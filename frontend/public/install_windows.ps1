# TiendaOS - Instalador Windows
# Ejecutar como Administrador:
# Set-ExecutionPolicy Bypass -Scope Process -Force
# .\tiendaos-install.ps1

param()
$ErrorActionPreference = "Stop"

$INSTALL_DIR = "C:\TiendaOS"
$REPO_URL = "https://github.com/eldylanjared/tiendaos.git"

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  TiendaOS - Instalador Windows" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# Check admin
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "ERROR: Ejecuta PowerShell como Administrador" -ForegroundColor Red
    Read-Host "Presiona Enter para salir"
    exit 1
}

function Has-Command($name) {
    return [bool](Get-Command $name -ErrorAction SilentlyContinue)
}

function Reload-Path {
    $machine = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
    $user    = [System.Environment]::GetEnvironmentVariable("Path", "User")
    $env:Path = $machine + ";" + $user
}

function Ensure-Installed($displayName, $cmd, $wingetId) {
    if (Has-Command $cmd) {
        Write-Host "  $displayName : OK" -ForegroundColor Green
        return
    }
    Write-Host "  Instalando $displayName ..." -ForegroundColor Yellow
    winget install --id $wingetId -e --silent --accept-source-agreements --accept-package-agreements
    Reload-Path
}

Write-Host "--- Verificando dependencias ---"
Ensure-Installed "Git"    "git"    "Git.Git"
Ensure-Installed "Python" "python" "Python.Python.3.12"
Ensure-Installed "Node"   "node"   "OpenJS.NodeJS.LTS"
Reload-Path

# Clone or update
Write-Host ""
if (Test-Path "$INSTALL_DIR\.git") {
    Write-Host "--- Actualizando codigo existente ---"
    Set-Location $INSTALL_DIR
    git pull origin master
} else {
    Write-Host "--- Clonando repositorio ---"
    git clone $REPO_URL $INSTALL_DIR
    Set-Location $INSTALL_DIR
}

# Backend setup
Write-Host ""
Write-Host "--- Configurando backend ---"
Set-Location "$INSTALL_DIR\backend"
python -m venv .venv
& ".\.venv\Scripts\pip.exe" install -r requirements.txt -q

# Create .env if missing
$envFile = "$INSTALL_DIR\backend\.env"
if (-not (Test-Path $envFile)) {
    Copy-Item "$INSTALL_DIR\.env.example" $envFile
    Write-Host ""
    Write-Host "IMPORTANTE: Configura el archivo .env con los datos de tu tienda." -ForegroundColor Yellow
    notepad $envFile
    Read-Host "Presiona Enter cuando hayas guardado el archivo .env"
}

# Frontend build
Write-Host ""
Write-Host "--- Construyendo frontend ---"
Set-Location "$INSTALL_DIR\frontend"
npm install --silent
npm run build

# Create start.bat using array to avoid here-string issues.
# The loop restarts uvicorn if it ever crashes; output goes to a log file.
$batLines = @(
    "@echo off",
    "cd /d C:\TiendaOS\backend",
    "if not exist C:\TiendaOS\logs mkdir C:\TiendaOS\logs",
    ":loop",
    "echo [%date% %time%] Iniciando TiendaOS >> C:\TiendaOS\logs\server.log",
    ".venv\Scripts\uvicorn app.main:app --host 0.0.0.0 --port 8000 >> C:\TiendaOS\logs\server.log 2>&1",
    "echo [%date% %time%] Servidor termino, reiniciando en 5s >> C:\TiendaOS\logs\server.log",
    "timeout /t 5 /nobreak > nul",
    "goto loop"
)
$batLines | Set-Content -Path "C:\TiendaOS\start.bat" -Encoding ASCII

# Register startup task
Write-Host ""
Write-Host "--- Registrando inicio automatico ---"
$action    = New-ScheduledTaskAction -Execute "C:\TiendaOS\start.bat"
$trigger   = New-ScheduledTaskTrigger -AtLogOn
# ExecutionTimeLimit Zero: sin esto Windows MATA la tarea a las 72 horas (default).
$settings  = New-ScheduledTaskSettingsSet -Hidden `
    -ExecutionTimeLimit ([TimeSpan]::Zero) `
    -RestartCount 10 -RestartInterval (New-TimeSpan -Minutes 1) `
    -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
    -MultipleInstances IgnoreNew
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -RunLevel Highest
Unregister-ScheduledTask -TaskName "TiendaOS" -Confirm:$false -ErrorAction SilentlyContinue
Register-ScheduledTask -TaskName "TiendaOS" -Action $action -Trigger $trigger -Settings $settings -Principal $principal | Out-Null
Write-Host "  TiendaOS arrancara automaticamente al iniciar sesion en Windows." -ForegroundColor Green
Write-Host "  Si el servidor falla, se reinicia solo. Logs: C:\TiendaOS\logs\server.log" -ForegroundColor Green

# Start now
Write-Host ""
Write-Host "--- Iniciando servidor ---"
Start-Process -FilePath "C:\TiendaOS\start.bat" -WindowStyle Minimized
Start-Sleep -Seconds 3

Write-Host ""
Write-Host "======================================" -ForegroundColor Green
Write-Host "  Instalacion completa!" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Green
Write-Host ""
Write-Host "  POS: http://localhost:8000" -ForegroundColor White
Write-Host ""
Start-Process "http://localhost:8000"
