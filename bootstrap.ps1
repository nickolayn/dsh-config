[CmdletBinding()]
param(
    # Куда положить клон репозитория.
    [string]$Target = (Join-Path $env:USERPROFILE 'dsh-config'),

    [string]$RepoUrl = 'https://github.com/nickolayn/dsh-config.git',

    # Имя профиля DSH.
    [string]$ProfileName = 'desktop',

    # Переопределить каталог профиля (для проверки на копии).
    [string]$ProfileDir,

    # Не устанавливать зависимости (только файлы).
    [switch]$NoInstall,

    # Если профиля ещё нет — запустить приложение, дождаться его создания и закрыть.
    [switch]$CreateProfile
)

$ErrorActionPreference = 'Stop'

function Write-Step([string]$Text) { Write-Host "==> $Text" -ForegroundColor Cyan }
function Write-Warn([string]$Text) { Write-Host "!   $Text" -ForegroundColor Yellow }
function Write-Ok([string]$Text) { Write-Host "OK  $Text" -ForegroundColor Green }

function Invoke-Native {
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

function Get-DshExe {
    $candidates = @(
        (Join-Path $env:LOCALAPPDATA 'Programs\DeepSeek Harness\DeepSeek Harness.exe'),
        (Join-Path $env:PROGRAMFILES 'DeepSeek Harness\DeepSeek Harness.exe')
    )
    foreach ($candidate in $candidates) { if (Test-Path -LiteralPath $candidate) { return $candidate } }
    return $null
}

Write-Host '=== DeepSeek Harness: развёртывание конфигурации на этом компьютере ===' -ForegroundColor White
Write-Host "    пользователь: $env:USERPROFILE"

# 1. git
Write-Step 'Проверяю git'
$git = Get-Command git -ErrorAction SilentlyContinue
if (-not $git) {
    Write-Warn 'git не найден. Установите Git for Windows: https://git-scm.com/download/win'
    Write-Warn 'после установки запустите этот скрипт снова'
    exit 1
}
Write-Ok "git $((Invoke-Native -FilePath 'git' -Arguments @('--version')).Output)"

# 2. credential helper: без него private-репозиторий не клонируется
Write-Step 'Проверяю авторизацию GitHub'
$helper = (Invoke-Native -FilePath 'git' -Arguments @('config', '--get', 'credential.helper')).Output.Trim()
if (-not $helper) {
    $gcm = @(
        'C:\Program Files\Git\mingw64\bin\git-credential-manager.exe',
        'C:\Program Files\Git\mingw64\libexec\git-core\git-credential-manager.exe'
    ) | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
    if ($gcm) {
        Invoke-Native -FilePath 'git' -Arguments @('config', '--global', 'credential.helper', 'manager') | Out-Null
        Write-Ok 'включил credential.helper=manager (окно входа откроется при клонировании)'
    } else {
        Write-Warn 'Git Credential Manager не найден — при клонировании потребуется токен GitHub'
    }
} else {
    Write-Ok "credential.helper = $helper"
}

# 3. клон или обновление
if (Test-Path -LiteralPath (Join-Path $Target '.git')) {
    Write-Step "Обновляю существующий клон: $Target"
    $pull = Invoke-Native -FilePath 'git' -Arguments @('-C', $Target, 'pull', '--ff-only') -ShowOutput
    if ($pull.ExitCode -ne 0) {
        Write-Warn 'обновление не удалось — применяю то, что уже есть локально'
    }
} else {
    Write-Step "Клонирую $RepoUrl"
    Write-Host "    в $Target"
    $clone = Invoke-Native -FilePath 'git' -Arguments @('clone', $RepoUrl, $Target) -ShowOutput
    if ($clone.ExitCode -ne 0) {
        Write-Warn 'клон не удался.'
        if ($clone.Output -match 'Repository not found') {
            Write-Warn 'GitHub отвечает "Repository not found" на приватный репозиторий, если нет входа.'
            Write-Warn 'Варианты:'
            Write-Warn '  1) git config --global credential.helper manager    затем повторить запуск скрипта'
            Write-Warn '  2) gh auth login                                     затем повторить запуск скрипта'
            Write-Warn '  3) скачать ZIP в браузере, где вы вошли в GitHub:'
            Write-Warn '     https://github.com/nickolayn/dsh-config/archive/refs/heads/main.zip'
            Write-Warn "     распаковать в $Target и запустить скрипт снова"
            Write-Warn '  4) если в хранилище Windows чужой аккаунт:  cmdkey /delete:git:https://github.com'
        }
        exit 2
    }
}

$syncScript = Join-Path $Target 'sync.ps1'
if (-not (Test-Path -LiteralPath $syncScript)) { throw "в клоне нет sync.ps1: $Target" }

# 4. профиль DSH должен существовать до раскладки файлов
if (-not $ProfileDir) { $ProfileDir = Join-Path (Join-Path (Join-Path $env:USERPROFILE '.dsh') 'profiles') $ProfileName }
if (-not (Test-Path -LiteralPath $ProfileDir)) {
    $exe = Get-DshExe
    if (-not $exe) {
        Write-Warn 'DeepSeek Harness не установлен. Установите его той же версии, что в DSH_VERSION репозитория.'
        exit 3
    }
    if (-not $CreateProfile) {
        Write-Warn "профиль не найден: $ProfileDir"
        Write-Warn 'запустите DeepSeek Harness один раз, закройте его и запустите этот скрипт снова'
        Write-Warn 'или запустите скрипт с ключом -CreateProfile — он сделает это сам'
        exit 3
    }
    Write-Step 'Профиля нет — запускаю приложение, чтобы он создался'
    Start-Process -FilePath $exe | Out-Null
    $deadline = [DateTime]::Now.AddSeconds(150)
    while (-not (Test-Path -LiteralPath $ProfileDir) -and [DateTime]::Now -lt $deadline) { Start-Sleep -Seconds 2 }
    if (-not (Test-Path -LiteralPath $ProfileDir)) {
        Write-Warn 'профиль так и не появился; проверьте приложение и повторите запуск'
        exit 3
    }
    Write-Ok 'профиль создан, закрываю приложение'
    Get-Process -Name 'DeepSeek Harness' -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 3
}

# 5. раскладка конфигурации и зависимости
Write-Step 'Применяю конфигурацию профиля'
$defaultProfileDir = Join-Path (Join-Path (Join-Path $env:USERPROFILE '.dsh') 'profiles') $ProfileName
if ($ProfileDir -ne $defaultProfileDir -and -not $NoInstall) {
    Write-Warn 'задан нестандартный каталог профиля — установку зависимостей пропускаю'
    $NoInstall = $true
}
if (Get-Process -Name 'DeepSeek Harness' -ErrorAction SilentlyContinue) {
    Write-Warn 'приложение запущено: если установка зависимостей не удастся, закройте его и повторите pull'
}
$syncParams = @{ Command = 'pull'; ProfileName = $ProfileName; ProfileDir = $ProfileDir }
if ($NoInstall) { $syncParams['NoInstall'] = $true }
& $syncScript @syncParams
if (-not $?) { Write-Warn 'sync.ps1 завершился с ошибкой — смотрите сообщения выше'; exit 4 }

# 6. итог
Write-Host ''
Write-Host '=== Готово ===' -ForegroundColor Green
Write-Host "1. Запустите DeepSeek Harness"
Write-Host '2. Settings -> Providers: введите ключ API (в git он не хранится)'
Write-Host "3. Если нужен GigaChat — поднимите локальный шлюз на 127.0.0.1:8877"
Write-Host "4. Дальше: cd `"$Target`"; .\sync.ps1 status | push | pull"
