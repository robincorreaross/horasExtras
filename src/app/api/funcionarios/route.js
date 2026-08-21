import sql from '@/lib/db';
import { NextResponse } from 'next/server';

// GET /api/funcionarios - Listar todos os colaboradores com cálculo de saldo de horas e dados de contas
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month');
    const year = searchParams.get('year');
    const loja = searchParams.get('loja');

    let funcionarios;

    if (month !== null && year !== null) {
      const pgMonth = parseInt(month) + 1;
      const pgYear = parseInt(year);
      const endDate = new Date(pgYear, pgMonth, 0).toISOString().split('T')[0];

      if (loja && loja !== 'TODAS') {
        funcionarios = await sql`
          SELECT 
            c.id, 
            c.id_loja,
            c.nome, 
            c.telefone, 
            c.loja, 
            c.data_admissao, 
            c.ativo, 
            COALESCE(c.saldo_inicial, 0) as saldo_inicial,
            COALESCE(c."valorConta", '0') as "valorConta",
            c."contaPDF",
            c."holeritePDF",
            c."imagemHoraExtra",
            c.created_at,
            COALESCE(SUM(m.horas_debito_credito), 0) as soma_movimentacoes,
            (COALESCE(c.saldo_inicial, 0) + COALESCE(SUM(m.horas_debito_credito), 0)) as saldo_atual
          FROM colaboradores c
          LEFT JOIN movimentacoes_he m ON c.id = m.funcionario_id 
            AND m.data_registro <= ${endDate}
          WHERE c.loja = ${loja}
          GROUP BY c.id
          ORDER BY c.nome ASC
        `;
      } else {
        funcionarios = await sql`
          SELECT 
            c.id, 
            c.id_loja,
            c.nome, 
            c.telefone, 
            c.loja, 
            c.data_admissao, 
            c.ativo, 
            COALESCE(c.saldo_inicial, 0) as saldo_inicial,
            COALESCE(c."valorConta", '0') as "valorConta",
            c."contaPDF",
            c."holeritePDF",
            c."imagemHoraExtra",
            c.created_at,
            COALESCE(SUM(m.horas_debito_credito), 0) as soma_movimentacoes,
            (COALESCE(c.saldo_inicial, 0) + COALESCE(SUM(m.horas_debito_credito), 0)) as saldo_atual
          FROM colaboradores c
          LEFT JOIN movimentacoes_he m ON c.id = m.funcionario_id 
            AND m.data_registro <= ${endDate}
          GROUP BY c.id
          ORDER BY c.nome ASC
        `;
      }
    } else {
      if (loja && loja !== 'TODAS') {
        funcionarios = await sql`
          SELECT 
            c.id, 
            c.id_loja,
            c.nome, 
            c.telefone, 
            c.loja, 
            c.data_admissao, 
            c.ativo, 
            COALESCE(c.saldo_inicial, 0) as saldo_inicial,
            COALESCE(c."valorConta", '0') as "valorConta",
            c."contaPDF",
            c."holeritePDF",
            c."imagemHoraExtra",
            c.created_at,
            COALESCE(SUM(m.horas_debito_credito), 0) as soma_movimentacoes,
            (COALESCE(c.saldo_inicial, 0) + COALESCE(SUM(m.horas_debito_credito), 0)) as saldo_atual
          FROM colaboradores c
          LEFT JOIN movimentacoes_he m ON c.id = m.funcionario_id
          WHERE c.loja = ${loja}
          GROUP BY c.id
          ORDER BY c.nome ASC
        `;
      } else {
        funcionarios = await sql`
          SELECT 
            c.id, 
            c.id_loja,
            c.nome, 
            c.telefone, 
            c.loja, 
            c.data_admissao, 
            c.ativo, 
            COALESCE(c.saldo_inicial, 0) as saldo_inicial,
            COALESCE(c."valorConta", '0') as "valorConta",
            c."contaPDF",
            c."holeritePDF",
            c."imagemHoraExtra",
            c.created_at,
            COALESCE(SUM(m.horas_debito_credito), 0) as soma_movimentacoes,
            (COALESCE(c.saldo_inicial, 0) + COALESCE(SUM(m.horas_debito_credito), 0)) as saldo_atual
          FROM colaboradores c
          LEFT JOIN movimentacoes_he m ON c.id = m.funcionario_id
          GROUP BY c.id
          ORDER BY c.nome ASC
        `;
      }
    }
    
    return NextResponse.json(funcionarios);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/funcionarios - Adicionar colaborador unificado
export async function POST(request) {
  try {
    const body = await request.json();
    const { id_loja, nome, telefone, loja, data_admissao, saldo_inicial, valorConta, ativo } = body;

    if (!nome) {
      return NextResponse.json({ error: 'O nome é obrigatório' }, { status: 400 });
    }

    const numIdLoja = id_loja ? parseInt(id_loja) : null;
    const numSaldo = isNaN(parseFloat(saldo_inicial)) ? 0 : parseFloat(saldo_inicial);
    const strValor = valorConta !== undefined ? String(valorConta) : '0';
    const isAtivo = ativo !== undefined ? Boolean(ativo) : true;

    const result = await sql`
      INSERT INTO colaboradores (
        id_loja, 
        nome, 
        telefone, 
        loja, 
        data_admissao, 
        saldo_inicial,
        "valorConta",
        ativo
      )
      VALUES (
        ${numIdLoja}, 
        ${nome}, 
        ${telefone || ''}, 
        ${loja || ''}, 
        ${data_admissao || null}, 
        ${numSaldo},
        ${strValor},
        ${isAtivo}
      )
      RETURNING *
    `;

    return NextResponse.json(result[0], { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
