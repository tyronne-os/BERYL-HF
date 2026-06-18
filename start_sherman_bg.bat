@echo off
cd /d "C:\Users\tjlsu\BERYL-HF\backend"
start /min "" "C:\Users\tjlsu\AppData\Local\Programs\Python\Python311\python.exe" -m uvicorn main:app --host 127.0.0.1 --port 8001 --log-level warning
