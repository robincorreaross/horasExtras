@echo off
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
python scripts_py\conta-pdf-download.py

echo.
echo [3/3] ETAPA 2: Consolidando valores das lojas e enviando para o Supabase...
python scripts_py\contas_lojas.py --auto

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
