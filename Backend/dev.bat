@echo off
echo [1/4] Freeing port 5000...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5000') do (
    taskkill /PID %%a /F >nul 2>&1
)

echo [2/4] Removing old container...
docker stop seeksuit-backend >nul 2>&1
docker rm seeksuit-backend >nul 2>&1

echo [3/4] Building image...
docker build -t seeksuit-backend .

echo [4/4] Starting container...
docker run -d --rm --name seeksuit-backend -p 5000:5000 --env-file .env seeksuit-backend

echo.
echo Server is running on http://localhost:5000
