@echo off
echo ==============================================
echo    INICIANDO SERVIDOR LOCAL (HERENCIA 90)    
echo ==============================================
echo.
echo Hola! Esto levantara tu tienda de forma correcta con todos los estilos.
echo.
echo Abriendo en tu navegador: http://localhost:8000
echo.
start "" "http://localhost:8000"
npx http-server web -p 8000
pause
