@echo off
setlocal EnableExtensions
chcp 65001 > nul
title Sincronizacao Completa (PDFs + Contas + Upload) - Farmasete
color 0B

echo ===================================================================
echo               FARMACIA FARMASSETE - SINCRONIZADOR
echo      Rotina Completa: Download PDFs + Valores + Upload Supabase
echo ===================================================================
echo.

:: 1. Verificar Python
echo [1/5] Verificando ambiente Python...
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

:: 2. Localizar Scripts
echo [2/5] Preparando scripts de execucao...
set "SCRIPT_PDF="
set "SCRIPT_CONTAS="
set "SCRIPT_UPLOAD="

:: Localizar conta-pdf-download.py
if exist "%~dp0scripts_py\conta-pdf-download.py" (
    set "SCRIPT_PDF=%~dp0scripts_py\conta-pdf-download.py"
) else if exist "%~dp0conta-pdf-download.py" (
    set "SCRIPT_PDF=%~dp0conta-pdf-download.py"
) else if exist "D:\work-projetos_ross\horasExtras\scripts_py\conta-pdf-download.py" (
    set "SCRIPT_PDF=D:\work-projetos_ross\horasExtras\scripts_py\conta-pdf-download.py"
) else (
    echo Baixando conta-pdf-download.py...
    if not exist "%TEMP%\farmasete_scripts" mkdir "%TEMP%\farmasete_scripts"
    powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; (New-Object Net.WebClient).DownloadFile('https://horasfarmasete.vercel.app/api/contas/download-script?type=conta_pdf_download', '%TEMP%\farmasete_scripts\conta-pdf-download.py')"
    if exist "%TEMP%\farmasete_scripts\conta-pdf-download.py" (
        set "SCRIPT_PDF=%TEMP%\farmasete_scripts\conta-pdf-download.py"
    )
)

:: Localizar contas_lojas.py
if exist "%~dp0scripts_py\contas_lojas.py" (
    set "SCRIPT_CONTAS=%~dp0scripts_py\contas_lojas.py"
) else if exist "%~dp0contas_lojas.py" (
    set "SCRIPT_CONTAS=%~dp0contas_lojas.py"
) else if exist "D:\work-projetos_ross\horasExtras\scripts_py\contas_lojas.py" (
    set "SCRIPT_CONTAS=D:\work-projetos_ross\horasExtras\scripts_py\contas_lojas.py"
) else (
    echo Baixando contas_lojas.py...
    if not exist "%TEMP%\farmasete_scripts" mkdir "%TEMP%\farmasete_scripts"
    powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; (New-Object Net.WebClient).DownloadFile('https://horasfarmasete.vercel.app/api/contas/download-script?type=contas_lojas', '%TEMP%\farmasete_scripts\contas_lojas.py')"
    if exist "%TEMP%\farmasete_scripts\contas_lojas.py" (
        set "SCRIPT_CONTAS=%TEMP%\farmasete_scripts\contas_lojas.py"
    )
)

:: Localizar upload_pdfs.py
if exist "%~dp0scripts_py\upload_pdfs.py" (
    set "SCRIPT_UPLOAD=%~dp0scripts_py\upload_pdfs.py"
) else if exist "%~dp0upload_pdfs.py" (
    set "SCRIPT_UPLOAD=%~dp0upload_pdfs.py"
) else if exist "D:\work-projetos_ross\horasExtras\scripts_py\upload_pdfs.py" (
    set "SCRIPT_UPLOAD=D:\work-projetos_ross\horasExtras\scripts_py\upload_pdfs.py"
) else (
    echo Baixando upload_pdfs.py...
    if not exist "%TEMP%\farmasete_scripts" mkdir "%TEMP%\farmasete_scripts"
    powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; (New-Object Net.WebClient).DownloadFile('https://horasfarmasete.vercel.app/api/contas/download-script?type=upload_pdfs', '%TEMP%\farmasete_scripts\upload_pdfs.py')"
    if exist "%TEMP%\farmasete_scripts\upload_pdfs.py" (
        set "SCRIPT_UPLOAD=%TEMP%\farmasete_scripts\upload_pdfs.py"
    )
)

if "%SCRIPT_PDF%"=="" (
    color 0C
    echo [ERRO] Nao foi possivel carregar o script conta-pdf-download.py!
    goto FIM
)
if "%SCRIPT_CONTAS%"=="" (
    color 0C
    echo [ERRO] Nao foi possivel carregar o script contas_lojas.py!
    goto FIM
)
if "%SCRIPT_UPLOAD%"=="" (
    color 0C
    echo [ERRO] Nao foi possivel carregar o script upload_pdfs.py!
    goto FIM
)

echo [OK] Scripts preparados com sucesso.
echo.

:: 3. Executar Passo 1: Download PDFs
echo [3/5] ETAPA 1: Baixando PDFs com Chrome Selenium...
python "%SCRIPT_PDF%"

echo.
:: 4. Executar Passo 2: Atualização de Contas
echo [4/5] ETAPA 2: Consolidando valores das lojas e enviando ao Supabase...
python "%SCRIPT_CONTAS%" --auto

echo.
:: 5. Executar Passo 3: Upload dos PDFs
echo [5/5] ETAPA 3: Enviando PDFs das contas e holerites para o Supabase Storage...
python "%SCRIPT_UPLOAD%"

if errorlevel 1 (
    color 0C
    echo.
    echo ===================================================================
    echo   [AVISO] Ocorreu uma falha no processo. Verifique as mensagens acima.
    echo ===================================================================
) else (
    color 0A
    echo.
    echo ===================================================================
    echo   [SUCESSO] Rotina completa executada com sucesso!
    echo   Valores e PDFs estao sincronizados no Supabase.
    echo ===================================================================
)

:FIM
echo.
echo Pressione qualquer tecla para fechar esta janela...
pause > nul
