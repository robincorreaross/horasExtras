import sql from '@/lib/db';
import { NextResponse } from 'next/server';

// GET /api/funcionarios/[id] - Buscar colaborador unificado por ID (UUID ou id_loja)
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month');
    const year = searchParams.get('year');

    let result;

    if (month !== null && year !== null) {
      const pgMonth = parseInt(month) + 1;
      const pgYear = parseInt(year);
      const endDate = new Date(pgYear, pgMonth, 0).toISOString().split('T')[0];

      result = await sql`
        SELECT 
          c.*,
          (COALESCE(c.saldo_inicial, 0) + COALESCE((SELECT SUM(horas_debito_credito) FROM movimentacoes_he WHERE funcionario_id = c.id AND data_registro <= ${endDate}), 0)) as saldo_atual
        FROM colaboradores c
        WHERE c.id::text = ${id} OR c.id_loja::text = ${id}
      `;
    } else {
      result = await sql`
        SELECT 
          c.*,
          (COALESCE(c.saldo_inicial, 0) + COALESCE((SELECT SUM(horas_debito_credito) FROM movimentacoes_he WHERE funcionario_id = c.id), 0)) as saldo_atual
        FROM colaboradores c
        WHERE c.id::text = ${id} OR c.id_loja::text = ${id}
      `;
    }

    if (result.length === 0) {
      return NextResponse.json({ error: 'Colaborador não encontrado' }, { status: 404 });
    }
    return NextResponse.json(result[0]);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PUT /api/funcionarios/[id] - Atualizar colaborador unificado
export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { id_loja, nome, telefone, loja, data_admissao, ativo, saldo_inicial, valorConta, contaPDF, holeritePDF } = body;

    const fieldsToUpdate = {};
    if (id_loja !== undefined) fieldsToUpdate.id_loja = id_loja ? parseInt(id_loja) : null;
    if (nome !== undefined) fieldsToUpdate.nome = nome;
    if (telefone !== undefined) fieldsToUpdate.telefone = telefone;
    if (loja !== undefined) fieldsToUpdate.loja = loja;
    if (data_admissao !== undefined) fieldsToUpdate.data_admissao = data_admissao || null;
    if (ativo !== undefined) fieldsToUpdate.ativo = Boolean(ativo);
    if (saldo_inicial !== undefined) fieldsToUpdate.saldo_inicial = isNaN(parseFloat(saldo_inicial)) ? 0 : parseFloat(saldo_inicial);
    if (valorConta !== undefined) fieldsToUpdate['valorConta'] = String(valorConta);
    if (contaPDF !== undefined) fieldsToUpdate['contaPDF'] = contaPDF;
    if (holeritePDF !== undefined) fieldsToUpdate['holeritePDF'] = holeritePDF;

    const result = await sql`
      UPDATE colaboradores 
      SET ${sql(fieldsToUpdate)}
      WHERE id::text = ${id} OR id_loja::text = ${id}
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

// DELETE /api/funcionarios/[id] - Remover colaborador
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    await sql`DELETE FROM colaboradores WHERE id::text = ${id} OR id_loja::text = ${id}`;
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
