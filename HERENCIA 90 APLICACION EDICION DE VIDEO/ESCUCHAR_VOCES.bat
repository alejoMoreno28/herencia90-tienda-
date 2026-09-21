@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo ===============================================
echo   HERENCIA 90 - Probador de voces
echo ===============================================
echo.
echo Instalando lo necesario (solo la primera vez)...
python -m pip install --quiet --upgrade edge-tts
if errorlevel 1 (
  echo.
  echo No se pudo instalar. Revisa que Python este instalado:
  echo   https://www.python.org/downloads/
  echo   IMPORTANTE: marca "Add Python to PATH" al instalarlo.
  echo.
  pause
  exit /b 1
)
python probar_voces.py
echo.
echo Abriendo la carpeta con las muestras...
start "" "%~dp0muestras_voz"
pause
