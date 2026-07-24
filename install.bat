@echo off
REM Installation Script for ChimerAI Project (SQLite)
echo.
echo ================================================
echo   ChimerAI Project Setup (SQLite - No Docker needed)
echo ================================================
echo.

REM Check Node.js
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not installed
    pause
    exit /b 1
)

echo [1/3] Installing dependencies...
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to install dependencies
    pause
    exit /b 1
)

echo [2/3] Setting up database...
call npm run db:push
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to setup database
    pause
    exit /b 1
)

echo [3/3] Seeding database...
call npm run db:seed
if %ERRORLEVEL% NEQ 0 (
    echo [WARNING] Seeding failed, but you can continue
)

echo.
echo ================================================
echo   Setup completed successfully!
echo ================================================
echo.
echo Next steps:
echo   npm run dev
echo   Open: http://localhost:3001
echo.
echo Login with:
echo   Email: admin@example.com
echo   Password: admin123
echo.
pause
