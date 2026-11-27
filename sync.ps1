[CmdletBinding()]
param(
    # Команда: push (компьютер -> репозиторий), pull (репозиторий -> компьютер), status (сравнить).
    [Parameter(Mandatory = $true, Position = 0)]
    [ValidateSet('push', 'pull', 'status')]
    [string]$Command,

    # Имя профиля DSH, которое синхронизируем.
    [string]$ProfileName = 'desktop',

    # Куда раскладывать профиль. По умолчанию %USERPROFILE%\.dsh\profiles\<ProfileName>.
    [string]$ProfileDir,

    # Каталог пользовательских скиллов. По умолчанию %USERPROFILE%\.dsh\skills.
    [string]$SkillsDir,

    # Сообщение коммита для push.
    [string]$Message,

    # pull: не выполнять dsh plugin install.
    [switch]$NoInstall,

    # push: только зафиксировать изменения, не коммитить.
    [switch]$NoCommit,

    # push: не отправлять в удалённый репозиторий.
    [switch]$NoPush
)

$ErrorActionPreference = 'Stop'
$RepoRoot = $PSScriptRoot
$RepoProfile = Join-Path $RepoRoot 'profile'
$RepoSkills = Join-Path $RepoRoot 'skills'
$VersionFile = Join-Path $RepoRoot 'DSH_VERSION'

if (-not $ProfileDir) {
    $ProfileDir = Join-Path (Join-Path (Join-Path $env:USERPROFILE '.dsh') 'profiles') $ProfileName
}
if (-not $SkillsDir) {
    $SkillsDir = Join-Path (Join-Path $env:USERPROFILE '.dsh') 'skills'
}

# Файлы профиля, из которых собирается конфигурация. node_modules восстанавливается pnpm.
$PortableFiles = @('package.json', 'pnpm-workspace.yaml', 'pnpm-lock.yaml', 'cordis.yml', 'cordis.patch.yml')
$PortableDirs = @('plugins', 'created-plugins')

function Write-Step([string]$Text) { Write-Host "==> $Text" -ForegroundColor Cyan }
function Write-Warn([string]$Text) { Write-Host "!   $Text" -ForegroundColor Yellow }
function Write-Ok([string]$Text) { Write-Host "OK  $Text" -ForegroundColor Green }

function Invoke-Native {
    # Запускает внешнюю команду так, чтобы её stderr не превращался в terminating error (PowerShell 5.1).
    param(
        [string]$FilePath,
        [string[]]$Arguments,
        [switch]$ShowOutput
    )

    $previous = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $lines = @(& $FilePath @Arguments 2>&1 | ForEach-Object { "$_" })
        $code = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $previous
    }
    if ($ShowOutput) { $lines | ForEach-Object { Write-Host "    $_" } }
    return [pscustomobject]@{ Output = ($lines -join [Environment]::NewLine); ExitCode = $code }
}

function Invoke-Git {
    # Возвращает текст вывода git; $null, если команда завершилась с ошибкой.
    param([string[]]$GitArgs)
    $result = Invoke-Native -FilePath 'git' -Arguments $GitArgs
    if ($result.ExitCode -ne 0) { return $null }
    return $result.Output.Trim()
}

function Copy-Tree {
    param([string]$Source, [string]$Destination, [switch]$Mirror)

    if (-not (Test-Path -LiteralPath $Source)) { Write-Warn "нет каталога: $Source"; return }
    $mode = if ($Mirror) { '/MIR' } else { '/E' }
    $result = Invoke-Native -FilePath 'robocopy' -Arguments @(
        $Source, $Destination, $mode,
        '/XD', 'node_modules', '.git', '.dsh-market', '.plugin-manager',
        '/XF', '*.log', '/NFL', '/NDL', '/NJH', '/NJS', '/NP', '/R:1', '/W:1'
    )
    if ($result.ExitCode -ge 8) { throw "robocopy завершился с кодом $($result.ExitCode) ($Source -> $Destination)" }
}

function ConvertTo-PortableLinks {
    param([string]$Path)
    $text = [System.IO.File]::ReadAllText($Path)
    # Абсолютный link: на локальный плагин -> относительный (переносимо между машинами).
    $normalized = [regex]::Replace($text, 'link:(?:[A-Za-z]:)?[^"]*?[/\\]created-plugins[/\\]([^"/\\]+)', 'link:./created-plugins/$1')
    if ($normalized -ne $text) {
        [System.IO.File]::WriteAllText($Path, $normalized, (New-Object System.Text.UTF8Encoding($false)))
        Write-Ok 'ссылки на локальные плагины переписаны в относительные'
    }
}

function ConvertTo-AbsoluteLinks {
    param([string]$Path, [string]$TargetProfileDir)
    $text = [System.IO.File]::ReadAllText($Path)
    $base = ($TargetProfileDir -replace '\\', '/').TrimEnd('/')
    $restored = [regex]::Replace($text, 'link:\./created-plugins/', "link:$base/created-plugins/")
    if ($restored -ne $text) {
        [System.IO.File]::WriteAllText($Path, $restored, (New-Object System.Text.UTF8Encoding($false)))
    }
}

function Resolve-DshCli {
    # Ищет CLI: сначала PATH, затем клиент, который ставит Desktop.
    $command = Get-Command dsh -ErrorAction SilentlyContinue
    if ($command) { return $command.Source }
    $candidates = @(
        (Join-Path $env:LOCALAPPDATA 'Programs\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd'),
        (Join-Path $env:LOCALAPPDATA 'Programs\DeepSeek Harness\resources\runtime\cli\bin\dsh.ps1')
    )
    foreach ($candidate in $candidates) {
        if (Test-Path -LiteralPath $candidate) { return $candidate }
    }
    return $null
}

function Get-DshVersion {
    $cli = Resolve-DshCli
    if ($cli) {
        $result = Invoke-Native -FilePath $cli -Arguments @('-V')
        if ($result.ExitCode -eq 0 -and $result.Output.Trim()) {
            return $result.Output.Trim().Split("`n")[0].Trim()
        }
    }
    $candidate = Join-Path $env:LOCALAPPDATA 'Programs\DeepSeek Harness\resources\app.asar\dsh\node_modules\@deepseek-ai\dsh\package.json'
    if (Test-Path -LiteralPath $candidate) { return (Get-Content -LiteralPath $candidate -Raw | ConvertFrom-Json).version }
    return $null
}

function Invoke-Push {
    Write-Step "Копирую конфигурацию из профиля: $ProfileDir"

    if (-not (Test-Path -LiteralPath $ProfileDir)) { throw "профиль не найден: $ProfileDir" }
    New-Item -ItemType Directory -Path $RepoProfile -Force | Out-Null
    New-Item -ItemType Directory -Path $RepoSkills -Force | Out-Null

    foreach ($file in $PortableFiles) {
        $source = Join-Path $ProfileDir $file
        if (Test-Path -LiteralPath $source) {
            Copy-Item -LiteralPath $source -Destination (Join-Path $RepoProfile $file) -Force
        } else {
            Write-Warn "в профиле нет $file"
        }
    }
    foreach ($dir in $PortableDirs) {
        Copy-Tree -Source (Join-Path $ProfileDir $dir) -Destination (Join-Path $RepoProfile $dir) -Mirror
    }
    Copy-Tree -Source $SkillsDir -Destination $RepoSkills -Mirror

    $linkFiles = @('package.json', 'pnpm-lock.yaml')
    foreach ($name in $linkFiles) {
        $path = Join-Path $RepoProfile $name
        if (Test-Path -LiteralPath $path) { ConvertTo-PortableLinks -Path $path }
    }

    $version = Get-DshVersion
    if ($version) {
        [System.IO.File]::WriteAllText($VersionFile, $version + [Environment]::NewLine, (New-Object System.Text.UTF8Encoding($false)))
    }

    Write-Step 'Фиксирую изменения в git'
    if ($null -eq (Invoke-Git -GitArgs @('-C', $RepoRoot, 'add', '-A'))) { throw 'git add завершился с ошибкой' }
    $pending = Invoke-Git -GitArgs @('-C', $RepoRoot, 'status', '--porcelain')
    if (-not $pending) {
        Write-Ok 'изменений нет'
    } elseif ($NoCommit) {
        Write-Warn 'есть изменения, коммит пропущен (-NoCommit)'
    } else {
        if (-not $Message) { $Message = "sync: $([DateTime]::Now.ToString('yyyy-MM-dd HH:mm:ss'))" }
        if ($null -eq (Invoke-Git -GitArgs @('-C', $RepoRoot, 'commit', '-m', $Message))) { throw 'git commit завершился с ошибкой' }
        Write-Ok "закоммичено: $Message"
    }

    if ($NoPush) { Write-Warn 'отправка пропущена (-NoPush)'; return }
    $remote = Invoke-Git -GitArgs @('-C', $RepoRoot, 'remote', 'get-url', 'origin')
    if (-not $remote) {
        Write-Warn 'удалённый репозиторий не настроен: git remote add origin <url>'
        return
    }
    Invoke-Git -GitArgs @('-C', $RepoRoot, 'pull', '--rebase', '--autostash') | Out-Null
    $push = Invoke-Native -FilePath 'git' -Arguments @('-C', $RepoRoot, 'push') -ShowOutput
    if ($push.ExitCode -ne 0) {
        Write-Warn 'git push не удался. Если это приватный репозиторий — нужна авторизация GitHub на этой машине:'
        Write-Warn '  gh auth login   (или)   git config --global credential.helper manager'
        throw 'git push завершился с ошибкой'
    }
    Write-Ok "отправлено в $remote"
}

function Invoke-Pull {
    if (-not (Test-Path -LiteralPath $RepoProfile)) { throw "в репозитории нет каталога profile: $RepoProfile" }

    if (-not (Test-Path -LiteralPath $ProfileDir)) {
        Write-Warn "профиль не найден: $ProfileDir"
        Write-Warn 'сначала запустите DeepSeek Harness один раз — он создаст профиль, — затем повторите pull'
        throw 'профиль DSH ещё не создан'
    }

    $remote = Invoke-Git -GitArgs @('-C', $RepoRoot, 'remote', 'get-url', 'origin')
    if ($remote) {
        Write-Step 'Забираю свежие изменения из git'
        if ($null -eq (Invoke-Git -GitArgs @('-C', $RepoRoot, 'pull', '--ff-only'))) {
            Write-Warn 'git pull не удался (нет авторизации или локальные правки) — применяю то, что есть'
        }
    }

    if (Test-Path -LiteralPath $VersionFile) {
        $repoVersion = (Get-Content -LiteralPath $VersionFile -Raw).Trim()
        $localVersion = Get-DshVersion
        if ($repoVersion -and $localVersion -and $repoVersion -ne $localVersion) {
            Write-Warn "версии DSH различаются: в репозитории $repoVersion, локально $localVersion"
            Write-Warn 'обновите Desktop до той же версии, иначе плагины могут не встать'
        }
    }

    Write-Step "Раскладываю конфигурацию в профиль: $ProfileDir"
    New-Item -ItemType Directory -Path $ProfileDir -Force | Out-Null

    $stamp = [DateTime]::Now.ToString('yyyyMMdd-HHmmss')
    foreach ($name in @('package.json', 'cordis.patch.yml')) {
        $current = Join-Path $ProfileDir $name
        if (Test-Path -LiteralPath $current) { Copy-Item -LiteralPath $current -Destination "$current.bak-$stamp" -Force }
    }

    foreach ($file in $PortableFiles) {
        $source = Join-Path $RepoProfile $file
        if (Test-Path -LiteralPath $source) { Copy-Item -LiteralPath $source -Destination (Join-Path $ProfileDir $file) -Force }
    }
    foreach ($dir in $PortableDirs) {
        Copy-Tree -Source (Join-Path $RepoProfile $dir) -Destination (Join-Path $ProfileDir $dir)
    }
    Copy-Tree -Source $RepoSkills -Destination $SkillsDir

    $linkFiles = @('package.json', 'pnpm-lock.yaml')
    foreach ($name in $linkFiles) {
        $path = Join-Path $ProfileDir $name
        if (Test-Path -LiteralPath $path) { ConvertTo-AbsoluteLinks -Path $path -TargetProfileDir $ProfileDir }
    }

    if ($NoInstall) { Write-Warn 'установка зависимостей пропущена (-NoInstall)'; return }
    $cli = Resolve-DshCli
    if (-not $cli) {
        Write-Warn 'не нашёл CLI DeepSeek Harness (команда dsh)'
        Write-Warn 'установите его через меню приложения: Manage dsh Command, затем повторите: dsh plugin --profile ' + $ProfileName + ' install'
        return
    }
    Write-Step "Ставлю зависимости профиля (dsh plugin install): $cli"
    $install = Invoke-Native -FilePath $cli -Arguments @('plugin', '--profile', $ProfileName, 'install') -ShowOutput
    if ($install.ExitCode -ne 0) { throw "dsh plugin install завершился с кодом $($install.ExitCode)" }
    Write-Ok 'готово, перезапустите DeepSeek Harness'
}

function Invoke-Status {
    Write-Step "Репозиторий: $RepoRoot"
    $remote = Invoke-Git -GitArgs @('-C', $RepoRoot, 'remote', 'get-url', 'origin')
    if ($remote) { Write-Host "    origin: $remote" }
    $dirty = Invoke-Git -GitArgs @('-C', $RepoRoot, 'status', '--porcelain')
    if ($dirty) {
        Write-Host '    незакоммиченные изменения:'
        $dirty.Split("`n") | ForEach-Object { Write-Host "      $($_.TrimEnd())" }
    } else {
        Write-Ok 'репозиторий чистый'
    }

    Write-Step "Сравниваю с профилем: $ProfileDir"
    foreach ($file in $PortableFiles) {
        $left = Join-Path $RepoProfile $file
        $right = Join-Path $ProfileDir $file
        if (-not (Test-Path -LiteralPath $left)) { Write-Host "    $file — нет в репозитории"; continue }
        if (-not (Test-Path -LiteralPath $right)) { Write-Host "    $file — нет в профиле"; continue }
        $normalized = [System.IO.File]::ReadAllText($left)
        $live = [System.IO.File]::ReadAllText($right)
        $live = [regex]::Replace($live, 'link:(?:[A-Za-z]:)?[^"]*?[/\\]created-plugins[/\\]([^"/\\]+)', 'link:./created-plugins/$1')
        if ($normalized -eq $live) { Write-Host "    $file — совпадает" }
        else { Write-Host "    $file — РАСХОДИТСЯ" -ForegroundColor Yellow }
    }
}

switch ($Command) {
    'push' { Invoke-Push }
    'pull' { Invoke-Pull }
    'status' { Invoke-Status }
}
