'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const TIPO_LABELS = {
  extra_50: 'Extra 50%',
  extra_100: 'Extra 100%',
  domingo_menos_1: 'Domingo -1',
  falta: 'Falta',
};

export default function Dashboard() {
  const router = useRouter();
  const now = new Date();

  // Mês anterior como padrão
  let defaultMonth = now.getMonth() - 1;
  let defaultYear = now.getFullYear();

  // Tratamento para Janeiro (mês 0): volta para Dezembro (11) do ano passado
  if (defaultMonth < 0) {
    defaultMonth = 11;
    defaultYear -= 1;
  }

  const [refMonth, setRefMonth] = useState(defaultMonth);
  const [refYear, setRefYear] = useState(defaultYear);

  const [funcionarios, setFuncionarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState([]);

  // Modal states
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [showMovModal, setShowMovModal] = useState(false);
  const [movTarget, setMovTarget] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailEmployee, setDetailEmployee] = useState(null);
  const [detailMovs, setDetailMovs] = useState([]);
  const [editingMov, setEditingMov] = useState(null);

  // Bulk send states
  const [bulkSending, setBulkSending] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });

  // Form states
  const [empForm, setEmpForm] = useState({ nome: '', telefone: '', cargo: '', data_admissao: '', saldo_inicial: '', ativo: true });
  const [movForm, setMovForm] = useState({ tipo: 'extra_50', horas: '', data_registro: '' });

  // ====== BUSCA E ORDENAÇÃO ======
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'nome', direction: 'asc' });

  const handleSort = (key) => {
    let direction = 'asc';
    // Se clicar na mesma coluna, inverte a ordem
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // 1. Filtra pelo termo de busca
  const filteredFuncionarios = funcionarios.filter(func =>
    func.nome.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 2. Ordena a lista filtrada
  const sortedAndFiltered = [...filteredFuncionarios].sort((a, b) => {
    const { key, direction } = sortConfig;
    let valA = a[key];
    let valB = b[key];

    // Se for o saldo atual, precisamos transformar em número para comparar corretamente
    if (key === 'saldo_atual') {
      valA = parseFloat(valA || 0);
      valB = parseFloat(valB || 0);
    } else {
      // Se for texto, transformamos em minúsculas
      valA = valA ? valA.toString().toLowerCase() : '';
      valB = valB ? valB.toString().toLowerCase() : '';
    }

    if (valA < valB) return direction === 'asc' ? -1 : 1;
    if (valA > valB) return direction === 'asc' ? 1 : -1;
    return 0;
  });

  const addToast = (msg, type = 'info') => {
    const id = Date.now() + '-' + Math.random();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  };

  const fetchFuncionarios = useCallback(async () => {
    try {
      const res = await fetch('/api/funcionarios');
      if (res.status === 401) { router.push('/login'); return; }
      const data = await res.json();
      setFuncionarios(data);
    } catch (err) {
      addToast('Erro ao carregar funcionários', 'error');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { fetchFuncionarios(); }, [fetchFuncionarios]);

  // ====== GLOBAL SHORTCURTS ======
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

  // ====== EMPLOYEE CRUD ======
  const openNewEmployee = () => {
    setEditingEmployee(null);
    setEmpForm({ nome: '', telefone: '', cargo: '', data_admissao: '', saldo_inicial: '', ativo: true });
    setShowEmployeeModal(true);
  };

  const openEditEmployee = (emp) => {
    setEditingEmployee(emp);
    setEmpForm({
      nome: emp.nome,
      telefone: emp.telefone,
      cargo: emp.cargo,
      data_admissao: emp.data_admissao ? emp.data_admissao.split('T')[0] : '',
      saldo_inicial: emp.saldo_inicial || '',
      ativo: emp.ativo,
    });
    setShowEmployeeModal(true);
  };

  const saveEmployee = async () => {
    try {
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
      addToast('Erro ao salvar funcionário', 'error');
    }
  };

  const deleteEmployee = async (emp) => {
    if (!confirm(`Tem certeza que deseja excluir ${emp.nome}? Todas as movimentações serão removidas.`)) return;
    try {
      await fetch(`/api/funcionarios/${emp.id}`, { method: 'DELETE' });
      addToast(`${emp.nome} removido`, 'success');
      fetchFuncionarios();
    } catch (err) {
      addToast('Erro ao excluir', 'error');
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
    // 1. Validação de data obrigatória no frontend
    if (!movForm.data_registro) {
      addToast('Por favor, selecione a data do registro.', 'error');
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
        // 2. Garantir que puxa o ID corretamente mesmo se a API devolver um Array
        const targetId = movTarget.id || (Array.isArray(movTarget) ? movTarget[0].id : null);

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

      addToast(editingMov ? 'Movimentação atualizada!' : 'Movimentação registrada!', 'success');
      setShowMovModal(false);
      fetchFuncionarios();

      if (detailEmployee) {
        // Garantir o recarregamento do modal usando o ID seguro
        const empId = detailEmployee.id || (Array.isArray(detailEmployee) ? detailEmployee[0].id : null);
        loadEmployeeDetail(empId);
      }
    } catch (err) {
      addToast('Erro de comunicação ao salvar movimentação', 'error');
    }
  };

  const deleteMov = async (movId) => {
    if (!confirm('Excluir esta movimentação?')) return;
    try {
      await fetch(`/api/movimentacoes/${movId}`, { method: 'DELETE' });
      addToast('Movimentação excluída', 'success');
      fetchFuncionarios();
      if (detailEmployee) {
        loadEmployeeDetail(detailEmployee.id);
      }
    } catch (err) {
      addToast('Erro ao excluir', 'error');
    }
  };

  // ====== EMPLOYEE DETAIL MODAL ======
  const loadEmployeeDetail = async (empId) => {
    try {
      const empRes = await fetch(`/api/funcionarios/${empId}`);
      const empData = await empRes.json();
      const movsRes = await fetch(`/api/movimentacoes?funcionario_id=${empId}`);
      const movsData = await movsRes.json();
      setDetailEmployee(empData);
      setDetailMovs(movsData);
      setShowDetailModal(true);
    } catch (err) {
      addToast('Erro ao carregar detalhes', 'error');
    }
  };

  // ====== WHATSAPP SEND ======
  const sendWhatsApp = async (empId) => {
    try {
      addToast('Verificando conexão do WhatsApp...', 'info');
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ funcionario_id: empId, ref_month: refMonth, ref_year: refYear }),
      });
      const data = await res.json();
      if (data.success) {
        addToast(`✅ Mensagem enviada para ${data.nome}!`, 'success');
      } else {
        addToast(`❌ ${data.error}`, 'error');
      }
    } catch (err) {
      addToast('Erro ao enviar mensagem', 'error');
    }
  };

  const sendBulkWhatsApp = async () => {
    const activeEmployees = funcionarios.filter(f => f.ativo);
    if (activeEmployees.length === 0) {
      addToast('Nenhum funcionário ativo', 'error');
      return;
    }
    if (!confirm(`Enviar mensagem para ${activeEmployees.length} funcionários ativos?`)) return;

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
          // Se não está conectado, parar o envio em massa
          if (data.error?.includes('desconectado') || data.error?.includes('Conecte')) {
            addToast('Envio em massa interrompido - WhatsApp desconectado', 'error');
            break;
          }
        }
      } catch (err) {
        addToast(`❌ Erro: ${activeEmployees[i].nome}`, 'error');
      }
      setBulkProgress({ current: i + 1, total: activeEmployees.length });

      // Aguarde 5 segundos (5000ms) entre mensagens para evitar bloqueio do WhatsApp
      if (i < activeEmployees.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    setBulkSending(false);
    addToast('Envio em massa finalizado!', 'info');
  };

  // ====== LOGOUT ======
  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  // ====== STATS ======
  const totalFuncionarios = funcionarios.length;

  const totalHorasExtras = funcionarios.reduce((acc, func) => {
    const saldo = parseFloat(func.saldo_atual);
    return saldo > 0 ? acc + saldo : acc;
  }, 0);

  const totalHorasDevendo = funcionarios.reduce((acc, func) => {
    const saldo = parseFloat(func.saldo_atual);
    // Usamos Math.abs para somar o valor absoluto da dívida
    return saldo < 0 ? acc + Math.abs(saldo) : acc;
  }, 0);

  const totalZerados = funcionarios.filter(func => parseFloat(func.saldo_atual) === 0).length;

  if (loading) {
    return (
      <>
        <nav className="navbar">
          <div className="navbar-content">
            <span className="logo">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
              TimeFlow
            </span>
          </div>
        </nav>
        <main className="layout-container">
          <div className="empty-state"><span className="spinner" style={{ width: 32, height: 32 }}></span><p style={{ marginTop: '1rem' }}>Carregando...</p></div>
        </main>
      </>
    );
  }

  return (
    <>
      {/* NAVBAR */}
      <nav className="navbar">
        <div className="navbar-content">
          <span className="logo">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
            TimeFlow
          </span>
          <div className="nav-actions">
            <div className="month-selector">
              <label>Mês Ref:</label>
              <select value={refMonth} onChange={(e) => setRefMonth(parseInt(e.target.value))}>
                {MONTH_NAMES.map((m, i) => <option key={i} value={i}>{m}</option>)}
              </select>
              <select value={refYear} onChange={(e) => setRefYear(parseInt(e.target.value))}>
                {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={handleLogout}>Sair</button>
          </div>
        </div>
      </nav>

      <main className="layout-container">
        {/* TOASTS */}
        <div className="toast-container">
          {toasts.map(t => (
            <div key={t.id} className={`toast toast-${t.type}`}>{t.msg}</div>
          ))}
        </div>

        {/* HEADER */}
        <div className="page-header">
          <div>
            <h1 className="page-title">Dashboard</h1>
            <p className="page-subtitle">
              Referência: {MONTH_NAMES[refMonth]} de {refYear}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={openNewEmployee}>+ Novo Funcionário</button>
            <button className="btn btn-whatsapp" onClick={sendBulkWhatsApp} disabled={bulkSending}>
              {bulkSending ? <><span className="spinner"></span> Enviando...</> : '📱 Enviar Todos'}
            </button>
          </div>
        </div>

        {/* BULK PROGRESS */}
        {bulkSending && (
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 600 }}>Enviando mensagens...</span>
              <span className="badge badge-accent">{bulkProgress.current} / {bulkProgress.total}</span>
            </div>
            <div className="progress-bar-container">
              <div className="progress-bar" style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }}></div>
            </div>
            <p className="progress-text">
              {bulkProgress.current} de {bulkProgress.total} funcionários processados
            </p>
          </div>
        )}

        {/* STATS */}
        <div className="stats-row">
          <div className="stat-card">
            <span className="stat-label">Total Funcionários</span>
            <span className="stat-value">{totalFuncionarios}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Total de Horas Extras</span>
            <span className="stat-value" style={{ color: 'var(--success)' }}>
              +{totalHorasExtras}h
            </span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Total de Horas Devendo</span>
            <span className="stat-value" style={{ color: 'var(--danger)' }}>
              -{totalHorasDevendo}h
            </span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Funcionários Zerados</span>
            <span className="stat-value" style={{ color: 'var(--text-muted)' }}>
              {totalZerados}
            </span>
          </div>
        </div>

        {/* TABLE E BUSCA */}
        <div className="card">
          {funcionarios.length === 0 ? (
            <div className="empty-state">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
              <p>Nenhum funcionário cadastrado ainda.</p>
              <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={openNewEmployee}>+ Cadastrar Primeiro</button>
            </div>
          ) : (
            <>
              {/* CAIXA DE BUSCA */}
              <div style={{ marginBottom: '1.25rem' }}>
                <input
                  type="text"
                  placeholder="🔍 Buscar funcionário pelo nome..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid #e2e8f0',
                    fontSize: '1rem',
                    outline: 'none'
                  }}
                />
              </div>

              <div className="table-wrapper">
                <table className="styled-table">
                  <thead>
                    <tr>
                      <th onClick={() => handleSort('nome')} style={{ cursor: 'pointer', userSelect: 'none' }} title="Clique para ordenar">
                        Nome {sortConfig.key === 'nome' ? (sortConfig.direction === 'asc' ? '🔼' : '🔽') : '↕️'}
                      </th>
                      <th onClick={() => handleSort('cargo')} style={{ cursor: 'pointer', userSelect: 'none' }} title="Clique para ordenar">
                        Cargo {sortConfig.key === 'cargo' ? (sortConfig.direction === 'asc' ? '🔼' : '🔽') : '↕️'}
                      </th>
                      <th>Telefone</th>
                      <th onClick={() => handleSort('saldo_atual')} style={{ cursor: 'pointer', userSelect: 'none' }} title="Clique para ordenar">
                        Saldo Atual {sortConfig.key === 'saldo_atual' ? (sortConfig.direction === 'asc' ? '🔼' : '🔽') : '↕️'}
                      </th>
                      <th>Status</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedAndFiltered.map(func => {
                      const saldo = parseFloat(func.saldo_atual);
                      return (
                        <tr key={func.id}>
                          <td style={{ fontWeight: 600 }}>{func.nome}</td>
                          <td style={{ color: 'var(--text-secondary)' }}>{func.cargo}</td>
                          <td style={{ color: 'var(--text-secondary)', fontFamily: 'monospace', fontSize: '0.8rem' }}>{func.telefone}</td>
                          <td>
                            <span className={`badge ${saldo > 0 ? 'badge-success' : saldo < 0 ? 'badge-danger' : 'badge-neutral'}`}>
                              {saldo > 0 ? '+' : ''}{saldo}h
                            </span>
                          </td>
                          <td>
                            <span className={`badge ${func.ativo ? 'badge-success' : 'badge-neutral'}`}>
                              {func.ativo ? 'Ativo' : 'Inativo'}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                              <button className="btn btn-secondary btn-sm" onClick={() => loadEmployeeDetail(func.id)} title="Ver detalhes">📋</button>
                              <button className="btn btn-secondary btn-sm" onClick={() => openAddMov(func)} title="Adicionar horas">⏱️</button>
                              <button className="btn btn-secondary btn-sm" onClick={() => openEditEmployee(func)} title="Editar">✏️</button>
                              <button className="btn btn-danger btn-sm" onClick={() => deleteEmployee(func)} title="Excluir">🗑️</button>
                              <button className="btn btn-whatsapp" onClick={() => sendWhatsApp(func.id)} title="Enviar WhatsApp" disabled={bulkSending}>📱</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* MENSAGEM QUANDO A BUSCA NÃO ENCONTRA NINGUÉM */}
                {sortedAndFiltered.length === 0 && searchTerm !== '' && (
                  <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    Nenhum funcionário encontrado com o nome "{searchTerm}".
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </main>

      {/* EMPLOYEE MODAL */}
      {showEmployeeModal && (
        <div className="modal-overlay">
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editingEmployee ? 'Editar Funcionário' : 'Novo Funcionário'}</h2>
              <button className="modal-close" onClick={() => setShowEmployeeModal(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group">
                  <label>Nome</label>
                  <input type="text" value={empForm.nome} onChange={e => setEmpForm({ ...empForm, nome: e.target.value })} placeholder="Nome completo" />
                </div>
                <div className="form-group">
                  <label>Telefone</label>
                  <input type="text" value={empForm.telefone} onChange={e => setEmpForm({ ...empForm, telefone: e.target.value })} placeholder="5516999999999" />
                </div>
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label>Cargo</label>
                  <input type="text" value={empForm.cargo} onChange={e => setEmpForm({ ...empForm, cargo: e.target.value })} placeholder="Ex: Vendedor" />
                </div>
                <div className="form-group">
                  <label>Data de Admissão</label>
                  <input type="date" value={empForm.data_admissao} onChange={e => setEmpForm({ ...empForm, data_admissao: e.target.value })} />
                </div>
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label>Saldo Inicial (horas)</label>
                  <input type="number" step="0.5" value={empForm.saldo_inicial} onChange={e => setEmpForm({ ...empForm, saldo_inicial: e.target.value })} placeholder="Ex: -14" />
                </div>
                {editingEmployee && (
                  <div className="form-group">
                    <label>Status</label>
                    <select value={empForm.ativo} onChange={e => setEmpForm({ ...empForm, ativo: e.target.value === 'true' })}>
                      <option value="true">Ativo</option>
                      <option value="false">Inativo</option>
                    </select>
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowEmployeeModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={saveEmployee}>
                {editingEmployee ? 'Salvar Alterações' : 'Cadastrar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MOVEMENT MODAL */}
      {showMovModal && (
        <div className="modal-overlay">
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                {editingMov ? 'Editar Movimentação' : `Nova Movimentação - ${movTarget?.nome}`}
              </h2>
              <button className="modal-close" onClick={() => setShowMovModal(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Tipo</label>
                <select value={movForm.tipo} onChange={e => setMovForm({ ...movForm, tipo: e.target.value })}>
                  <option value="extra_50">Extra 50%</option>
                  <option value="extra_100">Extra 100%</option>
                  <option value="domingo_menos_1">Domingo -1 (-4h)</option>
                  <option value="falta">Falta (débito manual)</option>
                </select>
              </div>

              {movForm.tipo !== 'domingo_menos_1' && (
                <div className="form-group">
                  <label>Horas</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    value={movForm.horas}
                    onChange={e => setMovForm({ ...movForm, horas: e.target.value })}
                    placeholder={movForm.tipo === 'falta' ? 'Horas a descontar' : 'Quantidade de horas'}
                  />
                </div>
              )}

              <div className="form-group">
                <label>Data</label>
                <input
                  type="date"
                  value={movForm.data_registro}
                  onChange={e => setMovForm({ ...movForm, data_registro: e.target.value })}
                />
              </div>

              {movForm.tipo === 'domingo_menos_1' && (
                <div style={{ background: 'var(--warning-bg)', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: 'var(--radius-sm)', padding: '0.75rem', fontSize: '0.85rem', color: 'var(--warning)' }}>
                  ⚠️ Domingo -1 sempre gera um débito de 4 horas automaticamente.
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowMovModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={saveMov}>
                {editingMov ? 'Salvar' : 'Registrar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DETAIL MODAL */}
      {showDetailModal && detailEmployee && (
        <div className="modal-overlay" onClick={() => setShowDetailModal(false)}>
          <div className="modal" style={{ maxWidth: 650 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">📋 {detailEmployee.nome}</h2>
              <button className="modal-close" onClick={() => setShowDetailModal(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
                <span className="badge badge-accent">📞 {detailEmployee.telefone}</span>
                <span className="badge badge-neutral">🏷️ {detailEmployee.cargo}</span>
                <span className={`badge ${detailEmployee.ativo ? 'badge-success' : 'badge-neutral'}`}>
                  {detailEmployee.ativo ? '✅ Ativo' : '⏸ Inativo'}
                </span>
                <span className={`badge ${parseFloat(detailEmployee.saldo_atual) < 0 ? 'badge-danger' : parseFloat(detailEmployee.saldo_atual) > 0 ? 'badge-success' : 'badge-neutral'}`}>
                  Saldo: {parseFloat(detailEmployee.saldo_atual)}h
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>Todas as Movimentações</h3>
                <button className="btn btn-primary btn-sm" onClick={() => {
                  setShowDetailModal(false);
                  openAddMov(detailEmployee, true);
                }}>+ Adicionar</button>
              </div>

              {detailMovs.length === 0 ? (
                <div className="empty-state" style={{ padding: '1.5rem' }}>
                  <p>Sem movimentações neste mês.</p>
                </div>
              ) : (
                <div className="table-wrapper">
                  <table className="styled-table">
                    <thead>
                      <tr>
                        <th>Data</th>
                        <th>Tipo</th>
                        <th>Horas</th>
                        <th>Ações</th>
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
                          <td>
                            <div style={{ display: 'flex', gap: '0.25rem' }}>
                              <button className="btn btn-secondary btn-sm" onClick={() => {
                                setShowDetailModal(false);
                                setMovTarget(detailEmployee);
                                openEditMov(mov);
                              }}>✏️</button>
                              <button className="btn btn-danger btn-sm" onClick={() => deleteMov(mov.id)}>🗑️</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}