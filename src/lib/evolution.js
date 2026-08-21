/**
 * Serviço de integração com Evolution API para envio de mensagens WhatsApp.
 */

const EVOLUTION_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_KEY = process.env.EVOLUTION_API_KEY;
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE;

/**
 * Verifica se a instância do WhatsApp está conectada.
 * @returns {{ connected: boolean, error?: string }}
 */
export async function checkConnection() {
  try {
    const res = await fetch(
      `${EVOLUTION_URL}/instance/connectionState/${EVOLUTION_INSTANCE}`,
      {
        headers: { apikey: EVOLUTION_KEY },
        cache: 'no-store',
      }
    );
    const data = await res.json();
    // Evolution API retorna { instance: { state: "open" } } quando conectado
    const state = data?.instance?.state || data?.state;
    if (state === 'open') {
      return { connected: true };
    }
    return { connected: false, error: 'Instância desconectada. Conecte o WhatsApp no painel da Evolution API.' };
  } catch (err) {
    return { connected: false, error: `Erro ao verificar conexão: ${err.message}` };
  }
}

/**
 * Envia uma mensagem de texto via WhatsApp.
 * @param {string} phone - Número do telefone (apenas dígitos, ex: 5516991080895)
 * @param {string} text - Mensagem a ser enviada
 * @returns {{ success: boolean, error?: string }}
 */
export async function sendTextMessage(phone, text) {
  try {
    // Limpar telefone - remover tudo que não é dígito
    const cleanPhone = phone.replace(/\D/g, '');

    const res = await fetch(
      `${EVOLUTION_URL}/message/sendText/${EVOLUTION_INSTANCE}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: EVOLUTION_KEY,
        },
        body: JSON.stringify({
          number: cleanPhone,
          text: text,
        }),
      }
    );

    const data = await res.json();

    if (!res.ok) {
      return { success: false, error: data?.message || `Erro HTTP ${res.status}` };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: `Erro ao enviar mensagem: ${err.message}` };
  }
}

/**
 * Envia um arquivo de mídia (PDF/Documento) via WhatsApp com legenda opcional.
 * @param {string} phone - Número do telefone (apenas dígitos, ex: 5516991080895)
 * @param {string} mediaUrl - URL pública da mídia (ex: Supabase Storage URL)
 * @param {string} fileName - Nome do arquivo exibido no WhatsApp (ex: Extrato_Raissa.pdf)
 * @param {string} caption - Legenda/mensagem acompanhando a mídia
 * @returns {{ success: boolean, error?: string }}
 */
export async function sendMediaMessage(phone, mediaUrl, fileName, caption = '') {
  try {
    const cleanPhone = phone.replace(/\D/g, '');

    const res = await fetch(
      `${EVOLUTION_URL}/message/sendMedia/${EVOLUTION_INSTANCE}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: EVOLUTION_KEY,
        },
        body: JSON.stringify({
          number: cleanPhone,
          media: mediaUrl,
          mediatype: 'document',
          mimetype: 'application/pdf',
          fileName: fileName || 'Documento.pdf',
          caption: caption,
        }),
      }
    );

    const data = await res.json();

    if (!res.ok) {
      return { success: false, error: data?.message || `Erro HTTP ${res.status}` };
    }

    return { success: true, data };
  } catch (err) {
    return { success: false, error: `Erro ao enviar mídia: ${err.message}` };
  }
}

