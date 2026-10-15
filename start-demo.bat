@echo off
TITLE CenterPoint ProERP - FinTechathon 2026 Demo Launcher
COLOR 0A

echo ===============================================================================
echo   CenterPoint ProERP -- AI Financial Copilot (WeBank Topic E)
echo   FinTechathon 2026 One-Click Demo Launcher & Environment Staging
echo ===============================================================================
echo.

cd /d "%~dp0backend"

echo [1/3] Refreshing database and seeding realistic WeBank Topic E demo scenario...
php artisan migrate:fresh --seed --force
php artisan db:seed --class=CopilotDemoSeeder --force

if %ERRORLEVEL% NEQ 0 (
    COLOR 0C
    echo [ERROR] Database seeding failed! Please verify PHP and database configuration.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo [2/3] Starting Laravel backend API server on http://127.0.0.1:8000 ...
start "CenterPoint Backend API (Port 8000)" cmd /k "php artisan serve --port=8000"

cd /d "%~dp0frontend"

echo.
echo [3/3] Starting React 19 / Vite frontend on http://localhost:5173 ...
start "CenterPoint Frontend (Port 5173)" cmd /k "npm run dev"

timeout /t 3 /nobreak >nul

echo.
echo ===============================================================================
echo   Environment successfully staged!
echo   Opening CenterPoint ProERP Copilot Workspace in your default browser...
echo ===============================================================================
start http://localhost:5173

echo.
echo Recording tips:
echo  - Press F11 in your browser for full-screen view.
echo  - Navigate to Finance -^> Copilot tab (or shortcut '8').
echo  - Consult docs\FINTECHATHON_DEMO_REHEARSAL_GUIDE.md for the 5-minute video script.
echo.
pause
