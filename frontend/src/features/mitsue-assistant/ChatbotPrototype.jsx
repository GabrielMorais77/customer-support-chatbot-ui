import {
  ArrowLeft,
  Bot,
  Ellipsis,
  FileText,
  Paperclip,
  Search,
  Send,
  Star,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import '../../chatbot_highfi_interactive.css';
import {
  askAssistant,
  createTicket,
  lookupTicket,
  sendTicketFeedback,
  sendTicketMessage,
  uploadTicketAttachments,
} from '../../services/api';
import { AREA_CONFIG, EMPTY_INTAKE } from './config';
import ChatField from './components/ChatField';
import MessageBubble from './components/MessageBubble';
import {
  loadLastLookup,
  saveLastLookup,
} from './storage';
import {
  canReadFilePreview,
  formatFileSize,
  formatShortDate,
  inferDocumentType,
  makeId,
} from './utils';

const SCREEN_BACK_MAP = {
  tickets: 'assistant',
  queue: 'details',
  details: 'tickets',
  rating: 'details',
  comment: 'details',
};

const DEFAULT_AREA = 'edital';

const ENTRY_OPTIONS = [
  {
    areaKey: 'edital',
    label: 'Analisar edital e regras',
    description: 'Cargo, requisitos, datas, etapas, cotas e eliminacao.',
  },
  {
    areaKey: 'planoEstudos',
    label: 'Montar plano de estudos',
    description: 'Cronograma, revisoes, metas e simulados.',
  },
  {
    areaKey: 'duvidasMateria',
    label: 'Tirar duvida simples',
    description: 'Materia, questao, documento ou regra operacional.',
  },
  {
    areaKey: 'recursoRevisao',
    label: 'Recurso ou revisao',
    description: 'Questao, nota, discursiva, TAF, prova oral ou eliminacao.',
  },
  {
    areaKey: 'laudoParecer',
    label: 'Laudo ou parecer',
    description: 'Coleta para documento tecnico assinado por especialista.',
  },
  {
    areaKey: 'acaoBanca',
    label: 'Caso contra banca',
    description: 'Triagem tecnica com possivel avaliacao juridica.',
  },
  {
    areaKey: 'peritaHumana',
    label: 'Encaminhar a perita',
    description: 'Resumo interno, documentos, prazo e proxima acao.',
  },
];

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

function getInitialDraftState() {
  const lastLookup = loadLastLookup();

  return {
    screen: 'assistant',
    selectedArea: DEFAULT_AREA,
    intake: PUBLIC_EMPTY_INTAKE,
    uploadedFiles: [],
    messages: [],
    lookupForm: { protocol: '', email: '', ...lastLookup },
    ratingForm: { stars: 5, rating: 5, comment: '' },
    commentDraft: '',
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
    `Tipo de demanda: ${selectedConfig.label}`,
    intake.objective,
    intake.urgencyNote ? `Urgencia/prazo: ${intake.urgencyNote}` : '',
    detailLines.length ? detailLines.join('\n') : '',
    fileLines.length ? fileLines.join('\n') : '',
    intake.dataConsent
      ? 'Consentimento: candidato autorizou o tratamento dos dados informados para triagem do atendimento.'
      : '',
    'Observacao: o assistente nao substitui advogado, nao emite laudo e nao garante resultado.',
  ]
    .filter(Boolean)
    .join('\n\n');
}

function normalizeText(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function buildQuickGuidance(text, selectedArea) {
  const normalized = normalizeText(text);

  if (normalized.includes('laudo') || normalized.includes('parecer')) {
    return 'Laudo, parecer tecnico-cientifico e documento assinado precisam de perita humana. Posso coletar finalidade, prazo, documentos, fato controvertido e perguntas tecnicas para encaminhar o caso organizado.';
  }

  if (normalized.includes('acao') || normalized.includes('liminar') || normalized.includes('judicial')) {
    return 'Esse tema pode exigir avaliacao juridica. Vou organizar fatos, banca, fase, decisao, prazo, recurso administrativo, documentos e prejuizo concreto, sem afirmar direito liquido e certo.';
  }

  if (normalized.includes('recurso') || normalized.includes('gabarito') || normalized.includes('questao')) {
    return 'Para recurso, separe edital, caderno de prova, questao, gabarito, alternativa marcada, fundamento tecnico, bibliografia e prazo. Casos simples podem virar minuta; discursiva, eliminacao e prova pratica pedem revisao humana.';
  }

  if (normalized.includes('estudo') || normalized.includes('cronograma') || selectedArea === 'planoEstudos') {
    return 'Para plano de estudos, informe concurso, banca, data da prova, horas por dia, nivel atual e materias fracas. A base e ciclo semanal, revisoes programadas, questoes e simulados.';
  }

  if (normalized.includes('edital') || normalized.includes('cargo') || selectedArea === 'edital') {
    return 'Para edital, confira cargo, requisitos, datas, etapas, conteudo programatico, criterios de aprovacao e eliminacao. Se anexar o edital, o protocolo fica melhor preparado para analise.';
  }

  return 'Posso ajudar com edital, plano de estudos, duvidas de materia, recurso, revisao de prova, laudo, parecer e triagem para perita humana. Escolha uma opcao ou descreva o ocorrido.';
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

function PhoneHeader({ title, subtitle, showBack, onBack, onMore }) {
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
      <button className="phone-icon-button" onClick={onMore} aria-label="Mais opcoes">
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
  const [isAssistantTyping, setIsAssistantTyping] = useState(false);

  const selectedConfig = AREA_CONFIG[selectedArea];
  const activeRecord = ticketToRecord(activeTicket);
  const compactFields = [intake.clientName, intake.email || intake.phone, intake.subject, intake.objective]
    .filter(Boolean)
    .length;
  const compactAreaFields = useMemo(() => selectedConfig.fields, [selectedConfig]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, screen]);

  useEffect(() => {
    saveLastLookup(lookupForm);
  }, [lookupForm]);

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
    setIntake((current) => ({
      ...current,
      subject: current.subject || AREA_CONFIG[areaKey].label,
    }));
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
          file,
        };
      }),
    );

    setUploadedFiles((current) => [...current, ...preparedFiles]);

    if (activeTicket?.protocol && activeTicket?.email) {
      setIsLoading(true);
      setError('');

      try {
        await uploadTicketAttachments(activeTicket.protocol, activeTicket.email, files);
        await refreshActiveTicket(activeTicket);
        setNotice(`${preparedFiles.length} documento(s) enviados para o protocolo.`);
      } catch (caughtError) {
        setError(caughtError.message);
      } finally {
        setIsLoading(false);
      }
    } else {
      setNotice(`${preparedFiles.length} documento(s) anexados. Eles serao enviados ao abrir o chamado.`);
    }

    event.target.value = '';
  }

  function validateTicketPayload(payload) {
    if (!payload.name || !payload.email || !payload.subject || !payload.description) {
      return 'Preencha nome, e-mail, assunto e descricao para abrir o chamado.';
    }

    if (!intake.dataConsent) {
      return 'Autorize o tratamento dos dados para que o atendimento seja registrado.';
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
      const files = uploadedFiles.map((item) => item.file).filter(Boolean);
      const created = await createTicket(payload, files);
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

  function buildAssistantHistory() {
    return messages
      .filter((message) => message.type === 'text' && ['user', 'assistant'].includes(message.role))
      .slice(-6)
      .map((message) => ({
        role: message.role,
        content: [message.title, message.text].filter(Boolean).join('\n'),
      }));
  }

  async function handleChatSubmit() {
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
    setIsAssistantTyping(true);

    try {
      const response = await askAssistant(trimmed, selectedConfig.label, buildAssistantHistory());
      appendMessage({
        role: 'assistant',
        type: 'text',
        title: response.source === 'openrouter' ? 'Resposta do assistente IA' : 'Resposta rapida',
        text: response.reply || buildQuickGuidance(trimmed, selectedArea),
      });
    } catch {
      appendMessage({
        role: 'assistant',
        type: 'text',
        title: 'Resposta rapida',
        text: buildQuickGuidance(trimmed, selectedArea),
      });
    } finally {
      setIsAssistantTyping(false);
    }
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

  function renderAssistantScreen() {
    return (
      <>
        <PhoneHeader
          title="Assistente Tecnico"
          subtitle="Concursos publicos"
          showBack={false}
          onBack={handleBack}
          onMore={() => goToScreen('tickets')}
        />
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
            {isAssistantTyping ? (
              <div className="message-shell message-shell-assistant typing-bubble">
                <span />
                <span />
                <span />
              </div>
            ) : null}
            <div ref={transcriptEndRef} />
          </div>

          <div className="assistant-menu">
            {ENTRY_OPTIONS.map((option) => (
              <button
                key={option.areaKey}
                className={`assistant-menu-button ${selectedArea === option.areaKey ? 'is-active' : ''}`}
                onClick={() => handleAreaSelection(option.areaKey)}
              >
                <strong>{option.label}</strong>
                <span>{option.description}</span>
              </button>
            ))}
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
                <p className="mini-eyebrow">Triagem tecnica</p>
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
                field={{ name: 'subject', label: 'Assunto', type: 'text', placeholder: 'Ex.: Recurso contra questao 42' }}
                value={intake.subject}
                onChange={handleFieldChange}
              />
              <ChatField
                field={{
                  name: 'objective',
                  label: 'Relato inicial',
                  type: 'textarea',
                  placeholder: 'Descreva o concurso, a banca, a fase, o que aconteceu e o que voce precisa.',
                }}
                value={intake.objective}
                onChange={handleFieldChange}
              />
              <ChatField
                field={{
                  name: 'urgencyNote',
                  label: 'Prazo ou urgencia',
                  type: 'textarea',
                  placeholder: 'Ex.: recurso vence hoje, prazo judicial aberto, prova amanha.',
                }}
                value={intake.urgencyNote}
                onChange={handleFieldChange}
              />
              {compactAreaFields.map((field) => (
                <ChatField key={field.name} field={field} value={intake[field.name]} onChange={handleFieldChange} />
              ))}
            </div>

            {uploadedFiles.length ? (
              <div className="attachment-list">
                {uploadedFiles.slice(-4).map((file) => (
                  <div key={file.id} className="attachment-chip">
                    <FileText size={14} />
                    <span>{file.name}</span>
                    <small>{file.sizeLabel}</small>
                  </div>
                ))}
              </div>
            ) : null}

            <label className="consent-card">
              <input
                type="checkbox"
                checked={Boolean(intake.dataConsent)}
                onChange={(event) => handleFieldChange('dataConsent', event.target.checked)}
              />
              <span>
                Autorizo o tratamento dos dados informados para triagem do atendimento. Entendo que o chat nao substitui
                advogado ou perita humana e nao garante resultado.
              </span>
            </label>

            <div className="triage-meta">
              <span>{compactFields}/4 dados-base</span>
              <span>{selectedConfig.label}</span>
              <span>Perita humana como autoridade final</span>
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
              placeholder="Digite sua duvida ou conte o que aconteceu..."
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

              {activeTicket.attachments?.length ? (
                <div className="details-card">
                  <strong>Documentos anexados</strong>
                  <div className="attachment-list">
                    {activeTicket.attachments.map((attachment) => (
                      <div key={attachment.id} className="attachment-chip">
                        <FileText size={14} />
                        <span>{attachment.original_name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

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
        return renderAssistantScreen();
    }
  }

  return (
    <div className="flow-app public-chat-shell">
      <input
        ref={fileInputRef}
        className="hidden-file-input"
        type="file"
        multiple
        onChange={handleFileUpload}
      />

      <div className="phone-stage public-phone-stage">
        <div className="phone-device public-phone-device">
          <div className="phone-notch" />
          <div className="phone-screen">{renderPhoneScreen()}</div>
          <div className="phone-home-indicator" />
        </div>
      </div>
    </div>
  );
}
