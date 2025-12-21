@echo off
if "%~1"=="" (
    echo Usage: .\publish.bat "Your commit message"
    exit /b 1
)

echo ========================================
echo Syncing to GitHub...
echo ========================================
call .\git-wrapper.bat add .
call .\git-wrapper.bat commit -m "%~1"
call .\git-wrapper.bat push origin main

echo.
echo ========================================
echo Deploying to FTP (voxcuriosa.no)...
echo ========================================
python deploy.py

echo.
echo ========================================
echo All done! 🚀
echo ========================================
