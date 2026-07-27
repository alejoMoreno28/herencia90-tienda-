@echo off
title Herencia 90 - Cargar pedido
cd /d "%~dp0"

echo.
echo  ============================================
echo   HERENCIA 90 - Cargador de pedidos
echo  ============================================
echo.
echo  Arrancando... la primera vez tarda un poco
echo  porque carga los modelos en la tarjeta grafica.
echo.
echo  NO CIERRES ESTA VENTANA mientras trabajas.
echo.

REM El navegador se abre solo cuando el robot ya responde, para no mostrar
REM una pagina en blanco mientras carga.
start "" cmd /c "for /l %%i in (1,1,90) do (curl -s -o nul http://localhost:3001/health && (start "" http://localhost:3001/cargador & exit) || timeout /t 2 >nul)"

node robot-fotos.mjs

echo.
echo  El robot se detuvo. Puedes cerrar esta ventana.
pause
