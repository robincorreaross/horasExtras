import sys
import io
import os
import requests
import psycopg2
import pandas as pd
from datetime import datetime
from pytz import timezone
from sqlalchemy import create_engine

# Força a codificação UTF-8 no console do Windows para evitar UnicodeEncodeError com emojis
if hasattr(sys.stdout, 'buffer'):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'buffer'):
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')


# ============================
# CONFIGURAÇÕES: BANCO LOCAL (POSTGRES)
# ============================
DB_LOCAL = {
    "dbname": "farmasete_loja01",
    "user": "leitura_164004882",
    "password": "r88L9Vm10rEZrVU",
    "host": "191.167.1.80",
    "port": 5432
}

# ============================
# CONFIGURAÇÕES: BANCO SQL SERVER
# ============================
DB_SERVER = "srv-sete"
DB_DATABASE = "Pharm"
DB_USER = "sa"
DB_PASSWORD = "alex3103"
CONN_STR_SQLSERVER = f"mssql+pyodbc://{DB_USER}:{DB_PASSWORD}@{DB_SERVER}/{DB_DATABASE}?driver=SQL+Server"

# ==============================
# CONFIGURAÇÕES: SUPABASE (BANCO)
# ==============================
DB_SUPABASE = {
    "dbname": "postgres",
    "user": "postgres.vfpgqqfqoxfzwigntcua",
    "password": "BD@163517bd@",
    "host": "aws-0-sa-east-1.pooler.supabase.com",
    "port": 5432
}

# ==============================
# CONFIGURAÇÕES: SUPABASE (STORAGE) E ARQUIVOS
# ==============================
# Coloque aqui a sua chave service_role (a mesma usada no n8n)
SUPABASE_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZmcGdxcWZxb3hmendpZ250Y3VhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTcwMjc4MywiZXhwIjoyMDY3Mjc4NzgzfQ.j2OeMLpvSeRnpoBq7ygDFAJpkS2oWMxOIcorQ2IwCoY"
SUPABASE_PROJETO_URL = "https://vfpgqqfqoxfzwigntcua.supabase.co"
BUCKET_NOME = "conta-pdf"
PASTA_PDFS = r"D:\work-Ross\Administrativo\Docs Colaboradores\enviarExtrato\extrato_contas"



# ==============================
# 1. BUSCAR DADOS DO POSTGRES
# ==============================
def buscar_convenio_postgres():
    query = """
        SELECT
            c.codigo AS codigo_cliente,
            p.nome AS funcionario,
            SUM(cr.valor) AS valor,
            cr.datafechamento
        FROM crediarioreceber cr
        JOIN cliente c ON c.id = cr.clienteid
        JOIN pessoa p ON p.id = c.pessoaid
        WHERE cr.status = 'A'
          AND c.crediarioid = 146907
          AND cr.datafechamento = date_trunc('month', CURRENT_DATE) + interval '16 day'
        GROUP BY c.codigo, p.nome, cr.datafechamento;
    """
    try:
        print("⏳ Lendo dados do banco Postgres (farmasete_loja01)...")
        conn = psycopg2.connect(**DB_LOCAL)
        df = pd.read_sql_query(query, conn)
        conn.close()
        
        if df.empty:
            return pd.DataFrame(), None
            
        data_fechamento = df["datafechamento"].iloc[0]
        # Padronizando colunas para o merge
        df = df[["codigo_cliente", "funcionario", "valor"]] 
        return df, data_fechamento
    except Exception as e:
        print(f"❌ Erro ao ler Postgres: {e}")
        return pd.DataFrame(), None

# ==============================
# 2. BUSCAR DADOS DO SQL SERVER
# ==============================
def buscar_convenio_sqlserver():
    query = """
        SELECT 
            cl.CODIGO AS codigo_cliente,
            cl.NOME AS funcionario,
            SUM(cb.VALOR_COMPRA) AS valor
        FROM COBRANCA cb
        JOIN CLIENTE cl ON cb.COD_CLIENTE = cl.CODIGO
        WHERE cb.AB_PG = 'ABERTO'
          AND cl.CONVENIO = 'S'
          AND cl.CODCONV IN ('45', '64')
          AND CAST(cb.DATA_COMPRA AS DATE) <= CAST(GETDATE() AS DATE)
        GROUP BY cl.CODIGO, cl.NOME;
    """
    try:
        print(f"⏳ Lendo dados do banco SQL Server ({DB_SERVER})...")
        engine = create_engine(CONN_STR_SQLSERVER)
        df = pd.read_sql(query, engine)
        engine.dispose()
        
        if df.empty:
            return pd.DataFrame()
            
        # As colunas já saem padronizadas do AS no select
        return df
    except Exception as e:
        print(f"❌ Erro ao ler SQL Server: {e}")
        return pd.DataFrame()

# ==============================
# 3. ATUALIZAR SUPABASE (BANCO)
# ==============================
def atualizar_supabase(df_final):
    """
    Zera o valor da conta de todos os funcionários e atualiza com os débitos consolidados.
    """
    print("\n⏳ Conectando ao Supabase para atualizar contas...")
    conn = psycopg2.connect(**DB_SUPABASE)
    cur = conn.cursor()

    # 1. Zera as contas de todo mundo no Supabase
    cur.execute("""
        UPDATE funcionarios
        SET "valorConta" = 0;
    """)
    print("🧹 Todas as contas no Supabase foram zeradas com sucesso.")

    # 2. Atualiza os valores consolidados
    for row in df_final.itertuples():
        cur.execute("""
            UPDATE funcionarios
            SET "valorConta" = %s
            WHERE id = %s;
        """, (row.valor, row.codigo_cliente))
        print(f"🔄 Atualizado funcionario ID={row.codigo_cliente} -> R$ {row.valor:.2f}")

    conn.commit()
    cur.close()
    conn.close()

# ==============================
# 4. MONTAR MENSAGEM
# ==============================
def montar_mensagem(df_final, data_fechamento):
    # Se não houver data do Postgres, usa a data atual como fallback
    if data_fechamento:
        data_fmt = data_fechamento.strftime("%d/%m/%Y")
    else:
        data_fmt = datetime.now().strftime("%d/%m/%Y")
        
    mensagem = f"📊 Valores em aberto para o fechamento {data_fmt}:\n\n"
    for row in df_final.itertuples():
        valor_fmt = f"R$ {row.valor:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
        mensagem += f"- {row.funcionario}: {valor_fmt}\n"
    return mensagem

# ==============================
# 5. UPLOAD DE PDFS PARA O STORAGE
# ==============================
def upload_pdfs_supabase():
    print("\n📂 Verificando pasta de PDFs para envio...")
    
    # Verifica se a pasta existe
    if not os.path.exists(PASTA_PDFS):
        print(f"⚠️ A pasta não foi encontrada: {PASTA_PDFS}")
        return

    # Lista apenas os arquivos com extensão .pdf
    arquivos = [f for f in os.listdir(PASTA_PDFS) if f.lower().endswith('.pdf')]
    
    if not arquivos:
        print("📭 Nenhum arquivo PDF encontrado na pasta. Ignorando upload.")
        return

    print(f"📄 Encontrados {len(arquivos)} arquivo(s) PDF.")
    
    # Pede confirmação do usuário (ou confirma automaticamente se executado via WebApp/Auto)
    import sys
    is_auto = os.environ.get("AUTO_CONFIRM", "").lower() == "true" or "--auto" in sys.argv
    if is_auto:
        resposta = 's'
        print("🤖 Confirmação automática ativada via WebApp.")
    else:
        resposta = input("Deseja fazer o upload destes arquivos para o Supabase? (s/n): ").strip().lower()
    
    if resposta != 's':

        print("❌ Upload cancelado pelo usuário.")
        return

    print("⏳ Iniciando upload dos arquivos...")
    
    headers = {
        "Authorization": f"Bearer {SUPABASE_API_KEY}",
        "apikey": SUPABASE_API_KEY,
        "Content-Type": "application/pdf",
        "x-upsert": "true"
    }


    sucessos = 0
    erros = 0

    for arquivo in arquivos:
        caminho_completo = os.path.join(PASTA_PDFS, arquivo)
        url_upload = f"{SUPABASE_PROJETO_URL}/storage/v1/object/{BUCKET_NOME}/{arquivo}"
        
        try:
            with open(caminho_completo, 'rb') as f:
                dados_arquivo = f.read()
                
            response = requests.post(url_upload, headers=headers, data=dados_arquivo)
            
            # 200 = OK, 201 = Criado com sucesso
            if response.status_code in [200, 201]:
                print(f"✅ Sucesso: {arquivo}")
                sucessos += 1
            else:
                print(f"❌ Erro ao enviar {arquivo}: {response.status_code} - {response.text}")
                erros += 1
        except Exception as e:
            print(f"❌ Erro inesperado ao processar {arquivo}: {e}")
            erros += 1
            
    print(f"\n📈 Resumo do Upload: {sucessos} enviados com sucesso, {erros} erros.")


# ==============================
# MAIN
# ==============================
if __name__ == "__main__":
    print("🚀 Iniciando consolidação de convênios...\n")
    
    # Busca dados das duas fontes
    df_pg, data_fechamento = buscar_convenio_postgres()
    df_sql = buscar_convenio_sqlserver()

    # Junta as duas tabelas
    dfs_para_juntar = [df for df in [df_pg, df_sql] if not df.empty]

    if not dfs_para_juntar:
        print("📊 Nenhum valor em aberto encontrado nos dois bancos. 📊")
    else:
        # Concatena e soma os valores agrupando pelo código do cliente
        df_final = pd.concat(dfs_para_juntar)
        df_final = df_final.groupby('codigo_cliente', as_index=False).agg({
            'funcionario': 'first', # Mantém o primeiro nome encontrado para aquele código
            'valor': 'sum'          # Soma os valores se ele estiver nos dois bancos
        })
        
        # Ordena por nome
        df_final = df_final.sort_values('funcionario')

        # Atualiza Supabase
        atualizar_supabase(df_final)

        # Exibe mensagem final
        msg = montar_mensagem(df_final, data_fechamento)
        print("\n--- Mensagem ---\n")
        print(msg)
        
    # Executa a rotina de upload dos PDFs
    upload_pdfs_supabase()