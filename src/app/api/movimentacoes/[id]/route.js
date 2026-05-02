import sql from '@/lib/db';
import { NextResponse } from 'next/server';

// PUT /api/movimentacoes/[id] - Atualizar movimentação
export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { data_registro, tipo, horas } = body;

    let horasDebitoCredito;
    switch (tipo) {
      case 'extra_50':
        horasDebitoCredito = Math.abs(parseFloat(horas));
        break;
      case 'extra_100':
        horasDebitoCredito = Math.abs(parseFloat(horas));
        break;
      case 'domingo_menos_1':
        horasDebitoCredito = -4;
        break;
      case 'falta':
      case 'pagamento_horas':
        horasDebitoCredito = -Math.abs(parseFloat(horas));
        break;
      default:
        return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 });
    }

    const result = await sql`
      UPDATE movimentacoes_he 
      SET data_registro = ${data_registro}, tipo = ${tipo}, horas_debito_credito = ${horasDebitoCredito}
      WHERE id = ${id}
      RETURNING *
    `;

    if (result.length === 0) {
      return NextResponse.json({ error: 'Movimentação não encontrada' }, { status: 404 });
    }
    return NextResponse.json(result[0]);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE /api/movimentacoes/[id] - Remover movimentação
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    await sql`DELETE FROM movimentacoes_he WHERE id = ${id}`;
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
