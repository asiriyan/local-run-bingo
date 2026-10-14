@echo off
cd /d "%~dp0"

start "Bingo Server" /min node www\server.js

echo Waiting for server to start...
:waitloop
timeout /t 1 /nobreak >nul
curl -s -o nul http://127.0.0.1:3000
if errorlevel 1 goto waitloop

start "" http://127.0.0.1:3000