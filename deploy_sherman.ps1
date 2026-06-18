# deploy_sherman.ps1
# Registers GEN SHERMAN (BERYL HF backend) as a Windows startup task,
# then starts it immediately.
# Run once: powershell -ExecutionPolicy Bypass -File deploy_sherman.ps1

$ErrorActionPreference = "Stop"

$BackendDir  = "$PSScriptRoot\backend"
$PythonExe   = (Get-Command python -ErrorAction SilentlyContinue).Source
if (-not $PythonExe) {
    Write-Host "Python not found in PATH. Install Python 3.10+ and re-run." -ForegroundColor Red
    exit 1
}

$TaskName    = "BERYL_GEN_SHERMAN"
$StartScript = "$PSScriptRoot\start_sherman_bg.bat"

# Create a hidden launcher batch file
$batchContent = "@echo off`r`ncd /d `"$BackendDir`"`r`nstart /min `"`" `"$PythonExe`" -m uvicorn main:app --host 127.0.0.1 --port 8001 --log-level warning`r`n"
[System.IO.File]::WriteAllText($StartScript, $batchContent, [System.Text.Encoding]::ASCII)

Write-Host "Launcher created: $StartScript" -ForegroundColor Cyan

# Remove old task if it exists, then create new one
$existing = schtasks /query /tn $TaskName 2>$null
if ($existing) {
    schtasks /delete /tn $TaskName /f | Out-Null
    Write-Host "Removed old task: $TaskName" -ForegroundColor Yellow
}

schtasks /create /tn $TaskName /tr "`"$StartScript`"" /sc ONLOGON /rl HIGHEST /f /ru "$env:USERNAME" | Out-Null
Write-Host "Task registered: $TaskName (runs at every logon)" -ForegroundColor Green

# Check if already running
$alreadyUp = $false
try {
    $r = Invoke-WebRequest -Uri "http://127.0.0.1:8001/security/daemon/status" -TimeoutSec 2 -ErrorAction SilentlyContinue
    if ($r.StatusCode -eq 200) { $alreadyUp = $true }
} catch {
    $alreadyUp = $false
}

if ($alreadyUp) {
    Write-Host "Backend already running on :8001 — daemon is live." -ForegroundColor Green
} else {
    Write-Host "Starting GEN SHERMAN backend now..." -ForegroundColor Cyan
    Start-Process -FilePath $StartScript -WindowStyle Hidden

    $tries = 0
    $up = $false
    while ($tries -lt 15) {
        Start-Sleep -Seconds 2
        try {
            $r = Invoke-WebRequest -Uri "http://127.0.0.1:8001/security/daemon/status" -TimeoutSec 2 -ErrorAction Stop
            if ($r.StatusCode -eq 200) {
                $status = $r.Content | ConvertFrom-Json
                Write-Host "GEN SHERMAN is LIVE. Threat level: $($status.threat_level)" -ForegroundColor Green
                $up = $true
                break
            }
        } catch {
            # keep trying
        }
        $tries++
    }
    if (-not $up) {
        Write-Host "Backend did not respond after 30s. Check logs in backend folder." -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "=====================================================" -ForegroundColor DarkGray
Write-Host "  GEN SHERMAN DEPLOYED" -ForegroundColor Yellow
Write-Host "  Posture check  : every 30 seconds" -ForegroundColor White
Write-Host "  Full sweep     : every 5 minutes" -ForegroundColor White
Write-Host "  Windows alerts : HIGH + CRITICAL threats" -ForegroundColor White
Write-Host "  Auto-start     : every Windows login (Task: $TaskName)" -ForegroundColor White
Write-Host "  Logs           : $BackendDir\sherman_log.jsonl" -ForegroundColor White
Write-Host "  Dashboard      : BERYL HF -> GEN SHERMAN tab -> DAEMON" -ForegroundColor White
Write-Host "=====================================================" -ForegroundColor DarkGray
