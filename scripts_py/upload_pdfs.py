import sys
import io
import os
import requests
import psycopg2

# Força a codificação UTF-8 no console do Windows
if hasattr(sys.stdout, 'buffer'):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'buffer'):
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# ==============================
# CONFIGURAÇÕES: SUPABASE (BANCO E STORAGE)
# ==============================
DB_SUPABASE = {
    "dbname": "postgres",
    "user": "postgres.vfpgqqfqoxfzwigntcua",
    "password": "BD@163517bd@",
    "host": "aws-0-sa-east-1.pooler.supabase.com",
    "port": 5432
}

SUPABASE_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZmcGdxcWZxb3hmendpZ250Y3VhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTcwMjc4MywiZXhwIjoyMDY3Mjc4NzgzfQ.j2OeMLpvSeRnpoBq7ygDFAJpkS2oWMxOIcorQ2IwCoY"
SUPABASE_PROJETO_URL = "https://vfpgqqfqoxfzwigntcua.supabase.co"

DIR_CONTAS = r"D:\work-Ross\Administrativo\Docs Colaboradores\enviarExtrato\extrato_contas"
DIR_HOLERITES = r"D:\work-Ross\Administrativo\Docs Colaboradores\enviarExtrato\holerites"

def find_matching_employee(pdf_name_clean, employees):
    target = pdf_name_clean.lower().strip()

    # 1. Tentar extrair ID numérico do início ou do fim do nome do arquivo
    import re
    id_match = re.search(r'^(\d+)(?:[_\s-]|$)|(?:[_\s-]|^)(\d+)$', target)
    if id_match:
        extracted_id = id_match.group(1) or id_match.group(2)
        for emp in employees:
            if str(emp.get('id_loja')) == str(extracted_id):
                return emp

    # 2. Match por nome completo exato
    for emp in employees:
        if emp.get('nome') and emp['nome'].lower().strip() == target:
            return emp

    # 3. Limpa dígitos
    clean = re.sub(r'^\d+[_\s-]*', '', target)
    clean = re.sub(r'[_\s-]*\d+$', '', clean).strip()

    if clean:
        # Match pelo primeiro nome
        for emp in employees:
            if emp.get('nome'):
                p_nome = emp['nome'].strip().split(' ')[0].lower()
                if p_nome == clean:
                    return emp
        # Match por inclusão
        for emp in employees:
            if emp.get('nome'):
                e_nome = emp['nome'].lower().strip()
                if clean in e_nome or e_nome.split(' ')[0] in clean:
                    return emp

    return None

def upload_folder(folder_path, bucket_name, field_name, employees, conn):
    if not os.path.exists(folder_path):
        print(f"⚠️ Pasta não encontrada: {folder_path}")
        return 0

    files = [f for f in os.listdir(folder_path) if f.lower().endswith('.pdf')]
    if not files:
        print(f"📭 Nenhum arquivo PDF encontrado em {folder_path}")
        return 0

    print(f"📁 Encontrados {len(files)} PDF(s) em {folder_path} para o bucket '{bucket_name}'.")

    headers = {
        "Authorization": f"Bearer {SUPABASE_API_KEY}",
        "apikey": SUPABASE_API_KEY,
        "Content-Type": "application/pdf",
        "x-upsert": "true"
    }

    cur = conn.cursor()
    success = 0

    for file in files:
        pdf_name_clean = os.path.splitext(file)[0]
        emp = find_matching_employee(pdf_name_clean, employees)

        if not emp:
            print(f"⚠️ {file}: Nenhum colaborador correspondente no banco.")
            continue

        file_path = os.path.join(folder_path, file)
        ref_code = emp.get('id_loja') or emp['nome'].strip().split(' ')[0]
        first_name = emp['nome'].strip().split(' ')[0]
        
        if bucket_name == 'holerites':
            filename_in_bucket = f"Holerite_{first_name}_{ref_code}.pdf"
        else:
            filename_in_bucket = f"{first_name}_{ref_code}.pdf"

        try:
            with open(file_path, 'rb') as f:
                data = f.read()

            url_upload = f"{SUPABASE_PROJETO_URL}/storage/v1/object/{bucket_name}/{filename_in_bucket}"
            res = requests.post(url_upload, headers=headers, data=data)

            if res.status_code in [200, 201]:
                public_url = f"{SUPABASE_PROJETO_URL}/storage/v1/object/public/{bucket_name}/{filename_in_bucket}"
                
                # Atualiza no banco
                query = f'UPDATE colaboradores SET "{field_name}" = %s WHERE id = %s;'
                cur.execute(query, (public_url, emp['id']))
                conn.commit()
                print(f"✅ {file} -> {emp['nome']} ({public_url})")
                success += 1
            else:
                print(f"❌ Erro ao enviar {file}: {res.status_code} - {res.text}")
        except Exception as e:
            print(f"❌ Erro ao processar {file}: {e}")

    cur.close()
    return success

def main():
    print("🚀 Iniciando upload de PDFs locais para o Supabase...\n")
    
    try:
        conn = psycopg2.connect(**DB_SUPABASE)
        cur = conn.cursor()
        cur.execute('SELECT id, id_loja, nome FROM colaboradores;')
        rows = cur.fetchall()
        employees = [{'id': r[0], 'id_loja': r[1], 'nome': r[2]} for r in rows]
        cur.close()
        print(f"👥 {len(employees)} colaboradores carregados do Supabase.\n")
    except Exception as e:
        print(f"❌ Erro ao conectar no Supabase: {e}")
        return

    # 1. Extratos de Contas
    print("--- 1. EXTRATOS DE CONTAS ---")
    c_ok = upload_folder(DIR_CONTAS, "conta-pdf", "contaPDF", employees, conn)

    # 2. Holerites
    print("\n--- 2. HOLERITES ---")
    h_ok = upload_folder(DIR_HOLERITES, "holerites", "holeritePDF", employees, conn)

    conn.close()
    print(f"\n📈 Finalizado: {c_ok} extratos de contas e {h_ok} holerites enviados com sucesso!")

if __name__ == "__main__":
    main()
