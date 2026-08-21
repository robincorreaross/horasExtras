'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import ContasView from '@/components/ContasView';

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const LOJAS = [
  'TODAS',
  'Loja 1 - FarmaSETE',
  'Loja 2 - Droga Sete Matriz',
  'Loja 3 - Droga Sete Filial',
  'Terceirizado'
];

const TIPO_LABELS = {
  extra_50: 'Extra 50%',
  extra_100: 'Extra 100%',
  domingo_menos_1: 'Domingo -1 (-4h)',
  falta: 'Falta (Débito)',
  pagamento_horas: 'Pagamento de Horas',
};

function formatBRL(val) {
  if (val === null || val === undefined || val === '') return 'R$ 0,00';
  const num = typeof val === 'number' ? val : parseFloat(String(val).replace(',', '.'));
  if (isNaN(num)) return 'R$ 0,00';
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function Dashboard() {
  const router = useRouter();
  const now = new Date();

  // Sidebar navigation state: 'colaboradores' | 'horas' | 'contas'
  const [activeNav, setActiveNav] = useState('colaboradores');

  // Month reference
  let defaultMonth = now.getMonth() - 1;
  let defaultYear = now.getFullYear();
  if (defaultMonth < 0) {
    defaultMonth = 11;
    defaultYear -= 1;
  }

  const [refMonth, setRefMonth] = useState(defaultMonth);
  const [refYear, setRefYear] = useState(defaultYear);

  // Data & Global States
  const [funcionarios, setFuncionarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState([]);
  const [selectedLoja, setSelectedLoja] = useState('TODAS');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'nome', direction: 'asc' });

  // Modal states
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [empForm, setEmpForm] = useState({
    id_loja: '',
    nome: '',
    telefone: '',
    loja: LOJAS[1],
    data_admissao: '',
    saldo_inicial: '',
    valorConta: '0',
    ativo: true,
  });

  const [showMovModal, setShowMovModal] = useState(false);
  const [movTarget, setMovTarget] = useState(null);
  const [editingMov, setEditingMov] = useState(null);
  const [movForm, setMovForm] = useState({ tipo: 'extra_50', horas: '', data_registro: '' });

  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailEmployee, setDetailEmployee] = useState(null);
  const [detailMovs, setDetailMovs] = useState([]);

  // Bulk send states
  const [bulkSending, setBulkSending] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });

  const addToast = useCallback((msg, type = 'info') => {
    const id = Date.now() + '-' + Math.random();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  const fetchFuncionarios = useCallback(async () => {
    try {
      const query = selectedLoja !== 'TODAS' ? `&loja=${encodeURIComponent(selectedLoja)}` : '';
      const res = await fetch(`/api/funcionarios?month=${refMonth}&year=${refYear}${query}`);
      if (res.status === 401) { router.push('/login'); return; }
      const data = await res.json();
      if (Array.isArray(data)) {
        setFuncionarios(data);
      }
    } catch (err) {
      addToast('Erro ao carregar colaboradores', 'error');
    } finally {
      setLoading(false);
    }
  }, [router, refMonth, refYear, selectedLoja, addToast]);

  useEffect(() => {
    fetchFuncionarios();
  }, [fetchFuncionarios]);

  // Global ESC key to close open modals
  useEffect(() => {
    const handleEsc = (event) => {
      if (event.key === 'Escape') {
        setShowEmployeeModal(false);
        setShowMovModal(false);
        setShowDetailModal(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  // ====== SORTING & FILTERING ======
  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const filteredFuncionarios = funcionarios.filter(func => {
    const term = searchTerm.toLowerCase();
    return (
      (func.nome && func.nome.toLowerCase().includes(term)) ||
      (func.telefone && func.telefone.includes(term)) ||
      (func.loja && func.loja.toLowerCase().includes(term)) ||
      (func.id_loja && String(func.id_loja).includes(term))
    );
  });

  const sortedFuncionarios = [...filteredFuncionarios].sort((a, b) => {
    const { key, direction } = sortConfig;
    let valA = a[key];
    let valB = b[key];

    if (key === 'saldo_atual' || key === 'saldo_inicial' || key === 'id_loja' || key === 'valorConta') {
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

  // ====== EMPLOYEE CRUD ======
  const openNewEmployee = () => {
    setEditingEmployee(null);
    setEmpForm({
      id_loja: '',
      nome: '',
      telefone: '',
      loja: LOJAS[1],
      data_admissao: '',
      saldo_inicial: '',
      valorConta: '0',
      ativo: true,
    });
    setShowEmployeeModal(true);
  };

  const openEditEmployee = (emp) => {
    setEditingEmployee(emp);
    setEmpForm({
      id_loja: emp.id_loja || '',
      nome: emp.nome,
      telefone: emp.telefone || '',
      loja: emp.loja || LOJAS[1],
      data_admissao: emp.data_admissao ? emp.data_admissao.split('T')[0] : '',
      saldo_inicial: emp.saldo_inicial || '0',
      valorConta: emp.valorConta || '0',
      ativo: emp.ativo !== false,
    });
    setShowEmployeeModal(true);
  };

  const saveEmployee = async () => {
    try {
      if (!empForm.nome.trim()) {
        addToast('O nome do colaborador é obrigatório', 'error');
        return;
      }

      if (editingEmployee) {
        await fetch(`/api/funcionarios/${editingEmployee.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(empForm),
        });
        addToast(`${empForm.nome} atualizado com sucesso!`, 'success');
      } else {
        await fetch('/api/funcionarios', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(empForm),
        });
        addToast(`${empForm.nome} cadastrado com sucesso!`, 'success');
      }
      setShowEmployeeModal(false);
      fetchFuncionarios();
    } catch (err) {
      addToast('Erro ao salvar colaborador', 'error');
    }
  };

  const deleteEmployee = async (emp) => {
    if (!confirm(`Tem certeza que deseja excluir ${emp.nome}? Todos os lançamentos vinculados serão removidos.`)) return;
    try {
      await fetch(`/api/funcionarios/${emp.id}`, { method: 'DELETE' });
      addToast(`${emp.nome} removido do sistema`, 'success');
      fetchFuncionarios();
    } catch (err) {
      addToast('Erro ao excluir colaborador', 'error');
    }
  };

  // ====== MOVEMENTS ======
  const openAddMov = (emp, fromDetail = false) => {
    if (!fromDetail) setDetailEmployee(null);
    setMovTarget(emp);
    setEditingMov(null);
    setMovForm({ tipo: 'extra_50', horas: '', data_registro: '' });
    setShowMovModal(true);
  };

  const openEditMov = (mov) => {
    setEditingMov(mov);
    setMovForm({
      tipo: mov.tipo,
      horas: Math.abs(parseFloat(mov.horas_debito_credito)),
      data_registro: mov.data_registro ? mov.data_registro.split('T')[0] : '',
    });
    setShowMovModal(true);
  };

  const saveMov = async () => {
    if (!movForm.data_registro) {
      addToast('Por favor, selecione a data do lançamento.', 'error');
      return;
    }

    try {
      let res;
      if (editingMov) {
        res = await fetch(`/api/movimentacoes/${editingMov.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...movForm }),
        });
      } else {
        const targetId = movTarget.id;
        res = await fetch('/api/movimentacoes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            funcionario_id: targetId,
            data_registro: movForm.data_registro,
            tipo: movForm.tipo,
            horas: movForm.horas,
          }),
        });
      }

      const data = await res.json();
      if (!res.ok) {
        addToast(data.error || 'Erro ao salvar movimentação', 'error');
        return;
      }

      addToast(editingMov ? 'Lançamento atualizado!' : 'Horas lançadas com sucesso!', 'success');
      setShowMovModal(false);
      fetchFuncionarios();

      if (detailEmployee) {
        loadEmployeeDetail(detailEmployee.id);
      }
    } catch (err) {
      addToast('Erro de comunicação ao salvar horas', 'error');
    }
  };

  const deleteMov = async (movId) => {
    if (!confirm('Excluir este lançamento de horas?')) return;
    try {
      await fetch(`/api/movimentacoes/${movId}`, { method: 'DELETE' });
      addToast('Lançamento excluído', 'success');
      fetchFuncionarios();
      if (detailEmployee) {
        loadEmployeeDetail(detailEmployee.id);
      }
    } catch (err) {
      addToast('Erro ao excluir lançamento', 'error');
    }
  };

  // ====== EMPLOYEE DETAIL MODAL ======
  const loadEmployeeDetail = async (empId) => {
    try {
      const empRes = await fetch(`/api/funcionarios/${empId}?month=${refMonth}&year=${refYear}`);
      const empData = await empRes.json();
      const mesStr = `${refYear}-${(refMonth + 1).toString().padStart(2, '0')}`;
      const movsRes = await fetch(`/api/movimentacoes?funcionario_id=${empId}&mes=${mesStr}`);
      const movsData = await movsRes.json();
      setDetailEmployee(empData);
      setDetailMovs(movsData);
      setShowDetailModal(true);
    } catch (err) {
      addToast('Erro ao carregar extrato de horas', 'error');
    }
  };

  // ====== WHATSAPP SEND (BANCO DE HORAS) ======
  const sendWhatsAppHoras = async (empId) => {
    try {
      addToast('Verificando conexão do WhatsApp...', 'info');
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ funcionario_id: empId, ref_month: refMonth, ref_year: refYear }),
      });
      const data = await res.json();
      if (data.success) {
        addToast(`✅ Extrato enviado para ${data.nome}!`, 'success');
      } else {
        addToast(`❌ ${data.error}`, 'error');
      }
    } catch (err) {
      addToast('Erro ao enviar mensagem de horas', 'error');
    }
  };

  const sendBulkWhatsAppHoras = async () => {
    // Exclui terceirizados conforme regra de negócio
    const activeEmployees = funcionarios.filter(f => f.ativo && f.loja !== 'Terceirizado');
    if (activeEmployees.length === 0) {
      addToast('Nenhum colaborador ativo (não terceirizado) disponível', 'error');
      return;
    }
    if (!confirm(`Confirmar disparo de extrato de banco de horas para ${activeEmployees.length} colaboradores ativos? (Terceirizados foram ignorados automaticamente)`)) return;

    setBulkSending(true);
    setBulkProgress({ current: 0, total: activeEmployees.length });

    for (let i = 0; i < activeEmployees.length; i++) {
      try {
        const res = await fetch('/api/whatsapp/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            funcionario_id: activeEmployees[i].id,
            ref_month: refMonth,
            ref_year: refYear,
          }),
        });
        const data = await res.json();
        if (data.success) {
          addToast(`✅ ${data.nome} - enviado`, 'success');
        } else {
          addToast(`❌ ${activeEmployees[i].nome}: ${data.error}`, 'error');
          if (data.error?.includes('desconectado') || data.error?.includes('Conecte')) {
            addToast('Envio em massa interrompido - WhatsApp desconectado', 'error');
            break;
          }
        }
      } catch (err) {
        addToast(`❌ Erro: ${activeEmployees[i].nome}`, 'error');
      }
      setBulkProgress({ current: i + 1, total: activeEmployees.length });

      if (i < activeEmployees.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 4000));
      }
    }

    setBulkSending(false);
    addToast('Envio em massa de horas finalizado!', 'info');
  };

  // ====== LOGOUT ======
  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  // ====== STATS CALCULATIONS ======
  const totalFuncionarios = sortedFuncionarios.length;
  const totalAtivos = sortedFuncionarios.filter(f => f.ativo).length;

  const totalHorasExtras = sortedFuncionarios.reduce((acc, func) => {
    const saldo = parseFloat(func.saldo_atual || 0);
    return saldo > 0 ? acc + saldo : acc;
  }, 0);

  const totalHorasDevendo = sortedFuncionarios.reduce((acc, func) => {
    const saldo = parseFloat(func.saldo_atual || 0);
    return saldo < 0 ? acc + Math.abs(saldo) : acc;
  }, 0);

  const totalZerados = sortedFuncionarios.filter(func => parseFloat(func.saldo_atual || 0) === 0).length;

  return (
    <div className="app-layout">
      {/* TOASTS */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.type}`}>{t.msg}</div>
        ))}
      </div>

      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo">R</div>
          <div className="sidebar-title-box">
            <span className="sidebar-title">Painel Ross</span>
            <span className="sidebar-subtitle">Gestão Integrada</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <button
            className={`sidebar-link ${activeNav === 'colaboradores' ? 'active' : ''}`}
            onClick={() => setActiveNav('colaboradores')}
          >
            <span className="icon">👥</span>
            <span>Colaboradores</span>
          </button>

          <button
            className={`sidebar-link ${activeNav === 'horas' ? 'active' : ''}`}
            onClick={() => setActiveNav('horas')}
          >
            <span className="icon">⏱️</span>
            <span>Banco de Horas</span>
          </button>

          <button
            className={`sidebar-link ${activeNav === 'contas' ? 'active' : ''}`}
            onClick={() => setActiveNav('contas')}
          >
            <span className="icon">🧾</span>
            <span>Contas & Holerites</span>
          </button>
        </nav>

        <div className="sidebar-footer">
          <button className="btn btn-secondary btn-sm" onClick={handleLogout} style={{ width: '100%' }}>
            🚪 Encerrar Sessão
          </button>
        </div>
      </aside>

      {/* MAIN VIEWPORT */}
      <div className="main-wrapper">
        {/* TOP BAR */}
        <header className="top-bar">
          <div className="top-bar-left">
            <span className="section-tag">
              {activeNav === 'colaboradores' && '👥 Cadastro Central de Colaboradores'}
              {activeNav === 'horas' && `⏱️ Banco de Horas (${MONTH_NAMES[refMonth]} / ${refYear})`}
              {activeNav === 'contas' && '🧾 Gestão de Contas, Extratos & Holerites'}
            </span>
          </div>

          <div className="top-bar-right">
            {activeNav === 'horas' && (
              <div className="month-picker">
                <span>📅 Referência:</span>
                <select value={refMonth} onChange={(e) => setRefMonth(parseInt(e.target.value))}>
                  {MONTH_NAMES.map((m, i) => (
                    <option key={i} value={i}>
                      {m}
                    </option>
                  ))}
                </select>
                <select value={refYear} onChange={(e) => setRefYear(parseInt(e.target.value))}>
                  {[2024, 2025, 2026, 2027].map(y => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            )}


            {activeNav === 'colaboradores' && (
              <button className="btn btn-primary btn-sm" onClick={openNewEmployee}>
                + Novo Colaborador
              </button>
            )}
          </div>
        </header>

        {/* CONTENT */}
        <main className="content-container">
          {loading ? (
            <div className="empty-state">
              <span className="spinner" style={{ width: 32, height: 32 }}></span>
              <p style={{ marginTop: '1rem' }}>Carregando dados unificados...</p>
            </div>
          ) : activeNav === 'contas' ? (
            <ContasView addToast={addToast} onOpenColabModal={openNewEmployee} />
          ) : activeNav === 'horas' ? (
            <>
              {/* BANCO DE HORAS - STATS */}
              <div className="stats-grid">
                <div className="stat-item">
                  <span className="stat-item-label">Total de Colaboradores</span>
                  <span className="stat-item-value">{totalFuncionarios}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-item-label">Total Horas Extras</span>
                  <span className="stat-item-value" style={{ color: 'var(--success)' }}>
                    +{totalHorasExtras}h
                  </span>
                </div>
                <div className="stat-item">
                  <span className="stat-item-label">Total Horas Devendo</span>
                  <span className="stat-item-value" style={{ color: 'var(--danger)' }}>
                    -{totalHorasDevendo}h
                  </span>
                </div>
                <div className="stat-item">
                  <span className="stat-item-label">Colaboradores Zerados</span>
                  <span className="stat-item-value" style={{ color: 'var(--text-muted)' }}>
                    {totalZerados}
                  </span>
                </div>
              </div>

              {/* BANCO DE HORAS - BULK PROGRESS */}
              {bulkSending && (
                <div className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600 }}>Enviando extratos de horas via WhatsApp...</span>
                    <span className="badge badge-accent">{bulkProgress.current} / {bulkProgress.total}</span>
                  </div>
                  <div className="progress-bar-container">
                    <div className="progress-bar" style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }}></div>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                    {bulkProgress.current} de {bulkProgress.total} colaboradores processados
                  </p>
                </div>
              )}

              {/* BANCO DE HORAS - TABELA */}
              <div className="card">
                <div className="card-header-clean">
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', flex: 1, minWidth: '280px' }}>
                    <input
                      type="text"
                      className="search-input"
                      placeholder="🔍 Buscar colaborador por nome, telefone ou loja..."
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
                    <button className="btn btn-whatsapp btn-sm" onClick={sendBulkWhatsAppHoras} disabled={bulkSending}>
                      {bulkSending ? <><span className="spinner"></span> Enviando...</> : '📱 Disparar Todos (WhatsApp)'}
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={fetchFuncionarios}>
                      🔄 Atualizar
                    </button>
                  </div>
                </div>

                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th onClick={() => handleSort('nome')} style={{ cursor: 'pointer' }}>
                          Nome {sortConfig.key === 'nome' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                        </th>
                        <th onClick={() => handleSort('loja')} style={{ cursor: 'pointer' }}>
                          Loja / Unidade {sortConfig.key === 'loja' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                        </th>
                        <th>Telefone</th>
                        <th onClick={() => handleSort('saldo_atual')} style={{ cursor: 'pointer', textAlign: 'center' }}>
                          Saldo do Mês {sortConfig.key === 'saldo_atual' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                        </th>
                        <th style={{ textAlign: 'center' }}>Status</th>
                        <th style={{ textAlign: 'right' }}>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedFuncionarios.map(func => {
                        const saldo = parseFloat(func.saldo_atual || 0);
                        const isTerceirizado = func.loja === 'Terceirizado';
                        return (
                          <tr key={func.id}>
                            <td style={{ fontWeight: 600 }}>{func.nome}</td>
                            <td>
                              <span className="badge badge-neutral">{func.loja || 'Sem Loja'}</span>
                            </td>
                            <td style={{ color: 'var(--text-secondary)', fontFamily: 'monospace', fontSize: '0.85rem' }}>
                              {func.telefone || <span style={{ color: 'var(--text-dim)' }}>Sem telefone</span>}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <span className={`badge ${saldo > 0 ? 'badge-success' : saldo < 0 ? 'badge-danger' : 'badge-neutral'}`}>
                                {saldo > 0 ? '+' : ''}{saldo}h
                              </span>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <span className={`badge ${func.ativo ? 'badge-success' : 'badge-neutral'}`}>
                                {func.ativo ? 'Ativo' : 'Inativo'}
                              </span>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end' }}>
                                <button className="btn btn-secondary btn-xs" onClick={() => loadEmployeeDetail(func.id)} title="Extrato detalhado">
                                  📋 Extrato
                                </button>
                                <button className="btn btn-primary btn-xs" onClick={() => openAddMov(func)} title="Lançar horas extras ou faltas">
                                  ⏱️ Lançar
                                </button>
                                {!isTerceirizado && (
                                  <button className="btn btn-whatsapp btn-xs" onClick={() => sendWhatsAppHoras(func.id)} title="Enviar WhatsApp" disabled={bulkSending}>
                                    📱
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            /* SEÇÃO 1: COLABORADORES (CADASTRO UNIFICADO CENTRAL) */
            <>
              <div className="stats-grid">
                <div className="stat-item">
                  <span className="stat-item-label">Total de Cadastros</span>
                  <span className="stat-item-value">{totalFuncionarios}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-item-label">Colaboradores Ativos</span>
                  <span className="stat-item-value" style={{ color: 'var(--success)' }}>
                    {totalAtivos}
                  </span>
                </div>
                <div className="stat-item">
                  <span className="stat-item-label">Unidades / Lojas</span>
                  <span className="stat-item-value" style={{ color: 'var(--cyan)' }}>
                    {LOJAS.length - 1}
                  </span>
                </div>
                <div className="stat-item">
                  <span className="stat-item-label">Módulo Ativo</span>
                  <span className="stat-item-value" style={{ fontSize: '1.2rem', color: 'var(--accent-light)' }}>
                    Unificado ✅
                  </span>
                </div>
              </div>

              <div className="card">
                <div className="card-header-clean">
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', flex: 1, minWidth: '280px' }}>
                    <input
                      type="text"
                      className="search-input"
                      placeholder="🔍 Buscar por nome, ID da loja, telefone..."
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
                    <button className="btn btn-primary btn-sm" onClick={openNewEmployee}>
                      + Cadastrar Colaborador
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={fetchFuncionarios}>
                      🔄 Atualizar
                    </button>
                  </div>
                </div>

                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th onClick={() => handleSort('id_loja')} style={{ cursor: 'pointer', width: '80px' }}>
                          ID Loja {sortConfig.key === 'id_loja' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                        </th>
                        <th onClick={() => handleSort('nome')} style={{ cursor: 'pointer' }}>
                          Nome Completo {sortConfig.key === 'nome' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                        </th>
                        <th onClick={() => handleSort('loja')} style={{ cursor: 'pointer' }}>
                          Loja {sortConfig.key === 'loja' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                        </th>
                        <th>Telefone WhatsApp</th>
                        <th onClick={() => handleSort('data_admissao')} style={{ cursor: 'pointer' }}>
                          Admissão {sortConfig.key === 'data_admissao' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                        </th>
                        <th style={{ textAlign: 'center' }}>Saldo Inicial</th>
                        <th style={{ textAlign: 'center' }}>Status</th>
                        <th style={{ textAlign: 'right' }}>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedFuncionarios.map(emp => (
                        <tr key={emp.id}>
                          <td style={{ fontWeight: 700, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                            {emp.id_loja ? `#${emp.id_loja}` : <span style={{ color: 'var(--text-dim)' }}>—</span>}
                          </td>
                          <td style={{ fontWeight: 600 }}>{emp.nome}</td>
                          <td>
                            <span className="badge badge-neutral">{emp.loja || 'Sem Loja'}</span>
                          </td>
                          <td style={{ color: 'var(--text-secondary)', fontFamily: 'monospace', fontSize: '0.85rem' }}>
                            {emp.telefone || <span style={{ color: 'var(--text-dim)' }}>Sem telefone</span>}
                          </td>
                          <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                            {emp.data_admissao ? new Date(emp.data_admissao).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—'}
                          </td>
                          <td style={{ textAlign: 'center', fontFamily: 'monospace' }}>
                            {emp.saldo_inicial || 0}h
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span className={`badge ${emp.ativo ? 'badge-success' : 'badge-neutral'}`}>
                              {emp.ativo ? 'Ativo' : 'Inativo'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end' }}>
                              <button className="btn btn-secondary btn-xs" onClick={() => openEditEmployee(emp)} title="Editar dados cadastrais">
                                ✏️ Editar
                              </button>
                              <button className="btn btn-danger btn-xs" onClick={() => deleteEmployee(emp)} title="Excluir">
                                🗑️
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </main>
      </div>

      {/* MODAL DE CADASTRO / EDIÇÃO DE COLABORADOR UNIFICADO */}
      {showEmployeeModal && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <div className="modal-header">
              <h3>{editingEmployee ? '✏️ Editar Colaborador' : '➕ Novo Colaborador (Unificado)'}</h3>
              <button className="modal-close" onClick={() => setShowEmployeeModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>ID / Código do Cliente (Postgres/Convênio):</label>
                <input
                  type="number"
                  className="form-control"
                  placeholder="Ex: 2957"
                  value={empForm.id_loja}
                  onChange={e => setEmpForm({ ...empForm, id_loja: e.target.value })}
                />
                <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.2rem', display: 'block' }}>
                  Código numérico utilizado para baixar os extratos em PDF e cruzar com as contas da loja.
                </small>
              </div>

              <div className="form-group">
                <label>Nome Completo:</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Ex: Raissa Rossi"
                  value={empForm.nome}
                  onChange={e => setEmpForm({ ...empForm, nome: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Telefone WhatsApp (com 55 e DDD):</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="5516999999999"
                  value={empForm.telefone}
                  onChange={e => setEmpForm({ ...empForm, telefone: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Loja / Unidade:</label>
                <select
                  className="form-control"
                  value={empForm.loja}
                  onChange={e => setEmpForm({ ...empForm, loja: e.target.value })}
                >
                  {LOJAS.filter(l => l !== 'TODAS').map(l => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label>Data de Admissão:</label>
                  <input
                    type="date"
                    className="form-control"
                    value={empForm.data_admissao}
                    onChange={e => setEmpForm({ ...empForm, data_admissao: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Saldo Inicial (Horas):</label>
                  <input
                    type="number"
                    step="0.5"
                    className="form-control"
                    placeholder="0"
                    value={empForm.saldo_inicial}
                    onChange={e => setEmpForm({ ...empForm, saldo_inicial: e.target.value })}
                  />
                </div>
              </div>

              {editingEmployee && (
                <div className="form-group">
                  <label>Status do Colaborador:</label>
                  <select
                    className="form-control"
                    value={empForm.ativo ? 'true' : 'false'}
                    onChange={e => setEmpForm({ ...empForm, ativo: e.target.value === 'true' })}
                  >
                    <option value="true">✅ Ativo</option>
                    <option value="false">⏸️ Inativo</option>
                  </select>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary btn-sm" onClick={() => setShowEmployeeModal(false)}>
                Cancelar
              </button>
              <button className="btn btn-primary btn-sm" onClick={saveEmployee}>
                {editingEmployee ? 'Salvar Alterações' : 'Cadastrar Colaborador'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE LANÇAMENTO DE HORAS */}
      {showMovModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3>{editingMov ? '✏️ Editar Lançamento' : `⏱️ Lançar Horas - ${movTarget?.nome}`}</h3>
              <button className="modal-close" onClick={() => setShowMovModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Tipo de Lançamento:</label>
                <select
                  className="form-control"
                  value={movForm.tipo}
                  onChange={e => setMovForm({ ...movForm, tipo: e.target.value })}
                >
                  <option value="extra_50">Extra 50% (Crédito)</option>
                  <option value="extra_100">Extra 100% (Crédito)</option>
                  <option value="domingo_menos_1">Domingo -1 (-4h Débito)</option>
                  <option value="falta">Falta (Débito Manual)</option>
                  <option value="pagamento_horas">Pagamento de Horas (Desconto)</option>
                </select>
              </div>

              {movForm.tipo !== 'domingo_menos_1' && (
                <div className="form-group">
                  <label>Quantidade de Horas:</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    className="form-control"
                    placeholder="Ex: 2.5"
                    value={movForm.horas}
                    onChange={e => setMovForm({ ...movForm, horas: e.target.value })}
                  />
                </div>
              )}

              <div className="form-group">
                <label>Data do Ocorrido / Registro:</label>
                <input
                  type="date"
                  className="form-control"
                  value={movForm.data_registro}
                  onChange={e => setMovForm({ ...movForm, data_registro: e.target.value })}
                />
              </div>

              {movForm.tipo === 'domingo_menos_1' && (
                <div style={{ background: 'var(--warning-bg)', border: '1px solid var(--warning-border)', borderRadius: 'var(--radius-sm)', padding: '0.75rem', fontSize: '0.85rem', color: 'var(--warning)' }}>
                  ⚠️ Domingo -1 gera automaticamente um débito de 4 horas conforme a regra da loja.
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary btn-sm" onClick={() => setShowMovModal(false)}>
                Cancelar
              </button>
              <button className="btn btn-primary btn-sm" onClick={saveMov}>
                {editingMov ? 'Salvar Lançamento' : 'Registrar Horas'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE EXTRATO DETALHADO DO COLABORADOR */}
      {showDetailModal && detailEmployee && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '640px' }}>
            <div className="modal-header">
              <h3>📋 Extrato: {detailEmployee.nome}</h3>
              <button className="modal-close" onClick={() => setShowDetailModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
                <span className="badge badge-accent">📞 {detailEmployee.telefone || 'Sem Tel'}</span>
                <span className="badge badge-neutral">🏪 {detailEmployee.loja}</span>
                <span className={`badge ${parseFloat(detailEmployee.saldo_atual || 0) < 0 ? 'badge-danger' : parseFloat(detailEmployee.saldo_atual || 0) > 0 ? 'badge-success' : 'badge-neutral'}`}>
                  Saldo Total: {parseFloat(detailEmployee.saldo_atual || 0)}h
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Lançamentos em {MONTH_NAMES[refMonth]} / {refYear}
                </h4>
                <button className="btn btn-primary btn-xs" onClick={() => {
                  setShowDetailModal(false);
                  openAddMov(detailEmployee, true);
                }}>
                  + Adicionar Lançamento
                </button>
              </div>

              {detailMovs.length === 0 ? (
                <div className="empty-state" style={{ padding: '1.5rem' }}>
                  <p>Sem movimentações registradas neste mês de referência.</p>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Data</th>
                        <th>Tipo</th>
                        <th>Horas</th>
                        <th style={{ textAlign: 'right' }}>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailMovs.map(mov => (
                        <tr key={mov.id}>
                          <td>{new Date(mov.data_registro).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</td>
                          <td><span className="badge badge-accent">{TIPO_LABELS[mov.tipo] || mov.tipo}</span></td>
                          <td>
                            <span className={`badge ${parseFloat(mov.horas_debito_credito) >= 0 ? 'badge-success' : 'badge-danger'}`}>
                              {parseFloat(mov.horas_debito_credito) > 0 ? '+' : ''}{parseFloat(mov.horas_debito_credito)}h
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'flex-end' }}>
                              <button className="btn btn-secondary btn-xs" onClick={() => {
                                setShowDetailModal(false);
                                setMovTarget(detailEmployee);
                                openEditMov(mov);
                              }}>✏️</button>
                              <button className="btn btn-danger btn-xs" onClick={() => deleteMov(mov.id)}>🗑️</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary btn-sm" onClick={() => setShowDetailModal(false)}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}