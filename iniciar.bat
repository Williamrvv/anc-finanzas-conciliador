@echo off
setlocal EnableDelayedExpansion

:: Tema Retro: Verde brillante sobre fondo negro
color 0A
title BOOT SEQUENCE - IRI SYSTEM

cls
echo.
echo    ====================================================
echo.
echo       ___  ____  ___ 
echo      ^|_ _^|^|  _ \^|_ _^|
echo       ^| ^| ^| ^|_) ^|^| ^| 
echo       ^| ^| ^|  _ ^< ^| ^| 
echo      ^|___^|^|_^| \_\___^|
echo.
echo      INTEGRACION REGIONAL DE INGRESOS
echo      SYSTEM KERNEL v1.0.4
echo.
echo    ====================================================
echo.

:: Simular chequeo de memoria inicial (1 segundo)
echo [SYS] INITIATING BOOT SEQUENCE...
ping -n 2 127.0.0.1 >nul

:: ==========================================
:: 1. OBTENER LA IP (Red)
:: ==========================================
echo [SYS] SCANNING NETWORK INTERFACES...
ping -n 2 127.0.0.1 >nul

for /f "tokens=2 delims=[]" %%i in ('ping -4 -n 1 %COMPUTERNAME%') do set "IP_LOCAL=%%i"

if "%IP_LOCAL%"=="" (
    color 0C
    echo [FATAL] CRITICAL NETWORK FAILURE. NO IPV4 DETECTED.
    echo [FATAL] SYSTEM HALTED.
    pause
    exit /b
)

echo [ OK ] IPV4 ADDRESS DETECTED: %IP_LOCAL%
ping -n 2 127.0.0.1 >nul

:: ==========================================
:: 2. ACTUALIZAR EL ARCHIVO .ENV
:: ==========================================
set "ARCHIVO_ENV=.env"
set "ARCHIVO_TEMP=.env.tmp"

echo [SYS] LOCATING CONFIGURATION FILE (.env)...
ping -n 2 127.0.0.1 >nul

if not exist "%ARCHIVO_ENV%" (
    color 0C
    echo [FATAL] CONFIG FILE NOT FOUND. SYSTEM HALTED.
    pause
    exit /b
)

echo [ OK ] FILE LOCATED.
echo [SYS] INITIATING HEX-PATCH ON VARIABLES...

if exist "%ARCHIVO_TEMP%" del "%ARCHIVO_TEMP%"

:: Lógica real de reemplazo
for /f "tokens=1* delims=:" %%X in ('findstr /n "^" "%ARCHIVO_ENV%"') do (
    set "LINEA=%%Y"
    if "!LINEA!"=="" (
        echo.>>"%ARCHIVO_TEMP%"
    ) else (
        for /f "tokens=1* delims==" %%A in ("!LINEA!") do (
            if "%%A"=="DB_HOST" (
                echo DB_HOST=%IP_LOCAL%>>"%ARCHIVO_TEMP%"
            ) else if "%%A"=="O365_REDIRECT_URI" (
                echo O365_REDIRECT_URI=https://%IP_LOCAL%:4435/callback.php>>"%ARCHIVO_TEMP%"
            ) else (
                echo !LINEA!>>"%ARCHIVO_TEMP%"
            )
        )
    )
)

move /y "%ARCHIVO_TEMP%" "%ARCHIVO_ENV%" >nul

ping -n 2 127.0.0.1 >nul
echo [ OK ] DB_HOST OVERWRITTEN.
echo [ OK ] O365_REDIRECT_URI OVERWRITTEN.
ping -n 2 127.0.0.1 >nul

:: ==========================================
:: 3. LEVANTAR DOCKER
:: ==========================================
echo [SYS] MOUNTING DOCKER ENGINE IMAGES...
ping -n 2 127.0.0.1 >nul

:: Ejecutamos docker
docker-compose up -d

echo.
echo    ====================================================
echo      [ OK ] SYSTEM ONLINE. WELCOME.
echo    ====================================================
echo.
pause