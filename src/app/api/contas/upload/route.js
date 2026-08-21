import { createClient } from '@supabase/supabase-js';
import sql from '@/lib/db';
import { NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
});

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const funcionarioId = formData.get('funcionario_id');
    const funcionarioNome = formData.get('funcionario_nome');
    const tipoDoc = formData.get('tipo_doc') || 'conta'; // 'conta' ou 'holerite'

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 });
    }

    if (!funcionarioId || !funcionarioNome) {
      return NextResponse.json({ error: 'Dados do funcionário incompletos' }, { status: 400 });
    }

    // Definir bucket e caminho do arquivo
    const bucketName = tipoDoc === 'holerite' ? 'holerites' : 'conta-pdf';
    
    // Nome limpo sem caracteres especiais para o arquivo
    const nomeLimpo = funcionarioNome.trim().split(' ')[0].replace(/[^a-zA-Z0-9_-]/g, '');
    const filename = `${nomeLimpo}.pdf`;

    // Converter Blob/File em Buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Garantir que o bucket exista (ou tentar upload direto)
    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(filename, buffer, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadError) {
      // Se o bucket não existir, tentar criar o bucket ou upload com fallback
      console.error('Erro no upload Supabase Storage:', uploadError);
      return NextResponse.json(
        { error: `Erro no upload para Supabase: ${uploadError.message}` },
        { status: 500 }
      );
    }

    // Obter URL pública
    const { data: publicUrlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(filename);

    const publicUrl = publicUrlData?.publicUrl;

    // Atualizar no banco postgres
    if (tipoDoc === 'holerite') {
      await sql`
        UPDATE funcionarios
        SET "holeritePDF" = ${publicUrl}
        WHERE id = ${funcionarioId}
      `;
    } else {
      await sql`
        UPDATE funcionarios
        SET "contaPDF" = ${publicUrl}
        WHERE id = ${funcionarioId}
      `;
    }

    return NextResponse.json({
      success: true,
      url: publicUrl,
      tipo: tipoDoc,
      funcionario_id: funcionarioId,
    });
  } catch (err) {
    console.error('Erro geral no upload API:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
