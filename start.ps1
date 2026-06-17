# Start the Hugging Face Desktop Client

# 0. Cleanup existing processes
Write-Host "Cleaning up existing processes..." -ForegroundColor Yellow
taskkill /F /IM python.exe /T 2>$null
taskkill /F /IM electron.exe /T 2>$null

# 1. Start the Backend
Write-Host "Starting Backend..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoProfile -Command 'cd backend; python main.py'" -WindowStyle Hidden

# 2. Start the Frontend
Write-Host "Starting Frontend (Electron)..." -ForegroundColor Cyan
cd frontend
npm run start
