import sql from '@/lib/db';
import { NextResponse } from 'next/server';

// GET /api/contas - Listar todos os colaboradores da tabela unificada
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const loja = searchParams.get('loja');

    let query;
    if (loja && loja !== 'TODAS') {
      query = sql`
        SELECT 
          id, 
          id_loja,
          nome, 
          telefone, 
          loja, 
          COALESCE("valorConta", '0') as "valorConta", 
          "contaPDF", 
          "holeritePDF", 
          "imagemHoraExtra", 
          created_at, 
          ativo as "Ativo"
        FROM colaboradores
        WHERE loja = ${loja}
        ORDER BY nome ASC
      `;
    } else {
      query = sql`
        SELECT 
          id, 
          id_loja,
          nome, 
          telefone, 
          loja, 
          COALESCE("valorConta", '0') as "valorConta", 
          "contaPDF", 
          "holeritePDF", 
          "imagemHoraExtra", 
          created_at, 
          ativo as "Ativo"
        FROM colaboradores
        ORDER BY nome ASC
      `;
    }

    const rows = await query;
    return NextResponse.json(rows);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/contas - Cadastrar novo colaborador
export async function POST(request) {
  try {
    const body = await request.json();
    const { id_loja, id, nome, telefone, loja, valorConta, contaPDF, holeritePDF, Ativo, ativo } = body;

    if (!nome) {
      return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 });
    }

    const valStr = valorConta !== undefined ? String(valorConta) : '0';
    const isAtivo = (Ativo !== undefined ? Ativo : (ativo !== undefined ? ativo : true)) !== false;
    const finalIdLoja = id_loja ? parseInt(id_loja) : (id && !isNaN(parseInt(id)) ? parseInt(id) : null);

    const result = await sql`
      INSERT INTO colaboradores (id_loja, nome, telefone, loja, "valorConta", "contaPDF", "holeritePDF", ativo)
      VALUES (${finalIdLoja}, ${nome}, ${telefone || ''}, ${loja || ''}, ${valStr}, ${contaPDF || null}, ${holeritePDF || null}, ${isAtivo})
      RETURNING *
    `;

    return NextResponse.json(result[0], { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PUT /api/contas - Atualizar dados do colaborador
export async function PUT(request) {
  try {
    const body = await request.json();
    const { id, id_loja, nome, telefone, loja, valorConta, contaPDF, holeritePDF, Ativo, ativo } = body;

    if (!id && !id_loja) {
      return NextResponse.json({ error: 'ID do funcionário é obrigatório' }, { status: 400 });
    }

    const fieldsToUpdate = {};
    if (id_loja !== undefined) fieldsToUpdate.id_loja = id_loja ? parseInt(id_loja) : null;
    if (nome !== undefined) fieldsToUpdate.nome = nome;
    if (telefone !== undefined) fieldsToUpdate.telefone = telefone;
    if (loja !== undefined) fieldsToUpdate.loja = loja;
    if (valorConta !== undefined) fieldsToUpdate['valorConta'] = String(valorConta);
    if (contaPDF !== undefined) fieldsToUpdate['contaPDF'] = contaPDF;
    if (holeritePDF !== undefined) fieldsToUpdate['holeritePDF'] = holeritePDF;
    if (Ativo !== undefined || ativo !== undefined) {
      fieldsToUpdate.ativo = (Ativo !== undefined ? Ativo : ativo) !== false;
    }

    const targetId = id || id_loja;

    const result = await sql`
      UPDATE colaboradores
      SET ${sql(fieldsToUpdate)}
      WHERE id::text = ${targetId} OR id_loja::text = ${targetId}
      RETURNING *
    `;

    if (result.length === 0) {
      return NextResponse.json({ error: 'Colaborador não encontrado' }, { status: 404 });
    }

    return NextResponse.json(result[0]);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
