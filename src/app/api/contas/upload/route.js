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
    const funcionarioNome = formData.get('funcionario_nome') || 'Colaborador';
    const tipoDoc = formData.get('tipo_doc') || 'conta'; // 'conta' ou 'holerite'

    if (!file || !funcionarioId) {
      return NextResponse.json(
        { success: false, error: 'Arquivo e ID do funcionário são obrigatórios' },
        { status: 400 }
      );
    }

    const bucketName = tipoDoc === 'holerite' ? 'holerites' : 'conta-pdf';
    const prefix = tipoDoc === 'holerite' ? 'Holerite_' : '';
    const cleanName = funcionarioNome.trim().split(' ')[0];
    const fileName = `${prefix}${cleanName}_${funcionarioId}.pdf`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 1. Upload para o Supabase Storage com overwrite
    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(fileName, buffer, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadError) {
      console.error('Erro no Supabase Storage:', uploadError);
      return NextResponse.json(
        { success: false, error: `Erro no upload: ${uploadError.message}` },
        { status: 500 }
      );
    }

    // 2. Obter URL pública
    const { data: publicUrlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(fileName);

    const publicUrl = publicUrlData?.publicUrl;

    // 3. Atualizar link na tabela colaboradores
    if (tipoDoc === 'holerite') {
      await sql`
        UPDATE colaboradores
        SET "holeritePDF" = ${publicUrl}
        WHERE id::text = ${funcionarioId} OR id_loja::text = ${funcionarioId}
      `;
    } else {
      await sql`
        UPDATE colaboradores
        SET "contaPDF" = ${publicUrl}
        WHERE id::text = ${funcionarioId} OR id_loja::text = ${funcionarioId}
      `;
    }

    return NextResponse.json({
      success: true,
      url: publicUrl,
      fileName,
      tipoDoc,
    });
  } catch (err) {
    console.error('Erro na API de upload:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
