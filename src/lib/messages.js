const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

/**
 * Gera a mensagem formatada de extrato de horas para um funcionário.
 * @param {object} employee - { nome, telefone, saldo_inicial }
 * @param {Array} movements - movimentações do mês de referência
 * @param {number} previousBalance - saldo acumulado antes do mês de referência
 * @param {number} refMonth - mês (0-11)
 * @param {number} refYear - ano
 * @returns {string} mensagem formatada para WhatsApp
 */
export function buildMessage(employee, movements, previousBalance, refMonth, refYear) {
  const monthName = MONTH_NAMES[refMonth];

  // Agregar movimentações por tipo
  let extra50 = 0;
  let extra100 = 0;
  let domingoDebito = 0;
  const faltas = [];

  for (const mov of movements) {
    switch (mov.tipo) {
      case 'extra_50':
        extra50 += Math.abs(parseFloat(mov.horas_debito_credito));
        break;
      case 'extra_100':
        extra100 += Math.abs(parseFloat(mov.horas_debito_credito));
        break;
      case 'domingo_menos_1':
        domingoDebito += Math.abs(parseFloat(mov.horas_debito_credito));
        break;
      case 'falta':
        faltas.push({
          data: new Date(mov.data_registro).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
          horas: Math.abs(parseFloat(mov.horas_debito_credito))
        });
        break;
    }
  }

  // Montar linhas de movimentação
  const lines = [];
  if (extra50 > 0) lines.push(`• Extra 50%: ${extra50}h`);
  if (extra100 > 0) lines.push(`• Extra 100%: ${extra100}h`);
  if (domingoDebito > 0) lines.push(`• Domingo-1: Débito ${domingoDebito}h`);
  for (const f of faltas) {
    lines.push(`• Falta (${f.data}): Débito ${f.horas}h`);
  }

  const movSection = lines.length > 0
    ? lines.join('\n')
    : 'Sem novas movimentações este mês.';

  // Calcular saldo total
  const monthNet = movements.reduce((acc, m) => acc + parseFloat(m.horas_debito_credito), 0);
  const totalBalance = previousBalance + monthNet;

  // Formatar saldo
  let balanceLine;
  if (totalBalance > 0) {
    balanceLine = `✅ Seu saldo total atualizado é de *CRÉDITO* de ${Math.abs(totalBalance)} horas.`;
  } else if (totalBalance < 0) {
    balanceLine = `⚠️ Seu saldo total atualizado é de *DÉBITO* de ${Math.abs(totalBalance)} horas.`;
  } else {
    balanceLine = `⚪ Seu saldo total está zerado.`;
  }

  // Nota sobre Domingo-1
  const domingoNote = domingoDebito > 0
    ? `\n_Nota: 'Domingo-1' indica que apenas um domingo foi trabalhado, gerando débito de 4h conforme a política da loja._`
    : '';

  const message = `📊 *EXTRATO DE BANCO DE HORAS*

Mês de referência: *${monthName} de ${refYear}*

Olá, *${employee.nome}*! Segue suas movimentações de horas neste mês:

📦 *Saldo Acumulado Anterior:* ${previousBalance}h

📝 *Movimentações do Mês:*
${movSection}

${balanceLine}
${domingoNote}`;

  return message.trim();
}

export { MONTH_NAMES };
