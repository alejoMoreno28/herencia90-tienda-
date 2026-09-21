@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
echo.
echo ==================================================
echo   HERENCIA 90 - Instalador del editor de video
echo ==================================================
echo.

where python >nul 2>&1
if errorlevel 1 (
  echo [X] No encuentro Python.
  echo.
  echo     Instalalo desde https://www.python.org/downloads/
  echo     IMPORTANTE: marca la casilla "Add Python to PATH".
  echo     Luego vuelve a ejecutar este archivo.
  echo.
  pause
  exit /b 1
)
echo [OK] Python encontrado.

where ffmpeg >nul 2>&1
if errorlevel 1 (
  echo [..] Falta FFmpeg. Lo instalo con winget...
  winget install --id Gyan.FFmpeg -e --accept-source-agreements --accept-package-agreements
  echo.
  echo     Si winget lo instalo, CIERRA esta ventana y vuelve a ejecutar
  echo     este archivo para que Windows reconozca el comando.
  echo.
) else (
  echo [OK] FFmpeg encontrado.
)

echo.
echo [..] Instalando las librerias del motor. Esto tarda unos minutos...
python -m pip install --upgrade pip --quiet
python -m pip install -r requirements.txt
if errorlevel 1 (
  echo.
  echo [X] Fallo la instalacion de las librerias. Copiame el error de arriba.
  pause
  exit /b 1
)

echo.
echo [..] Buscando tu tarjeta grafica NVIDIA...
where nvidia-smi >nul 2>&1
if errorlevel 1 (
  echo [--] No veo una GPU NVIDIA. Todo funcionara igual, solo mas lento.
) else (
  echo [OK] GPU NVIDIA detectada. Instalando PyTorch con CUDA...
  python -m pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu124
)

echo.
echo [..] Descargando la tipografia Montserrat...
python descargar_fuentes.py

echo.
echo ==================================================
echo   Revision final
echo ==================================================
python -m motor.cli revisar
echo.
pause
