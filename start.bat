@echo off
setlocal
set "APP_DIR=%~dp0"
set "NODE_DIR=%APP_DIR%.tools\node-v24.21.0-win-x64"

if not exist "%NODE_DIR%\node.exe" (
  echo Local Node.js was not found. Follow the installation instructions in README.md.
  pause
  exit /b 1
)

set "PATH=%NODE_DIR%;%PATH%"
pushd "%APP_DIR%"
call npm.cmd start
set "APP_EXIT=%ERRORLEVEL%"
popd

if not "%APP_EXIT%"=="0" pause
exit /b %APP_EXIT%
