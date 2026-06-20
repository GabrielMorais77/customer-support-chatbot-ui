import {
  ArrowLeft,
  Bell,
  Bot,
  CheckCircle2,
  Clock3,
  Download,
  FileText,
  LogOut,
  MessageCircleMore,
  RefreshCw,
  Search,
  Send,
  TicketCheck,
  TimerReset,
  UserRound,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import '../../chatbot_highfi_interactive.css';
import {
  adminDownloadAttachment,
  adminGetTicket,
  adminListTickets,
  adminLogin,
  adminLogout,
  adminSendMessage,
  adminUpdateStatus,
  hasAdminSession,
} from '../../services/api';

const STATUS_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'open', label: 'Aberto' },
  { value: 'waiting', label: 'Aguardando visitante' },
  { value: 'in_progress', label: 'Em atendimento' },
  { value: 'answered', label: 'Respondido' },
  { value: 'closed', label: 'Encerrado' },
];

const STATUS_LABELS = Object.fromEntries(STATUS_OPTIONS.filter((item) => item.value).map((item) => [item.value, item.label]));

function statusLabel(status) {
  return STATUS_LABELS[status] || status || 'Aberto';
}

function formatDateTime(value) {
  if (!value) {
    return 'Nao informado';
  }

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatBytes(value) {
  const size = Number(value);

  if (!Number.isFinite(size) || size <= 0) {
    return '0 KB';
  }

  if (size < 1024 * 1024) {
    return `${Math.max(1, Math.round(size / 1024))} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function toDate(value) {
  return value ? new Date(value) : null;
}

function diffHours(start, end = new Date()) {
  const startDate = toDate(start);
  const endDate = toDate(end);

  if (!startDate || Number.isNaN(startDate.getTime()) || !endDate || Number.isNaN(endDate.getTime())) {
    return 0;
  }

  return Math.max(0, (endDate.getTime() - startDate.getTime()) / 36e5);
}

function formatDuration(ticket) {
  const hours = diffHours(ticket?.created_at, ticket?.closed_at || new Date());

  if (hours < 1) {
    return 'menos de 1h';
  }

  if (hours < 24) {
    return `${Math.round(hours)}h`;
  }

  const days = Math.floor(hours / 24);
  const remainingHours = Math.round(hours % 24);
  return remainingHours ? `${days}d ${remainingHours}h` : `${days}d`;
}

function numberValue(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isAiResolved(ticket) {
  return ticket?.status === 'closed' && numberValue(ticket.agent_messages_count) === 0;
}

function isActiveTicket(ticket) {
  return ['open', 'waiting', 'in_progress', 'answered'].includes(ticket?.status);
}

export default function AdminDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(hasAdminSession);
  const [loginForm, setLoginForm] = useState({ email: 'admin@local.test', password: 'admin123' });
  const [filters, setFilters] = useState({ status: '', search: '' });
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [statusDraft, setStatusDraft] = useState('open');
  const [replyDraft, setReplyDraft] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const metrics = useMemo(() => {
    const closedTickets = tickets.filter((ticket) => ticket.status === 'closed');
    const closedHours = closedTickets.map((ticket) => diffHours(ticket.created_at, ticket.closed_at || ticket.updated_at));
    const averageHours = closedHours.length
      ? closedHours.reduce((total, value) => total + value, 0) / closedHours.length
      : 0;

    return {
      total: tickets.length,
      active: tickets.filter(isActiveTicket).length,
      urgent: tickets.filter((ticket) => ticket.priority === 'urgent').length,
      attachments: tickets.reduce((total, ticket) => total + numberValue(ticket.attachments_count), 0),
      aiResolved: tickets.filter(isAiResolved).length,
      chatResolved: closedTickets.length,
      averageDuration: averageHours ? `${Math.max(1, Math.round(averageHours))}h` : '0h',
    };
  }, [tickets]);

  const notifications = useMemo(() => {
    const urgent = tickets.filter((ticket) => ticket.priority === 'urgent' && ticket.status !== 'closed');
    const withAttachments = tickets.filter((ticket) => numberValue(ticket.attachments_count) > 0 && ticket.status !== 'closed');
    const waiting = tickets.filter((ticket) => ['open', 'in_progress'].includes(ticket.status));

    return [
      ...urgent.slice(0, 3).map((ticket) => ({
        id: `urgent-${ticket.id}`,
        title: 'Prazo ou prioridade alta',
        text: `${ticket.protocol} precisa de revisao humana.`,
      })),
      ...withAttachments.slice(0, 3).map((ticket) => ({
        id: `attachment-${ticket.id}`,
        title: 'Documento recebido',
        text: `${ticket.protocol} tem ${ticket.attachments_count} anexo(s) para analise.`,
      })),
      ...waiting.slice(0, 3).map((ticket) => ({
        id: `waiting-${ticket.id}`,
        title: 'Atendimento pendente',
        text: `${ticket.protocol} esta ${statusLabel(ticket.status).toLowerCase()}.`,
      })),
    ].slice(0, 5);
  }, [tickets]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    loadTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      loadTickets(filters, { silent: true });
    }, 30000);

    return () => window.clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, filters.status, filters.search]);

  async function loadTickets(nextFilters = filters, options = {}) {
    if (!options.silent) {
      setIsLoading(true);
    }

    setError('');

    try {
      const payload = await adminListTickets(nextFilters);
      setTickets(payload.tickets || []);
    } catch (caughtError) {
      setError(caughtError.message);

      if (caughtError.status === 401) {
        setIsAuthenticated(false);
      }
    } finally {
      if (!options.silent) {
        setIsLoading(false);
      }
    }
  }

  async function refreshSelectedTicket(ticketId = selectedTicket?.id) {
    if (!ticketId) {
      return;
    }

    const payload = await adminGetTicket(ticketId);
    setSelectedTicket(payload.ticket);
    setStatusDraft(payload.ticket.status);
  }

  async function handleLogin(event) {
    event.preventDefault();
    setIsLoading(true);
    setError('');
    setNotice('');

    try {
      await adminLogin(loginForm.email, loginForm.password);
      setIsAuthenticated(true);
      setNotice('Login realizado.');
    } catch (caughtError) {
      setError(caughtError.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleLogout() {
    setIsLoading(true);

    try {
      await adminLogout();
    } finally {
      setIsAuthenticated(false);
      setSelectedTicket(null);
      setTickets([]);
      setIsLoading(false);
    }
  }

  async function handleFilterSubmit(event) {
    event.preventDefault();
    await loadTickets(filters);
  }

  async function handleOpenTicket(ticketId) {
    setIsLoading(true);
    setError('');
    setNotice('');

    try {
      await refreshSelectedTicket(ticketId);
    } catch (caughtError) {
      setError(caughtError.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleStatusUpdate() {
    if (!selectedTicket) {
      return;
    }

    await updateSelectedStatus(statusDraft);
  }

  async function updateSelectedStatus(nextStatus) {
    if (!selectedTicket) {
      return;
    }

    setIsLoading(true);
    setError('');
    setNotice('');

    try {
      await adminUpdateStatus(selectedTicket.id, nextStatus);
      setStatusDraft(nextStatus);
      await refreshSelectedTicket(selectedTicket.id);
      await loadTickets();
      setNotice('Status atualizado.');
    } catch (caughtError) {
      setError(caughtError.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleReplySubmit(event) {
    event.preventDefault();

    if (!selectedTicket || !replyDraft.trim()) {
      return;
    }

    setIsLoading(true);
    setError('');
    setNotice('');

    try {
      await adminSendMessage(selectedTicket.id, replyDraft.trim());
      setReplyDraft('');
      await refreshSelectedTicket(selectedTicket.id);
      await loadTickets();
      setNotice('Resposta enviada ao chamado.');
    } catch (caughtError) {
      setError(caughtError.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDownloadAttachment(attachment) {
    setError('');

    try {
      await adminDownloadAttachment(attachment);
    } catch (caughtError) {
      setError(caughtError.message);
    }
  }

  function renderMessages() {
    return (
      <>
        {error ? <div className="info-bubble info-bubble-error">{error}</div> : null}
        {notice ? <div className="info-bubble info-bubble-success">{notice}</div> : null}
      </>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flow-app admin-app">
        <header className="flow-hero admin-hero">
          <div>
            <h1>Painel de Atendimento.</h1>
          </div>
          <div className="hero-status-stack">
            <article>
              <span>Acesso</span>
              <strong>Admin local</strong>
            </article>
          </div>
        </header>

        <main className="admin-login-shell">
          <form className="mini-login-card admin-login-card" onSubmit={handleLogin}>
            {renderMessages()}
            <label>
              <span>E-mail</span>
              <input
                type="email"
                value={loginForm.email}
                onChange={(event) => setLoginForm((current) => ({ ...current, email: event.target.value }))}
              />
            </label>
            <label>
              <span>Senha</span>
              <input
                type="password"
                value={loginForm.password}
                onChange={(event) => setLoginForm((current) => ({ ...current, password: event.target.value }))}
              />
            </label>
            <button className="phone-primary-button" disabled={isLoading}>
              {isLoading ? 'Entrando...' : 'Entrar'}
            </button>
            <button type="button" className="phone-outline-button" onClick={() => { window.location.href = '/'; }}>
              <ArrowLeft size={14} />
              Voltar ao atendimento
            </button>
          </form>
        </main>
      </div>
    );
  }

  return (
    <div className="flow-app admin-app">
      <header className="admin-ops-header">
        <div className="admin-title-block">
          <p className="panel-kicker">Central humana</p>
          <h1>Painel de Atendimento</h1>
          <p>Fila de triagem, documentos, conversa com o visitante e indicadores do assistente 24/7.</p>
        </div>
        <div className="admin-toolbar-actions admin-header-actions">
          <button className="phone-secondary-button" onClick={() => loadTickets()} disabled={isLoading}>
            <RefreshCw size={15} />
            Atualizar
          </button>
          <button className="phone-outline-button" onClick={handleLogout} disabled={isLoading}>
            <LogOut size={15} />
            Sair
          </button>
        </div>
      </header>

      <section className="admin-kpi-grid">
        <article className="admin-kpi-card">
          <TicketCheck size={20} />
          <span>Chamados</span>
          <strong>{metrics.total}</strong>
          <small>{metrics.active} ativos na fila</small>
        </article>
        <article className="admin-kpi-card">
          <Bot size={20} />
          <span>IA sozinha</span>
          <strong>{metrics.aiResolved}</strong>
          <small>sem resposta humana</small>
        </article>
        <article className="admin-kpi-card">
          <CheckCircle2 size={20} />
          <span>Resolvidos</span>
          <strong>{metrics.chatResolved}</strong>
          <small>encerrados no chat</small>
        </article>
        <article className="admin-kpi-card">
          <Clock3 size={20} />
          <span>Duracao media</span>
          <strong>{metrics.averageDuration}</strong>
          <small>chamados encerrados</small>
        </article>
        <article className="admin-kpi-card">
          <FileText size={20} />
          <span>Anexos</span>
          <strong>{metrics.attachments}</strong>
          <small>{metrics.urgent} prioridade alta</small>
        </article>
      </section>

      <main className="admin-shell admin-ops-shell">
        <section className="admin-panel admin-queue-panel">
          <div className="admin-panel-heading">
            <div>
              <p className="panel-kicker">Notificacoes</p>
              <h2>Fila operacional</h2>
            </div>
            <span className="admin-live-pill">
              <Bell size={14} />
              {notifications.length}
            </span>
          </div>

          <div className="admin-notification-list">
            {notifications.map((item) => (
              <button key={item.id} className="admin-notification-card" type="button">
                <Bell size={14} />
                <span>
                  <strong>{item.title}</strong>
                  <small>{item.text}</small>
                </span>
              </button>
            ))}
            {!notifications.length ? (
              <div className="admin-notification-empty">Sem alertas relevantes agora.</div>
            ) : null}
          </div>

          <div className="admin-toolbar">
            <form className="admin-filter-form" onSubmit={handleFilterSubmit}>
              <label>
                <span>Status</span>
                <select
                  value={filters.status}
                  onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value || 'all'} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Busca</span>
                <input
                  type="text"
                  value={filters.search}
                  placeholder="Protocolo, nome, e-mail ou assunto"
                  onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
                />
              </label>
              <button className="phone-primary-button" disabled={isLoading}>
                <Search size={15} />
                Filtrar
              </button>
            </form>
          </div>

          {renderMessages()}

          <div className="admin-ticket-list">
            {tickets.map((ticket) => (
              <button
                key={ticket.id}
                className={`admin-ticket-row ${selectedTicket?.id === ticket.id ? 'is-active' : ''}`}
                onClick={() => handleOpenTicket(ticket.id)}
              >
                <div className="admin-ticket-row-head">
                  <span className={`ticket-status ${ticket.priority}`}>{statusLabel(ticket.status)}</span>
                  {isAiResolved(ticket) ? <span className="admin-ai-badge">IA resolveu</span> : null}
                </div>
                <strong>{ticket.protocol}</strong>
                <span>{ticket.subject}</span>
                <div className="admin-ticket-meta">
                  <small>{ticket.name}</small>
                  <small>
                    <TimerReset size={13} />
                    {formatDuration(ticket)}
                  </small>
                  {ticket.attachments_count ? (
                    <small>
                      <FileText size={13} />
                      {ticket.attachments_count} anexo(s)
                    </small>
                  ) : null}
                </div>
              </button>
            ))}
            {!tickets.length ? <div className="info-bubble">Nenhum chamado encontrado.</div> : null}
          </div>
        </section>

        <section className="admin-panel admin-detail-panel admin-chat-panel">
          {selectedTicket ? (
            <>
              <div className="admin-chat-head">
                <div>
                  <p className="panel-kicker">Atendimento ativo</p>
                  <h2>{selectedTicket.protocol}</h2>
                  <span>{selectedTicket.subject}</span>
                </div>
                <span className={`ticket-status ${selectedTicket.priority}`}>{statusLabel(selectedTicket.status)}</span>
              </div>

              <div className="admin-detail-grid">
                <div>
                  <UserRound size={16} />
                  <span>Candidato</span>
                  <strong>{selectedTicket.name}</strong>
                </div>
                <div>
                  <Clock3 size={16} />
                  <span>Duracao</span>
                  <strong>{formatDuration(selectedTicket)}</strong>
                </div>
                <div>
                  <FileText size={16} />
                  <span>Anexos</span>
                  <strong>{selectedTicket.attachments?.length || 0}</strong>
                </div>
                <div>
                  <Bot size={16} />
                  <span>Atendimento IA</span>
                  <strong>{isAiResolved(selectedTicket) ? 'Resolvido' : 'Triagem'}</strong>
                </div>
              </div>

              <div className="admin-quick-actions">
                <button type="button" onClick={() => updateSelectedStatus('in_progress')} disabled={isLoading}>
                  Assumir
                </button>
                <button type="button" onClick={() => updateSelectedStatus('waiting')} disabled={isLoading}>
                  Aguardar visitante
                </button>
                <button type="button" onClick={() => updateSelectedStatus('answered')} disabled={isLoading}>
                  Marcar respondido
                </button>
                <button type="button" onClick={() => updateSelectedStatus('closed')} disabled={isLoading}>
                  Encerrar
                </button>
              </div>

              <div className="details-card admin-description-card">
                <strong>{selectedTicket.area}</strong>
                <span>{selectedTicket.email}</span>
                <p>{selectedTicket.description}</p>
              </div>

              {selectedTicket.feedback ? (
                <div className="details-card admin-feedback-card">
                  <strong>Avaliacao do atendimento</strong>
                  <span>{selectedTicket.feedback.stars || selectedTicket.feedback.rating}/5 estrelas</span>
                  <p>{selectedTicket.feedback.comment || 'Sem comentario adicional.'}</p>
                </div>
              ) : null}

              <div className="detail-list admin-contact-list">
                <div>
                  <span>E-mail do visitante</span>
                  <strong>{selectedTicket.email}</strong>
                </div>
                <div>
                  <span>Criado em</span>
                  <strong>{formatDateTime(selectedTicket.created_at)}</strong>
                </div>
              </div>

              {selectedTicket.attachments?.length ? (
                <div className="details-card">
                  <strong>Documentos para analise</strong>
                  <div className="attachment-list">
                    {selectedTicket.attachments.map((attachment) => (
                      <button
                        key={attachment.id}
                        type="button"
                        className="attachment-chip attachment-chip-button"
                        onClick={() => handleDownloadAttachment(attachment)}
                      >
                        <FileText size={14} />
                        <span>{attachment.original_name}</span>
                        <small>{formatBytes(attachment.size)}</small>
                        <Download size={14} />
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="admin-status-row">
                <label>
                  <span>Status</span>
                  <select value={statusDraft} onChange={(event) => setStatusDraft(event.target.value)}>
                    {STATUS_OPTIONS.filter((option) => option.value).map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <button className="phone-secondary-button" onClick={handleStatusUpdate} disabled={isLoading}>
                  Salvar status
                </button>
              </div>

              <div className="admin-chat-box">
                <div className="admin-chat-title">
                  <MessageCircleMore size={17} />
                  <div>
                    <strong>Chat do atendimento</strong>
                    <span>{(selectedTicket.messages || []).length} mensagem(ns)</span>
                  </div>
                </div>

                <div className="admin-message-list admin-chat-messages">
                  {(selectedTicket.messages || []).map((message) => (
                    <div
                      key={message.id}
                      className={`admin-chat-bubble is-${message.sender_type}`}
                    >
                      <div className="admin-chat-avatar">
                        {message.sender_type === 'agent' ? <TicketCheck size={14} /> : null}
                        {message.sender_type === 'visitor' ? <UserRound size={14} /> : null}
                        {message.sender_type === 'system' ? <Bot size={14} /> : null}
                      </div>
                      <div>
                        <strong>{message.sender_name || message.sender_type}</strong>
                        <p>{message.message}</p>
                        <small>{formatDateTime(message.created_at)}</small>
                      </div>
                    </div>
                  ))}
                  {!(selectedTicket.messages || []).length ? (
                    <div className="info-bubble">Nenhuma mensagem registrada ainda.</div>
                  ) : null}
                </div>

                <form className="admin-reply-form admin-chat-composer" onSubmit={handleReplySubmit}>
                  <textarea
                    rows="4"
                    value={replyDraft}
                    placeholder="Responder ao visitante..."
                    onChange={(event) => setReplyDraft(event.target.value)}
                  />
                  <button className="phone-primary-button" disabled={isLoading || !replyDraft.trim()}>
                    <Send size={15} />
                    Enviar resposta
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="admin-empty-state">
              <TicketCheck size={28} />
              <strong>Selecione um chamado</strong>
              <span>Abra um protocolo da fila para conversar, revisar anexos e atualizar o status.</span>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
