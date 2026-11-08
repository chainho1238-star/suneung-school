@echo off
rem Double-click this file: build client, install server, start server.
echo [1/3] Preparing screen files... (first time takes 1-2 minutes)
cd /d "%~dp0client" || goto fail
call npm install
if errorlevel 1 goto fail
call npm run build
if errorlevel 1 goto fail
echo.
echo [2/3] Installing server parts...
cd /d "%~dp0server" || goto fail
call npm install
if errorlevel 1 goto fail
echo.
echo [3/3] Starting server.
echo.
echo  ==^> Open Chrome and go to  http://localhost:3000
echo  ==^> Closing this black window stops the server.
echo.
node index.js
pause
exit /b 0

:fail
echo.
echo ERROR. Please capture the red text above and send it to Claude.
pause
exit /b 1
