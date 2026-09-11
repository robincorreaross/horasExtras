@echo off
setlocal EnableExtensions
chcp 65001 > nul
title Upload de PDFs para Supabase - Farmasete
color 0B

echo ===================================================================
echo               FARMACIA FARMASSETE - SINCRONIZADOR
echo           Upload de PDFs Locais para o Supabase Storage
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
echo [2/3] Localizando script upload_pdfs.py...
set "SCRIPT_FILE="

if exist "%~dp0scripts_py\upload_pdfs.py" (
    set "SCRIPT_FILE=%~dp0scripts_py\upload_pdfs.py"
) else if exist "%~dp0upload_pdfs.py" (
    set "SCRIPT_FILE=%~dp0upload_pdfs.py"
) else if exist "D:\work-projetos_ross\horasExtras\scripts_py\upload_pdfs.py" (
    set "SCRIPT_FILE=D:\work-projetos_ross\horasExtras\scripts_py\upload_pdfs.py"
) else (
    echo Baixando versao mais recente do script...
    if not exist "%TEMP%\farmasete_scripts" mkdir "%TEMP%\farmasete_scripts"
    powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; (New-Object Net.WebClient).DownloadFile('https://horasfarmasete.vercel.app/api/contas/download-script?type=upload_pdfs', '%TEMP%\farmasete_scripts\upload_pdfs.py')"
    if exist "%TEMP%\farmasete_scripts\upload_pdfs.py" (
        set "SCRIPT_FILE=%TEMP%\farmasete_scripts\upload_pdfs.py"
    )
)

if "%SCRIPT_FILE%"=="" (
    color 0C
    echo [ERRO] Nao foi possivel encontrar ou baixar upload_pdfs.py!
    goto FIM
)

echo [OK] Script localizado: %SCRIPT_FILE%
echo.

:: 3. Executar o Script
echo [3/3] Iniciando envio dos PDFs (Contas e Holerites) para o Supabase...
echo Lendo pastas locais e vinculando aos colaboradores...
echo.

python "%SCRIPT_FILE%"

if errorlevel 1 (
    color 0C
    echo.
    echo ===================================================================
    echo   [AVISO] Ocorreu uma falha no upload dos PDFs. Verifique acima.
    echo ===================================================================
) else (
    color 0A
    echo.
    echo ===================================================================
    echo   [SUCESSO] Todos os PDFs foram enviados e vinculados no Supabase!
    echo   O painel online da Vercel ja exibira os links de download.
    echo ===================================================================
)

:FIM
echo.
echo Pressione qualquer tecla para fechar esta janela...
pause > nul
