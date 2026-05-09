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
import { startTransition, useEffect, useRef, useState } from 'react';
import '../../chatbot_highfi_interactive.css';
import { AREA_CONFIG, EMPTY_INTAKE } from './config';
import ChatField from './components/ChatField';
import MessageBubble from './components/MessageBubble';
import { clearDraft, loadDraft, loadHistory, saveDraft, saveHistory } from './storage';
import {
  buildAssessment,
  buildProtocol,
  buildSuggestedMeetings,
  canReadFilePreview,
  defaultReply,
  detectUrgencySignals,
  findMatchingFaq,
  formatFileSize,
  formatShortDate,
  inferAreaFromText,
  inferDocumentType,
  looksLikeFaqQuestion,
  makeId,
  resolvePriority,
} from './utils';

const FLOW_STEPS = [
  { id: 'landing', title: 'Abertura' },
  { id: 'site', title: 'Página do site' },
  { id: 'assistant', title: 'Assistente virtual' },
  { id: 'identify', title: 'Identificação' },
  { id: 'tickets', title: 'Meus chamados' },
  { id: 'queue', title: 'Fila de atendimento' },
  { id: 'details', title: 'Detalhes do chamado' },
  { id: 'rating', title: 'Avaliação' },
  { id: 'comment', title: 'Comentário no chamado' },
];

const FLOW_SCREENS = FLOW_STEPS;
const SHOW_FLOW_BOARD = false;

const SCREEN_BACK_MAP = {
  site: 'landing',
  assistant: 'site',
  identify: 'assistant',
  tickets: 'assistant',
  queue: 'tickets',
  details: 'tickets',
  rating: 'details',
  comment: 'details',
};

function FlowPreview() {
  return null;
}

function createWelcomeMessages() {
  const createdAt = new Date().toISOString();
  return [
    {
      id: 'welcome-1',
      role: 'assistant',
      type: 'text',
      title: 'Assistente virtual',
      text: 'Olá. Este canal organiza demandas de perícia judicial, assistência técnica, licitações e gestão pública com atendimento 24/7.',
      createdAt,
    },
    {
      id: 'welcome-2',
      role: 'assistant',
      type: 'text',
      title: 'Como posso te ajudar hoje?',
      text: 'Escolha uma área de atuação, descreva o caso e eu preparo a triagem inicial para a Mitsue Borges.',
      createdAt,
    },
  ];
}

function hydrateMessages(storedMessages) {
  if (!Array.isArray(storedMessages) || !storedMessages.length) {
    return createWelcomeMessages();
  }

  return storedMessages.map((message) => ({
    ...message,
    id: message.id || makeId('msg'),
    createdAt: message.createdAt || new Date().toISOString(),
  }));
}

function getInitialDraftState() {
  const draft = loadDraft();

  if (!draft) {
    return {
      screen: 'landing',
      selectedArea: 'periciaJudicial',
      intake: EMPTY_INTAKE,
      uploadedFiles: [],
      messages: createWelcomeMessages(),
      activeRecordId: '',
      loginEmail: '',
      isAuthenticated: false,
      ratingForm: { stars: 4, score: 8, comment: '' },
      commentDraft: '',
    };
  }

  return {
    screen: draft.screen || 'landing',
    selectedArea: draft.selectedArea || 'periciaJudicial',
    intake: { ...EMPTY_INTAKE, ...(draft.intake || {}) },
    uploadedFiles: Array.isArray(draft.uploadedFiles) ? draft.uploadedFiles : [],
    messages: hydrateMessages(draft.messages),
    activeRecordId: draft.activeRecordId || '',
    loginEmail: draft.loginEmail || '',
    isAuthenticated: Boolean(draft.isAuthenticated),
    ratingForm: draft.ratingForm || { stars: 4, score: 8, comment: '' },
    commentDraft: draft.commentDraft || '',
  };
}

function createDemoRecords() {
  const periciaIntake = {
    ...EMPTY_INTAKE,
    clientName: 'Maria Lacerda',
    organization: 'OU Consul',
    email: 'maria@ouconsul.com.br',
    phone: '(67) 99999-0001',
    objective: 'Nomeação em perícia contábil com prazo muito curto.',
    urgencyNote: 'Prazo hoje',
    processNumber: '0801245-82.2026.8.12.0001',
    court: '3ª Vara Cível de Campo Grande/MS',
    expertiseDeadline: '2026-05-10',
    feeDeposit: 'parcial',
    partyQuestions: 'sim',
  };

  const licitacaoIntake = {
    ...EMPTY_INTAKE,
    clientName: 'Ana Paula Souza',
    organization: 'AP Licita',
    email: 'ana@aplicita.com',
    phone: '(61) 98888-0022',
    objective: 'Impugnação de edital por exigência abusiva.',
    urgencyNote: 'Sessão amanhã',
    modality: 'pregao',
    agency: 'Secretaria Municipal de Saúde',
    noticeNumber: 'PE 014/2026',
    sessionDate: '2026-05-10',
    issueType: 'exigencia_abusiva',
    desiredAction: 'impugnar',
  };

  const periciaFiles = [
    {
      id: 'demo-file-1',
      name: 'processo_pericia.pdf',
      inferredType: 'Processo',
      sizeLabel: '1.2 MB',
      uploadedAt: new Date('2026-05-09T08:30:00').toISOString(),
      preview: '',
    },
    {
      id: 'demo-file-2',
      name: 'quesitos_autor.docx',
      inferredType: 'Quesitos',
      sizeLabel: '220 KB',
      uploadedAt: new Date('2026-05-09T08:40:00').toISOString(),
      preview: '',
    },
  ];

  const licitacaoFiles = [
    {
      id: 'demo-file-3',
      name: 'edital_pe_014_2026.pdf',
      inferredType: 'Edital',
      sizeLabel: '3.0 MB',
      uploadedAt: new Date('2026-05-08T15:12:00').toISOString(),
      preview: '',
    },
  ];

  return [
    {
      id: 'demo-record-1',
      protocol: 'MITSUE-2026-00018',
      areaKey: 'periciaJudicial',
      areaLabel: AREA_CONFIG.periciaJudicial.label,
      priority: 'urgent',
      status: 'Aguardando análise',
      queuePosition: 2,
      expectedReturn: 'até 2 horas úteis',
      assessment: buildAssessment('periciaJudicial', periciaIntake, periciaFiles, 'urgent'),
      clientName: periciaIntake.clientName,
      organization: periciaIntake.organization,
      createdAt: new Date('2026-05-09T08:45:00').toISOString(),
      documents: periciaFiles.map((file) => ({
        id: file.id,
        name: file.name,
        inferredType: file.inferredType,
      })),
      snapshot: periciaIntake,
      feedback: null,
      notes: [],
    },
    {
      id: 'demo-record-2',
      protocol: 'MITSUE-2026-00019',
      areaKey: 'licitacoes',
      areaLabel: AREA_CONFIG.licitacoes.label,
      priority: 'urgent',
      status: 'Na fila',
      queuePosition: 1,
      expectedReturn: 'até 2 horas úteis',
      assessment: buildAssessment('licitacoes', licitacaoIntake, licitacaoFiles, 'urgent'),
      clientName: licitacaoIntake.clientName,
      organization: licitacaoIntake.organization,
      createdAt: new Date('2026-05-09T09:10:00').toISOString(),
      documents: licitacaoFiles.map((file) => ({
        id: file.id,
        name: file.name,
        inferredType: file.inferredType,
      })),
      snapshot: licitacaoIntake,
      feedback: null,
      notes: [],
    },
  ];
}

function getNextProtocolSequence(records) {
  const lastSequence = records.reduce((highest, record) => {
    const match = String(record.protocol || '').match(/(\d+)$/);
    const numeric = match ? Number(match[1]) : 0;
    return Math.max(highest, numeric);
  }, 0);

  return lastSequence + 1;
}

function TicketCard({ record, onOpenDetails, onOpenQueue }) {
  return (
    <article className="ticket-card">
      <div className="ticket-card-head">
        <strong>{record.protocol}</strong>
        <span className={`ticket-status ${record.priority}`}>{record.status || 'Aguardando'}</span>
      </div>
      <p>{record.areaLabel}</p>
      <span>
        {record.clientName}
        {record.organization ? ` • ${record.organization}` : ''}
      </span>
      <div className="ticket-card-actions">
        <button onClick={() => onOpenDetails(record.id)}>Ver detalhes</button>
        <button onClick={() => onOpenQueue(record.id)}>Abrir chat</button>
      </div>
    </article>
  );
}

function PhoneHeader({ title, subtitle, showBack, onBack }) {
  return (
    <header className="phone-header">
      <div className="phone-header-left">
        {showBack ? (
          <button className="phone-icon-button" onClick={onBack}>
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
      <button className="phone-icon-button">
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
  const [messages, setMessages] = useState(initialDraft.messages);
  const [intake, setIntake] = useState(initialDraft.intake);
  const [uploadedFiles, setUploadedFiles] = useState(initialDraft.uploadedFiles);
  const [serviceHistory, setServiceHistory] = useState(loadHistory);
  const [demoRecords, setDemoRecords] = useState(createDemoRecords);
  const [activeRecordId, setActiveRecordId] = useState(initialDraft.activeRecordId);
  const [chatInput, setChatInput] = useState('');
  const [loginEmail, setLoginEmail] = useState(initialDraft.loginEmail);
  const [loginPassword, setLoginPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(initialDraft.isAuthenticated);
  const [ratingForm, setRatingForm] = useState(initialDraft.ratingForm);
  const [commentDraft, setCommentDraft] = useState(initialDraft.commentDraft);
  const [historySearch, setHistorySearch] = useState('');
  const [suggestedMeetings] = useState(() => buildSuggestedMeetings());

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, screen]);

  useEffect(() => {
    saveHistory(serviceHistory);
  }, [serviceHistory]);

  useEffect(() => {
    saveDraft({
      screen,
      selectedArea,
      intake,
      uploadedFiles,
      messages,
      activeRecordId,
      loginEmail,
      isAuthenticated,
      ratingForm,
      commentDraft,
    });
  }, [
    activeRecordId,
    commentDraft,
    intake,
    isAuthenticated,
    loginEmail,
    messages,
    ratingForm,
    screen,
    selectedArea,
    uploadedFiles,
  ]);

  const displayHistory = serviceHistory.length ? serviceHistory : demoRecords;
  const filteredHistory = displayHistory.filter((record) => {
    const search = historySearch.trim().toLowerCase();
    if (!search) {
      return true;
    }

    return [record.protocol, record.clientName, record.areaLabel, record.organization]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(search));
  });

  const selectedConfig = AREA_CONFIG[selectedArea];
  const priority = resolvePriority(selectedArea, intake, uploadedFiles, messages);
  const assessment = buildAssessment(selectedArea, intake, uploadedFiles, priority);
  const activeRecord = displayHistory.find((record) => record.id === activeRecordId) || displayHistory[0] || null;
  const currentStep = FLOW_STEPS.find((item) => item.id === screen) || FLOW_STEPS[0];
  const currentStepIndex = FLOW_STEPS.findIndex((item) => item.id === currentStep.id);
  const compactFields = [intake.clientName, intake.email || intake.phone, intake.objective].filter(Boolean).length;
  const compactAreaFields = selectedConfig.fields.slice(0, 3);
  const documentCoverage = assessment?.documentInsights?.coverage?.percentage || 0;

  function appendMessage(message) {
    startTransition(() => {
      setMessages((current) => [
        ...current,
        {
          id: makeId('msg'),
          createdAt: new Date().toISOString(),
          ...message,
        },
      ]);
    });
  }

  function goToScreen(targetScreen) {
    setScreen(targetScreen);
  }

  function goToAdjacentStep(direction) {
    const nextIndex = currentStepIndex + direction;
    if (nextIndex < 0 || nextIndex >= FLOW_STEPS.length) {
      return;
    }

    setScreen(FLOW_STEPS[nextIndex].id);
  }

  function handleBack() {
    const previous = SCREEN_BACK_MAP[screen];
    if (previous) {
      setScreen(previous);
    }
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
      title: 'Triagem iniciada',
      text: AREA_CONFIG[areaKey].intro,
    });
  }

  function handleFieldChange(name, value) {
    setIntake((current) => ({
      ...current,
      [name]: value,
    }));
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
    appendMessage({
      role: 'assistant',
      type: 'text',
      title: 'Arquivos recebidos',
      text: `${preparedFiles.length} arquivo(s) foram adicionados ao pré-atendimento e vinculados à triagem atual.`,
    });

    event.target.value = '';
  }

  function updateRecord(recordId, updater) {
    const applyUpdate = (records) =>
      records.map((record) =>
        record.id === recordId
          ? typeof updater === 'function'
            ? updater(record)
            : { ...record, ...updater }
          : record,
      );

    if (serviceHistory.length) {
      setServiceHistory((current) => applyUpdate(current));
      return;
    }

    setDemoRecords((current) => applyUpdate(current));
  }

  function buildRecord(identified) {
    const nextIntake = {
      ...intake,
      clientName: intake.clientName || (identified ? 'Solicitante identificado' : 'Visitante'),
      objective: intake.objective || `Solicitação inicial em ${selectedConfig.label.toLowerCase()}.`,
      email: identified ? intake.email || loginEmail || 'contato@exemplo.com' : intake.email,
    };

    const currentPriority = resolvePriority(selectedArea, nextIntake, uploadedFiles, messages);
    const currentAssessment = buildAssessment(selectedArea, nextIntake, uploadedFiles, currentPriority);

    const record = {
      id: makeId('record'),
      protocol: buildProtocol(getNextProtocolSequence(displayHistory)),
      areaKey: selectedArea,
      areaLabel: selectedConfig.label,
      priority: currentPriority,
      status: currentPriority === 'urgent' ? 'Na fila prioritária' : 'Na fila',
      queuePosition: currentPriority === 'urgent' ? 1 : 2,
      expectedReturn: currentAssessment.responseTime,
      assessment: currentAssessment,
      clientName: nextIntake.clientName,
      organization: nextIntake.organization,
      createdAt: new Date().toISOString(),
      documents: uploadedFiles.map((file) => ({
        id: file.id,
        name: file.name,
        inferredType: file.inferredType,
      })),
      snapshot: nextIntake,
      feedback: null,
      notes: [],
    };

    setServiceHistory((current) => [record, ...current]);
    setActiveRecordId(record.id);
    setIsAuthenticated(identified);
    setIntake(nextIntake);
    appendMessage({
      role: 'assistant',
      type: 'protocol',
      record,
    });
    appendMessage({
      role: 'assistant',
      type: 'text',
      title: 'Solicitação registrada',
      text: `Protocolo ${record.protocol} criado com sucesso. Agora você pode acompanhar a fila e os detalhes do atendimento.`,
    });

    return record;
  }

  function handleIdentification(type) {
    const identified = type === 'auth';
    const record = buildRecord(identified);
    setScreen('tickets');
    setActiveRecordId(record.id);
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

    const faq = findMatchingFaq(trimmed);
    const inferredArea = inferAreaFromText(trimmed);
    const urgent = detectUrgencySignals(trimmed);
    const faqStyleQuestion = looksLikeFaqQuestion(trimmed);

    if (inferredArea && inferredArea !== selectedArea && !faqStyleQuestion) {
      setSelectedArea(inferredArea);
      appendMessage({
        role: 'assistant',
        type: 'text',
        title: 'Roteamento automático',
        text: `Entendi. Sua solicitação parece se encaixar melhor em ${AREA_CONFIG[inferredArea].label.toLowerCase()}.`,
      });
      return;
    }

    if (faq && faqStyleQuestion) {
      appendMessage({
        role: 'assistant',
        type: 'text',
        title: 'Resposta técnica',
        text: faq.answer,
      });
      return;
    }

    if (urgent) {
      setIntake((current) => ({
        ...current,
        urgencyNote: current.urgencyNote || trimmed,
      }));
    }

    appendMessage({
      role: 'assistant',
      type: 'text',
      title: urgent ? 'Prioridade alta identificada' : 'Encaminhamento inicial',
      text: defaultReply(selectedArea, urgent ? 'urgent' : priority),
    });
  }

  function handleQueueMessage() {
    const trimmed = chatInput.trim();
    if (!trimmed || !activeRecord) {
      return;
    }

    updateRecord(activeRecord.id, (record) => ({
      ...record,
      notes: [...(record.notes || []), { id: makeId('note'), text: trimmed, createdAt: new Date().toISOString() }],
      status: 'Mensagem enviada',
    }));
    setChatInput('');
  }

  function handleQueueLater() {
    if (!activeRecord) {
      return;
    }

    updateRecord(activeRecord.id, {
      status: 'Retorno agendado mais tarde',
    });
  }

  function handleFeedbackSubmit() {
    if (!activeRecord) {
      return;
    }

    updateRecord(activeRecord.id, {
      feedback: {
        ...ratingForm,
        submittedAt: new Date().toISOString(),
      },
      status: 'Feedback recebido',
    });
    setScreen('comment');
  }

  function handleCommentSubmit() {
    if (!activeRecord || !commentDraft.trim()) {
      return;
    }

    updateRecord(activeRecord.id, (record) => ({
      ...record,
      notes: [
        ...(record.notes || []),
        { id: makeId('note'), text: commentDraft.trim(), createdAt: new Date().toISOString() },
      ],
      status: 'Comentário enviado',
    }));
    setCommentDraft('');
    setScreen('details');
  }

  function handleResetPrototype() {
    setScreen('landing');
    setSelectedArea('periciaJudicial');
    setIntake(EMPTY_INTAKE);
    setUploadedFiles([]);
    setMessages(createWelcomeMessages());
    setActiveRecordId('');
    setChatInput('');
    setLoginEmail('');
    setLoginPassword('');
    setIsAuthenticated(false);
    setRatingForm({ stars: 4, score: 8, comment: '' });
    setCommentDraft('');
    clearDraft();
  }

  function renderLandingScreen() {
    return (
      <div className="screen-home">
        <div className="screen-sitebar">
          <span>Logo</span>
          <button onClick={() => goToScreen('site')}>Menu</button>
        </div>
        <div className="screen-home-center">
          <h2>Atendimento 24/7</h2>
          <p>Assistente virtual da Mitsue Borges</p>
          <button className="phone-primary-button" onClick={() => goToScreen('assistant')}>
            Iniciar atendimento
          </button>
        </div>
        <button className="chat-fab" onClick={() => goToScreen('assistant')}>
          <span className="chat-fab-badge">24/7</span>
          <MessageCircleMore size={18} />
        </button>
      </div>
    );
  }

  function renderSiteScreen() {
    return (
      <div className="screen-site">
        <div className="screen-sitebar">
          <span>Logo</span>
          <button onClick={() => goToScreen('landing')}>Voltar</button>
        </div>
        <div className="screen-placeholder">
          <strong>Página institucional</strong>
          <p>
            Conteúdo do site com apresentação da perita, áreas de atuação, credibilidade e um botão flutuante
            para abrir o atendimento.
          </p>
        </div>
        <button className="chat-fab chat-fab-site" onClick={() => goToScreen('assistant')}>
          <span className="chat-fab-label">Atendimento 24/7</span>
          <Bot size={18} />
        </button>
      </div>
    );
  }

  function renderAssistantScreen() {
    return (
      <>
        <PhoneHeader
          title="Assistente Virtual"
          subtitle="Online agora"
          showBack
          onBack={handleBack}
        />

        <div className="phone-body">
          <div className="phone-thread">
            {messages.slice(-4).map((message) => (
              <MessageBubble key={message.id} message={message} onProtocolClick={setActiveRecordId} />
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
                <p className="mini-eyebrow">Pré-triagem</p>
                <strong>{selectedConfig.label}</strong>
              </div>
              <span>{priority === 'urgent' ? 'Urgente' : 'Normal'}</span>
            </div>

            <div className="phone-field-stack">
              <ChatField field={{ name: 'clientName', label: 'Nome', type: 'text', placeholder: 'Nome completo' }} value={intake.clientName} onChange={handleFieldChange} />
              <ChatField field={{ name: 'email', label: 'E-mail', type: 'email', placeholder: 'contato@exemplo.com' }} value={intake.email} onChange={handleFieldChange} />
              <ChatField field={{ name: 'phone', label: 'Telefone', type: 'tel', placeholder: '(00) 00000-0000' }} value={intake.phone} onChange={handleFieldChange} />
              <ChatField
                field={{
                  name: 'objective',
                  label: 'Resumo do caso',
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
              <span>{compactFields}/3 dados-base preenchidos</span>
              <span>{uploadedFiles.length} documento(s)</span>
              <span>{documentCoverage}% cobertura documental</span>
            </div>

            <div className="triage-actions">
              <button className="phone-secondary-button" onClick={() => fileInputRef.current?.click()}>
                <Paperclip size={14} />
                Anexar
              </button>
              <button className="phone-primary-button" onClick={() => goToScreen('identify')}>
                Continuar
              </button>
            </div>
          </div>

          <div className="phone-composer">
            <textarea
              rows="2"
              value={chatInput}
              placeholder="Digite sua mensagem..."
              onChange={(event) => setChatInput(event.target.value)}
            />
            <button className="compose-send" onClick={handleChatSubmit}>
              <Send size={15} />
            </button>
          </div>
        </div>
      </>
    );
  }

  function renderIdentifyScreen() {
    return (
      <>
        <PhoneHeader title="Assistente Virtual" subtitle="Confirmação do atendimento" showBack onBack={handleBack} />
        <div className="phone-body">
          <div className="info-bubble">
            Para continuar seu protocolo, você pode se identificar agora ou seguir como visitante.
          </div>

          <div className="identify-actions">
            <button className="phone-primary-button" onClick={() => handleIdentification('auth')}>
              Entrar com minha conta
            </button>
            <button className="phone-outline-button" onClick={() => handleIdentification('guest')}>
              Continuar sem identificar
            </button>
          </div>

          <div className="mini-login-card">
            <label>
              <span>Login</span>
              <input
                type="email"
                value={loginEmail}
                placeholder="E-mail"
                onChange={(event) => setLoginEmail(event.target.value)}
              />
            </label>
            <label>
              <span>Senha</span>
              <input
                type="password"
                value={loginPassword}
                placeholder="Senha"
                onChange={(event) => setLoginPassword(event.target.value)}
              />
            </label>
          </div>

          <button className="phone-primary-button phone-primary-center" onClick={() => handleIdentification('auth')}>
            Entrar
          </button>
        </div>
      </>
    );
  }

  function renderTicketsScreen() {
    return (
      <>
        <PhoneHeader title="Meus Chamados" subtitle="Acompanhe seus protocolos" showBack onBack={handleBack} />
        <div className="phone-body">
          <div className="ticket-search">
            <Search size={14} />
            <input
              type="text"
              value={historySearch}
              placeholder="Buscar protocolo ou cliente"
              onChange={(event) => setHistorySearch(event.target.value)}
            />
          </div>

          <div className="ticket-list">
            {filteredHistory.slice(0, 4).map((record) => (
              <TicketCard
                key={record.id}
                record={record}
                onOpenDetails={(recordId) => {
                  setActiveRecordId(recordId);
                  setScreen('details');
                }}
                onOpenQueue={(recordId) => {
                  setActiveRecordId(recordId);
                  setScreen('queue');
                }}
              />
            ))}
          </div>
        </div>
      </>
    );
  }

  function renderQueueScreen() {
    return (
      <>
        <PhoneHeader title="Assistente Virtual" subtitle="Fila de atendimento" showBack onBack={handleBack} />
        <div className="phone-body">
          <div className="info-bubble">
            Vou te transferir para um atendimento humano assim que a triagem e a fila forem confirmadas.
          </div>

          <div className="queue-card">
            <span className="queue-card-label">Aguardando</span>
            <strong>Você é o {activeRecord?.queuePosition || 2}º na fila</strong>
            <p>{activeRecord?.protocol || 'Sem protocolo ativo'}</p>
          </div>

          <button className="queue-later-button" onClick={handleQueueLater}>
            Atender mais tarde
          </button>

          <div className="queue-message user">
            <strong>{activeRecord?.clientName || 'Visitante'}</strong>
            <p>{activeRecord?.snapshot?.objective || 'Quero acompanhar meu protocolo.'}</p>
          </div>

          {(activeRecord?.notes || []).slice(-2).map((note) => (
            <div key={note.id} className="queue-message">
              <strong>Comentário enviado</strong>
              <p>{note.text}</p>
            </div>
          ))}

          <div className="phone-composer queue-compose">
            <textarea
              rows="2"
              value={chatInput}
              placeholder="Digite sua mensagem..."
              onChange={(event) => setChatInput(event.target.value)}
            />
            <button className="compose-send" onClick={handleQueueMessage}>
              <Send size={15} />
            </button>
          </div>
        </div>
      </>
    );
  }

  function renderDetailsScreen() {
    return (
      <>
        <PhoneHeader title="Detalhes do Chamado" subtitle={activeRecord?.protocol || 'Sem protocolo'} showBack onBack={handleBack} />
        <div className="phone-body">
          <div className="details-card">
            <strong>{activeRecord?.protocol}</strong>
            <span>{activeRecord?.areaLabel}</span>
            <p>{activeRecord?.assessment?.summary}</p>
          </div>

          <div className="detail-list">
            <div>
              <span>Status</span>
              <strong>{activeRecord?.status || 'Aguardando'}</strong>
            </div>
            <div>
              <span>Retorno estimado</span>
              <strong>{activeRecord?.expectedReturn || 'até 12 horas úteis'}</strong>
            </div>
            <div>
              <span>Registro</span>
              <strong>{activeRecord ? formatShortDate(activeRecord.createdAt) : 'Hoje'}</strong>
            </div>
          </div>

          <div className="detail-actions">
            <button onClick={() => setScreen('comment')}>Adicionar comentário</button>
            <button onClick={() => setScreen('rating')}>Encerrar e avaliar</button>
            <button onClick={() => setScreen('tickets')}>Voltar à lista</button>
          </div>
        </div>
      </>
    );
  }

  function renderRatingScreen() {
    return (
      <>
        <PhoneHeader title="Avaliação" subtitle="Feedback do atendimento" showBack onBack={handleBack} />
        <div className="phone-body">
          <div className="info-bubble">
            Como você avalia o atendimento e a experiência de navegação deste protótipo?
          </div>

          <div className="star-row">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                className={`star-button ${ratingForm.stars >= value ? 'is-active' : ''}`}
                onClick={() => setRatingForm((current) => ({ ...current, stars: value }))}
              >
                <Star size={18} fill={ratingForm.stars >= value ? 'currentColor' : 'none'} />
              </button>
            ))}
          </div>

          <div className="score-grid">
            {Array.from({ length: 11 }, (_, index) => index).map((value) => (
              <button
                key={value}
                className={`score-chip ${ratingForm.score === value ? 'is-active' : ''}`}
                onClick={() => setRatingForm((current) => ({ ...current, score: value }))}
              >
                {value}
              </button>
            ))}
          </div>

          <textarea
            className="phone-textarea"
            rows="4"
            value={ratingForm.comment}
            placeholder="Conte o que podemos melhorar."
            onChange={(event) => setRatingForm((current) => ({ ...current, comment: event.target.value }))}
          />

          <button className="phone-primary-button phone-primary-center" onClick={handleFeedbackSubmit}>
            Enviar feedback
          </button>
        </div>
      </>
    );
  }

  function renderCommentScreen() {
    return (
      <>
        <PhoneHeader title="Comentário no Chamado" subtitle={activeRecord?.protocol || 'Sem protocolo'} showBack onBack={handleBack} />
        <div className="phone-body">
          <div className="info-bubble">
            Inclua um comentário adicional para o chamado selecionado. Ele ficará registrado no histórico local.
          </div>

          <textarea
            className="phone-textarea"
            rows="5"
            value={commentDraft}
            placeholder="Descreva novas informações, anexos ou atualizações."
            onChange={(event) => setCommentDraft(event.target.value)}
          />

          <div className="triage-actions">
            <button className="phone-secondary-button" onClick={() => fileInputRef.current?.click()}>
              <Paperclip size={14} />
              Anexar arquivo
            </button>
            <button className="phone-primary-button" onClick={handleCommentSubmit}>
              Enviar
            </button>
          </div>
        </div>
      </>
    );
  }

  function renderPhoneScreen() {
    switch (screen) {
      case 'landing':
        return renderLandingScreen();
      case 'site':
        return renderSiteScreen();
      case 'assistant':
        return renderAssistantScreen();
      case 'identify':
        return renderIdentifyScreen();
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
            <span>Área ativa</span>
            <strong>{selectedConfig.label}</strong>
          </article>
          <article>
            <span>Protocolo em destaque</span>
            <strong>{activeRecord?.protocol || 'MITSUE-2026-00000'}</strong>
          </article>
          <article>
            <span>Resposta estimada</span>
            <strong>{activeRecord?.expectedReturn || assessment?.responseTime || 'até 12 horas úteis'}</strong>
          </article>
        </div>
      </header>

      {SHOW_FLOW_BOARD ? <section className="flow-board">
        <div className="flow-board-row">
          {FLOW_SCREENS.slice(0, 6).map((screenItem) => (
            <FlowPreview key={screenItem.id} screen={screenItem} isActive={screen === screenItem.id} onClick={goToScreen} />
          ))}
        </div>
        <div className="flow-arrow">↓</div>
        <div className="flow-board-row flow-board-row-bottom">
          {FLOW_SCREENS.slice(6).map((screenItem) => (
            <FlowPreview key={screenItem.id} screen={screenItem} isActive={screen === screenItem.id} onClick={goToScreen} />
          ))}
        </div>
      </section> : null}

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
                Próxima
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
            <p>Navegação completa em uma única interface funcional.</p>
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
              <h3>Resumo do fluxo</h3>
            </div>
            <p>{assessment?.summary}</p>
            <div className="side-tags">
              <span>{priority === 'urgent' ? 'Prioridade urgente' : 'Prioridade normal'}</span>
              <span>{uploadedFiles.length} documento(s)</span>
              <span>{documentCoverage}% cobertura</span>
            </div>
          </article>

          <article className="side-card">
            <div className="side-card-head">
              <Ticket size={18} />
              <h3>Checklist da triagem</h3>
            </div>
            <ul className="side-list">
              <li>{compactFields >= 1 ? 'Nome ou contato informados.' : 'Falta nome ou contato inicial.'}</li>
              <li>{intake.objective ? 'Resumo da demanda preenchido.' : 'Ainda falta resumo do caso.'}</li>
              <li>
                {assessment?.documentInsights?.coverage?.missing?.length
                  ? `Documentos pendentes: ${assessment.documentInsights.coverage.missing.slice(0, 2).join(', ')}.`
                  : 'Documentos principais já identificados.'}
              </li>
            </ul>
          </article>

          <article className="side-card">
            <div className="side-card-head">
              <Clock3 size={18} />
              <h3>Próximos horários sugeridos</h3>
            </div>
            <div className="slot-list">
              {suggestedMeetings.map((slot) => (
                <button
                  key={slot}
                  className="slot-button"
                  onClick={() =>
                    setIntake((current) => ({
                      ...current,
                      preferredWindow: slot,
                      meetingType: current.meetingType === 'nao' ? 'online' : current.meetingType,
                    }))
                  }
                >
                  <CalendarDays size={14} />
                  {slot}
                </button>
              ))}
            </div>
          </article>

          <article className="side-card">
            <div className="side-card-head">
              <FileText size={18} />
              <h3>Atendimentos protocolados</h3>
            </div>
            <div className="history-compact-list">
              {displayHistory.slice(0, 3).map((record) => (
                <button
                  key={record.id}
                  className={`history-compact-card ${activeRecord?.id === record.id ? 'is-active' : ''}`}
                  onClick={() => {
                    setActiveRecordId(record.id);
                    setScreen('details');
                  }}
                >
                  <strong>{record.protocol}</strong>
                  <span>{record.areaLabel}</span>
                  <small>{record.status || 'Aguardando'}</small>
                </button>
              ))}
            </div>
          </article>

          <article className="side-card side-card-footer">
            <div className="side-card-head">
              <UserRound size={18} />
              <h3>Reset do protótipo</h3>
            </div>
            <p>Se quiser recomeçar a navegação do fluxo como na imagem, limpe o rascunho atual.</p>
            <button className="reset-button" onClick={handleResetPrototype}>
              Reiniciar protótipo
              <ChevronRight size={14} />
            </button>
          </article>
        </aside>
      </main>

    </div>
  );
}
