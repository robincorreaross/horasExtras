import sql from '@/lib/db';
import { NextResponse } from 'next/server';

// POST /api/contas/clear-pdfs - Limpar URLs dos PDFs no banco de dados (tabela colaboradores)
export async function POST(request) {
  try {
    const body = await request.json();
    const { tipo } = body; // 'contas', 'holerites', 'todos'

    if (!tipo) {
      return NextResponse.json({ error: 'Tipo é obrigatório' }, { status: 400 });
    }

    let result;
    if (tipo === 'contas') {
      result = await sql`
        UPDATE colaboradores
        SET "contaPDF" = NULL
        RETURNING id
      `;
    } else if (tipo === 'holerites') {
      result = await sql`
        UPDATE colaboradores
        SET "holeritePDF" = NULL
        RETURNING id
      `;
    } else if (tipo === 'todos') {
      result = await sql`
        UPDATE colaboradores
        SET "contaPDF" = NULL, "holeritePDF" = NULL
        RETURNING id
      `;
    } else {
      return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      tipo,
      count: result.length,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
