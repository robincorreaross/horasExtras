import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';

const BAT_CONTAS = `@echo off
chcp 65001 > nul
title Sincronização de Contas - Farmasete
color 0B

echo ===================================================================
echo               FARMACIA FARMASSETE - SINCRONIZADOR
echo               Atualizacao de Valores e Extratos (Supabase)
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
echo [2/2] Executando rotina de atualizacao de contas...
echo Conectando aos bancos da loja (191.167.1.80 e srv-sete) e enviando ao Supabase...
echo.

cd /d "%~dp0"
python scripts_py\\contas_lojas.py --auto

if %errorlevel% equ 0 (
    color 0A
    echo.
    echo ===================================================================
    echo   [SUCESSO] Sincronizacao finalizada com sucesso!
    echo   Os dados no sistema online (Vercel) ja estao atualizados.
    echo ===================================================================
) else (
    color 0C
    echo.
    echo ===================================================================
    echo   [AVISO] Ocorreu uma falha ao rodar o script. Verifique as mensagens acima.
    echo ===================================================================
)

echo.
echo Pressione qualquer tecla para fechar esta janela...
pause > nul
`;

const BAT_DOWNLOAD = `@echo off
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
python scripts_py\\conta-pdf-download.py

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
`;

const BAT_TUDO = `@echo off
chcp 65001 > nul
title Sincronização Completa (PDFs + Contas) - Farmasete
color 0B

echo ===================================================================
echo               FARMACIA FARMASSETE - SINCRONIZADOR
echo               Rotina Completa (Download PDFs + Atualizacao Supabase)
echo ===================================================================
echo.
echo [1/3] Verificando ambiente Python...
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
echo [2/3] ETAPA 1: Baixando PDFs via Chrome Selenium...
cd /d "%~dp0"
python scripts_py\\conta-pdf-download.py

echo.
echo [3/3] ETAPA 2: Consolidando valores das lojas e enviando para o Supabase...
python scripts_py\\contas_lojas.py --auto

if %errorlevel% equ 0 (
    color 0A
    echo.
    echo ===================================================================
    echo   [SUCESSO] Rotina completa executada com sucesso!
    echo   Todos os valores e PDFs ja estao sincronizados no Supabase.
    echo   O painel online (Vercel) ja exibira os dados atualizados!
    echo ===================================================================
) else (
    color 0C
    echo.
    echo ===================================================================
    echo   [AVISO] Ocorreu uma falha durante o processo. Verifique os logs acima.
    echo ===================================================================
)

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
    } else if (type === 'bat_contas') {
      filename = 'Executar_Atualizacao_Contas.bat';
      content = BAT_CONTAS;
    } else if (type === 'bat_download') {
      filename = 'Executar_Download_Extratos.bat';
      content = BAT_DOWNLOAD;
    } else {
      filename = 'Executar_Tudo_Sincronizacao.bat';
      content = BAT_TUDO;
    }

    if (!content) {
      return NextResponse.json({ error: 'Arquivo não encontrado' }, { status: 404 });
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
