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

function Copy-Tree {
    param([string]$Source, [string]$Destination, [switch]$Mirror)

    if (-not (Test-Path -LiteralPath $Source)) { Write-Warn "нет каталога: $Source"; return }
    $mode = if ($Mirror) { '/MIR' } else { '/E' }
    & robocopy $Source $Destination $mode /XD node_modules .git .dsh-market .plugin-manager /XF *.log /NFL /NDL /NJH /NJS /NP /R:1 /W:1 | Out-Null
    if ($LASTEXITCODE -ge 8) { throw "robocopy завершился с кодом $LASTEXITCODE ($Source -> $Destination)" }
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

function Get-DshVersion {
    try {
        $raw = & dsh -V 2>$null
        if ($raw) { return ($raw | Select-Object -First 1).ToString().Trim() }
    } catch { }
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

    $packageJson = Join-Path $RepoProfile 'package.json'
    if (Test-Path -LiteralPath $packageJson) { ConvertTo-PortableLinks -Path $packageJson }

    $version = Get-DshVersion
    if ($version) { [System.IO.File]::WriteAllText($VersionFile, $version + [Environment]::NewLine, (New-Object System.Text.UTF8Encoding($false))) }

    Write-Step 'Фиксирую изменения в git'
    & git -C $RepoRoot add -A
    if ($LASTEXITCODE -ne 0) { throw 'git add завершился с ошибкой' }
    $pending = & git -C $RepoRoot status --porcelain
    if (-not $pending) {
        Write-Ok 'изменений нет'
    } elseif ($NoCommit) {
        Write-Warn 'есть изменения, коммит пропущен (-NoCommit)'
    } else {
        if (-not $Message) { $Message = "sync: $([DateTime]::Now.ToString('yyyy-MM-dd HH:mm:ss'))" }
        & git -C $RepoRoot commit -m $Message | Out-Null
        if ($LASTEXITCODE -ne 0) { throw 'git commit завершился с ошибкой' }
        Write-Ok "закоммичено: $Message"
    }

    if ($NoPush) { Write-Warn 'отправка пропущена (-NoPush)'; return }
    $remote = & git -C $RepoRoot remote get-url origin 2>$null
    if (-not $remote) {
        Write-Warn 'удалённый репозиторий не настроен: git remote add origin <url>'
        return
    }
    & git -C $RepoRoot pull --rebase --autostash 2>&1 | Out-Null
    & git -C $RepoRoot push
    if ($LASTEXITCODE -ne 0) { throw 'git push завершился с ошибкой' }
    Write-Ok "отправлено в $remote"
}

function Invoke-Pull {
    if (-not (Test-Path -LiteralPath $RepoProfile)) { throw "в репозитории нет каталога profile: $RepoProfile" }

    $remote = & git -C $RepoRoot remote get-url origin 2>$null
    if ($remote) {
        Write-Step 'Забираю свежие изменения из git'
        & git -C $RepoRoot pull --ff-only 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) { Write-Warn 'git pull не удался (локальные правки?) — применяю то, что есть' }
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

    $packageJson = Join-Path $ProfileDir 'package.json'
    if (Test-Path -LiteralPath $packageJson) { ConvertTo-AbsoluteLinks -Path $packageJson -TargetProfileDir $ProfileDir }

    if ($NoInstall) { Write-Warn 'установка зависимостей пропущена (-NoInstall)'; return }
    Write-Step 'Ставлю зависимости профиля (dsh plugin install)'
    & dsh plugin --profile $ProfileName install
    if ($LASTEXITCODE -ne 0) { throw "dsh plugin install завершился с кодом $LASTEXITCODE" }
    Write-Ok 'готово, перезапустите DeepSeek Harness'
}

function Invoke-Status {
    Write-Step "Репозиторий: $RepoRoot"
    $remote = & git -C $RepoRoot remote get-url origin 2>$null
    if ($remote) { Write-Host "    origin: $remote" }
    $dirty = & git -C $RepoRoot status --porcelain
    if ($dirty) { Write-Host '    незакоммиченные изменения:'; $dirty | ForEach-Object { Write-Host "      $_" } }
    else { Write-Ok 'репозиторий чистый' }

    Write-Step "Сравниваю с профилем: $ProfileDir"
    foreach ($file in $PortableFiles) {
        $left = Join-Path $RepoProfile $file
        $right = Join-Path $ProfileDir $file
        if (-not (Test-Path -LiteralPath $left)) { Write-Host "    $file — нет в репозитории"; continue }
        if (-not (Test-Path -LiteralPath $right)) { Write-Host "    $file — нет в профиле"; continue }
        $normalized = [System.IO.File]::ReadAllText($left)
        $live = [System.IO.File]::ReadAllText($right)
        $live = [regex]::Replace($live, 'link:(?:[A-Za-z]:)?[^"]*?[/\\]created-plugins[/\\]([^"/\\]+)', 'link:./created-plugins/$1')
        if ($normalized -eq $live) { Write-Host "    $file — совпадает" } else { Write-Host "    $file — РАСХОДИТСЯ" -ForegroundColor Yellow }
    }
}

switch ($Command) {
    'push' { Invoke-Push }
    'pull' { Invoke-Pull }
    'status' { Invoke-Status }
}
