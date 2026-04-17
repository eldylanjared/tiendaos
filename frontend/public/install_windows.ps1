# TiendaOS — Instalador para Windows
# Ejecutar como Administrador en PowerShell:
# Set-ExecutionPolicy Bypass -Scope Process -Force; .\install_windows.ps1

$REPO_URL = "https://github.com/eldylanjared/tiendaos.git"
$INSTALL_DIR = "C:\TiendaOS"

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  TiendaOS — Instalador Windows" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# Check admin
if (-NOT ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "ERROR: Ejecuta PowerShell como Administrador" -ForegroundColor Red
    exit 1
}

# Install dependencies via winget
function Install-IfMissing($cmd, $wingetId) {
    if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
        Write-Host "Instalando $wingetId..."
        winget install --id $wingetId -e --silent --accept-source-agreements --accept-package-agreements
        # Reload PATH
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    } else {
        Write-Host "  ${cmd}: OK"
    }
}

Write-Host "--- Instalando dependencias ---"
Install-IfMissing "git" "Git.Git"
Install-IfMissing "python3" "Python.Python.3.12"
Install-IfMissing "node" "OpenJS.NodeJS.LTS"

# Reload PATH after installs
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

# Clone or update
Write-Host ""
if (Test-Path "$INSTALL_DIR\.git") {
    Write-Host "--- Actualizando codigo ---"
    Set-Location $INSTALL_DIR
    git pull origin master
} else {
    Write-Host "--- Clonando repositorio ---"
    git clone $REPO_URL $INSTALL_DIR
}

# Backend setup
Write-Host ""
Write-Host "--- Configurando backend ---"
Set-Location "$INSTALL_DIR\backend"
python -m venv .venv
.\.venv\Scripts\pip install -r requirements.txt -q

if (-not (Test-Path "$INSTALL_DIR\backend\.env")) {
    Copy-Item "$INSTALL_DIR\.env.example" "$INSTALL_DIR\backend\.env"
    Write-Host ""
    Write-Host "IMPORTANTE: Edita $INSTALL_DIR\backend\.env con los datos de tu tienda:" -ForegroundColor Yellow
    Write-Host "  IS_LOCAL_INSTANCE=true"
    Write-Host "  STORE_ID=tienda-1"
    Write-Host "  STORE_NAME=Sucursal Centro"
    Write-Host "  CLOUD_API_URL=https://dylanlopez.com/api"
    Write-Host "  CLOUD_SYNC_USER=admin"
    Write-Host "  CLOUD_SYNC_PASSWORD=tu_password"
    notepad "$INSTALL_DIR\backend\.env"
    Read-Host "Presiona Enter cuando termines de editar el archivo .env"
}

# Frontend build
Write-Host ""
Write-Host "--- Construyendo frontend ---"
Set-Location "$INSTALL_DIR\frontend"
npm install --silent
npm run build

# Create startup batch file
$startScript = @"
@echo off
cd /d C:\TiendaOS\backend
.venv\Scripts\uvicorn app.main:app --host 0.0.0.0 --port 8000
"@
$startScript | Out-File -FilePath "C:\TiendaOS\start.bat" -Encoding ASCII

# Register as Windows startup task
$action = New-ScheduledTaskAction -Execute "C:\TiendaOS\start.bat"
$trigger = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet -Hidden
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -RunLevel Highest

Unregister-ScheduledTask -TaskName "TiendaOS" -Confirm:$false -ErrorAction SilentlyContinue
Register-ScheduledTask -TaskName "TiendaOS" -Action $action -Trigger $trigger -Settings $settings -Principal $principal | Out-Null

# Start now
Write-Host ""
Write-Host "--- Iniciando servidor ---"
Start-Process -FilePath "C:\TiendaOS\start.bat" -WindowStyle Minimized

Write-Host ""
Write-Host "======================================" -ForegroundColor Green
Write-Host "  Instalacion completa!" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Abrir POS: http://localhost:8000" -ForegroundColor White
Write-Host ""
Write-Host "  El sistema arranca automaticamente al iniciar Windows." -ForegroundColor Gray
Write-Host "  Para actualizar: ejecuta este script de nuevo." -ForegroundColor Gray
Write-Host ""
Start-Process "http://localhost:8000"
