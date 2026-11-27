[CmdletBinding()]
param(
    [string]$RepoRoot,
    [string]$ProfileName = 'desktop',
    [string]$ProfileDir,
    [string]$SkillsDir,

    # Записать отчёт в репозиторий и отправить его на GitHub (тогда состояние
    # рабочей машины можно проверить с другой машины).
    [switch]$Publish
)

$ErrorActionPreference = 'Stop'

# $PSScriptRoot как значение параметра по умолчанию пуст в PowerShell 5.1, поэтому здесь.
if (-not $RepoRoot) { $RepoRoot = $PSScriptRoot }
if (-not $RepoRoot) { $RepoRoot = (Get-Location).Path }

if (-not $ProfileDir) { $ProfileDir = Join-Path (Join-Path (Join-Path $env:USERPROFILE '.dsh') 'profiles') $ProfileName }
if (-not $SkillsDir) { $SkillsDir = Join-Path (Join-Path $env:USERPROFILE '.dsh') 'skills' }

$checks = New-Object System.Collections.Generic.List[object]

function Write-Step([string]$Text) { Write-Host "==> $Text" -ForegroundColor Cyan }
function Write-Warn([string]$Text) { Write-Host "!   $Text" -ForegroundColor Yellow }
function Write-Ok([string]$Text) { Write-Host "OK  $Text" -ForegroundColor Green }

function Invoke-Native {
    param([string]$FilePath, [string[]]$Arguments)
    $previous = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $lines = @(& $FilePath @Arguments 2>&1 | ForEach-Object { "$_" })
        $code = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $previous
    }
    return [pscustomobject]@{ Output = ($lines -join "`n").Trim(); ExitCode = $code }
}

function Add-Check {
    param([string]$Name, [string]$Status, [string]$Detail)
    $checks.Add([pscustomobject]@{ name = $Name; status = $Status; detail = $Detail })
    switch ($Status) {
        'ok' { Write-Ok "$Name — $Detail" }
        'warn' { Write-Warn "$Name — $Detail" }
        'fail' { Write-Host "FAIL $Name — $Detail" -ForegroundColor Red }
    }
}

function Resolve-DshCli {
    $command = Get-Command dsh -ErrorAction SilentlyContinue
    if ($command) { return $command.Source }
    $candidates = @(
        (Join-Path $env:LOCALAPPDATA 'Programs\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd'),
        (Join-Path $env:LOCALAPPDATA 'Programs\DeepSeek Harness\resources\runtime\cli\bin\dsh.ps1')
    )
    foreach ($candidate in $candidates) { if (Test-Path -LiteralPath $candidate) { return $candidate } }
    return $null
}

function Normalize-Links([string]$Text) {
    return [regex]::Replace($Text, 'link:(?:[A-Za-z]:)?[^"]*?[/\\]created-plugins[/\\]([^"/\\]+)', 'link:./created-plugins/$1')
}

Write-Host "=== Проверка установки DSH ===" -ForegroundColor White

# 1. Репозиторий
$remote = (Invoke-Native -FilePath 'git' -Arguments @('-C', $RepoRoot, 'remote', 'get-url', 'origin')).Output
if ($remote) { Add-Check 'репозиторий' 'ok' $remote } else { Add-Check 'репозиторий' 'fail' 'origin не настроен' }

$head = (Invoke-Native -FilePath 'git' -Arguments @('-C', $RepoRoot, 'rev-parse', '--short', 'HEAD')).Output
$branch = (Invoke-Native -FilePath 'git' -Arguments @('-C', $RepoRoot, 'rev-parse', '--abbrev-ref', 'HEAD')).Output
$dirty = (Invoke-Native -FilePath 'git' -Arguments @('-C', $RepoRoot, 'status', '--porcelain')).Output
if ($dirty) { Add-Check 'репозиторий чистый' 'warn' 'есть незакоммиченные изменения' }
else { Add-Check 'репозиторий чистый' 'ok' "$branch @ $head" }

# 2. Версия DSH
$expectedVersion = if (Test-Path -LiteralPath (Join-Path $RepoRoot 'DSH_VERSION')) {
    (Get-Content -LiteralPath (Join-Path $RepoRoot 'DSH_VERSION') -Raw).Trim()
} else { $null }
$cli = Resolve-DshCli
$dshVersion = $null
if ($cli) {
    $result = Invoke-Native -FilePath $cli -Arguments @('-V')
    if ($result.ExitCode -eq 0) { $dshVersion = $result.Output.Split("`n")[0].Trim() }
    Add-Check 'CLI dsh' 'ok' $cli
} else {
    Add-Check 'CLI dsh' 'fail' 'не найден ни в PATH, ни в Desktop'
}
if ($expectedVersion -and $dshVersion) {
    if ($expectedVersion -eq $dshVersion) { Add-Check 'версия DSH' 'ok' $dshVersion }
    else { Add-Check 'версия DSH' 'warn' "в репозитории $expectedVersion, локально $dshVersion" }
}

# 3. Файлы профиля
if (-not (Test-Path -LiteralPath $ProfileDir)) {
    Add-Check 'профиль' 'fail' "нет каталога $ProfileDir"
} else {
    $missing = @()
    $differs = @()
    foreach ($file in @('package.json', 'pnpm-lock.yaml', 'cordis.patch.yml', 'cordis.yml', 'pnpm-workspace.yaml')) {
        $live = Join-Path $ProfileDir $file
        $repo = Join-Path (Join-Path $RepoRoot 'profile') $file
        if (-not (Test-Path -LiteralPath $live)) { $missing += $file; continue }
        if (Test-Path -LiteralPath $repo) {
            if ((Normalize-Links ([System.IO.File]::ReadAllText($repo))) -ne (Normalize-Links ([System.IO.File]::ReadAllText($live)))) { $differs += $file }
        }
    }
    if ($missing) { Add-Check 'файлы профиля' 'fail' "нет: $($missing -join ', ')" }
    elseif ($differs) { Add-Check 'файлы профиля' 'warn' "расходятся с репозиторием: $($differs -join ', ')" }
    else { Add-Check 'файлы профиля' 'ok' 'совпадают с репозиторием' }
}

# 4. Зависимости профиля
$nodeModules = Join-Path $ProfileDir 'node_modules'
if (-not (Test-Path -LiteralPath $nodeModules)) {
    Add-Check 'зависимости' 'fail' 'нет node_modules — выполните: .\sync.ps1 pull'
} else {
    $packages = @('dshmarket', 'dsh-kimino-theme', 'dsh-whale-widget', 'dsh-token-viewer')
    $absent = @($packages | Where-Object { -not (Test-Path -LiteralPath (Join-Path $nodeModules $_)) })
    $localViews = @(Get-ChildItem -LiteralPath (Join-Path $nodeModules '@dsh-local') -ErrorAction SilentlyContinue)
    if ($absent) { Add-Check 'зависимости' 'fail' "не установлены: $($absent -join ', ')" }
    elseif (-not $localViews) { Add-Check 'зависимости' 'fail' 'нет локального плагина @dsh-local/*' }
    else { Add-Check 'зависимости' 'ok' "пакетов: $($packages.Count + $localViews.Count)" }
}

# 5. Скилл
$skill = Join-Path (Join-Path $SkillsDir 'legal-ru') 'SKILL.md'
$repoSkill = Join-Path (Join-Path (Join-Path $RepoRoot 'skills') 'legal-ru') 'SKILL.md'
if (-not (Test-Path -LiteralPath $skill)) { Add-Check 'скилл legal-ru' 'fail' "нет $skill" }
elseif ((Test-Path -LiteralPath $repoSkill) -and ((Get-FileHash $skill).Hash -ne (Get-FileHash $repoSkill).Hash)) {
    Add-Check 'скилл legal-ru' 'warn' 'версия отличается от репозитория'
} else { Add-Check 'скилл legal-ru' 'ok' 'на месте' }

# 6. Итог
$failed = @($checks | Where-Object { $_.status -eq 'fail' })
$warned = @($checks | Where-Object { $_.status -eq 'warn' })
Write-Host ''
if ($failed.Count -eq 0) {
    if ($warned.Count) { Write-Host "Итог: всё на месте, предупреждений — $($warned.Count)" -ForegroundColor Green }
    else { Write-Host 'Итог: всё на месте' -ForegroundColor Green }
}
else { Write-Host "Итог: проблем — $($failed.Count). Исправьте и повторите проверку." -ForegroundColor Red }

# 7. Публикация отчёта
if ($Publish) {
    $reportDir = Join-Path $RepoRoot 'verify'
    New-Item -ItemType Directory -Path $reportDir -Force | Out-Null
    $report = [pscustomobject]@{
        machine     = $env:COMPUTERNAME
        user        = $env:USERNAME
        checkedAt   = [DateTime]::Now.ToString('yyyy-MM-ddTHH:mm:sszzz')
        os          = [System.Environment]::OSVersion.VersionString
        dshVersion  = $dshVersion
        repoHead    = $head
        branch      = $branch
        clean       = (-not $dirty)
        failed      = $failed.Count
        warned      = $warned.Count
        checks      = $checks
    }
    $reportPath = Join-Path $reportDir 'last.json'
    [System.IO.File]::WriteAllText($reportPath, ($report | ConvertTo-Json -Depth 4), (New-Object System.Text.UTF8Encoding($false)))
    Write-Step "Отчёт записан: $reportPath"
    Invoke-Native -FilePath 'git' -Arguments @('-C', $RepoRoot, 'add', 'verify/last.json') | Out-Null
    Invoke-Native -FilePath 'git' -Arguments @('-C', $RepoRoot, 'commit', '-m', "verify: $env:COMPUTERNAME $([DateTime]::Now.ToString('yyyy-MM-dd HH:mm'))") | Out-Null
    $push = Invoke-Native -FilePath 'git' -Arguments @('-C', $RepoRoot, 'push')
    if ($push.ExitCode -eq 0) { Write-Ok 'отчёт отправлен на GitHub' }
    else { Write-Warn "отправить не удалось (нет авторизации?): $($push.Output)" }
}

if ($failed.Count -gt 0) { exit 1 }
exit 0
