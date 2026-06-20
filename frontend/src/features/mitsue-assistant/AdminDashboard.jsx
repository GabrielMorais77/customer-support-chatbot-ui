import {
  ArrowLeft,
  Download,
  FileText,
  LogOut,
  RefreshCw,
  Search,
  Send,
  TicketCheck,
} from 'lucide-react';
import { useEffect, useState } from 'react';
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

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    loadTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  async function loadTickets(nextFilters = filters) {
    setIsLoading(true);
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
      setIsLoading(false);
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

    setIsLoading(true);
    setError('');
    setNotice('');

    try {
      await adminUpdateStatus(selectedTicket.id, statusDraft);
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
      <header className="flow-hero admin-hero">
        <div>
          <h1>Painel de Atendimento.</h1>
        </div>
        <div className="hero-status-stack">
          <article>
            <span>Chamados</span>
            <strong>{tickets.length}</strong>
          </article>
          <article>
            <span>Selecionado</span>
            <strong>{selectedTicket?.protocol || 'Nenhum'}</strong>
          </article>
        </div>
      </header>

      <main className="admin-shell">
        <section className="admin-panel">
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
            <div className="admin-toolbar-actions">
              <button className="phone-secondary-button" onClick={() => loadTickets()} disabled={isLoading}>
                <RefreshCw size={15} />
                Atualizar
              </button>
              <button className="phone-outline-button" onClick={handleLogout} disabled={isLoading}>
                <LogOut size={15} />
                Sair
              </button>
            </div>
          </div>

          {renderMessages()}

          <div className="admin-ticket-list">
            {tickets.map((ticket) => (
              <button
                key={ticket.id}
                className={`admin-ticket-row ${selectedTicket?.id === ticket.id ? 'is-active' : ''}`}
                onClick={() => handleOpenTicket(ticket.id)}
              >
                <span className={`ticket-status ${ticket.priority}`}>{statusLabel(ticket.status)}</span>
                <strong>{ticket.protocol}</strong>
                <span>{ticket.subject}</span>
                <small>
                  {ticket.name} - {formatDateTime(ticket.created_at)}
                  {ticket.attachments_count ? ` - ${ticket.attachments_count} anexo(s)` : ''}
                </small>
              </button>
            ))}
            {!tickets.length ? <div className="info-bubble">Nenhum chamado encontrado.</div> : null}
          </div>
        </section>

        <section className="admin-panel admin-detail-panel">
          {selectedTicket ? (
            <>
              <div className="admin-detail-head">
                <div>
                  <p className="panel-kicker">Detalhe do chamado</p>
                  <h2>{selectedTicket.protocol}</h2>
                </div>
                <TicketCheck size={24} />
              </div>

              <div className="details-card">
                <strong>{selectedTicket.subject}</strong>
                <span>{selectedTicket.area}</span>
                <p>{selectedTicket.description}</p>
              </div>

              <div className="detail-list">
                <div>
                  <span>Solicitante</span>
                  <strong>{selectedTicket.name}</strong>
                </div>
                <div>
                  <span>E-mail</span>
                  <strong>{selectedTicket.email}</strong>
                </div>
                <div>
                  <span>Status</span>
                  <strong>{statusLabel(selectedTicket.status)}</strong>
                </div>
                <div>
                  <span>Anexos</span>
                  <strong>{selectedTicket.attachments?.length || 0}</strong>
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

              <div className="admin-message-list">
                {(selectedTicket.messages || []).map((message) => (
                  <div
                    key={message.id}
                    className={`queue-message ${message.sender_type === 'visitor' ? 'user' : ''}`}
                  >
                    <strong>{message.sender_name || message.sender_type}</strong>
                    <p>{message.message}</p>
                    <small>{formatDateTime(message.created_at)}</small>
                  </div>
                ))}
              </div>

              <form className="admin-reply-form" onSubmit={handleReplySubmit}>
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
            </>
          ) : (
            <div className="admin-empty-state">
              <TicketCheck size={28} />
              <strong>Selecione um chamado</strong>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
