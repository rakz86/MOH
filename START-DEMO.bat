@echo off
REM ===========================================================================
REM  MOH Kuwait - Medical Requisitions
REM  Double-click this file to run the demo. No internet needed.
REM ===========================================================================
setlocal
cd /d "%~dp0"
title MOH Medical Requisitions - demo server

echo.
echo   Ministry of Health Kuwait - Medical Requisitions
echo   ------------------------------------------------
echo.

REM Find a working Python. On Windows "python" can be a Microsoft Store stub
REM that opens the Store instead of running anything, so test it properly
REM rather than trusting that the command exists.
set PY=
for %%C in (python py python3) do (
  if not defined PY (
    %%C -c "import sys" >nul 2>nul && set PY=%%C
  )
)

if not defined PY (
  echo   Python was not found on this machine.
  echo.
  echo   Install it from https://www.python.org/downloads/
  echo   and tick "Add python.exe to PATH" during setup.
  echo.
  echo   Nothing else is needed - no internet, no other software.
  echo.
  pause
  exit /b 1
)

echo   Starting the local server with %PY% ...
echo.
echo   The site will open in your browser at:
echo       http://localhost:4173/
echo.
echo   KEEP THIS WINDOW OPEN during the demo.
echo   Close it, or press Ctrl+C, to stop the server.
echo.

REM Give the server a moment to bind before the browser asks for the page.
start "" /b cmd /c "timeout /t 2 /nobreak >nul && start "" http://localhost:4173/"

%PY% tools\devserver.py 4173 .

echo.
echo   Server stopped.
pause
