@echo off
setlocal EnableExtensions
chcp 65001 > nul
title Download de Extratos PDF - Farmasete
color 0B

echo ===================================================================
echo               FARMACIA FARMASSETE - SINCRONIZADOR
echo           Download Automatico de Extratos em PDF com Chrome
echo ===================================================================
echo.

:: 1. Verificar Python
echo [1/3] Verificando ambiente Python...
where python >nul 2>nul
if errorlevel 1 (
    color 0C
    echo.
    echo [ERRO] Python nao foi encontrado no seu Windows!
    echo Instale o Python ou marque a opcao "Add Python to PATH".
    echo.
    goto FIM
)
echo [OK] Python detectado com sucesso.
echo.

:: 2. Localizar ou baixar o script Python
echo [2/3] Localizando script conta-pdf-download.py...
set "SCRIPT_FILE="

if exist "%~dp0scripts_py\conta-pdf-download.py" (
    set "SCRIPT_FILE=%~dp0scripts_py\conta-pdf-download.py"
) else if exist "%~dp0conta-pdf-download.py" (
    set "SCRIPT_FILE=%~dp0conta-pdf-download.py"
) else if exist "D:\work-projetos_ross\horasExtras\scripts_py\conta-pdf-download.py" (
    set "SCRIPT_FILE=D:\work-projetos_ross\horasExtras\scripts_py\conta-pdf-download.py"
) else (
    echo Baixando versao mais recente do script...
    if not exist "%TEMP%\farmasete_scripts" mkdir "%TEMP%\farmasete_scripts"
    powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; (New-Object Net.WebClient).DownloadFile('https://horasfarmasete.vercel.app/api/contas/download-script?type=conta_pdf_download', '%TEMP%\farmasete_scripts\conta-pdf-download.py')"
    if exist "%TEMP%\farmasete_scripts\conta-pdf-download.py" (
        set "SCRIPT_FILE=%TEMP%\farmasete_scripts\conta-pdf-download.py"
    )
)

if "%SCRIPT_FILE%"=="" (
    color 0C
    echo [ERRO] Nao foi possivel encontrar ou baixar conta-pdf-download.py!
    goto FIM
)

echo [OK] Script localizado: %SCRIPT_FILE%
echo.

:: 3. Executar o Script
echo [3/3] Iniciando Chrome Selenium para download dos extratos...
echo Acessando sistema de convenios e baixando extratos...
echo.

python "%SCRIPT_FILE%"

if errorlevel 1 (
    color 0C
    echo.
    echo ===================================================================
    echo   [AVISO] Ocorreu uma falha no download. Verifique os logs acima.
    echo ===================================================================
) else (
    color 0A
    echo.
    echo ===================================================================
    echo   [SUCESSO] Extratos baixados com sucesso na pasta!
    echo ===================================================================
)

:FIM
echo.
echo Pressione qualquer tecla para fechar esta janela...
pause > nul
