@echo off
REM Expo Server Restart & QR Code Generator for Windows
REM Usage: Double-click or run from command prompt

echo =========================================
echo   Kvitt Mobile - Expo Dev Server
echo =========================================
echo.
echo   Backend: https://kvitt.duckdns.org
echo   Supabase: https://hbqngvptbuvocjrozcgw.supabase.co
echo.

REM Get script directory
set SCRIPT_DIR=%~dp0
set MOBILE_DIR=%SCRIPT_DIR%mobile

REM Check if mobile directory exists
if not exist "%MOBILE_DIR%" (
    echo ERROR: Mobile directory not found at %MOBILE_DIR%
    pause
    exit /b 1
)

cd /d "%MOBILE_DIR%"

REM 1. Kill any existing Expo/Node processes on dev ports
echo 1. Stopping any existing Expo processes...
echo    Killing processes on ports 8081, 8082, 19000, 19001...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8081 :8082 :19000 :19001" 2^>nul') do (
    taskkill /F /PID %%a 2>nul
)
REM Also kill any node processes that might be hanging
taskkill /F /IM "node.exe" 2>nul
echo    Done.
ping -n 3 127.0.0.1 >nul

REM 2. Clear Expo cache
echo.
echo 2. Clearing Expo cache...
if exist ".expo" rmdir /s /q ".expo" 2>nul
if exist "node_modules\.cache" rmdir /s /q "node_modules\.cache" 2>nul

REM 3. Check .env file
echo.
echo 3. Checking environment configuration...
if exist ".env" (
    echo    .env file found
    type .env | findstr "EXPO_PUBLIC_"
) else (
    echo    WARNING: .env file not found!
    echo    Please create mobile\.env with your configuration
)

REM 4. Install dependencies if needed
echo.
echo 4. Checking dependencies...
if not exist "node_modules" (
    echo    Installing dependencies...
    call npm install
) else (
    echo    Dependencies already installed
)

REM 5. Start Expo
echo.
echo 5. Starting Expo development server...
echo.
echo =========================================
echo   STARTING EXPO
echo =========================================
echo.
echo   Options:
echo     - Press 'a' to open Android emulator
echo     - Press 'i' to open iOS simulator (Mac only)
echo     - Press 'w' to open web browser
echo     - Scan QR code with Expo Go app
echo.
echo   To stop: Press Ctrl+C
echo.
echo =========================================
echo.

REM Start Expo with LAN mode (phone must be on same WiFi as computer)
echo Starting Expo server with LAN mode...
echo.
echo NOTE: Your phone must be on the same WiFi network as this computer.
echo       If you need external access, run: npx expo start --tunnel
echo.
echo Scan the QR code displayed in the terminal below with Expo Go.
echo.

call npx expo start

pause
