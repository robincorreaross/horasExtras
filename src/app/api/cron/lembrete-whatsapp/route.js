import sql from '@/lib/db';
import { checkConnection, sendTextMessage } from '@/lib/evolution';
import { NextResponse } from 'next/server';

// POST /api/cron/lembrete-whatsapp
export async function POST(request) {
    // 1. Segurança: Evita que qualquer pessoa aceda a esta URL e dispare mensagens.
    // O Supabase enviará este cabeçalho de Autorização.
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return new Response('Não autorizado', { status: 401 });
    }

    try {
        // 2. Verificar a ligação à Evolution API antes de começar o loop
        const connResult = await checkConnection();
        if (!connResult.connected) {
            return NextResponse.json(
                { success: false, error: connResult.error || 'WhatsApp desconectado. Conecte no painel da Evolution API.' },
                { status: 400 }
            );
        }

        // 3. Buscar apenas os funcionários ativos
        const funcionarios = await sql`
      SELECT id, nome, telefone FROM funcionarios_he WHERE ativo = true
    `;

        if (funcionarios.length === 0) {
            return NextResponse.json({ message: 'Nenhum funcionário ativo encontrado para enviar lembrete.' });
        }

        const resultados = [];

        // 4. Loop de envio com intervalo para evitar bloqueios por spam no WhatsApp
        for (let i = 0; i < funcionarios.length; i++) {
            const func = funcionarios[i];
            // Pode personalizar esta mensagem como preferir
            const mensagem = `*🤖 Disparo Automático 🤖*

*🌞 Bom dia! ☕✨*

Olá, ${func.nome}! Tudo bem?

⏱️ Passando para lembrar: se tiver *horas extras ou faltas* para repassar referentes a este mês, por favor, envie-me hoje!

*Obrigado!*`;

            try {
                const sendResult = await sendTextMessage(func.telefone, mensagem);

                if (sendResult.success) {
                    resultados.push({ nome: func.nome, status: 'enviado' });
                } else {
                    resultados.push({ nome: func.nome, status: 'erro', erro: sendResult.error });
                }
            } catch (err) {
                resultados.push({ nome: func.nome, status: 'erro', erro: err.message });
            }

            // Espera 5 segundos (5000ms) entre cada mensagem
            if (i < funcionarios.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }

        return NextResponse.json({ success: true, enviados: resultados });
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}