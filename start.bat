@echo off
echo Starting VoteSecure Backend...
start /B node server.js
timeout /t 3 /nobreak >nul
echo Starting VoteSecure Frontend...
start /B npm run client
echo.
echo VoteSecure is starting...
echo Backend: http://localhost:3000
echo Frontend: http://localhost:5500
echo.
pause