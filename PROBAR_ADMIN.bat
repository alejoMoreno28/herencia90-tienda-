@echo off
cd /d "%~dp0"
echo ==============================================
echo      PRUEBAS ADMIN HERENCIA 90
echo ==============================================
echo.
echo Esto levanta la web localmente para probar login/admin.
echo.
echo Login:  http://127.0.0.1:8000/login.html
echo Admin:  http://127.0.0.1:8000/admin.html
echo.
echo Si no tienes sesion activa, entra primero por Login.
echo Para apagar el servidor, cierra esta ventana o presiona Ctrl+C.
echo.
start "" "http://127.0.0.1:8000/login.html"
python -m http.server 8000 -d web
pause
