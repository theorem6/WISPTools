@echo off
REM Firebase Login Batch Script
REM This runs in Command Prompt which doesn't have execution policy restrictions

echo ==================================
echo   Firebase CLI Login
echo ==================================
echo.

cd /d C:\Users\david\Downloads\PCI_mapper

echo Logging into Firebase...
echo A browser window will open for authentication.
echo.

firebase login

echo.
echo ==================================
echo   Login Complete!
echo ==================================
echo.
pause

