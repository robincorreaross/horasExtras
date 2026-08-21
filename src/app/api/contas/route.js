import sql from '@/lib/db';
import { NextResponse } from 'next/server';

// GET /api/contas - Listar todos os funcionários da tabela de contas
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const loja = searchParams.get('loja');
    const search = searchParams.get('search');

    let query = sql`
      SELECT 
        id, 
        nome, 
        telefone, 
        loja, 
        COALESCE("valorConta", '0') as "valorConta", 
        "contaPDF", 
        "holeritePDF", 
        "imagemHoraExtra", 
        created_at, 
        COALESCE("Ativo", true) as "Ativo"
      FROM funcionarios
      WHERE 1=1
    `;

    if (loja && loja !== 'TODAS') {
      query = sql`
        SELECT 
          id, nome, telefone, loja, COALESCE("valorConta", '0') as "valorConta", 
          "contaPDF", "holeritePDF", "imagemHoraExtra", created_at, COALESCE("Ativo", true) as "Ativo"
        FROM funcionarios
        WHERE loja = ${loja}
        ORDER BY nome ASC
      `;
    } else {
      query = sql`
        SELECT 
          id, nome, telefone, loja, COALESCE("valorConta", '0') as "valorConta", 
          "contaPDF", "holeritePDF", "imagemHoraExtra", created_at, COALESCE("Ativo", true) as "Ativo"
        FROM funcionarios
        ORDER BY nome ASC
      `;
    }

    const rows = await query;
    return NextResponse.json(rows);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/contas - Cadastrar novo funcionário na tabela de contas
export async function POST(request) {
  try {
    const body = await request.json();
    const { id, nome, telefone, loja, valorConta, contaPDF, holeritePDF, Ativo } = body;

    if (!nome) {
      return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 });
    }

    const valStr = valorConta !== undefined ? String(valorConta) : '0';
    const isAtivo = Ativo !== undefined ? Boolean(Ativo) : true;

    let result;
    if (id) {
      result = await sql`
        INSERT INTO funcionarios (id, nome, telefone, loja, "valorConta", "contaPDF", "holeritePDF", "Ativo")
        VALUES (${id}, ${nome}, ${telefone || ''}, ${loja || ''}, ${valStr}, ${contaPDF || null}, ${holeritePDF || null}, ${isAtivo})
        RETURNING *
      `;
    } else {
      result = await sql`
        INSERT INTO funcionarios (nome, telefone, loja, "valorConta", "contaPDF", "holeritePDF", "Ativo")
        VALUES (${nome}, ${telefone || ''}, ${loja || ''}, ${valStr}, ${contaPDF || null}, ${holeritePDF || null}, ${isAtivo})
        RETURNING *
      `;
    }

    return NextResponse.json(result[0], { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PUT /api/contas - Atualizar dados do funcionário
export async function PUT(request) {
  try {
    const body = await request.json();
    const { id, nome, telefone, loja, valorConta, contaPDF, holeritePDF, Ativo } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID do funcionário é obrigatório' }, { status: 400 });
    }

    const fieldsToUpdate = {};
    if (nome !== undefined) fieldsToUpdate.nome = nome;
    if (telefone !== undefined) fieldsToUpdate.telefone = telefone;
    if (loja !== undefined) fieldsToUpdate.loja = loja;
    if (valorConta !== undefined) fieldsToUpdate['valorConta'] = String(valorConta);
    if (contaPDF !== undefined) fieldsToUpdate['contaPDF'] = contaPDF;
    if (holeritePDF !== undefined) fieldsToUpdate['holeritePDF'] = holeritePDF;
    if (Ativo !== undefined) fieldsToUpdate['Ativo'] = Boolean(Ativo);

    const result = await sql`
      UPDATE funcionarios
      SET ${sql(fieldsToUpdate)}
      WHERE id = ${id}
      RETURNING *
    `;

    if (result.length === 0) {
      return NextResponse.json({ error: 'Funcionário não encontrado' }, { status: 404 });
    }

    return NextResponse.json(result[0]);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
