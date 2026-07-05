# TiendaOS - Reparar inicio automatico (Windows)
# Para computadoras que YA tienen TiendaOS instalado en C:\TiendaOS.
# Corrige: el servidor no arranca despues de reiniciar / se apaga solo.
#
# Ejecutar como Administrador:
#   Set-ExecutionPolicy Bypass -Scope Process -Force
#   .\fix_autostart_windows.ps1

param()
$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  TiendaOS - Reparar inicio automatico" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# Check admin
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "ERROR: Ejecuta PowerShell como Administrador" -ForegroundColor Red
    Read-Host "Presiona Enter para salir"
    exit 1
}

# Check existing install
if (-not (Test-Path "C:\TiendaOS\backend\.venv\Scripts\uvicorn.exe")) {
    Write-Host "ERROR: No se encontro TiendaOS en C:\TiendaOS." -ForegroundColor Red
    Write-Host "Usa el instalador completo (install_windows.ps1) primero." -ForegroundColor Yellow
    Read-Host "Presiona Enter para salir"
    exit 1
}

# Stop old task and any server already running on port 8000
Write-Host "--- Deteniendo servidor anterior ---"
Stop-ScheduledTask -TaskName "TiendaOS" -ErrorAction SilentlyContinue
Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue |
    ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
Start-Sleep -Seconds 2

# Rewrite start.bat with auto-restart loop and logging
Write-Host "--- Escribiendo start.bat ---"
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

# Re-register the startup task with correct settings
Write-Host "--- Registrando tarea de inicio ---"
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

# Start now
Write-Host "--- Iniciando servidor ---"
Start-ScheduledTask -TaskName "TiendaOS"
Start-Sleep -Seconds 5

# Verify
try {
    $resp = Invoke-WebRequest -Uri "http://localhost:8000/" -UseBasicParsing -TimeoutSec 10
    Write-Host ""
    Write-Host "======================================" -ForegroundColor Green
    Write-Host "  Listo! Servidor local funcionando." -ForegroundColor Green
    Write-Host "======================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "  POS local: http://localhost:8000" -ForegroundColor White
    Write-Host "  El servidor arranca solo al iniciar sesion" -ForegroundColor White
    Write-Host "  y se reinicia solo si falla." -ForegroundColor White
} catch {
    Write-Host ""
    Write-Host "El servidor no respondio todavia." -ForegroundColor Yellow
    Write-Host "Revisa el log: C:\TiendaOS\logs\server.log" -ForegroundColor Yellow
}
Write-Host ""
Read-Host "Presiona Enter para salir"
