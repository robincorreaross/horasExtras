import sys
import io
import time
import os
import shutil
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager

# Força a codificação UTF-8 no console do Windows para evitar UnicodeEncodeError com emojis
if hasattr(sys.stdout, 'buffer'):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'buffer'):
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')


# --- CONFIGURAÇÕES ---
URL_LOGIN = "http://191.167.1.80:8080/a7webconvenios/#/login"
URL_LISTA_CLIENTES = "http://191.167.1.80:8080/a7webconvenios/#/clientes"
BASE_URL = "http://191.167.1.80:8080"
USUARIO = "farmasete.funcionarios"
SENHA = "163517"

# NOME PADRÃO QUE O CHROME BAIXA (Visto no seu print)
NOME_PADRAO_DOWNLOAD = "Por Item de Venda.pdf" 

# Pasta de download
pasta_download = r"D:\work-Ross\Administrativo\Docs Colaboradores\enviarExtrato\extrato_contas"
if not os.path.exists(pasta_download):
    os.makedirs(pasta_download)


# --- SETUP CHROME ---
options = webdriver.ChromeOptions()
options.add_argument("--start-maximized")
options.add_argument("--ignore-certificate-errors")
options.add_argument(f"--unsafely-treat-insecure-origin-as-secure={BASE_URL}")

prefs = {
    "download.default_directory": pasta_download,
    "download.prompt_for_download": False,
    "download.directory_upgrade": True,
    "plugins.always_open_pdf_externally": True,
    "safebrowsing.enabled": True
}
options.add_experimental_option("prefs", prefs)

driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)
wait = WebDriverWait(driver, 15)
wait_curto = WebDriverWait(driver, 5)

# --- FUNÇÃO DE LIMPEZA E RENOMEAÇÃO ROBUSTA ---
def limpar_arquivo_temporario():
    """Remove 'Por Item de Venda.pdf' se ele existir antes do download começar"""
    caminho_padrao = os.path.join(pasta_download, NOME_PADRAO_DOWNLOAD)
    if os.path.exists(caminho_padrao):
        try:
            os.remove(caminho_padrao)
            print("Limpeza: Arquivo antigo removido da pasta.")
        except:
            print("Aviso: Não foi possível limpar o arquivo antigo. Pode gerar duplicidade.")

def fechar_modais_e_limpar_backdrop():
    """Garante que nenhum modal ou backdrop do Bootstrap fique bloqueando a tela."""
    try:
        botoes = driver.find_elements(
            By.XPATH, 
            "//button[contains(., 'Fechar') or contains(., 'OK') or contains(., 'Cancelar') or @data-dismiss='modal' or contains(@class, 'close')]"
        )
        for btn in botoes:
            try:
                if btn.is_displayed():
                    driver.execute_script("arguments[0].click();", btn)
                    time.sleep(0.5)
            except:
                pass

        driver.execute_script("""
            var backdrops = document.querySelectorAll('.modal-backdrop');
            backdrops.forEach(function(el) { el.remove(); });
            document.body.classList.remove('modal-open');
        """)
    except Exception:
        pass

import psycopg2

# Configurações do Supabase para buscar IDs dos funcionários
DB_SUPABASE = {
    "dbname": "postgres",
    "user": "postgres.vfpgqqfqoxfzwigntcua",
    "password": "BD@163517bd@",
    "host": "aws-0-sa-east-1.pooler.supabase.com",
    "port": 5432
}

def obter_mapa_funcionarios():
    """Busca o mapeamento de Nome -> ID do Supabase para evitar ambiguidade de nomes iguais"""
    try:
        conn = psycopg2.connect(**DB_SUPABASE)
        cur = conn.cursor()
        cur.execute('SELECT id, nome FROM funcionarios;')
        rows = cur.fetchall()
        cur.close()
        conn.close()
        mapa = {}
        for emp_id, nome in rows:
            if nome:
                mapa[nome.strip().lower()] = str(emp_id)
                # Mapeia também pelo primeiro nome se for único
                primeiro = nome.strip().split()[0].lower()
                if primeiro not in mapa:
                    mapa[primeiro] = str(emp_id)
        return mapa
    except Exception as e:
        print(f"Aviso: Não foi possível obter mapa de IDs do Supabase: {e}")
        return {}

def renomear_arquivo_especifico(emp_id, primeiro_nome):
    """
    Aguarda o arquivo 'Por Item de Venda.pdf' existir e renomeia para 'ID_Nome.pdf' (ex: 2957_Raissa.pdf).
    """
    origem = os.path.join(pasta_download, NOME_PADRAO_DOWNLOAD)
    
    if emp_id:
        nome_arquivo = f"{emp_id}_{primeiro_nome}.pdf"
    else:
        nome_arquivo = f"{primeiro_nome}.pdf"
        
    destino = os.path.join(pasta_download, nome_arquivo)
    
    # Tratamento para nomes duplicados caso não haja ID
    contador = 1
    while os.path.exists(destino) and not emp_id:
        destino = os.path.join(pasta_download, f"{primeiro_nome}_{contador}.pdf")
        contador += 1

    # Tenta renomear (com 5 tentativas em caso de bloqueio do Windows)
    for tentativa in range(5):
        try:
            if os.path.exists(origem):
                time.sleep(1) # Respira fundo para o SO liberar o arquivo
                
                os.rename(origem, destino)
                print(f"SUCESSO: {os.path.basename(origem)} -> {os.path.basename(destino)}")
                return True
            else:
                time.sleep(1) # Arquivo ainda não apareceu, espera
        except PermissionError:
            print(f"Arquivo bloqueado (Tentativa {tentativa+1}/5)...")
            time.sleep(2)
        except Exception as e:
            print(f"Erro ao renomear: {e}")
            return False
            
    return False


# --- INÍCIO DO PROCESSO ---
try:
    # 1. LOGIN
    driver.get(URL_LOGIN)
    try:
        wait.until(EC.presence_of_element_located((By.XPATH, "//input[@type='password']")))
        driver.find_element(By.XPATH, "//input[@type='text']").send_keys(USUARIO)
        driver.find_element(By.XPATH, "//input[@type='password']").send_keys(SENHA)
        driver.find_element(By.XPATH, "//button[@type='submit'] | //button[contains(., 'Entrar')]").click()
        time.sleep(3)
    except:
        print("Já logado.")

    # 2. LISTA DE CLIENTES
    print("Indo para lista de clientes...")
    driver.get(URL_LISTA_CLIENTES)
    time.sleep(5)
    
    # Obtém mapeamento de IDs do banco Supabase
    mapa_ids = obter_mapa_funcionarios()
    
    # Pega lista de nomes
    elementos_nomes = driver.find_elements(By.XPATH, "//tbody/tr/td[1]")
    lista_nomes = [elem.text.strip() for elem in elementos_nomes if elem.text.strip() != ""]
    
    print(f"Clientes encontrados: {len(lista_nomes)}")
    print("-" * 30)

    # 3. LOOP
    for nome_completo in lista_nomes:
        primeiro_nome = nome_completo.split()[0].capitalize()
        emp_id = mapa_ids.get(nome_completo.strip().lower()) or mapa_ids.get(primeiro_nome.strip().lower())
        
        # Nome do arquivo esperado
        nome_esperado = f"{emp_id}_{primeiro_nome}.pdf" if emp_id else f"{primeiro_nome}.pdf"
        
        # Ignora se já existe o arquivo final (pula quem já foi baixado corretamente)
        if os.path.exists(os.path.join(pasta_download, nome_esperado)):
            print(f"Pular: {nome_esperado} já existe.")
            continue

        print(f"Processando: {nome_completo} (ID: {emp_id or 'Desconhecido'})...")
        
        try:
            # Limpa qualquer modal/backdrop que tenha ficado aberto da iteração anterior
            fechar_modais_e_limpar_backdrop()

            # Garante estar na lista de clientes
            if "clienteDetail" in driver.current_url or len(driver.find_elements(By.XPATH, f"//td[contains(text(), '{nome_completo}')]")) == 0:
                driver.get(URL_LISTA_CLIENTES)
                time.sleep(2)
                fechar_modais_e_limpar_backdrop()

            # Clica no cliente usando JavaScript para evitar ElementClickInterceptedException
            elem_cliente = wait.until(EC.presence_of_element_located((By.XPATH, f"//td[contains(text(), '{nome_completo}')]")))
            driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", elem_cliente)
            time.sleep(0.5)
            driver.execute_script("arguments[0].click();", elem_cliente)
            time.sleep(2)

            # 1. Limpa qualquer lixo anterior para garantir nome único
            limpar_arquivo_temporario()

            # 2. Abre Menu Débitos
            try:
                menu_debitos = wait_curto.until(EC.presence_of_element_located((By.XPATH, "//h3[contains(., 'Débitos pendentes')]")))
                driver.execute_script("arguments[0].click();", menu_debitos)
                time.sleep(1)
            except Exception:
                print(f"Aviso: Cliente {primeiro_nome} não possui 'Débitos pendentes' ou conta está zerada.")
                continue

            # 3. Clica Download
            try:
                botao_download = wait_curto.until(EC.presence_of_element_located((By.XPATH, "//button[contains(., 'Por Item de Venda')]")))
                driver.execute_script("arguments[0].click();", botao_download)
            except Exception:
                print(f"Aviso: Botão 'Por Item de Venda' não encontrado para {primeiro_nome} (conta zerada/sem débitos).")
                continue

            # 4. Monitoramento INTELIGENTE
            timeout = 15
            tempo = 0
            arquivo_baixado = False
            
            while tempo < timeout:
                caminho_alvo = os.path.join(pasta_download, NOME_PADRAO_DOWNLOAD)
                caminho_crdownload = caminho_alvo + ".crdownload"
                
                if os.path.exists(caminho_alvo) and not os.path.exists(caminho_crdownload):
                    if os.path.getsize(caminho_alvo) > 0:
                        arquivo_baixado = True
                        break
                
                time.sleep(1)
                tempo += 1
            
            if arquivo_baixado:
                renomear_arquivo_especifico(emp_id, primeiro_nome)
            else:
                print(f"ERRO: Timeout no download de {primeiro_nome} (conta zerada ou sem vendas).")


        except Exception as e:
            print(f"Erro no fluxo de {primeiro_nome}: {e}")

        finally:
            # SEMPRE limpa modais e backdrops ao finalizar a iteração do cliente
            fechar_modais_e_limpar_backdrop()

    print("-" * 30)
    print("Finalizado!")

except Exception as e:
    print(f"Erro Geral: {e}")