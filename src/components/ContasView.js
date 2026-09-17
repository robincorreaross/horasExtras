'use client';

import { useState, useEffect, useCallback } from 'react';

const LOJAS = [
  'TODAS',
  'Loja 1 - FarmaSETE',
  'Loja 2 - Droga Sete Matriz',
  'Loja 3 - Droga Sete Filial',
  'Terceirizado'
];

function parseValorConta(val) {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const str = String(val).trim();
  if (str.includes(',')) {
    const cleaned = str.replace(/[^\d,-]/g, '').replace(/\./g, '').replace(',', '.');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  }
  const cleaned = str.replace(/[^\d.-]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function formatBRL(val) {
  const num = parseValorConta(val);
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}


export default function ContasView({ addToast, onOpenColabModal }) {
  const [colaboradores, setColaboradores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLoja, setSelectedLoja] = useState('TODAS');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'nome', direction: 'asc' });

  // Modal States
  const [previewModal, setPreviewModal] = useState({ open: false, emp: null, tipo: 'aviso_17' });
  const [uploadModal, setUploadModal] = useState({ open: false, emp: null, tipoDoc: 'conta' });
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  // Sync Local Files Modal State
  const [syncModal, setSyncModal] = useState({ open: false, syncing: false, logs: [] });

  // Clear PDFs Modal State
  const [clearModal, setClearModal] = useState({ open: false, clearing: false });

  // Python Script Runner Modal State
  const [scriptModal, setScriptModal] = useState({ open: false, running: false, title: '', output: '' });

  // Script Download & Local Sync Modal State
  const [downloadModal, setDownloadModal] = useState(false);

  // Check if running on cloud / online vs local
  const isOnline = typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';

  // Bulk Manual Send States
  const [bulkState, setBulkState] = useState({
    active: false,
    tipo: 'aviso_17',
    current: 0,
    total: 0,
    logs: [],
  });

  const fetchContas = useCallback(async () => {
    setLoading(true);
    try {
      const sep = selectedLoja !== 'TODAS' ? `?loja=${encodeURIComponent(selectedLoja)}&` : '?';
      const res = await fetch(`/api/funcionarios${sep}_t=${Date.now()}`, {
        cache: 'no-store',
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        setColaboradores(data);
      } else {
        addToast(data.error || 'Erro ao carregar dados das contas', 'error');
      }
    } catch (err) {
      addToast('Erro de comunicação com o servidor', 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedLoja, addToast]);

  useEffect(() => {
    fetchContas();
  }, [fetchContas]);

  // ====== FILTER & SORT ======
  const filteredContas = colaboradores.filter((c) => {
    const term = searchTerm.toLowerCase();
    return (
      (c.nome && c.nome.toLowerCase().includes(term)) ||
      (c.telefone && c.telefone.includes(term)) ||
      (c.loja && c.loja.toLowerCase().includes(term)) ||
      (c.id_loja && String(c.id_loja).includes(term))
    );
  });

  const sortedContas = [...filteredContas].sort((a, b) => {
    const { key, direction } = sortConfig;
    let valA = a[key];
    let valB = b[key];

    if (key === 'valorConta' || key === 'id_loja') {
      valA = parseFloat(valA || 0);
      valB = parseFloat(valB || 0);
    } else {
      valA = valA ? valA.toString().toLowerCase() : '';
      valB = valB ? valB.toString().toLowerCase() : '';
    }

    if (valA < valB) return direction === 'asc' ? -1 : 1;
    if (valA > valB) return direction === 'asc' ? 1 : -1;
    return 0;
  });

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  // ====== DOWNLOAD SCRIPTS & ATALHOS ======
  const handleDownloadScript = (type) => {
    window.open(`/api/contas/download-script?type=${type}`, '_blank');
    addToast('📥 Download iniciado! Execute o arquivo no seu computador.', 'info');
  };

  // ====== RUN PYTHON SCRIPT ======
  const triggerRunScript = async (scriptType) => {
    // Se o usuário estiver acessando online (Vercel), redireciona diretamente para o modal de download
    if (isOnline) {
      setDownloadModal(true);
      addToast('💡 Acesso Online: Baixe o script/atalho para executar no seu PC com 1 clique.', 'info');
      return;
    }

    const title = scriptType === 'contas_lojas'
      ? '🤖 Atualização de Valores das Contas (contas_lojas.py)'
      : '🤖 Download Automático dos Extratos (conta-pdf-download.py)';

    setScriptModal({
      open: true,
      running: true,
      title,
      output: '⏳ Executando script Python no computador. Por favor, aguarde...',
    });

    try {
      const res = await fetch('/api/contas/run-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script: scriptType }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setScriptModal({
          open: true,
          running: false,
          title,
          output: `✅ Script executado com sucesso!\n\n--- Saída do Console ---\n${data.output}`,
        });
        addToast(`✅ Script ${data.script} finalizado!`, 'success');
        fetchContas();
      } else {
        if (data.isCloudEnv) {
          setScriptModal({ open: false, running: false, title: '', output: '' });
          setDownloadModal(true);
          addToast('💡 Ambiente na nuvem: Baixe o atalho .bat para rodar no seu PC.', 'info');
          return;
        }

        setScriptModal({
          open: true,
          running: false,
          title,
          output: `❌ Falha ao executar script.\n\n--- Erro ---\n${data.error}\n\n--- Saída ---\n${data.output || ''}`,
        });
        addToast(`❌ ${data.error || 'Erro na execução do script'}`, 'error');
      }
    } catch (err) {
      setScriptModal({
        open: true,
        running: false,
        title,
        output: `❌ Erro de comunicação com o servidor: ${err.message}`,
      });
      addToast('Erro ao acionar o script Python', 'error');
    }
  };

  // ====== SYNC LOCAL FILES ======
  const triggerSyncLocal = async (tipo) => {
    if (isOnline) {
      setDownloadModal(true);
      addToast('💡 Sincronização de pastas locais deve ser executada no seu computador.', 'info');
      return;
    }
    setSyncModal({ open: true, syncing: true, logs: ['⏳ Iniciando verificação das pastas locais e upload para o Supabase Storage...'] });
    try {
      const res = await fetch('/api/contas/sync-local', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSyncModal({
          open: true,
          syncing: false,
          logs: data.logs || ['✅ Sincronização concluída com sucesso!'],
        });
        addToast(`✅ Pastas sincronizadas com sucesso! (${data.contasSuccess || 0} contas, ${data.holeritesSuccess || 0} holerites)`, 'success');
        fetchContas();
      } else {
        setSyncModal({
          open: true,
          syncing: false,
          logs: [`❌ Erro na sincronização: ${data.error || 'Erro desconhecido'}`],
        });
        addToast(`❌ ${data.error || 'Erro na sincronização'}`, 'error');
      }
    } catch (err) {
      setSyncModal({
        open: true,
        syncing: false,
        logs: [`❌ Erro de comunicação com o servidor: ${err.message}`],
      });
      addToast('Erro ao sincronizar arquivos locais', 'error');
    }
  };

  // ====== CLEAR PDFS ======
  const triggerClearPdfs = async (tipo) => {
    const desc = tipo === 'contas' ? 'Extratos das Contas' : tipo === 'holerites' ? 'Holerites' : 'TODOS os PDFs';
    if (!confirm(`Tem certeza que deseja LIMPAR os links de PDF de ${desc}? Os links no banco de dados serão zerados.`)) {
      return;
    }
    setClearModal({ open: true, clearing: true });
    try {
      const res = await fetch('/api/contas/clear-pdfs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        addToast(`🧹 ${data.count} registros de PDF foram limpos!`, 'success');
        setClearModal({ open: false, clearing: false });
        fetchContas();
      } else {
        addToast(`❌ ${data.error || 'Erro ao limpar PDFs'}`, 'error');
        setClearModal({ open: false, clearing: false });
      }
    } catch (err) {
      addToast('Erro ao realizar limpeza dos PDFs', 'error');
      setClearModal({ open: false, clearing: false });
    }
  };

  // ====== SINGLE SEND WHATSAPP ======
  const triggerSendSingle = async (empId, tipo) => {
    try {
      addToast('Iniciando envio via WhatsApp...', 'info');
      const res = await fetch('/api/whatsapp/send-conta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ funcionario_id: empId, tipo }),
      });

      const data = await res.json();

      if (data.success) {
        const desc = tipo === 'aviso_17' ? 'Aviso Dia 17' : tipo === 'fechamento_18' ? 'Extrato PDF Dia 18' : 'Holerite PDF';
        addToast(`✅ ${desc} enviado com sucesso para ${data.nome}!`, 'success');
        setPreviewModal({ open: false, emp: null, tipo: 'aviso_17' });
      } else {
        addToast(`❌ ${data.error}`, 'error');
      }
    } catch (err) {
      addToast('Erro ao realizar envio', 'error');
    }
  };

  // ====== BULK SEND WHATSAPP ======
  const startBulkSend = async (tipo) => {
    let targets = sortedContas.filter((c) => c.ativo && c.telefone);

    if (targets.length === 0) {
      addToast('Nenhum colaborador ativo com telefone cadastrado para o envio', 'error');
      return;
    }

    if (tipo === 'aviso_17') {
      const totalAtivos = targets.length;
      targets = targets.filter(c => parseValorConta(c.valorConta) > 0);
      const zerados = totalAtivos - targets.length;

      if (targets.length === 0) {
        addToast('Nenhum colaborador com saldo devedor/conta em aberto para enviar o Aviso Dia 17.', 'info');
        return;
      }

      if (!confirm(`Confirma o disparo MANUAL de Aviso Dia 17 para ${targets.length} colaborador(es) com contas em aberto?\n(${zerados} colaborador(es) com conta zerada serão ignorados).`)) {
        return;
      }
    } else if (tipo === 'fechamento_18') {
      const comPdf = targets.filter(c => !!c.contaPDF);
      const zeradosSemPdf = targets.filter(c => !c.contaPDF && parseValorConta(c.valorConta) <= 0).length;
      const comSaldoSemPdf = targets.filter(c => !c.contaPDF && parseValorConta(c.valorConta) > 0).length;

      targets = comPdf;

      if (targets.length === 0) {
        addToast('Nenhum colaborador com PDF de Extrato anexado para realizar o disparo do Dia 18.', 'info');
        return;
      }

      let confirmMsg = `Confirma o disparo MANUAL de Extrato com PDF (Dia 18) para ${targets.length} colaborador(es) com PDF anexado?`;
      const ignorados = [];
      if (zeradosSemPdf > 0) ignorados.push(`${zeradosSemPdf} zerado(s) sem PDF`);
      if (comSaldoSemPdf > 0) ignorados.push(`${comSaldoSemPdf} com saldo sem PDF`);
      if (ignorados.length > 0) {
        confirmMsg += `\n(${ignorados.join(' e ')} serão ignorados).`;
      }

      if (!confirm(confirmMsg)) {
        return;
      }
    } else if (tipo === 'holerite') {
      const semHolerite = targets.filter(c => !c.holeritePDF);
      if (semHolerite.length > 0) {
        if (!confirm(`Atenção: ${semHolerite.length} colaborador(es) não possuem PDF de Holerite. Deseja prosseguir mesmo assim?`)) {
          return;
        }
      }
      if (!confirm(`Confirma o disparo MANUAL em massa de Holerite em PDF para ${targets.length} colaborador(es)?`)) {
        return;
      }
    }

    setBulkState({
      active: true,
      tipo,
      current: 0,
      total: targets.length,
      logs: [],
    });

    for (let i = 0; i < targets.length; i++) {
      const emp = targets[i];
      try {
        const res = await fetch('/api/whatsapp/send-conta', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ funcionario_id: emp.id, tipo }),
        });
        const data = await res.json();

        if (data.success) {
          setBulkState((prev) => ({
            ...prev,
            current: i + 1,
            logs: [...prev.logs, { status: 'success', text: `${emp.nome}: Mensagem enviada!` }],
          }));
        } else {
          setBulkState((prev) => ({
            ...prev,
            current: i + 1,
            logs: [...prev.logs, { status: 'error', text: `${emp.nome}: ${data.error}` }],
          }));
          if (data.error?.includes('desconectado') || data.error?.includes('Conecte')) {
            addToast('Envio em massa interrompido - WhatsApp desconectado', 'error');
            break;
          }
        }
      } catch (err) {
        setBulkState((prev) => ({
          ...prev,
          current: i + 1,
          logs: [...prev.logs, { status: 'error', text: `${emp.nome}: Erro de comunicação` }],
        }));
      }

      if (i < targets.length - 1) {
        await new Promise((r) => setTimeout(r, 4000));
      }
    }

    addToast('Disparo em massa finalizado!', 'info');
  };

  // ====== UPLOAD PDF (AVULSO MANUAL) ======
  const handleUpload = async (e) => {
    e.preventDefault();
    if (!uploadFile) {
      addToast('Selecione um arquivo PDF', 'error');
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('funcionario_id', uploadModal.emp.id);
      formData.append('funcionario_nome', uploadModal.emp.nome);
      formData.append('tipo_doc', uploadModal.tipoDoc);

      const res = await fetch('/api/contas/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (res.ok && data.success) {
        addToast(`✅ PDF do ${uploadModal.tipoDoc === 'holerite' ? 'Holerite' : 'Extrato'} atualizado!`, 'success');
        setUploadModal({ open: false, emp: null, tipoDoc: 'conta' });
        setUploadFile(null);
        fetchContas();
      } else {
        addToast(`❌ ${data.error || 'Erro no upload'}`, 'error');
      }
    } catch (err) {
      addToast('Erro ao realizar upload', 'error');
    } finally {
      setUploading(false);
    }
  };

  // STATS
  const totalColaboradores = sortedContas.length;
  const totalSomaContas = sortedContas.reduce((acc, c) => acc + parseFloat(c.valorConta || 0), 0);
  const totalPdfsContas = sortedContas.filter((c) => !!c.contaPDF).length;
  const totalPdfsHolerites = sortedContas.filter((c) => !!c.holeritePDF).length;

  // RENDER PREVIEW MESSAGE TEXT
  const getPreviewText = (emp, tipo) => {
    if (!emp) return '';
    const primeiroNome = emp.nome.trim().split(' ')[0];
    const valorFmt = formatBRL(emp.valorConta);

    if (tipo === 'aviso_17') {
      return `🤖 Disparo Automático 🤖\n\n` +
        `🌞 Bom dia ${primeiroNome}! ☕✨\n\n` +
        `Este é um aviso do fechamento da sua conta que será feito nos próximos dias.\n` +
        `No momento o valor é de *${valorFmt}*\n` +
        `Previsão de fechamento, dia 18.\n` +
        `Qualquer dúvida, me comunique.\n\n` +
        `Obrigado.`;
    } else if (tipo === 'fechamento_18') {
      return `🤖 Disparo Automático 🤖\n\n` +
        `🌞 Bom dia ${primeiroNome}! ☕✨\n\n` +
        `Segue seu extrato total da sua conta.\n` +
        `O valor de fechamento deste mês é de *${valorFmt}*\n\n` +
        `Qualquer dúvida, me comunique.\n\n` +
        `Obrigado.\n\n` +
        `📎 [Anexo PDF: Extrato_${primeiroNome}.pdf]`;
    } else {
      return `🤖 Disparo Automático 🤖\n\n` +
        `🌞 Bom dia ${primeiroNome}! ☕✨\n\n` +
        `Segue em anexo o seu Holerite.\n\n` +
        `Qualquer dúvida, me comunique.\n\n` +
        `Obrigado.\n\n` +
        `📎 [Anexo PDF: Holerite_${primeiroNome}.pdf]`;
    }
  };

  return (
    <div>
      {/* STATS ROW */}
      <div className="stats-grid">
        <div className="stat-item">
          <span className="stat-item-label">Colaboradores Listados</span>
          <span className="stat-item-value">{totalColaboradores}</span>
        </div>
        <div className="stat-item">
          <span className="stat-item-label">Total das Contas</span>
          <span className="stat-item-value" style={{ color: 'var(--cyan)' }}>
            {formatBRL(totalSomaContas)}
          </span>
        </div>
        <div className="stat-item">
          <span className="stat-item-label">Extratos PDF</span>
          <span className="stat-item-value" style={{ color: totalPdfsContas > 0 ? 'var(--success)' : 'var(--text-muted)' }}>
            {totalPdfsContas} / {totalColaboradores}
          </span>
        </div>
        <div className="stat-item">
          <span className="stat-item-label">Holerites PDF</span>
          <span className="stat-item-value" style={{ color: totalPdfsHolerites > 0 ? 'var(--accent-light)' : 'var(--text-muted)' }}>
            {totalPdfsHolerites} / {totalColaboradores}
          </span>
        </div>
      </div>

      {/* GESTÃO & FERRAMENTAS */}
      <div className="card">
        <div className="card-header-clean">
          <div>
            <h3 className="card-title">
              ⚡ Automação e Gestão de Extratos
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              Execute os scripts de fechamento e sincronize os PDFs das contas e holerites.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              className="btn btn-primary btn-sm"
              style={{
                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                boxShadow: '0 2px 10px rgba(59, 130, 246, 0.3)',
                fontWeight: 600,
              }}
              onClick={() => setDownloadModal(true)}
              title="Baixar scripts e atalhos para executar no computador com 1 clique"
            >
              📥 Sincronizar no PC (1 Clique)
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => triggerRunScript('contas_lojas')}
              title="Executar script contas_lojas.py"
            >
              🐍 1. Atualizar Valores
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => triggerRunScript('conta_pdf_download')}
              title="Executar script conta-pdf-download.py"
            >
              🐍 2. Baixar PDFs
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => triggerSyncLocal('todos')}
              title="Ler arquivos locais e subir para o Supabase"
            >
              📁 Enviar Pastas Locais
            </button>
            <button
              className="btn btn-danger btn-sm"
              onClick={() => setClearModal({ open: true, clearing: false })}
              title="Limpar URLs de PDFs do banco de dados"
            >
              🗑️ Limpar PDFs
            </button>
          </div>
        </div>

        <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
            Disparos Manuais por WhatsApp:
          </span>
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
            <button
              className="btn btn-warning btn-sm"
              onClick={() => startBulkSend('aviso_17')}
              disabled={bulkState.active}
            >
              📅 Disparar Aviso (Dia 17)
            </button>
            <button
              className="btn btn-whatsapp btn-sm"
              onClick={() => startBulkSend('fechamento_18')}
              disabled={bulkState.active}
            >
              📑 Disparar Extrato com PDF (Dia 18)
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => startBulkSend('holerite')}
              disabled={bulkState.active}
            >
              📄 Disparar Holerites
            </button>
          </div>
        </div>

        {/* PROGRESS BAR DO DISPARO EM MASSA */}
        {bulkState.active && (
          <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                Enviando {bulkState.tipo === 'aviso_17' ? 'Aviso Dia 17' : bulkState.tipo === 'fechamento_18' ? 'Extratos PDF Dia 18' : 'Holerites'}...
              </span>
              <span className="badge badge-accent">
                {bulkState.current} / {bulkState.total}
              </span>
            </div>
            <div className="progress-bar-container">
              <div
                className="progress-bar"
                style={{ width: `${(bulkState.current / bulkState.total) * 100}%` }}
              ></div>
            </div>
            <div style={{ maxHeight: '120px', overflowY: 'auto', marginTop: '0.5rem', fontSize: '0.8rem', background: 'rgba(0,0,0,0.3)', padding: '0.5rem 0.75rem', borderRadius: '6px' }}>
              {bulkState.logs.map((log, idx) => (
                <div key={idx} style={{ color: log.status === 'success' ? '#4ade80' : '#f87171', margin: '0.15rem 0' }}>
                  {log.text}
                </div>
              ))}
            </div>
            {bulkState.current >= bulkState.total && (
              <button
                className="btn btn-secondary btn-sm"
                style={{ marginTop: '0.5rem' }}
                onClick={() => setBulkState({ active: false, tipo: 'aviso_17', current: 0, total: 0, logs: [] })}
              >
                Fechar Progresso
              </button>
            )}
          </div>
        )}
      </div>

      {/* TABELA DE CONTAS */}
      <div className="card">
        <div className="card-header-clean">
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', flex: 1, minWidth: '280px' }}>
            <input
              type="text"
              className="search-input"
              placeholder="🔍 Buscar por nome, telefone, ID da loja..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ flex: 1 }}
            />
            <select
              className="select-input"
              value={selectedLoja}
              onChange={(e) => setSelectedLoja(e.target.value)}
              style={{ minWidth: '180px' }}
            >
              {LOJAS.map((l) => (
                <option key={l} value={l}>
                  {l === 'TODAS' ? 'Todas as Lojas' : l}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-secondary btn-sm" onClick={fetchContas}>
              🔄 Atualizar
            </button>
          </div>
        </div>

        {loading ? (
          <div className="empty-state">
            <span className="spinner" style={{ width: 28, height: 28 }}></span>
            <p style={{ marginTop: '0.75rem' }}>Carregando dados das contas...</p>
          </div>
        ) : sortedContas.length === 0 ? (
          <div className="empty-state">
            <p>Nenhum colaborador encontrado.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th onClick={() => handleSort('id_loja')} style={{ cursor: 'pointer', width: '80px' }}>
                    ID Loja {sortConfig.key === 'id_loja' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => handleSort('nome')} style={{ cursor: 'pointer' }}>
                    Nome {sortConfig.key === 'nome' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th>Telefone</th>
                  <th onClick={() => handleSort('loja')} style={{ cursor: 'pointer' }}>
                    Loja {sortConfig.key === 'loja' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => handleSort('valorConta')} style={{ cursor: 'pointer', textAlign: 'right' }}>
                    Valor da Conta {sortConfig.key === 'valorConta' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th style={{ textAlign: 'center' }}>PDF da Conta</th>
                  <th style={{ textAlign: 'center' }}>Holerite PDF</th>
                  <th style={{ textAlign: 'right' }}>Ações Manuais</th>
                </tr>
              </thead>
              <tbody>
                {sortedContas.map((emp) => (
                  <tr key={emp.id}>
                    <td style={{ fontWeight: 700, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                      {emp.id_loja ? `#${emp.id_loja}` : <span style={{ color: 'var(--text-dim)' }}>—</span>}
                    </td>
                    <td style={{ fontWeight: 600 }}>{emp.nome}</td>
                    <td style={{ color: 'var(--text-secondary)', fontFamily: 'monospace', fontSize: '0.85rem' }}>
                      {emp.telefone || <span style={{ color: 'var(--text-dim)' }}>Sem telefone</span>}
                    </td>
                    <td>
                      <span className="badge badge-neutral" style={{ fontSize: '0.75rem' }}>
                        {emp.loja || 'Sem Loja'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 800, fontSize: '0.95rem', color: parseFloat(emp.valorConta || 0) > 0 ? 'var(--cyan)' : 'var(--text-muted)' }}>
                      {formatBRL(emp.valorConta)}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {emp.contaPDF ? (
                        <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'center', alignItems: 'center' }}>
                          <a
                            href={emp.contaPDF}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="badge badge-success"
                            title="Visualizar PDF da Conta"
                          >
                            📄 Ver PDF
                          </a>
                          <button
                            className="btn-icon"
                            title="Substituir PDF"
                            onClick={() => setUploadModal({ open: true, emp, tipoDoc: 'conta' })}
                          >
                            ⬆️
                          </button>
                        </div>
                      ) : (
                        <button
                          className="btn btn-secondary btn-xs"
                          onClick={() => setUploadModal({ open: true, emp, tipoDoc: 'conta' })}
                        >
                          + Subir PDF
                        </button>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {emp.holeritePDF ? (
                        <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'center', alignItems: 'center' }}>
                          <a
                            href={emp.holeritePDF}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="badge badge-accent"
                            title="Visualizar Holerite PDF"
                          >
                            📄 Ver Holerite
                          </a>
                          <button
                            className="btn-icon"
                            title="Substituir Holerite"
                            onClick={() => setUploadModal({ open: true, emp, tipoDoc: 'holerite' })}
                          >
                            ⬆️
                          </button>
                        </div>
                      ) : (
                        <button
                          className="btn btn-secondary btn-xs"
                          onClick={() => setUploadModal({ open: true, emp, tipoDoc: 'holerite' })}
                        >
                          + Subir Holerite
                        </button>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end' }}>
                        <button
                          className="btn btn-warning btn-xs"
                          title="Prévia e envio manual do Aviso Dia 17"
                          onClick={() => setPreviewModal({ open: true, emp, tipo: 'aviso_17' })}
                        >
                          📅 Dia 17
                        </button>
                        <button
                          className="btn btn-whatsapp btn-xs"
                          title="Prévia e envio manual do Extrato com PDF Dia 18"
                          onClick={() => setPreviewModal({ open: true, emp, tipo: 'fechamento_18' })}
                        >
                          📑 Dia 18 (PDF)
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL DE EXECUÇÃO DE SCRIPT PYTHON */}
      {scriptModal.open && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '640px' }}>
            <div className="modal-header">
              <h3>{scriptModal.title}</h3>
              <button
                className="modal-close"
                onClick={() => setScriptModal({ open: false, running: false, title: '', output: '' })}
                disabled={scriptModal.running}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              {scriptModal.running && (
                <div style={{ textAlign: 'center', margin: '1rem 0' }}>
                  <span className="spinner" style={{ width: 36, height: 36 }}></span>
                  <p style={{ marginTop: '0.75rem', fontWeight: 600 }}>Executando script no servidor local...</p>
                </div>
              )}
              <pre style={{ maxHeight: '300px', overflowY: 'auto', background: '#090d16', padding: '1rem', borderRadius: '8px', color: 'var(--cyan)', fontSize: '0.85rem', whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
                {scriptModal.output}
              </pre>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-primary btn-sm"
                onClick={() => setScriptModal({ open: false, running: false, title: '', output: '' })}
                disabled={scriptModal.running}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE SINCRONIZAÇÃO DE PASTAS LOCAIS */}
      {syncModal.open && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '580px' }}>
            <div className="modal-header">
              <h3>📥 Sincronização de PDFs Locais</h3>
              <button className="modal-close" onClick={() => setSyncModal({ open: false, syncing: false, logs: [] })}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: '1rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                <strong>Pastas Monitoradas:</strong>
                <ul style={{ margin: '0.5rem 0 0 1.25rem', padding: 0 }}>
                  <li>Contas: <code>D:\work-Ross\Administrativo\Docs Colaboradores\enviarExtrato\extrato_contas</code></li>
                  <li>Holerites: <code>D:\work-Ross\Administrativo\Docs Colaboradores\enviarExtrato\holerites</code></li>
                </ul>
              </div>

              {syncModal.syncing && (
                <div style={{ textAlign: 'center', margin: '1rem 0' }}>
                  <span className="spinner" style={{ width: 32, height: 32 }}></span>
                  <p style={{ marginTop: '0.5rem', fontWeight: 600 }}>Enviando PDFs para o Supabase Storage...</p>
                </div>
              )}

              <div style={{ maxHeight: '200px', overflowY: 'auto', background: 'rgba(0,0,0,0.3)', padding: '0.75rem', borderRadius: '6px', fontSize: '0.8rem' }}>
                {syncModal.logs.map((log, i) => (
                  <div key={i} style={{ margin: '0.2rem 0', color: log.startsWith('✅') ? '#4ade80' : log.startsWith('❌') ? '#f87171' : '#cbd5e1' }}>
                    {log}
                  </div>
                ))}
              </div>
            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn-secondary btn-sm" onClick={() => triggerSyncLocal('contas')} disabled={syncModal.syncing}>
                  Apenas Extratos
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => triggerSyncLocal('holerites')} disabled={syncModal.syncing}>
                  Apenas Holerites
                </button>
              </div>
              <button className="btn btn-primary btn-sm" onClick={() => setSyncModal({ open: false, syncing: false, logs: [] })} disabled={syncModal.syncing}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE LIMPEZA DE PDFS */}
      {clearModal.open && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <h3>🗑️ Limpar PDFs do Banco de Dados</h3>
              <button className="modal-close" onClick={() => setClearModal({ open: false, clearing: false })}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '0.9rem', marginBottom: '1rem', color: 'var(--text-secondary)' }}>
                Selecione quais links de PDF você deseja remover do cadastro dos colaboradores:
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <button
                  className="btn btn-secondary"
                  style={{ textAlign: 'left', justifyContent: 'flex-start' }}
                  onClick={() => triggerClearPdfs('contas')}
                  disabled={clearModal.clearing}
                >
                  📄 Limpar PDFs dos Extratos de Contas
                </button>
                <button
                  className="btn btn-secondary"
                  style={{ textAlign: 'left', justifyContent: 'flex-start' }}
                  onClick={() => triggerClearPdfs('holerites')}
                  disabled={clearModal.clearing}
                >
                  📄 Limpar PDFs dos Holerites
                </button>
                <button
                  className="btn btn-danger"
                  style={{ textAlign: 'left', justifyContent: 'flex-start' }}
                  onClick={() => triggerClearPdfs('todos')}
                  disabled={clearModal.clearing}
                >
                  🚨 Limpar TODOS os PDFs
                </button>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary btn-sm" onClick={() => setClearModal({ open: false, clearing: false })}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE DOWNLOAD E EXECUÇÃO LOCAL NO PC */}
      {downloadModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '680px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span style={{ fontSize: '1.4rem' }}>💻</span>
                <div>
                  <h3 style={{ margin: 0 }}>Sincronização e Scripts para PC</h3>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {isOnline ? '🌐 Modo Online (Vercel)' : '💻 Modo Local (Localhost)'} • Execute no Windows com 1 clique
                  </p>
                </div>
              </div>
              <button className="modal-close" onClick={() => setDownloadModal(false)}>
                ✕
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              
              <div style={{ background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.25)', borderRadius: '8px', padding: '1rem' }}>
                <p style={{ fontSize: '0.88rem', margin: 0, color: 'var(--text-main)', lineHeight: 1.5 }}>
                  ℹ️ <strong>Por que executar no computador?</strong> Os scripts precisam de acesso direto aos bancos de dados locais da farmácia (<code>191.167.1.80</code> e <code>srv-sete</code>) e ao Chrome Selenium. Ao rodar no PC, eles atualizam o <strong>Supabase</strong> na nuvem automaticamente.
                </p>
              </div>

              {/* OPÇÕES DE DOWNLOAD 1-CLIQUE */}
              <div>
                <h4 style={{ fontSize: '0.95rem', marginBottom: '0.6rem', color: 'var(--text-main)' }}>
                  🚀 1. Executáveis em Lote (.bat para Windows)
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.75rem' }}>
                  
                  {/* Card Tudo */}
                  <div style={{ background: 'var(--bg-subtle, rgba(255,255,255,0.03))', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '0.9rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#60a5fa', marginBottom: '0.25rem' }}>
                        ⚡ Rotina Completa (Tudo)
                      </div>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                        Baixa extratos via Chrome e sincroniza valores dos bancos no Supabase.
                      </p>
                    </div>
                    <button
                      className="btn btn-primary btn-sm"
                      style={{ marginTop: '0.75rem', width: '100%', justifyContent: 'center' }}
                      onClick={() => handleDownloadScript('bat_tudo')}
                    >
                      📥 Baixar Executar_Tudo.bat
                    </button>
                  </div>

                  {/* Card Atualizar Valores */}
                  <div style={{ background: 'var(--bg-subtle, rgba(255,255,255,0.03))', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '0.9rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#4ade80', marginBottom: '0.25rem' }}>
                        📊 Apenas Atualizar Valores
                      </div>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                        Consolida débitos das lojas 01 e 07 e grava no banco de dados.
                      </p>
                    </div>
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ marginTop: '0.75rem', width: '100%', justifyContent: 'center' }}
                      onClick={() => handleDownloadScript('bat_contas')}
                    >
                      📥 Baixar Atualizar_Contas.bat
                    </button>
                  </div>

                  {/* Card Download PDFs */}
                  <div style={{ background: 'var(--bg-subtle, rgba(255,255,255,0.03))', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '0.9rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#fbbf24', marginBottom: '0.25rem' }}>
                        📄 Apenas Baixar Extratos PDF
                      </div>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                        Abre o Selenium para baixar extratos do sistema de convênios.
                      </p>
                    </div>
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ marginTop: '0.75rem', width: '100%', justifyContent: 'center' }}
                      onClick={() => handleDownloadScript('bat_download')}
                    >
                      📥 Baixar Baixar_Extratos.bat
                    </button>
                  </div>

                  {/* Card Upload PDFs */}
                  <div style={{ background: 'var(--bg-subtle, rgba(255,255,255,0.03))', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '0.9rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#38bdf8', marginBottom: '0.25rem' }}>
                        📤 Apenas Subir PDFs Locais
                      </div>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                        Envia os PDFs de contas e holerites locais para o Supabase Storage.
                      </p>
                    </div>
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ marginTop: '0.75rem', width: '100%', justifyContent: 'center' }}
                      onClick={() => handleDownloadScript('bat_upload')}
                    >
                      📥 Baixar Subir_PDFs.bat
                    </button>
                  </div>

                  {/* Card Scripts Python Puros */}
                  <div style={{ background: 'var(--bg-subtle, rgba(255,255,255,0.03))', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '0.9rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#c084fc', marginBottom: '0.25rem' }}>
                        🐍 Scripts Python (.py)
                      </div>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                        Código fonte dos scripts para quem roda direto pelo terminal.
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.3rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ flex: 1, minWidth: '85px', justifyContent: 'center', fontSize: '0.72rem', padding: '0.3rem 0.4rem' }}
                        onClick={() => handleDownloadScript('contas_lojas')}
                      >
                        contas.py
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ flex: 1, minWidth: '85px', justifyContent: 'center', fontSize: '0.72rem', padding: '0.3rem 0.4rem' }}
                        onClick={() => handleDownloadScript('conta_pdf_download')}
                      >
                        download.py
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ flex: 1, minWidth: '85px', justifyContent: 'center', fontSize: '0.72rem', padding: '0.3rem 0.4rem' }}
                        onClick={() => handleDownloadScript('upload_pdfs')}
                      >
                        upload.py
                      </button>
                    </div>
                  </div>

                </div>
              </div>

              {/* PASSO A PASSO */}
              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem' }}>
                <h4 style={{ fontSize: '0.9rem', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
                  📋 Como utilizar:
                </h4>
                <ol style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                  <li>Baixe o arquivo <code>.bat</code> e deixe na pasta do projeto no seu PC.</li>
                  <li>Dê <strong>2 cliques</strong> no arquivo <code>.bat</code> para executar a sincronização.</li>
                  <li>Assim que o terminal fechar com sucesso, clique no botão <strong>Recarregar Dados</strong> abaixo!</li>
                </ol>
              </div>

            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  fetchContas();
                  addToast('🔄 Dados atualizados da nuvem!', 'success');
                }}
              >
                🔄 Recarregar Dados da Tela
              </button>
              <button className="btn btn-primary btn-sm" onClick={() => setDownloadModal(false)}>
                Concluído
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE PRÉVIA DE MENSAGEM */}
      {previewModal.open && previewModal.emp && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <h3>📱 Prévia de Mensagem WhatsApp</h3>
              <button
                className="modal-close"
                onClick={() => setPreviewModal({ open: false, emp: null, tipo: 'aviso_17' })}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: '1rem', fontSize: '0.9rem' }}>
                <strong>Colaborador:</strong> {previewModal.emp.nome} <br />
                <strong>Telefone:</strong> {previewModal.emp.telefone || 'Não informado'} <br />
                <strong>Loja:</strong> {previewModal.emp.loja || 'Não informada'} <br />
                <strong>Tipo de Disparo:</strong>{' '}
                <span className="badge badge-accent">
                  {previewModal.tipo === 'aviso_17'
                    ? 'Aviso de Fechamento (Dia 17 - Sem PDF)'
                    : previewModal.tipo === 'fechamento_18'
                    ? 'Envio de Extrato com PDF (Dia 18)'
                    : 'Holerite PDF'}
                </span>
              </div>

              <div className="whatsapp-preview-box">
                <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
                  {getPreviewText(previewModal.emp, previewModal.tipo)}
                </pre>
              </div>

              {previewModal.tipo === 'fechamento_18' && !previewModal.emp.contaPDF && (
                <div style={{ marginTop: '0.75rem', color: parseValorConta(previewModal.emp.valorConta) <= 0 ? '#f59e0b' : 'var(--danger)', fontSize: '0.85rem', background: parseValorConta(previewModal.emp.valorConta) <= 0 ? 'rgba(245, 158, 11, 0.1)' : 'rgba(239, 68, 68, 0.1)', border: '1px solid currentColor', padding: '0.6rem 0.8rem', borderRadius: '6px' }}>
                  {parseValorConta(previewModal.emp.valorConta) <= 0
                    ? 'ℹ️ Conta Zerada sem Extrato: Este colaborador possui conta zerada (R$ 0,00) e não tem PDF de extrato anexado. O envio está bloqueado.'
                    : '⚠️ Atenção: Este colaborador não possui o PDF do Extrato anexado. Faça o upload antes de enviar.'}
                </div>
              )}

              {previewModal.tipo === 'fechamento_18' && !!previewModal.emp.contaPDF && parseValorConta(previewModal.emp.valorConta) <= 0 && (
                <div style={{ marginTop: '0.75rem', color: '#10b981', fontSize: '0.85rem', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '0.6rem 0.8rem', borderRadius: '6px' }}>
                  📄 <strong>Extrato Anexado:</strong> O colaborador está com valor zerado (R$ 0,00), mas possui o extrato em PDF anexado. O documento será enviado normalmente com a mensagem.
                </div>
              )}

              {previewModal.tipo === 'holerite' && !previewModal.emp.holeritePDF && (
                <div style={{ marginTop: '0.75rem', color: 'var(--danger)', fontSize: '0.85rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid currentColor', padding: '0.6rem 0.8rem', borderRadius: '6px' }}>
                  ⚠️ Atenção: Este colaborador não possui o PDF do Holerite anexado. Faça o upload antes de enviar.
                </div>
              )}

              {previewModal.tipo === 'aviso_17' && parseValorConta(previewModal.emp.valorConta) <= 0 && (
                <div style={{ marginTop: '0.75rem', color: '#f59e0b', fontSize: '0.85rem', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '0.6rem 0.8rem', borderRadius: '6px' }}>
                  ℹ️ <strong>Conta Zerada:</strong> Este colaborador não possui débitos em aberto (R$ 0,00). O envio do Aviso de Fechamento está bloqueado para contas zeradas.
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setPreviewModal({ open: false, emp: null, tipo: 'aviso_17' })}
              >
                Cancelar
              </button>
              <button
                className="btn btn-whatsapp btn-sm"
                onClick={() => triggerSendSingle(previewModal.emp.id, previewModal.tipo)}
                disabled={
                  (previewModal.tipo === 'aviso_17' && parseValorConta(previewModal.emp.valorConta) <= 0) ||
                  (previewModal.tipo === 'fechamento_18' && !previewModal.emp.contaPDF) ||
                  (previewModal.tipo === 'holerite' && !previewModal.emp.holeritePDF)
                }
              >
                🚀 Confirmar Envio Manual
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE UPLOAD DE PDF (AVULSO) */}
      {uploadModal.open && uploadModal.emp && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '460px' }}>
            <div className="modal-header">
              <h3>
                📄 Upload de {uploadModal.tipoDoc === 'holerite' ? 'Holerite PDF' : 'Extrato PDF'}
              </h3>
              <button
                className="modal-close"
                onClick={() => setUploadModal({ open: false, emp: null, tipoDoc: 'conta' })}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleUpload}>
              <div className="modal-body">
                <p style={{ marginBottom: '1rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  Selecione o arquivo PDF para <strong>{uploadModal.emp.nome}</strong>. O arquivo será salvo diretamente no Supabase Storage.
                </p>

                <div className="form-group">
                  <label>Arquivo PDF:</label>
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => setUploadFile(e.target.files[0])}
                    required
                    className="form-control"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setUploadModal({ open: false, emp: null, tipoDoc: 'conta' })}
                  disabled={uploading}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary btn-sm" disabled={uploading}>
                  {uploading ? <><span className="spinner"></span> Enviando...</> : 'Enviar PDF'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
