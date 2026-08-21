import sql from '@/lib/db';
import { checkConnection, sendTextMessage } from '@/lib/evolution';
import { buildMessage } from '@/lib/messages';
import { NextResponse } from 'next/server';

// POST /api/whatsapp/send - Enviar extrato de horas via WhatsApp para um colaborador
export async function POST(request) {
  try {
    const body = await request.json();
    const { funcionario_id, ref_month, ref_year } = body;
    // ref_month: 0-11 (Janeiro=0), ref_year: 2026

    // 1. Verificar conexão
    const connResult = await checkConnection();
    if (!connResult.connected) {
      return NextResponse.json(
        { success: false, error: connResult.error || 'WhatsApp desconectado. Conecte no painel da Evolution API antes de enviar.' },
        { status: 400 }
      );
    }

    // 2. Buscar colaborador
    const employees = await sql`
      SELECT * FROM colaboradores 
      WHERE id::text = ${funcionario_id} OR id_loja::text = ${funcionario_id}
    `;
    if (employees.length === 0) {
      return NextResponse.json({ success: false, error: 'Colaborador não encontrado' }, { status: 404 });
    }
    const emp = employees[0];

    if (!emp.telefone) {
      return NextResponse.json({ success: false, error: `Colaborador ${emp.nome} não possui telefone cadastrado` }, { status: 400 });
    }

    // 3. Calcular saldo anterior (tudo ANTES do mês de referência)
    const refStart = `${ref_year}-${String(ref_month + 1).padStart(2, '0')}-01`;
    
    const prevResult = await sql`
      SELECT COALESCE(SUM(horas_debito_credito), 0) as total
      FROM movimentacoes_he
      WHERE funcionario_id = ${emp.id}
        AND data_registro < ${refStart}
    `;
    const previousBalance = parseFloat(emp.saldo_inicial || 0) + parseFloat(prevResult[0].total);

    // 4. Buscar movimentações do mês de referência
    const lastDay = new Date(ref_year, ref_month + 1, 0).getDate();
    const refEnd = `${ref_year}-${String(ref_month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const movements = await sql`
      SELECT * FROM movimentacoes_he
      WHERE funcionario_id = ${emp.id}
        AND data_registro >= ${refStart}
        AND data_registro <= ${refEnd}
      ORDER BY data_registro ASC
    `;

    // 5. Gerar mensagem
    const message = buildMessage(emp, movements, previousBalance, ref_month, ref_year);

    // 6. Enviar
    const sendResult = await sendTextMessage(emp.telefone, message);

    if (!sendResult.success) {
      return NextResponse.json(
        { success: false, error: sendResult.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      nome: emp.nome,
      telefone: emp.telefone,
      mensagem: message,
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
