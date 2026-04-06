import sql from '@/lib/db';
import { NextResponse } from 'next/server';

// GET /api/funcionarios/[id] - Buscar funcionário por ID
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const result = await sql`
      SELECT 
        f.*,
        (COALESCE(f.saldo_inicial, 0) + COALESCE((SELECT SUM(horas_debito_credito) FROM movimentacoes_he WHERE funcionario_id = f.id), 0)) as saldo_atual
      FROM funcionarios_he f
      WHERE f.id = ${id}
    `;
    if (result.length === 0) {
      return NextResponse.json({ error: 'Funcionário não encontrado' }, { status: 404 });
    }
    return NextResponse.json(result[0]);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PUT /api/funcionarios/[id] - Atualizar funcionário
export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { nome, telefone, cargo, data_admissao, ativo, saldo_inicial } = body;

    const result = await sql`
      UPDATE funcionarios_he 
      SET nome = ${nome}, telefone = ${telefone}, cargo = ${cargo}, 
          data_admissao = ${data_admissao}, ativo = ${ativo}, saldo_inicial = ${isNaN(parseFloat(saldo_inicial)) ? 0 : parseFloat(saldo_inicial)}
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

// DELETE /api/funcionarios/[id] - Remover funcionário
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    await sql`DELETE FROM funcionarios_he WHERE id = ${id}`;
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
