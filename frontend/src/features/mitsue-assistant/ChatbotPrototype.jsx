import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Bot,
  CalendarDays,
  ChevronRight,
  Clock3,
  Ellipsis,
  FileText,
  MessageCircleMore,
  Paperclip,
  Search,
  Send,
  Star,
  Ticket,
  UserRound,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import '../../chatbot_highfi_interactive.css';
import {
  createTicket,
  lookupTicket,
  sendTicketFeedback,
  sendTicketMessage,
} from '../../services/api';
import { AREA_CONFIG, EMPTY_INTAKE } from './config';
import ChatField from './components/ChatField';
import MessageBubble from './components/MessageBubble';
import {
  clearDraft,
  loadDraft,
  loadLastLookup,
  saveDraft,
  saveLastLookup,
} from './storage';
import {
  canReadFilePreview,
  formatFileSize,
  formatShortDate,
  inferDocumentType,
  makeId,
} from './utils';

const FLOW_STEPS = [
  { id: 'landing', title: 'Abertura' },
  { id: 'assistant', title: 'Novo chamado' },
  { id: 'tickets', title: 'Meus chamados' },
  { id: 'queue', title: 'Mensagens' },
  { id: 'details', title: 'Detalhes' },
  { id: 'rating', title: 'Avaliacao' },
  { id: 'comment', title: 'Comentario' },
];

const SCREEN_BACK_MAP = {
  assistant: 'landing',
  tickets: 'assistant',
  queue: 'details',
  details: 'tickets',
  rating: 'details',
  comment: 'details',
};

const PUBLIC_EMPTY_INTAKE = {
  ...EMPTY_INTAKE,
  subject: '',
};

const STATUS_LABELS = {
  open: 'Aberto',
  waiting: 'Aguardando visitante',
  in_progress: 'Em atendimento',
  answered: 'Respondido',
  closed: 'Encerrado',
};

function createWelcomeMessages() {
  const createdAt = new Date().toISOString();

  return [
    {
      id: 'welcome-1',
      role: 'assistant',
      type: 'text',
      title: 'Assistente virtual',
      text: 'O atendimento digital registra chamados reais, gera protocolo e organiza as mensagens para resposta humana.',
      createdAt,
    },
    {
      id: 'welcome-2',
      role: 'assistant',
      type: 'text',
      title: 'Como posso ajudar?',
      text: 'Escolha uma area, preencha os dados do solicitante e descreva o problema para abrir o chamado.',
      createdAt,
    },
  ];
}

function getInitialDraftState() {
  const draft = loadDraft();
  const lastLookup = loadLastLookup();

  return {
    screen: draft?.screen || 'landing',
    selectedArea: draft?.selectedArea || 'periciaJudicial',
    intake: { ...PUBLIC_EMPTY_INTAKE, ...(draft?.intake || {}) },
    uploadedFiles: Array.isArray(draft?.uploadedFiles) ? draft.uploadedFiles : [],
    messages: Array.isArray(draft?.messages) && draft.messages.length ? draft.messages : createWelcomeMessages(),
    lookupForm: { protocol: '', email: '', ...lastLookup, ...(draft?.lookupForm || {}) },
    ratingForm: draft?.ratingForm || { stars: 5, rating: 5, comment: '' },
    commentDraft: draft?.commentDraft || '',
  };
}

function getStatusLabel(status) {
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

function formatEstimatedReturn(ticket) {
  if (!ticket?.estimated_response_at) {
    return 'ate 12 horas uteis';
  }

  return formatDateTime(ticket.estimated_response_at);
}

function ticketToRecord(ticket) {
  if (!ticket) {
    return null;
  }

  return {
    id: ticket.id || ticket.protocol,
    protocol: ticket.protocol,
    areaLabel: ticket.area,
    clientName: ticket.name,
    organization: ticket.email,
    status: getStatusLabel(ticket.status),
    priority: ticket.priority || 'normal',
    expectedReturn: formatEstimatedReturn(ticket),
    createdAt: ticket.created_at,
    documents: [],
    assessment: {
      summary: ticket.subject || ticket.description || 'Chamado registrado no atendimento digital.',
    },
  };
}

function buildDescription(intake, selectedConfig, uploadedFiles) {
  const detailLines = selectedConfig.fields
    .map((field) => {
      const value = intake[field.name];
      return value ? `${field.label}: ${value}` : '';
    })
    .filter(Boolean);

  const fileLines = uploadedFiles.map((file) => `Arquivo informado: ${file.name} (${file.inferredType})`);

  return [
    intake.objective,
    intake.urgencyNote ? `Urgencia/prazo: ${intake.urgencyNote}` : '',
    detailLines.length ? detailLines.join('\n') : '',
    fileLines.length ? fileLines.join('\n') : '',
  ]
    .filter(Boolean)
    .join('\n\n');
}

function TicketCard({ record, onOpenDetails, onOpenQueue }) {
  return (
    <article className="ticket-card">
      <div className="ticket-card-head">
        <strong>{record.protocol}</strong>
        <span className={`ticket-status ${record.priority}`}>{record.status}</span>
      </div>
      <p>{record.assessment?.summary || record.areaLabel}</p>
      <span>
        {record.clientName}
        {record.organization ? ` - ${record.organization}` : ''}
      </span>
      <div className="ticket-card-actions">
        <button onClick={() => onOpenDetails(record.id)}>Ver detalhes</button>
        <button onClick={() => onOpenQueue(record.id)}>Mensagens</button>
      </div>
    </article>
  );
}

function PhoneHeader({ title, subtitle, showBack, onBack }) {
  return (
    <header className="phone-header">
      <div className="phone-header-left">
        {showBack ? (
          <button className="phone-icon-button" onClick={onBack} aria-label="Voltar">
            <ArrowLeft size={16} />
          </button>
        ) : (
          <div className="phone-avatar">
            <Bot size={14} />
          </div>
        )}
        <div>
          <strong>{title}</strong>
          {subtitle ? <span>{subtitle}</span> : null}
        </div>
      </div>
      <button className="phone-icon-button" aria-label="Mais opcoes">
        <Ellipsis size={16} />
      </button>
    </header>
  );
}

export default function ChatbotPrototype() {
  const [initialDraft] = useState(getInitialDraftState);
  const transcriptEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const [screen, setScreen] = useState(initialDraft.screen);
  const [selectedArea, setSelectedArea] = useState(initialDraft.selectedArea);
  const [intake, setIntake] = useState(initialDraft.intake);
  const [uploadedFiles, setUploadedFiles] = useState(initialDraft.uploadedFiles);
  const [messages, setMessages] = useState(initialDraft.messages);
  const [lookupForm, setLookupForm] = useState(initialDraft.lookupForm);
  const [activeTicket, setActiveTicket] = useState(null);
  const [chatInput, setChatInput] = useState('');
  const [ratingForm, setRatingForm] = useState(initialDraft.ratingForm);
  const [commentDraft, setCommentDraft] = useState(initialDraft.commentDraft);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const selectedConfig = AREA_CONFIG[selectedArea];
  const activeRecord = ticketToRecord(activeTicket);
  const currentStep = FLOW_STEPS.find((item) => item.id === screen) || FLOW_STEPS[0];
  const currentStepIndex = FLOW_STEPS.findIndex((item) => item.id === currentStep.id);
  const compactFields = [intake.clientName, intake.email || intake.phone, intake.subject, intake.objective]
    .filter(Boolean)
    .length;
  const compactAreaFields = useMemo(() => selectedConfig.fields.slice(0, 2), [selectedConfig]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, screen]);

  useEffect(() => {
    saveDraft({
      screen,
      selectedArea,
      intake,
      uploadedFiles,
      messages,
      lookupForm,
      ratingForm,
      commentDraft,
    });
    saveLastLookup(lookupForm);
  }, [commentDraft, intake, lookupForm, messages, ratingForm, screen, selectedArea, uploadedFiles]);

  useEffect(() => {
    if (!initialDraft.lookupForm.protocol || !initialDraft.lookupForm.email) {
      return;
    }

    lookupTicket(initialDraft.lookupForm.protocol, initialDraft.lookupForm.email)
      .then((payload) => setActiveTicket(payload.ticket))
      .catch(() => {
        setActiveTicket(null);
      });
  }, [initialDraft.lookupForm.email, initialDraft.lookupForm.protocol]);

  function appendMessage(message) {
    setMessages((current) => [
      ...current,
      {
        id: makeId('msg'),
        createdAt: new Date().toISOString(),
        ...message,
      },
    ]);
  }

  function goToScreen(targetScreen) {
    setError('');
    setNotice('');
    setScreen(targetScreen);
  }

  function goToAdjacentStep(direction) {
    const nextIndex = currentStepIndex + direction;

    if (nextIndex < 0 || nextIndex >= FLOW_STEPS.length) {
      return;
    }

    goToScreen(FLOW_STEPS[nextIndex].id);
  }

  function handleBack() {
    const previous = SCREEN_BACK_MAP[screen];

    if (previous) {
      goToScreen(previous);
    }
  }

  function handleFieldChange(name, value) {
    setIntake((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function updateLookupField(name, value) {
    setLookupForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function handleAreaSelection(areaKey) {
    setSelectedArea(areaKey);
    appendMessage({
      role: 'user',
      type: 'text',
      text: AREA_CONFIG[areaKey].label,
    });
    appendMessage({
      role: 'assistant',
      type: 'text',
      title: 'Area selecionada',
      text: AREA_CONFIG[areaKey].intro,
    });
  }

  async function handleFileUpload(event) {
    const files = Array.from(event.target.files || []);

    if (!files.length) {
      return;
    }

    const preparedFiles = await Promise.all(
      files.map(async (file) => {
        let preview = '';

        if (canReadFilePreview(file)) {
          preview = (await file.text()).slice(0, 600);
        }

        return {
          id: makeId('file'),
          name: file.name,
          sizeLabel: formatFileSize(file.size),
          inferredType: inferDocumentType(file.name),
          preview,
          uploadedAt: new Date().toISOString(),
        };
      }),
    );

    setUploadedFiles((current) => [...current, ...preparedFiles]);
    setNotice(`${preparedFiles.length} arquivo(s) adicionados ao rascunho local.`);
    event.target.value = '';
  }

  function validateTicketPayload(payload) {
    if (!payload.name || !payload.email || !payload.subject || !payload.description) {
      return 'Preencha nome, e-mail, assunto e descricao para abrir o chamado.';
    }

    return '';
  }

  async function handleCreateTicket() {
    const payload = {
      name: intake.clientName.trim(),
      email: intake.email.trim(),
      phone: intake.phone.trim(),
      area: selectedConfig.label,
      subject: intake.subject.trim(),
      description: buildDescription(intake, selectedConfig, uploadedFiles).trim(),
    };

    const validationError = validateTicketPayload(payload);

    if (validationError) {
      setError(validationError);
      return;
    }

    setIsLoading(true);
    setError('');
    setNotice('');

    try {
      const created = await createTicket(payload);
      const lookup = { protocol: created.ticket.protocol, email: payload.email };
      const refreshed = await lookupTicket(lookup.protocol, lookup.email);

      setLookupForm(lookup);
      setActiveTicket(refreshed.ticket);
      appendMessage({
        role: 'assistant',
        type: 'protocol',
        record: ticketToRecord(refreshed.ticket),
      });
      setNotice(`Chamado ${lookup.protocol} aberto com sucesso.`);
      setScreen('details');
    } catch (caughtError) {
      setError(caughtError.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleLookupSubmit(event) {
    event?.preventDefault();

    if (!lookupForm.protocol.trim() || !lookupForm.email.trim()) {
      setError('Informe protocolo e e-mail para consultar o chamado.');
      return;
    }

    setIsLoading(true);
    setError('');
    setNotice('');

    try {
      const payload = await lookupTicket(lookupForm.protocol.trim(), lookupForm.email.trim());
      setActiveTicket(payload.ticket);
      setLookupForm({ protocol: payload.ticket.protocol, email: payload.ticket.email });
      setNotice(`Chamado ${payload.ticket.protocol} carregado.`);
      setScreen('details');
    } catch (caughtError) {
      setActiveTicket(null);
      setError(caughtError.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function refreshActiveTicket(ticket = activeTicket) {
    if (!ticket?.protocol || !ticket?.email) {
      return null;
    }

    const payload = await lookupTicket(ticket.protocol, ticket.email);
    setActiveTicket(payload.ticket);
    return payload.ticket;
  }

  async function handleQueueMessage() {
    const trimmed = chatInput.trim();

    if (!trimmed || !activeTicket) {
      return;
    }

    setIsLoading(true);
    setError('');
    setNotice('');

    try {
      await sendTicketMessage(activeTicket.protocol, activeTicket.email, trimmed);
      setChatInput('');
      await refreshActiveTicket();
      setNotice('Mensagem enviada no chamado.');
    } catch (caughtError) {
      setError(caughtError.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCommentSubmit() {
    const trimmed = commentDraft.trim();

    if (!trimmed || !activeTicket) {
      return;
    }

    setIsLoading(true);
    setError('');
    setNotice('');

    try {
      await sendTicketMessage(activeTicket.protocol, activeTicket.email, trimmed);
      setCommentDraft('');
      await refreshActiveTicket();
      setNotice('Comentario registrado no chamado.');
      setScreen('details');
    } catch (caughtError) {
      setError(caughtError.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleFeedbackSubmit() {
    if (!activeTicket) {
      return;
    }

    setIsLoading(true);
    setError('');
    setNotice('');

    try {
      await sendTicketFeedback(activeTicket.protocol, activeTicket.email, {
        rating: ratingForm.rating,
        stars: ratingForm.stars,
        comment: ratingForm.comment,
      });
      await refreshActiveTicket();
      setNotice('Avaliacao registrada. O chamado foi encerrado.');
      setScreen('details');
    } catch (caughtError) {
      setError(caughtError.message);
    } finally {
      setIsLoading(false);
    }
  }

  function handleChatSubmit() {
    const trimmed = chatInput.trim();

    if (!trimmed) {
      return;
    }

    appendMessage({
      role: 'user',
      type: 'text',
      text: trimmed,
    });
    setChatInput('');

    appendMessage({
      role: 'assistant',
      type: 'text',
      title: 'Registro do atendimento',
      text: 'Inclua esse contexto na descricao do chamado para que o atendente receba tudo em um unico protocolo.',
    });
  }

  function handleResetPrototype() {
    setScreen('landing');
    setSelectedArea('periciaJudicial');
    setIntake(PUBLIC_EMPTY_INTAKE);
    setUploadedFiles([]);
    setMessages(createWelcomeMessages());
    setLookupForm({ protocol: '', email: '' });
    setActiveTicket(null);
    setChatInput('');
    setRatingForm({ stars: 5, rating: 5, comment: '' });
    setCommentDraft('');
    setError('');
    setNotice('');
    clearDraft();
    saveLastLookup({ protocol: '', email: '' });
  }

  function renderFeedbackMessages() {
    return (
      <>
        {error ? <div className="info-bubble info-bubble-error">{error}</div> : null}
        {notice ? <div className="info-bubble info-bubble-success">{notice}</div> : null}
      </>
    );
  }

  function renderLookupForm() {
    return (
      <form className="mini-login-card" onSubmit={handleLookupSubmit}>
        <label>
          <span>Protocolo</span>
          <input
            type="text"
            value={lookupForm.protocol}
            placeholder="MIT-2026-000001"
            onChange={(event) => updateLookupField('protocol', event.target.value)}
          />
        </label>
        <label>
          <span>E-mail</span>
          <input
            type="email"
            value={lookupForm.email}
            placeholder="email@exemplo.com"
            onChange={(event) => updateLookupField('email', event.target.value)}
          />
        </label>
        <button className="phone-primary-button" disabled={isLoading}>
          {isLoading ? 'Consultando...' : 'Consultar chamado'}
        </button>
      </form>
    );
  }

  function renderLandingScreen() {
    return (
      <div className="screen-home">
        <div className="screen-sitebar">
          <span>Mitsue Borges</span>
          <button onClick={() => goToScreen('tickets')}>Protocolos</button>
        </div>
        <div className="screen-home-center">
          <h2>Atendimento 24/7</h2>
          <p>Abra e acompanhe chamados com protocolo real.</p>
          <button className="phone-primary-button" onClick={() => goToScreen('assistant')}>
            Iniciar atendimento
          </button>
        </div>
        <button className="chat-fab" onClick={() => goToScreen('assistant')} aria-label="Abrir atendimento">
          <span className="chat-fab-badge">Online</span>
          <MessageCircleMore size={20} />
        </button>
      </div>
    );
  }

  function renderAssistantScreen() {
    return (
      <>
        <PhoneHeader title="Novo chamado" subtitle="API conectada" showBack onBack={handleBack} />
        <div className="phone-body">
          {renderFeedbackMessages()}
          <div className="phone-thread">
            {messages.slice(-4).map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                onProtocolClick={() => activeTicket && goToScreen('details')}
              />
            ))}
            <div ref={transcriptEndRef} />
          </div>

          <div className="area-chip-grid">
            {Object.entries(AREA_CONFIG).map(([key, area]) => (
              <button
                key={key}
                className={`area-chip ${selectedArea === key ? 'is-active' : ''}`}
                onClick={() => handleAreaSelection(key)}
              >
                {area.shortLabel}
              </button>
            ))}
          </div>

          <div className="triage-sheet">
            <div className="triage-sheet-head">
              <div>
                <p className="mini-eyebrow">Abertura</p>
                <strong>{selectedConfig.label}</strong>
              </div>
              <span>{uploadedFiles.length} anexo(s)</span>
            </div>

            <div className="phone-field-stack">
              <ChatField
                field={{ name: 'clientName', label: 'Nome', type: 'text', placeholder: 'Nome completo' }}
                value={intake.clientName}
                onChange={handleFieldChange}
              />
              <ChatField
                field={{ name: 'email', label: 'E-mail', type: 'email', placeholder: 'contato@exemplo.com' }}
                value={intake.email}
                onChange={handleFieldChange}
              />
              <ChatField
                field={{ name: 'phone', label: 'Telefone', type: 'tel', placeholder: '(00) 00000-0000' }}
                value={intake.phone}
                onChange={handleFieldChange}
              />
              <ChatField
                field={{ name: 'subject', label: 'Assunto', type: 'text', placeholder: 'Resumo do problema' }}
                value={intake.subject}
                onChange={handleFieldChange}
              />
              <ChatField
                field={{
                  name: 'objective',
                  label: 'Descricao',
                  type: 'textarea',
                  placeholder: 'Descreva a demanda, o prazo e o objetivo do atendimento.',
                }}
                value={intake.objective}
                onChange={handleFieldChange}
              />
              {compactAreaFields.map((field) => (
                <ChatField key={field.name} field={field} value={intake[field.name]} onChange={handleFieldChange} />
              ))}
            </div>

            <div className="triage-meta">
              <span>{compactFields}/4 dados-base</span>
              <span>{selectedConfig.label}</span>
              <span>SQLite via API</span>
            </div>

            <div className="triage-actions">
              <button className="phone-secondary-button" onClick={() => fileInputRef.current?.click()}>
                <Paperclip size={14} />
                Anexar
              </button>
              <button className="phone-primary-button" onClick={handleCreateTicket} disabled={isLoading}>
                {isLoading ? 'Abrindo...' : 'Abrir chamado'}
              </button>
            </div>
          </div>

          <div className="phone-composer">
            <textarea
              rows="2"
              value={chatInput}
              placeholder="Digite uma nota para o rascunho..."
              onChange={(event) => setChatInput(event.target.value)}
            />
            <button className="compose-send" onClick={handleChatSubmit} aria-label="Enviar nota">
              <Send size={15} />
            </button>
          </div>
        </div>
      </>
    );
  }

  function renderTicketsScreen() {
    return (
      <>
        <PhoneHeader title="Meus chamados" subtitle="Consulta publica" showBack onBack={handleBack} />
        <div className="phone-body">
          {renderFeedbackMessages()}
          <div className="ticket-search">
            <Search size={14} />
            <input
              type="text"
              value={lookupForm.protocol}
              placeholder="Protocolo"
              onChange={(event) => updateLookupField('protocol', event.target.value)}
            />
          </div>
          {renderLookupForm()}
          <div className="ticket-list">
            {activeRecord ? (
              <TicketCard
                record={activeRecord}
                onOpenDetails={() => goToScreen('details')}
                onOpenQueue={() => goToScreen('queue')}
              />
            ) : null}
          </div>
        </div>
      </>
    );
  }

  function renderQueueScreen() {
    return (
      <>
        <PhoneHeader title="Mensagens" subtitle={activeTicket?.protocol || 'Sem protocolo'} showBack onBack={handleBack} />
        <div className="phone-body">
          {renderFeedbackMessages()}
          {!activeTicket ? renderLookupForm() : null}
          {activeTicket ? (
            <>
              <div className="queue-card">
                <span className="queue-card-label">{getStatusLabel(activeTicket.status)}</span>
                <strong>{activeTicket.subject}</strong>
                <p>{activeTicket.protocol}</p>
              </div>

              {(activeTicket.messages || []).map((message) => (
                <div
                  key={message.id}
                  className={`queue-message ${message.sender_type === 'visitor' ? 'user' : ''}`}
                >
                  <strong>{message.sender_name || getStatusLabel(message.sender_type)}</strong>
                  <p>{message.message}</p>
                  <small>{formatDateTime(message.created_at)}</small>
                </div>
              ))}

              {activeTicket.status !== 'closed' ? (
                <div className="phone-composer queue-compose">
                  <textarea
                    rows="2"
                    value={chatInput}
                    placeholder="Mensagem complementar..."
                    onChange={(event) => setChatInput(event.target.value)}
                  />
                  <button className="compose-send" onClick={handleQueueMessage} disabled={isLoading} aria-label="Enviar mensagem">
                    <Send size={15} />
                  </button>
                </div>
              ) : (
                <div className="info-bubble">Chamado encerrado.</div>
              )}
            </>
          ) : null}
        </div>
      </>
    );
  }

  function renderDetailsScreen() {
    return (
      <>
        <PhoneHeader title="Detalhes do chamado" subtitle={activeTicket?.protocol || 'Consultar chamado'} showBack onBack={handleBack} />
        <div className="phone-body">
          {renderFeedbackMessages()}
          {!activeTicket ? renderLookupForm() : null}
          {activeTicket ? (
            <>
              <div className="details-card">
                <strong>{activeTicket.protocol}</strong>
                <span>{activeTicket.area}</span>
                <p>{activeTicket.subject}</p>
              </div>

              <div className="detail-list">
                <div>
                  <span>Status</span>
                  <strong>{getStatusLabel(activeTicket.status)}</strong>
                </div>
                <div>
                  <span>Retorno estimado</span>
                  <strong>{formatEstimatedReturn(activeTicket)}</strong>
                </div>
                <div>
                  <span>Registro</span>
                  <strong>{formatShortDate(activeTicket.created_at)}</strong>
                </div>
              </div>

              <div className="queue-message user">
                <strong>{activeTicket.name}</strong>
                <p>{activeTicket.description}</p>
              </div>

              <div className="detail-actions">
                <button onClick={() => goToScreen('queue')}>Ver mensagens</button>
                {activeTicket.status !== 'closed' ? <button onClick={() => goToScreen('comment')}>Adicionar comentario</button> : null}
                <button onClick={() => goToScreen('rating')}>Avaliar</button>
              </div>
            </>
          ) : null}
        </div>
      </>
    );
  }

  function renderRatingScreen() {
    return (
      <>
        <PhoneHeader title="Avaliacao" subtitle={activeTicket?.protocol || 'Feedback'} showBack onBack={handleBack} />
        <div className="phone-body">
          {renderFeedbackMessages()}
          {!activeTicket ? renderLookupForm() : null}
          {activeTicket ? (
            <>
              <div className="info-bubble">Registre sua avaliacao final do atendimento.</div>

              <div className="star-row">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    className={`star-button ${ratingForm.stars >= value ? 'is-active' : ''}`}
                    onClick={() => setRatingForm((current) => ({ ...current, stars: value, rating: value }))}
                  >
                    <Star size={18} fill={ratingForm.stars >= value ? 'currentColor' : 'none'} />
                  </button>
                ))}
              </div>

              <div className="score-grid">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    className={`score-chip ${ratingForm.rating === value ? 'is-active' : ''}`}
                    onClick={() => setRatingForm((current) => ({ ...current, rating: value, stars: value }))}
                  >
                    {value}
                  </button>
                ))}
              </div>

              <textarea
                className="phone-textarea"
                rows="4"
                value={ratingForm.comment}
                placeholder="Conte como foi o atendimento."
                onChange={(event) => setRatingForm((current) => ({ ...current, comment: event.target.value }))}
              />

              <button className="phone-primary-button phone-primary-center" onClick={handleFeedbackSubmit} disabled={isLoading}>
                {isLoading ? 'Enviando...' : 'Enviar feedback'}
              </button>
            </>
          ) : null}
        </div>
      </>
    );
  }

  function renderCommentScreen() {
    return (
      <>
        <PhoneHeader title="Comentario" subtitle={activeTicket?.protocol || 'Sem protocolo'} showBack onBack={handleBack} />
        <div className="phone-body">
          {renderFeedbackMessages()}
          {!activeTicket ? renderLookupForm() : null}
          {activeTicket ? (
            <>
              <div className="info-bubble">Inclua uma mensagem complementar no historico do chamado.</div>
              <textarea
                className="phone-textarea"
                rows="5"
                value={commentDraft}
                placeholder="Descreva novas informacoes, anexos ou atualizacoes."
                onChange={(event) => setCommentDraft(event.target.value)}
              />

              <div className="triage-actions">
                <button className="phone-secondary-button" onClick={() => fileInputRef.current?.click()}>
                  <Paperclip size={14} />
                  Anexar
                </button>
                <button className="phone-primary-button" onClick={handleCommentSubmit} disabled={isLoading}>
                  {isLoading ? 'Enviando...' : 'Enviar'}
                </button>
              </div>
            </>
          ) : null}
        </div>
      </>
    );
  }

  function renderPhoneScreen() {
    switch (screen) {
      case 'landing':
        return renderLandingScreen();
      case 'assistant':
        return renderAssistantScreen();
      case 'tickets':
        return renderTicketsScreen();
      case 'queue':
        return renderQueueScreen();
      case 'details':
        return renderDetailsScreen();
      case 'rating':
        return renderRatingScreen();
      case 'comment':
        return renderCommentScreen();
      default:
        return renderLandingScreen();
    }
  }

  return (
    <div className="flow-app">
      <input
        ref={fileInputRef}
        className="hidden-file-input"
        type="file"
        multiple
        onChange={handleFileUpload}
      />

      <header className="flow-hero">
        <div>
          <h1>Central de Atendimento Mitsue Borges 24/7.</h1>
        </div>
        <div className="hero-status-stack">
          <article>
            <span>Area ativa</span>
            <strong>{selectedConfig.label}</strong>
          </article>
          <article>
            <span>Protocolo</span>
            <strong>{activeTicket?.protocol || lookupForm.protocol || 'MIT-0000-000000'}</strong>
          </article>
          <article>
            <span>Status</span>
            <strong>{getStatusLabel(activeTicket?.status)}</strong>
          </article>
        </div>
      </header>

      <main className="prototype-grid">
        <section className="prototype-phone-panel">
          <div className="interactive-header">
            <div>
              <p className="panel-kicker">Atendimento interativo</p>
              <h2>{currentStep.title}</h2>
            </div>
            <div className="stage-nav">
              <button className="stage-nav-button" onClick={() => goToAdjacentStep(-1)} disabled={currentStepIndex <= 0}>
                <ArrowLeft size={14} />
                Anterior
              </button>
              <button
                className="stage-nav-button"
                onClick={() => goToAdjacentStep(1)}
                disabled={currentStepIndex >= FLOW_STEPS.length - 1}
              >
                Proxima
                <ArrowRight size={14} />
              </button>
            </div>
          </div>

          <div className="stage-pills">
            {FLOW_STEPS.map((screenItem) => (
              <button
                key={screenItem.id}
                className={`stage-pill ${screen === screenItem.id ? 'is-active' : ''}`}
                onClick={() => goToScreen(screenItem.id)}
              >
                {screenItem.title}
              </button>
            ))}
          </div>

          <div className="active-stage-note">
            <span>Etapa atual</span>
            <strong>
              {currentStepIndex + 1} de {FLOW_STEPS.length}
            </strong>
            <p>Fluxo publico conectado ao backend Laravel.</p>
          </div>

          <div className="phone-stage">
            <div className="phone-device">
              <div className="phone-notch" />
              <div className="phone-screen">{renderPhoneScreen()}</div>
              <div className="phone-home-indicator" />
            </div>
          </div>
        </section>

        <aside className="prototype-side-panel">
          <article className="side-card side-card-primary">
            <div className="side-card-head">
              <BadgeCheck size={18} />
              <h3>MVP real</h3>
            </div>
            <p>
              Chamados, mensagens, status e feedback sao persistidos no SQLite pelo backend Laravel.
            </p>
            <div className="side-tags">
              <span>{activeTicket ? getStatusLabel(activeTicket.status) : 'Sem chamado ativo'}</span>
              <span>{uploadedFiles.length} anexo(s) locais</span>
            </div>
          </article>

          <article className="side-card">
            <div className="side-card-head">
              <Ticket size={18} />
              <h3>Checklist da abertura</h3>
            </div>
            <ul className="side-list">
              <li>{intake.clientName ? 'Nome informado.' : 'Falta nome do solicitante.'}</li>
              <li>{intake.email ? 'E-mail informado.' : 'Falta e-mail para consulta publica.'}</li>
              <li>{intake.subject && intake.objective ? 'Assunto e descricao preenchidos.' : 'Falta assunto ou descricao.'}</li>
            </ul>
          </article>

          <article className="side-card">
            <div className="side-card-head">
              <Clock3 size={18} />
              <h3>Retorno</h3>
            </div>
            <div className="slot-list">
              <button className="slot-button">
                <CalendarDays size={14} />
                {activeTicket ? formatEstimatedReturn(activeTicket) : 'Estimado apos abertura'}
              </button>
            </div>
          </article>

          <article className="side-card">
            <div className="side-card-head">
              <FileText size={18} />
              <h3>Chamado ativo</h3>
            </div>
            <div className="history-compact-list">
              {activeRecord ? (
                <button className="history-compact-card is-active" onClick={() => goToScreen('details')}>
                  <strong>{activeRecord.protocol}</strong>
                  <span>{activeRecord.areaLabel}</span>
                  <small>{activeRecord.status}</small>
                </button>
              ) : (
                <button className="history-compact-card" onClick={() => goToScreen('tickets')}>
                  <strong>Consultar protocolo</strong>
                  <span>Use protocolo e e-mail</span>
                  <small>Publico</small>
                </button>
              )}
            </div>
          </article>

          <article className="side-card side-card-footer">
            <div className="side-card-head">
              <UserRound size={18} />
              <h3>Painel admin</h3>
            </div>
            <p>Atendentes acessam a fila em /admin com o usuario local criado pelo seeder.</p>
            <button className="reset-button" onClick={() => { window.location.href = '/admin'; }}>
              Abrir admin
              <ChevronRight size={14} />
            </button>
            <button className="reset-button reset-button-secondary" onClick={handleResetPrototype}>
              Reiniciar
              <ChevronRight size={14} />
            </button>
          </article>
        </aside>
      </main>
    </div>
  );
}
