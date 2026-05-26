@echo off
setlocal EnableDelayedExpansion

title Iniciando Ecosistema IRI

set "ARCHIVO_ENV=.env"
set "ARCHIVO_TEMP=.env.tmp"

echo Buscando IP local principal...

:: ==========================================
:: 1. OBTENER LA IP (Truco del Ping)
:: ==========================================
for /f "tokens=2 delims=[]" %%i in ('ping -4 -n 1 %COMPUTERNAME%') do set "IP_LOCAL=%%i"

if "%IP_LOCAL%"=="" (
    echo [ERROR] No se pudo obtener la IP.
    pause
    exit /b
)

echo [OK] IP detectada: %IP_LOCAL%

:: ==========================================
:: 2. ACTUALIZAR EL ARCHIVO .ENV
:: ==========================================
if not exist "%ARCHIVO_ENV%" (
    echo [ERROR] No se encontro el archivo %ARCHIVO_ENV% en esta carpeta.
    pause
    exit /b
)

echo Actualizando variables DB_HOST y O365_REDIRECT_URI...

if exist "%ARCHIVO_TEMP%" del "%ARCHIVO_TEMP%"

:: Leer linea por linea asegurando no borrar lineas vacias
for /f "tokens=1* delims=:" %%X in ('findstr /n "^" "%ARCHIVO_ENV%"') do (
    set "LINEA=%%Y"
    if "!LINEA!"=="" (
        echo.>>"%ARCHIVO_TEMP%"
    ) else (
        :: Partir la linea por el signo "=" para ver que variable es
        for /f "tokens=1* delims==" %%A in ("!LINEA!") do (
            if "%%A"=="DB_HOST" (
                :: Inyecta la IP limpia
                echo DB_HOST=%IP_LOCAL%>>"%ARCHIVO_TEMP%"
            ) else if "%%A"=="O365_REDIRECT_URI" (
                :: Inyecta la IP respetando el formato https y el puerto 4435
                echo O365_REDIRECT_URI=https://%IP_LOCAL%:4435/callback.php>>"%ARCHIVO_TEMP%"
            ) else (
                :: Si es cualquier otra variable, la deja exactamente igual (incluyendo contraseñas)
                echo !LINEA!>>"%ARCHIVO_TEMP%"
            )
        )
    )
)

:: Reemplazar el archivo viejo con el nuevo modificado
move /y "%ARCHIVO_TEMP%" "%ARCHIVO_ENV%" >nul
echo [OK] Archivo .env actualizado correctamente.

:: ==========================================
:: 3. LEVANTAR DOCKER
:: ==========================================
echo.
echo Levantando contenedores Docker...
docker-compose up -d

echo.
echo ¡Proceso finalizado con exito!
pause