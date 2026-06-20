# deploy_sherman.ps1 — Register GEN SHERMAN auto-start and launch backend
# Run once: powershell -ExecutionPolicy Bypass -File deploy_sherman.ps1

$ErrorActionPreference = "Stop"

$BackendDir  = "$PSScriptRoot\backend"
$PythonExe   = (Get-Command python -ErrorAction SilentlyContinue).Source
if (-not $PythonExe) {
    Write-Host "Python not found in PATH." -ForegroundColor Red
    exit 1
}

$TaskName    = "BERYL_GEN_SHERMAN"
$StartScript = "$PSScriptRoot\start_sherman_bg.bat"

$batchContent = "@echo off`r`ncd /d `"$BackendDir`"`r`nstart /min `"`" `"$PythonExe`" -m uvicorn main:app --host 127.0.0.1 --port 8001 --log-level warning`r`n"
[System.IO.File]::WriteAllText($StartScript, $batchContent, [System.Text.Encoding]::ASCII)

Write-Host "Launcher: $StartScript" -ForegroundColor Cyan

$RegKey  = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
$RegName = "BERYL_GEN_SHERMAN"
Set-ItemProperty -Path $RegKey -Name $RegName -Value "`"$StartScript`"" -Force
Write-Host "Auto-start registered in HKCU Run key: $RegName" -ForegroundColor Green

$alreadyUp = $false
try {
    $r = Invoke-WebRequest -Uri "http://127.0.0.1:8001/security/daemon/status" -TimeoutSec 2 -ErrorAction SilentlyContinue
    if ($r.StatusCode -eq 200) { $alreadyUp = $true }
} catch {
    $alreadyUp = $false
}

if ($alreadyUp) {
    Write-Host "Backend already running on :8001 -- GEN SHERMAN is LIVE." -ForegroundColor Green
} else {
    Write-Host "Starting backend..." -ForegroundColor Cyan
    Start-Process -FilePath $StartScript -WindowStyle Hidden

    $tries = 0
    $up = $false
    while ($tries -lt 15) {
        Start-Sleep -Seconds 2
        try {
            $r = Invoke-WebRequest -Uri "http://127.0.0.1:8001/security/daemon/status" -TimeoutSec 2 -ErrorAction Stop
            if ($r.StatusCode -eq 200) {
                $status = $r.Content | ConvertFrom-Json
                Write-Host "GEN SHERMAN LIVE. Threat level: $($status.threat_level)" -ForegroundColor Green
                $up = $true
                break
            }
        } catch { }
        $tries++
    }
    if (-not $up) {
        Write-Host "Backend did not respond after 30s. Check backend logs." -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "GEN SHERMAN DEPLOYED" -ForegroundColor Yellow
Write-Host "  Posture check : every 30s" -ForegroundColor White
Write-Host "  Full sweep    : every 5min" -ForegroundColor White
Write-Host "  Alerts        : HIGH + CRITICAL" -ForegroundColor White
Write-Host "  Auto-start    : ONLOGON task $TaskName" -ForegroundColor White
Write-Host "  Logs          : $BackendDir\sherman_log.jsonl" -ForegroundColor White
Write-Host "  Dashboard     : BERYL HF -> GEN SHERMAN -> DAEMON tab" -ForegroundColor White
