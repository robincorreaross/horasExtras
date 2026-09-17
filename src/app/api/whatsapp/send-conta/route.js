import sql from '@/lib/db';
import { checkConnection, sendTextMessage, sendMediaMessage } from '@/lib/evolution';
import { NextResponse } from 'next/server';

function parseValorConta(val) {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const str = String(val).trim();
  // Se contiver vírgula, assume formato brasileiro (1.234,56 ou 150,00)
  if (str.includes(',')) {
    const cleaned = str.replace(/[^\d,-]/g, '').replace(/\./g, '').replace(',', '.');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  }
  // Formato padrão (150.00 ou 150)
  const cleaned = str.replace(/[^\d.-]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function formatCurrency(val) {
  const num = parseValorConta(val);
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

    // 2. Buscar dados do colaborador na tabela colaboradores
    const rows = await sql`
      SELECT id, id_loja, nome, telefone, loja, COALESCE("valorConta", '0') as "valorConta", "contaPDF", "holeritePDF"
      FROM colaboradores
      WHERE id::text = ${funcionario_id} OR id_loja::text = ${funcionario_id}
    `;

    if (rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Colaborador não encontrado' }, { status: 404 });
    }

    const emp = rows[0];

    if (!emp.telefone) {
      return NextResponse.json(
        { success: false, error: `Colaborador ${emp.nome} não possui telefone cadastrado` },
        { status: 400 }
      );
    }

    const numValor = parseValorConta(emp.valorConta);
    const valorFmt = formatCurrency(emp.valorConta);
    const primeiroNome = emp.nome ? emp.nome.trim().split(' ')[0] : 'Colaborador';

    let sendResult;
    let messageText = '';

    if (tipo === 'aviso_17') {
      if (numValor <= 0) {
        return NextResponse.json(
          {
            success: false,
            skipped: true,
            error: `Colaborador(a) ${emp.nome} possui conta zerada (${valorFmt}). O aviso de fechamento não foi enviado.`,
          },
          { status: 400 }
        );
      }


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
        if (numValor <= 0) {
          return NextResponse.json(
            {
              success: false,
              skipped: true,
              error: `Colaborador(a) ${emp.nome} possui conta zerada (${valorFmt}) e não tem PDF de extrato anexado. Mensagem não enviada.`,
            },
            { status: 400 }
          );
        }
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
