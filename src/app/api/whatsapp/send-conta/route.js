import sql from '@/lib/db';
import { checkConnection, sendTextMessage, sendMediaMessage } from '@/lib/evolution';
import { NextResponse } from 'next/server';

/**
 * Formata um valor numérico ou texto para a representação em moeda brasileira (R$ XX,XX)
 */
function formatCurrency(val) {
  if (val === null || val === undefined || val === '') return 'R$ 0,00';
  const num = typeof val === 'number' ? val : parseFloat(String(val).replace(',', '.'));
  if (isNaN(num)) return 'R$ 0,00';
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// POST /api/whatsapp/send-conta - Envio manual de mensagem de conta ou holerite
export async function POST(request) {
  try {
    const body = await request.json();
    const { funcionario_id, tipo } = body; 
    // tipo: 'aviso_17', 'fechamento_18', 'holerite'

    if (!funcionario_id || !tipo) {
      return NextResponse.json(
        { success: false, error: 'Parâmetros funcionario_id e tipo são obrigatórios' },
        { status: 400 }
      );
    }

    // 1. Verificar conexão com WhatsApp
    const connResult = await checkConnection();
    if (!connResult.connected) {
      return NextResponse.json(
        { success: false, error: connResult.error || 'WhatsApp desconectado. Conecte no painel da Evolution API antes de enviar.' },
        { status: 400 }
      );
    }

    // 2. Buscar dados do funcionário
    const rows = await sql`
      SELECT id, nome, telefone, loja, COALESCE("valorConta", '0') as "valorConta", "contaPDF", "holeritePDF"
      FROM funcionarios
      WHERE id = ${funcionario_id}
    `;

    if (rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Funcionário não encontrado' }, { status: 404 });
    }

    const emp = rows[0];

    if (!emp.telefone) {
      return NextResponse.json(
        { success: false, error: `Funcionário ${emp.nome} não possui telefone cadastrado` },
        { status: 400 }
      );
    }

    const valorFmt = formatCurrency(emp.valorConta);
    const primeiroNome = emp.nome ? emp.nome.trim().split(' ')[0] : 'Colaborador';

    let sendResult;
    let messageText = '';

    if (tipo === 'aviso_17') {
      // Mensagem de Aviso de Fechamento da Conta (Sem PDF)
      messageText = `*🤖 Disparo Automático 🤖*\n\n` +
        `*🌞 Bom dia ${primeiroNome}! ☕✨*\n\n` +
        `Este é um aviso do fechamento da sua conta que será feito nos próximos dias.\n` +
        `No momento o valor é de *${valorFmt}*\n` +
        `Previsão de fechamento, dia 18.\n` +
        `Qualquer dúvida, me comunique.\n\n` +
        `*Obrigado.*`;

      sendResult = await sendTextMessage(emp.telefone, messageText);

    } else if (tipo === 'fechamento_18') {
      // Mensagem de Envio Final com Extrato PDF
      if (!emp.contaPDF) {
        return NextResponse.json(
          { success: false, error: `O PDF do extrato de ${emp.nome} ainda não foi carregado.` },
          { status: 400 }
        );
      }

      messageText = `*🤖 Disparo Automático 🤖*\n\n` +
        `*🌞 Bom dia ${primeiroNome}! ☕✨*\n\n` +
        `Segue seu extrato total da sua conta.\n` +
        `O valor de fechamento deste mês é de *${valorFmt}*\n\n` +
        `Qualquer dúvida, me comunique.\n\n` +
        `*Obrigado.*`;

      const fileName = `Extrato_${primeiroNome}.pdf`;
      sendResult = await sendMediaMessage(emp.telefone, emp.contaPDF, fileName, messageText);

    } else if (tipo === 'holerite') {
      // Mensagem de Envio de Holerite PDF
      if (!emp.holeritePDF) {
        return NextResponse.json(
          { success: false, error: `O PDF do holerite de ${emp.nome} ainda não foi carregado.` },
          { status: 400 }
        );
      }

      messageText = `*🤖 Disparo Automático 🤖*\n\n` +
        `*🌞 Bom dia ${primeiroNome}! ☕✨*\n\n` +
        `Segue em anexo o seu Holerite.\n\n` +
        `Qualquer dúvida, me comunique.\n\n` +
        `*Obrigado.*`;

      const fileName = `Holerite_${primeiroNome}.pdf`;
      sendResult = await sendMediaMessage(emp.telefone, emp.holeritePDF, fileName, messageText);

    } else {
      return NextResponse.json({ success: false, error: 'Tipo de disparo inválido' }, { status: 400 });
    }

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
      tipo: tipo,
      mensagem: messageText,
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
