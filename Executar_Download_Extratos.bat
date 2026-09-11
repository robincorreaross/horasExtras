@echo off
chcp 65001 > nul
title Download de Extratos PDF - Farmasete
color 0B

echo ===================================================================
echo               FARMACIA FARMASSETE - SINCRONIZADOR
echo               Download Automatico de Extratos em PDF (Chrome)
echo ===================================================================
echo.
echo [1/2] Verificando ambiente Python...
where python >nul 2>nul
if %errorlevel% neq 0 (
    color 0C
    echo.
    echo [ERRO] Python nao foi encontrado no seu Windows!
    echo Por favor, certifique-se de que o Python esta instalado
    echo e marcado na opcao "Add Python to PATH".
    echo.
    pause
    exit /b 1
)

echo [OK] Python detectado com sucesso.
echo.
echo [2/2] Iniciando Chrome Selenium para download dos extratos...
echo Acessando http://191.167.1.80:8080/a7webconvenios ...
echo.

cd /d "%~dp0"
python scripts_py\conta-pdf-download.py

if %errorlevel% equ 0 (
    color 0A
    echo.
    echo ===================================================================
    echo   [SUCESSO] Extratos baixados com sucesso na pasta!
    echo ===================================================================
) else (
    color 0C
    echo.
    echo ===================================================================
    echo   [AVISO] Ocorreu uma falha durante o download dos extratos.
    echo ===================================================================
)

echo.
echo Pressione qualquer tecla para fechar esta janela...
pause > nul
