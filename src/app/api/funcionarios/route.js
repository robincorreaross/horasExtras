import sql from '@/lib/db';
import { NextResponse } from 'next/server';

// GET /api/funcionarios - Listar todos os funcionários com saldo
export async function GET() {
  try {
    const funcionarios = await sql`
      SELECT 
        f.id, f.nome, f.telefone, f.cargo, f.data_admissao, f.ativo, COALESCE(f.saldo_inicial, 0) as saldo_inicial,
        COALESCE(SUM(m.horas_debito_credito), 0) as soma_movimentacoes,
        (COALESCE(f.saldo_inicial, 0) + COALESCE(SUM(m.horas_debito_credito), 0)) as saldo_atual
      FROM funcionarios_he f
      LEFT JOIN movimentacoes_he m ON f.id = m.funcionario_id
      GROUP BY f.id
      ORDER BY f.nome ASC
    `;
    return NextResponse.json(funcionarios);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/funcionarios - Adicionar funcionário
export async function POST(request) {
  try {
    const body = await request.json();
    const { nome, telefone, cargo, data_admissao, saldo_inicial } = body;

    const result = await sql`
      INSERT INTO funcionarios_he (nome, telefone, cargo, data_admissao, saldo_inicial)
      VALUES (${nome}, ${telefone}, ${cargo}, ${data_admissao}, ${isNaN(parseFloat(saldo_inicial)) ? 0 : parseFloat(saldo_inicial)})
      RETURNING *
    `;

    return NextResponse.json(result[0], { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
