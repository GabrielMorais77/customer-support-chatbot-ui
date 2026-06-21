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
  askConcursosChat,
  askAssistant,
  createTicket,
  lookupTicket,
  sendTicketFeedback,
  sendTicketMessage,
  uploadTicketAttachments,
} from '../../services/api';
import { AREA_CONFIG, EMPTY_INTAKE } from './config';
import AssistantMenu from './components/AssistantMenu';
import ChatField from './components/ChatField';
import ChatConversation from './components/ChatConversation';
import ChatLayout from './components/ChatLayout';
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

const SENSITIVE_AREA_KEYS = new Set(['recursoRevisao', 'laudoParecer', 'acaoBanca', 'peritaHumana']);
const DIRECT_AI_AREA_KEYS = new Set(['edital', 'planoEstudos', 'duvidasMateria']);
const AREA_TO_CHAT_OPTION = {
  edital: 'analisar_edital_regras',
  planoEstudos: 'montar_plano_estudos',
  duvidasMateria: 'tirar_duvida_simples',
  recursoRevisao: 'recurso_revisao',
  laudoParecer: 'laudo_parecer',
  acaoBanca: 'caso_contra_banca',
  peritaHumana: 'encaminhar_perita',
};

const COMMON_PROTOCOL_FIELDS = [
  {
    name: 'contestName',
    label: 'Concurso',
    type: 'text',
    placeholder: 'Nome do concurso ou orgao',
  },
  {
    name: 'boardName',
    label: 'Banca',
    type: 'text',
    placeholder: 'Ex.: FGV, Cebraspe, Vunesp...',
  },
  {
    name: 'targetRole',
    label: 'Cargo',
    type: 'text',
    placeholder: 'Cargo, area ou especialidade',
  },
  {
    name: 'examStage',
    label: 'Etapa',
    type: 'text',
    placeholder: 'Inscricao, objetiva, discursiva, TAF, pericia...',
  },
];

function createInitialMessages() {
  const createdAt = new Date().toISOString();

  return [
    {
      id: 'initial-ai-welcome',
      role: 'assistant',
      type: 'text',
      title: 'IA 24/7 para concursos publicos',
      text:
        'Ola! Sou o assistente tecnico 24/7 para concursos publicos.\n\nPosso ajudar com edital, banca, cargo, etapas, cotas, PCD, heteroidentificacao, pericia medica, TAF, recursos, revisoes, plano de estudos e organizacao do seu caso.\n\nResolvo duvidas simples aqui no chat. Se houver laudo, parecer, eliminacao, recurso com prazo, documento sensivel ou necessidade de analise profissional, eu organizo os dados e abro um protocolo para uma perita humana avaliar.\n\nPara comecar, escolha uma opcao abaixo ou me diga brevemente o que voce precisa.',
      createdAt,
    },
  ];
}

function getInitialDraftState() {
  const lastLookup = loadLastLookup();

  return {
    screen: 'assistant',
    selectedArea: DEFAULT_AREA,
    intake: PUBLIC_EMPTY_INTAKE,
    uploadedFiles: [],
    messages: createInitialMessages(),
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

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function containsNormalizedTerm(text, term) {
  if (term.includes(' ')) {
    return text.includes(term);
  }

  return new RegExp(`(^|[^a-z0-9])${escapeRegExp(term)}([^a-z0-9]|$)`).test(text);
}

function containsAnyNormalizedTerm(text, terms) {
  return terms.some((term) => containsNormalizedTerm(text, term));
}

function buildQuickGuidance(text, selectedArea) {
  const normalized = normalizeText(text);

  if (containsAnyNormalizedTerm(normalized, ['classificacao', 'classificado', 'convocacao', 'convocado'])) {
    return 'Classificacao significa que o candidato ficou ordenado no resultado do concurso. Convocacao e o chamado oficial para proxima etapa, documentos, posse ou nomeacao. Estar classificado nao garante convocacao: depende das vagas, cadastro reserva, validade do concurso e atos oficiais do orgao.';
  }

  if (containsAnyNormalizedTerm(normalized, ['laudo', 'parecer'])) {
    return 'Laudo, parecer tecnico-cientifico e documento assinado precisam de perita humana. Posso coletar finalidade, prazo, documentos, fato controvertido e perguntas tecnicas para encaminhar o caso organizado.';
  }

  if (containsAnyNormalizedTerm(normalized, ['acao', 'liminar', 'judicial'])) {
    return 'Esse tema pode exigir avaliacao juridica. Vou organizar fatos, banca, fase, decisao, prazo, recurso administrativo, documentos e prejuizo concreto, sem afirmar direito liquido e certo.';
  }

  if (containsAnyNormalizedTerm(normalized, ['recurso', 'gabarito', 'questao'])) {
    return 'Para recurso, separe edital, caderno de prova, questao, gabarito, alternativa marcada, fundamento tecnico, bibliografia e prazo. Casos simples podem virar minuta; discursiva, eliminacao e prova pratica pedem revisao humana.';
  }

  if (containsAnyNormalizedTerm(normalized, ['estudo', 'cronograma']) || selectedArea === 'planoEstudos') {
    return 'Para plano de estudos, informe concurso, banca, data da prova, horas por dia, nivel atual e materias fracas. A base e ciclo semanal, revisoes programadas, questoes e simulados.';
  }

  if (containsAnyNormalizedTerm(normalized, ['edital', 'cargo']) || selectedArea === 'edital') {
    return 'Para edital, confira cargo, requisitos, datas, etapas, conteudo programatico, criterios de aprovacao e eliminacao. Se anexar o edital, o protocolo fica melhor preparado para analise.';
  }

  return 'Posso ajudar com edital, plano de estudos, duvidas de materia, recurso, revisao de prova, laudo, parecer e triagem para perita humana. Escolha uma opcao ou descreva o ocorrido.';
}

function getHumanProtocolArea(text, areaKey = DEFAULT_AREA) {
  const normalized = normalizeText(text);

  if (SENSITIVE_AREA_KEYS.has(areaKey)) {
    return areaKey;
  }

  if (containsAnyNormalizedTerm(normalized, ['laudo', 'parecer', 'nota tecnica', 'pericial'])) {
    return 'laudoParecer';
  }

  if (containsAnyNormalizedTerm(normalized, ['acao', 'judicial', 'liminar', 'mandado', 'processo'])) {
    return 'acaoBanca';
  }

  if (
    containsAnyNormalizedTerm(normalized, [
      'recurso',
      'revisao',
      'revisao de redacao',
      'redacao',
      'discursiva',
      'espelho',
      'nota',
      'gabarito',
      'eliminacao',
      'indeferimento',
    ])
  ) {
    return 'recursoRevisao';
  }

  if (
    containsAnyNormalizedTerm(normalized, [
      'falar com perita',
      'falar com uma perita',
      'perita humana',
      'pericia',
      'encaminhar perita',
      'encaminhar a perita',
      'analise profissional',
      'atendimento humano',
      'abrir protocolo',
      'quero abrir protocolo',
    ])
  ) {
    return 'peritaHumana';
  }

  return null;
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

  const [viewMode, setViewMode] = useState('desktop');
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
  const [isCollectingTicket, setIsCollectingTicket] = useState(false);
  const [conversationStarted, setConversationStarted] = useState(false);
  const [chatSessionId, setChatSessionId] = useState('');

  const selectedConfig = AREA_CONFIG[selectedArea];
  const activeRecord = ticketToRecord(activeTicket);
  const compactFields = [
    intake.clientName,
    intake.email,
    intake.phone,
    intake.subject,
    intake.objective,
    intake.contestName,
    intake.boardName,
    intake.targetRole,
    intake.examStage,
  ]
    .filter(Boolean)
    .length;
  const compactAreaFields = useMemo(() => selectedConfig.fields, [selectedConfig]);
  const commonProtocolFields = useMemo(() => {
    const areaFieldNames = new Set(compactAreaFields.map((field) => field.name));
    return COMMON_PROTOCOL_FIELDS.filter((field) => !areaFieldNames.has(field.name));
  }, [compactAreaFields]);

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

  function shouldCollectProtocol(text, areaKey = selectedArea) {
    return Boolean(getHumanProtocolArea(text, areaKey))
      || containsAnyNormalizedTerm(normalizeText(text), ['prazo', 'urgente', 'vence hoje', 'vence amanha']);
  }

  function prefillSensitiveIntake(text, areaKey) {
    const normalized = normalizeText(text);
    const subjectByArea = {
      recursoRevisao: 'Revisao de prova/redacao',
      laudoParecer: 'Laudo ou parecer tecnico',
      acaoBanca: 'Caso contra banca',
      peritaHumana: 'Encaminhamento para perita',
    };

    return {
      subject: subjectByArea[areaKey] || AREA_CONFIG[areaKey]?.label || 'Atendimento humano',
      objective: text,
      boardName: containsAnyNormalizedTerm(normalized, ['cespe', 'cebraspe']) ? 'Cebraspe/CESPE' : '',
      examStage: containsAnyNormalizedTerm(normalized, ['redacao', 'discursiva']) ? 'discursiva' : '',
    };
  }

  function startProtocolCollectionFromMessage(text, areaKey, assistantText = '') {
    const nextConfig = AREA_CONFIG[areaKey] || AREA_CONFIG.peritaHumana;
    const prefill = prefillSensitiveIntake(text, areaKey);

    setSelectedArea(areaKey);
    setIsCollectingTicket(true);
    setIntake((current) => ({
      ...current,
      subject: current.subject || prefill.subject,
      objective: current.objective || prefill.objective,
      boardName: current.boardName || prefill.boardName,
      examStage: current.examStage || prefill.examStage,
    }));

    appendMessage({
      role: 'assistant',
      type: 'text',
      title: 'Encaminhamento para perita',
      text:
        assistantText ||
        `${nextConfig.intro}\n\nEntendi que voce quer atendimento humano para revisao/analise tecnica. Vou abrir a coleta de protocolo agora. Preencha nome, e-mail, telefone, concurso, banca, cargo, fase e prazo. Se tiver edital, espelho de correcao, texto da redacao ou decisao da banca, anexe tambem.`,
    });
  }

  function applyTriageDecision(userText, triage = {}) {
    const suggestedAreaKey = AREA_CONFIG[triage.suggested_area_key] ? triage.suggested_area_key : selectedArea;
    const nextConfig = AREA_CONFIG[suggestedAreaKey] || selectedConfig;
    const requiresTicket = Boolean(triage.requires_ticket) || shouldCollectProtocol(userText, suggestedAreaKey);

    if (suggestedAreaKey !== selectedArea) {
      setSelectedArea(suggestedAreaKey);
    }

    if (!requiresTicket) {
      return;
    }

    setIsCollectingTicket(true);
    setIntake((current) => ({
      ...current,
      subject: current.subject || nextConfig.label,
      objective: current.objective || userText,
    }));
  }

  function handleAreaSelection(areaKey) {
    const requiresTicket = SENSITIVE_AREA_KEYS.has(areaKey);

    setConversationStarted(true);
    setSelectedArea(areaKey);
    setIntake((current) => ({
      ...current,
      subject: current.subject || AREA_CONFIG[areaKey].label,
    }));
    setIsCollectingTicket(requiresTicket);
    appendMessage({
      role: 'user',
      type: 'text',
      text: AREA_CONFIG[areaKey].label,
    });
    appendMessage({
      role: 'assistant',
      type: 'text',
      title: 'Area selecionada',
      text: requiresTicket
        ? `${AREA_CONFIG[areaKey].intro}\n\nEsse tipo de demanda pode exigir analise tecnica humana. Vou coletar os dados minimos e, depois da sua confirmacao, abrir um protocolo.`
        : `${AREA_CONFIG[areaKey].intro}\n\nPode enviar sua pergunta. Vou responder com base nos editais indexados; se a informacao nao estiver na base, vou dizer isso claramente.`,
    });
  }

  function handleOpenProtocol() {
    setConversationStarted(true);
    setIsCollectingTicket(true);
    setIntake((current) => ({
      ...current,
      subject: current.subject || selectedConfig.label,
    }));
    appendMessage({
      role: 'user',
      type: 'text',
      text: 'Quero abrir protocolo',
    });
    appendMessage({
      role: 'assistant',
      type: 'text',
      title: 'Coleta de protocolo',
      text:
        'Certo. Vou coletar nome, e-mail, telefone, concurso, banca, cargo, etapa e relato inicial. Depois da sua confirmacao, registro o protocolo e voce pode continuar enviando mensagens.',
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
      setConversationStarted(true);
      setIsCollectingTicket(true);
      setNotice(`${preparedFiles.length} documento(s) anexados. Eles serao enviados ao abrir o chamado.`);
      appendMessage({
        role: 'assistant',
        type: 'text',
        title: 'Documento recebido',
        text:
          'Recebi o anexo. Como documento pode envolver analise tecnica, vou abrir a coleta de dados para registrar um protocolo antes de enviar para a perita humana.',
      });
    }

    event.target.value = '';
  }

  function validateTicketPayload(payload) {
    if (!payload.name || !payload.email || !payload.phone || !payload.subject || !intake.objective?.trim()) {
      return 'Preencha nome, e-mail, telefone, assunto e relato do caso para abrir o chamado.';
    }

    if (!intake.contestName?.trim() || !intake.boardName?.trim() || !intake.targetRole?.trim() || !intake.examStage?.trim()) {
      return 'Informe concurso, banca, cargo e etapa. Se nao souber algum dado, escreva "nao sei" no campo correspondente.';
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
      setIsCollectingTicket(false);
      appendMessage({
        role: 'assistant',
        type: 'text',
        title: 'Protocolo aberto',
        text:
          `Protocolo aberto com sucesso: ${lookup.protocol}.\n\nSeu caso foi registrado e sera analisado por uma perita humana. Use este protocolo junto com seu e-mail para acompanhar o atendimento. Voce tambem pode enviar mensagens complementares ou anexar novos documentos enquanto aguarda a analise.`,
      });
      appendMessage({
        role: 'assistant',
        type: 'protocol',
        record: ticketToRecord(refreshed.ticket),
      });
      setNotice(`Chamado ${lookup.protocol} aberto com sucesso.`);
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

  async function handleChatSubmit(messageOverride = '', optionOverride = '') {
    const trimmed = (messageOverride || chatInput).trim();

    if (!trimmed) {
      return;
    }

    setConversationStarted(true);
    appendMessage({
      role: 'user',
      type: 'text',
      text: trimmed,
    });
    setChatInput('');
    setIsAssistantTyping(true);

    try {
      const humanProtocolArea = getHumanProtocolArea(trimmed, selectedArea);

      if (humanProtocolArea && !isCollectingTicket) {
        startProtocolCollectionFromMessage(trimmed, humanProtocolArea);
        return;
      }

      if ((DIRECT_AI_AREA_KEYS.has(selectedArea) || optionOverride) && !isCollectingTicket) {
        const option = optionOverride || AREA_TO_CHAT_OPTION[selectedArea] || selectedArea;
        const response = await askConcursosChat({
          pergunta: trimmed,
          session_id: chatSessionId || undefined,
          option,
        });

        if (response.session_id) {
          setChatSessionId(response.session_id);
        }

        if (response.requires_ticket) {
          const responseArea = AREA_CONFIG[response.suggested_area_key]
            ? response.suggested_area_key
            : getHumanProtocolArea(trimmed, selectedArea) || 'peritaHumana';

          startProtocolCollectionFromMessage(trimmed, responseArea, response.resposta);
          return;
        }

        appendMessage({
          role: 'assistant',
          type: 'text',
          title: 'Resposta com base nos editais',
          text:
            response.resposta ||
            'Nao localizei informacao suficiente nos editais indexados para responder com seguranca.',
          sources: response.fontes_usadas || [],
          catalogResults: response.catalog_results || [],
          studyOptions: response.study_options || [],
        });
        return;
      }

      const response = await askAssistant(trimmed, selectedConfig.label, buildAssistantHistory());
      applyTriageDecision(trimmed, response.triage);
      appendMessage({
        role: 'assistant',
        type: 'text',
        title: 'Resposta rapida',
        text: response.reply || buildQuickGuidance(trimmed, selectedArea),
      });
    } catch (caughtError) {
      if ((DIRECT_AI_AREA_KEYS.has(selectedArea) || optionOverride) && !isCollectingTicket) {
        appendMessage({
          role: 'assistant',
          type: 'text',
          title: 'Base de editais indisponivel',
          text:
            caughtError?.message ||
            'Nao consegui consultar os editais indexados agora. Tente novamente em alguns instantes.',
        });
        return;
      }

      applyTriageDecision(trimmed, {
        requires_ticket: shouldCollectProtocol(trimmed),
        suggested_area_key: selectedArea,
      });
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

  function handleMessageAction(action) {
    if (!action?.message) {
      return;
    }

    setSelectedArea('planoEstudos');
    handleChatSubmit(action.message, 'montar_plano_estudos');
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

  function renderAssistantStart({ compact = false } = {}) {
    return (
      <div className={`assistant-start ${compact ? 'assistant-start-compact' : ''}`}>
        <div className="assistant-mode-card">
          <strong>Primeiro eu faco a triagem no chat.</strong>
          <p>
            Duvidas simples eu respondo agora. Se houver prazo, recurso, eliminacao, documento sensivel, laudo ou
            necessidade de perita humana, eu abro a coleta de protocolo.
          </p>
          <div className="assistant-mode-actions">
            <button type="button" onClick={handleOpenProtocol}>
              Quero abrir protocolo
            </button>
            <button type="button" onClick={() => fileInputRef.current?.click()}>
              Anexar documento
            </button>
          </div>
        </div>

        <AssistantMenu
          options={ENTRY_OPTIONS}
          selectedArea={selectedArea}
          onSelect={handleAreaSelection}
        />

        {!compact ? (
          <div className="area-chip-grid">
            {Object.entries(AREA_CONFIG).map(([key, area]) => (
              <button
                key={key}
                className={`area-chip ${selectedArea === key ? 'is-active' : ''}`}
                onClick={() => handleAreaSelection(key)}
                type="button"
              >
                {area.shortLabel}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  function renderConversationContext() {
    return (
      <div className="conversation-context-card">
        <div>
          <span>{isCollectingTicket ? 'Coleta de protocolo' : 'Conversa ativa'}</span>
          <strong>{selectedConfig.label}</strong>
          <p>
            {isCollectingTicket
              ? 'Informe os dados principais do caso. O protocolo sera gerado no backend existente.'
              : 'Pergunte sobre edital, regras, prazos ou plano de estudos. O bot usa o catalogo local e os editais indexados.'}
          </p>
        </div>
        <div className="conversation-context-actions">
          {!isCollectingTicket ? (
            <button type="button" onClick={handleOpenProtocol}>
              Abrir protocolo
            </button>
          ) : null}
          <button type="button" onClick={() => fileInputRef.current?.click()}>
            Anexar
          </button>
        </div>
      </div>
    );
  }

  function renderTriageSheet() {
    return (
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
          {commonProtocolFields.map((field) => (
            <ChatField key={field.name} field={field} value={intake[field.name]} onChange={handleFieldChange} />
          ))}
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
          <span>{compactFields}/9 dados-base</span>
          <span>{selectedConfig.label}</span>
          <span>Perita humana como autoridade final</span>
        </div>

        <div className="triage-actions">
          <button className="phone-secondary-button" type="button" onClick={() => fileInputRef.current?.click()}>
            <Paperclip size={14} />
            Anexar
          </button>
          <button className="phone-primary-button" type="button" onClick={handleCreateTicket} disabled={isLoading}>
            {isLoading ? 'Abrindo...' : 'Abrir chamado'}
          </button>
        </div>
      </div>
    );
  }

  function renderAssistantScreen(chrome = 'phone') {
    const isDesktop = chrome === 'desktop';
    const showConversation = conversationStarted || isDesktop;

    return (
      <>
        {isDesktop ? (
          <header className="desktop-chat-header">
            <div className="phone-header-left">
              <div className="phone-avatar">
                <Bot size={14} />
              </div>
              <div>
                <strong>Assistente Tecnico</strong>
                <span>Concursos publicos</span>
              </div>
            </div>
            <button className="phone-outline-button" type="button" onClick={() => goToScreen('tickets')}>
              Meus protocolos
            </button>
          </header>
        ) : (
          <PhoneHeader
            title="Assistente Tecnico"
            subtitle="Concursos publicos"
            showBack={false}
            onBack={handleBack}
            onMore={() => goToScreen('tickets')}
          />
        )}

        <div className={`phone-body assistant-body ${showConversation ? 'is-conversation' : 'is-menu'} ${isDesktop ? 'assistant-body-desktop' : ''}`}>
          {showConversation ? (
            <ChatConversation
              messages={messages}
              isTyping={isAssistantTyping}
              endRef={transcriptEndRef}
              onProtocolClick={() => activeTicket && goToScreen('details')}
              inputValue={chatInput}
              onInputChange={setChatInput}
              onSubmit={handleChatSubmit}
              onAttach={() => fileInputRef.current?.click()}
              onMessageAction={handleMessageAction}
              visitorName={intake.clientName}
              disabled={isAssistantTyping}
              headerSlot={
                <>
                  {renderFeedbackMessages()}
                  {conversationStarted ? renderConversationContext() : renderAssistantStart({ compact: true })}
                </>
              }
            >
              {isCollectingTicket ? renderTriageSheet() : null}
            </ChatConversation>
          ) : (
            <>
              {renderFeedbackMessages()}
              {renderAssistantStart()}
            </>
          )}
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

  function renderDesktopChatScreen() {
    if (screen === 'assistant') {
      return renderAssistantScreen('desktop');
    }

    return renderPhoneScreen();
  }

  function renderDesktopExperience() {
    return (
      <main className="desktop-site-shell">
        <section className="desktop-institutional">
          <p className="mini-eyebrow">Balcao digital</p>
          <h1>Assistente Tecnico para concursos publicos</h1>
          <p className="desktop-lead">
            Atendimento inicial para candidatos que precisam entender edital, regras, prazos, plano de estudos,
            documentos e casos que podem exigir protocolo humano.
          </p>

          <div className="desktop-service-grid">
            <article>
              <strong>Base de editais</strong>
              <span>Respostas com contexto recuperado dos PDFs indexados.</span>
            </article>
            <article>
              <strong>Triagem responsavel</strong>
              <span>Casos sensiveis viram protocolo para analise humana.</span>
            </article>
            <article>
              <strong>Chat sempre aberto</strong>
              <span>Menu inicial, mensagens e campo de envio no mesmo balcao.</span>
            </article>
          </div>

          <div className="desktop-action-row">
            <button type="button" className="phone-primary-button" onClick={() => handleAreaSelection('duvidasMateria')}>
              Tirar duvida simples
            </button>
            <button type="button" className="phone-secondary-button" onClick={handleOpenProtocol}>
              Abrir protocolo
            </button>
          </div>
        </section>

        <section className="desktop-chat-window" aria-label="Chat do Assistente Tecnico">
          {renderDesktopChatScreen()}
        </section>
      </main>
    );
  }

  function renderMobileExperience() {
    return (
      <div className="phone-stage public-phone-stage">
        <div className="phone-device public-phone-device">
          <div className="phone-notch" />
          <div className="phone-screen">{renderPhoneScreen()}</div>
          <div className="phone-home-indicator" />
        </div>
      </div>
    );
  }

  function renderPhoneScreen() {
    switch (screen) {
      case 'assistant':
        return renderAssistantScreen('phone');
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
        return renderAssistantScreen('phone');
    }
  }

  return (
    <div className={`flow-app public-chat-shell public-chat-shell-${viewMode}`}>
      <input
        ref={fileInputRef}
        className="hidden-file-input"
        type="file"
        multiple
        onChange={handleFileUpload}
      />

      <ChatLayout
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        desktop={renderDesktopExperience()}
        mobile={renderMobileExperience()}
      />
    </div>
  );
}
