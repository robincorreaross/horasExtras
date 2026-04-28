import sql from '@/lib/db';
import { NextResponse } from 'next/server';

// GET /api/movimentacoes?funcionario_id=xxx&mes=2026-03
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const funcionarioId = searchParams.get('funcionario_id');
    const mes = searchParams.get('mes'); // formato: "2026-03"

    if (!funcionarioId) {
      return NextResponse.json({ error: 'funcionario_id é obrigatório' }, { status: 400 });
    }

    let movimentacoes;
    if (mes) {
      // Filtrar por mês específico
      const [year, month] = mes.split('-');
      const startDate = `${year}-${month}-01`;
      const endDate = new Date(parseInt(year), parseInt(month), 0).toISOString().split('T')[0];

      movimentacoes = await sql`
        SELECT * FROM movimentacoes_he
        WHERE funcionario_id = ${funcionarioId}
          AND data_registro >= ${startDate}
          AND data_registro <= ${endDate}
        ORDER BY data_registro ASC, criado_em ASC
      `;
    } else {
      // Todos
      movimentacoes = await sql`
        SELECT * FROM movimentacoes_he
        WHERE funcionario_id = ${funcionarioId}
        ORDER BY data_registro DESC, criado_em DESC
      `;
    }

    return NextResponse.json(movimentacoes);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/movimentacoes - Adicionar movimentação
export async function POST(request) {
  try {
    const body = await request.json();
    const { funcionario_id, data_registro, tipo, horas } = body;

    // 1. Validações de segurança para evitar erro 500 do banco de dados
    if (!funcionario_id) {
      return NextResponse.json({ error: 'funcionario_id é obrigatório' }, { status: 400 });
    }
    if (!data_registro) {
      return NextResponse.json({ error: 'A data do registro é obrigatória' }, { status: 400 });
    }

    // 2. Definir o valor de horas_debito_credito com base no tipo
    let horasDebitoCredito;
    switch (tipo) {
      case 'extra_50':
      case 'extra_100':
        horasDebitoCredito = Math.abs(parseFloat(horas || 0));
        break;
      case 'domingo_menos_1':
        horasDebitoCredito = -4; // Sempre -4h
        break;
      case 'falta':
        horasDebitoCredito = -Math.abs(parseFloat(horas || 0)); // Sempre negativo
        break;
      default:
        return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 });
    }

    const result = await sql`
      INSERT INTO movimentacoes_he (funcionario_id, data_registro, tipo, horas_debito_credito)
      VALUES (${funcionario_id}, ${data_registro}, ${tipo}, ${horasDebitoCredito})
      RETURNING *
    `;

    return NextResponse.json(result[0], { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}