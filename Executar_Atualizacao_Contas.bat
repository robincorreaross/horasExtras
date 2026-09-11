@echo off
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
python scripts_py\contas_lojas.py --auto

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
