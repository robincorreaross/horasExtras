import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';

const BAT_CONTAS = `@echo off
setlocal EnableExtensions
chcp 65001 > nul
title Sincronizacao de Contas - Farmasete
color 0B

echo ===================================================================
echo               FARMACIA FARMASSETE - SINCRONIZADOR
echo           Atualizacao de Valores no Banco de Dados
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
echo [2/3] Localizando script contas_lojas.py...
set "SCRIPT_FILE="

if exist "%~dp0scripts_py\\contas_lojas.py" (
    set "SCRIPT_FILE=%~dp0scripts_py\\contas_lojas.py"
) else if exist "%~dp0contas_lojas.py" (
    set "SCRIPT_FILE=%~dp0contas_lojas.py"
) else if exist "D:\\work-projetos_ross\\horasExtras\\scripts_py\\contas_lojas.py" (
    set "SCRIPT_FILE=D:\\work-projetos_ross\\horasExtras\\scripts_py\\contas_lojas.py"
) else (
    echo Baixando versao mais recente do script...
    if not exist "%TEMP%\\farmasete_scripts" mkdir "%TEMP%\\farmasete_scripts"
    powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; (New-Object Net.WebClient).DownloadFile('https://horasfarmasete.vercel.app/api/contas/download-script?type=contas_lojas', '%TEMP%\\farmasete_scripts\\contas_lojas.py')"
    if exist "%TEMP%\\farmasete_scripts\\contas_lojas.py" (
        set "SCRIPT_FILE=%TEMP%\\farmasete_scripts\\contas_lojas.py"
    )
)

if "%SCRIPT_FILE%"=="" (
    color 0C
    echo [ERRO] Nao foi possivel encontrar ou baixar contas_lojas.py!
    goto FIM
)

echo [OK] Script localizado: %SCRIPT_FILE%
echo.

:: 3. Executar o Script
echo [3/3] Executando rotina de atualizacao de valores...
echo Conectando aos bancos da loja e enviando para o Supabase...
echo.

python "%SCRIPT_FILE%" --auto

if errorlevel 1 (
    color 0C
    echo.
    echo ===================================================================
    echo   [AVISO] Ocorreu uma falha na execucao. Verifique os logs acima.
    echo ===================================================================
) else (
    color 0A
    echo.
    echo ===================================================================
    echo   [SUCESSO] Sincronizacao de valores finalizada com sucesso!
    echo   Os dados no sistema online da Vercel ja estao atualizados.
    echo ===================================================================
)

:FIM
echo.
echo Pressione qualquer tecla para fechar esta janela...
pause > nul
`;

const BAT_DOWNLOAD = `@echo off
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

if exist "%~dp0scripts_py\\conta-pdf-download.py" (
    set "SCRIPT_FILE=%~dp0scripts_py\\conta-pdf-download.py"
) else if exist "%~dp0conta-pdf-download.py" (
    set "SCRIPT_FILE=%~dp0conta-pdf-download.py"
) else if exist "D:\\work-projetos_ross\\horasExtras\\scripts_py\\conta-pdf-download.py" (
    set "SCRIPT_FILE=D:\\work-projetos_ross\\horasExtras\\scripts_py\\conta-pdf-download.py"
) else (
    echo Baixando versao mais recente do script...
    if not exist "%TEMP%\\farmasete_scripts" mkdir "%TEMP%\\farmasete_scripts"
    powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; (New-Object Net.WebClient).DownloadFile('https://horasfarmasete.vercel.app/api/contas/download-script?type=conta_pdf_download', '%TEMP%\\farmasete_scripts\\conta-pdf-download.py')"
    if exist "%TEMP%\\farmasete_scripts\\conta-pdf-download.py" (
        set "SCRIPT_FILE=%TEMP%\\farmasete_scripts\\conta-pdf-download.py"
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
`;

const BAT_UPLOAD = `@echo off
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

if exist "%~dp0scripts_py\\upload_pdfs.py" (
    set "SCRIPT_FILE=%~dp0scripts_py\\upload_pdfs.py"
) else if exist "%~dp0upload_pdfs.py" (
    set "SCRIPT_FILE=%~dp0upload_pdfs.py"
) else if exist "D:\\work-projetos_ross\\horasExtras\\scripts_py\\upload_pdfs.py" (
    set "SCRIPT_FILE=D:\\work-projetos_ross\\horasExtras\\scripts_py\\upload_pdfs.py"
) else (
    echo Baixando versao mais recente do script...
    if not exist "%TEMP%\\farmasete_scripts" mkdir "%TEMP%\\farmasete_scripts"
    powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; (New-Object Net.WebClient).DownloadFile('https://horasfarmasete.vercel.app/api/contas/download-script?type=upload_pdfs', '%TEMP%\\farmasete_scripts\\upload_pdfs.py')"
    if exist "%TEMP%\\farmasete_scripts\\upload_pdfs.py" (
        set "SCRIPT_FILE=%TEMP%\\farmasete_scripts\\upload_pdfs.py"
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
`;

const BAT_TUDO = `@echo off
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
if exist "%~dp0scripts_py\\conta-pdf-download.py" (
    set "SCRIPT_PDF=%~dp0scripts_py\\conta-pdf-download.py"
) else if exist "%~dp0conta-pdf-download.py" (
    set "SCRIPT_PDF=%~dp0conta-pdf-download.py"
) else if exist "D:\\work-projetos_ross\\horasExtras\\scripts_py\\conta-pdf-download.py" (
    set "SCRIPT_PDF=D:\\work-projetos_ross\\horasExtras\\scripts_py\\conta-pdf-download.py"
) else (
    echo Baixando conta-pdf-download.py...
    if not exist "%TEMP%\\farmasete_scripts" mkdir "%TEMP%\\farmasete_scripts"
    powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; (New-Object Net.WebClient).DownloadFile('https://horasfarmasete.vercel.app/api/contas/download-script?type=conta_pdf_download', '%TEMP%\\farmasete_scripts\\conta-pdf-download.py')"
    if exist "%TEMP%\\farmasete_scripts\\conta-pdf-download.py" (
        set "SCRIPT_PDF=%TEMP%\\farmasete_scripts\\conta-pdf-download.py"
    )
)

:: Localizar contas_lojas.py
if exist "%~dp0scripts_py\\contas_lojas.py" (
    set "SCRIPT_CONTAS=%~dp0scripts_py\\contas_lojas.py"
) else if exist "%~dp0contas_lojas.py" (
    set "SCRIPT_CONTAS=%~dp0contas_lojas.py"
) else if exist "D:\\work-projetos_ross\\horasExtras\\scripts_py\\contas_lojas.py" (
    set "SCRIPT_CONTAS=D:\\work-projetos_ross\\horasExtras\\scripts_py\\contas_lojas.py"
) else (
    echo Baixando contas_lojas.py...
    if not exist "%TEMP%\\farmasete_scripts" mkdir "%TEMP%\\farmasete_scripts"
    powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; (New-Object Net.WebClient).DownloadFile('https://horasfarmasete.vercel.app/api/contas/download-script?type=contas_lojas', '%TEMP%\\farmasete_scripts\\contas_lojas.py')"
    if exist "%TEMP%\\farmasete_scripts\\contas_lojas.py" (
        set "SCRIPT_CONTAS=%TEMP%\\farmasete_scripts\\contas_lojas.py"
    )
)

:: Localizar upload_pdfs.py
if exist "%~dp0scripts_py\\upload_pdfs.py" (
    set "SCRIPT_UPLOAD=%~dp0scripts_py\\upload_pdfs.py"
) else if exist "%~dp0upload_pdfs.py" (
    set "SCRIPT_UPLOAD=%~dp0upload_pdfs.py"
) else if exist "D:\\work-projetos_ross\\horasExtras\\scripts_py\\upload_pdfs.py" (
    set "SCRIPT_UPLOAD=D:\\work-projetos_ross\\horasExtras\\scripts_py\\upload_pdfs.py"
) else (
    echo Baixando upload_pdfs.py...
    if not exist "%TEMP%\\farmasete_scripts" mkdir "%TEMP%\\farmasete_scripts"
    powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; (New-Object Net.WebClient).DownloadFile('https://horasfarmasete.vercel.app/api/contas/download-script?type=upload_pdfs', '%TEMP%\\farmasete_scripts\\upload_pdfs.py')"
    if exist "%TEMP%\\farmasete_scripts\\upload_pdfs.py" (
        set "SCRIPT_UPLOAD=%TEMP%\\farmasete_scripts\\upload_pdfs.py"
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
`;

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'bat_tudo';

    let filename = 'Executar_Tudo_Sincronizacao.bat';
    let content = '';
    let contentType = 'application/x-bat; charset=utf-8';

    if (type === 'contas_lojas' || type === 'contas_lojas.py') {
      filename = 'contas_lojas.py';
      contentType = 'text/plain; charset=utf-8';
      const filePath = path.resolve('scripts_py', 'contas_lojas.py');
      if (fs.existsSync(filePath)) {
        content = fs.readFileSync(filePath, 'utf-8');
      }
    } else if (type === 'conta_pdf_download' || type === 'conta-pdf-download.py') {
      filename = 'conta-pdf-download.py';
      contentType = 'text/plain; charset=utf-8';
      const filePath = path.resolve('scripts_py', 'conta-pdf-download.py');
      if (fs.existsSync(filePath)) {
        content = fs.readFileSync(filePath, 'utf-8');
      }
    } else if (type === 'upload_pdfs' || type === 'upload_pdfs.py') {
      filename = 'upload_pdfs.py';
      contentType = 'text/plain; charset=utf-8';
      const filePath = path.resolve('scripts_py', 'upload_pdfs.py');
      if (fs.existsSync(filePath)) {
        content = fs.readFileSync(filePath, 'utf-8');
      }
    } else if (type === 'bat_contas') {
      filename = 'Executar_Atualizacao_Contas.bat';
      content = BAT_CONTAS;
    } else if (type === 'bat_download') {
      filename = 'Executar_Download_Extratos.bat';
      content = BAT_DOWNLOAD;
    } else if (type === 'bat_upload') {
      filename = 'Executar_Upload_PDFs.bat';
      content = BAT_UPLOAD;
    } else {
      filename = 'Executar_Tudo_Sincronizacao.bat';
      content = BAT_TUDO;
    }

    if (!content) {
      return NextResponse.json({ error: 'Arquivo não encontrado' }, { status: 404 });
    }

    if (filename.endsWith('.bat')) {
      content = content.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n');
    }

    return new Response(content, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
