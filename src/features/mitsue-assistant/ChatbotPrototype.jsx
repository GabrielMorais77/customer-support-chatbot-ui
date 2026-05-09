import {
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  FolderKanban,
  Paperclip,
  Send,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  UserRound,
} from 'lucide-react';
import { startTransition, useDeferredValue, useEffect, useRef, useState } from 'react';
import '../../chatbot_highfi_interactive.css';
import {
  AREA_CONFIG,
  BASE_FIELDS,
  EMPTY_INTAKE,
  FAQS,
  HERO_BADGES,
  INITIAL_MESSAGES,
  MOBILE_SHORTCUTS,
  TRUST_ITEMS,
  WORKSPACE_TABS,
} from './config';
import ChatField from './components/ChatField';
import MessageBubble from './components/MessageBubble';
import { clearDraft, loadDraft, loadHistory, saveDraft, saveHistory } from './storage';
import {
  buildAssessment,
  buildProtocol,
  buildSuggestedMeetings,
  canReadFilePreview,
  countMeaningfulBaseFields,
  defaultReply,
  describeFieldValue,
  detectUrgencySignals,
  findMatchingFaq,
  findRelatedRecords,
  formatDateTime,
  formatFileSize,
  getCompletionStats,
  inferAreaFromText,
  inferDocumentType,
  looksLikeFaqQuestion,
  makeId,
  resolvePriority,
} from './utils';

function createWelcomeMessages() {
  const createdAt = new Date().toISOString();
  return INITIAL_MESSAGES.map((message) => ({
    ...message,
    createdAt,
  }));
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
  const savedDraft = loadDraft();

  if (!savedDraft) {
    return {
      selectedArea: 'periciaJudicial',
      intake: EMPTY_INTAKE,
      uploadedFiles: [],
      messages: createWelcomeMessages(),
      activeRecordId: '',
      workspaceTab: 'dados',
    };
  }

  return {
    selectedArea: savedDraft.selectedArea || 'periciaJudicial',
    intake: { ...EMPTY_INTAKE, ...(savedDraft.intake || {}) },
    uploadedFiles: Array.isArray(savedDraft.uploadedFiles) ? savedDraft.uploadedFiles : [],
    messages: hydrateMessages(savedDraft.messages),
    activeRecordId: savedDraft.activeRecordId || '',
    workspaceTab: savedDraft.workspaceTab || 'dados',
  };
}

function buildRecordHighlights(record) {
  const areaFields = AREA_CONFIG[record.areaKey]?.fields || [];
  const allFields = [...BASE_FIELDS, ...areaFields];

  return allFields
    .map((field) => {
      const value = record.snapshot?.[field.name];
      if (!value) {
        return null;
      }

      return {
        label: field.label,
        value: describeFieldValue(field, value),
      };
    })
    .filter(Boolean)
    .slice(0, 8);
}

export default function ChatbotPrototype() {
  const [initialDraft] = useState(getInitialDraftState);
  const transcriptEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const [selectedArea, setSelectedArea] = useState(initialDraft.selectedArea);
  const [messages, setMessages] = useState(initialDraft.messages);
  const [intake, setIntake] = useState(initialDraft.intake);
  const [chatInput, setChatInput] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState(initialDraft.uploadedFiles);
  const [serviceHistory, setServiceHistory] = useState(loadHistory);
  const [activeRecordId, setActiveRecordId] = useState(initialDraft.activeRecordId);
  const [historySearch, setHistorySearch] = useState('');
  const [workspaceTab, setWorkspaceTab] = useState(initialDraft.workspaceTab);
  const [suggestedMeetings] = useState(() => buildSuggestedMeetings());
  const deferredHistorySearch = useDeferredValue(historySearch);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    saveHistory(serviceHistory);
  }, [serviceHistory]);

  useEffect(() => {
    saveDraft({
      selectedArea,
      intake,
      uploadedFiles,
      messages,
      activeRecordId,
      workspaceTab,
    });
  }, [activeRecordId, intake, messages, selectedArea, uploadedFiles, workspaceTab]);

  const priority = resolvePriority(selectedArea, intake, uploadedFiles, messages);
  const assessment = buildAssessment(selectedArea, intake, uploadedFiles, priority);
  const selectedConfig = AREA_CONFIG[selectedArea];
  const completionStats = getCompletionStats(selectedArea, intake, uploadedFiles);
  const activeRecord = serviceHistory.find((record) => record.id === activeRecordId) || null;
  const relatedRecords = findRelatedRecords(serviceHistory, intake);
  const latestProtocol = serviceHistory[0]?.protocol || 'MITSUE-2026-00000';
  const baseFieldPulse = countMeaningfulBaseFields(intake);

  const filteredHistory = serviceHistory.filter((record) => {
    const search = deferredHistorySearch.trim().toLowerCase();
    if (!search) {
      return true;
    }

    return [record.protocol, record.clientName, record.areaLabel, record.organization]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(search));
  });

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

  function handleAreaSelection(areaKey) {
    setSelectedArea(areaKey);
    setWorkspaceTab('dados');
    appendMessage({
      role: 'user',
      type: 'text',
      text: AREA_CONFIG[areaKey].label,
    });
    appendMessage({
      role: 'assistant',
      type: 'text',
      title: 'Triagem inteligente iniciada',
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
    const inputFiles = Array.from(event.target.files || []);
    if (!inputFiles.length) {
      return;
    }

    const preparedFiles = await Promise.all(
      inputFiles.map(async (file) => {
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
    setWorkspaceTab('documentos');
    appendMessage({
      role: 'assistant',
      type: 'text',
      title: 'Documentos recebidos',
      text: `${preparedFiles.length} documento(s) anexado(s) com sucesso. Vou considerar esses materiais na pré-análise do atendimento.`,
    });

    event.target.value = '';
  }

  function removeFile(fileId) {
    setUploadedFiles((current) => current.filter((file) => file.id !== fileId));
  }

  function handleFaqClick(faq) {
    appendMessage({
      role: 'user',
      type: 'text',
      text: faq.question,
    });
    appendMessage({
      role: 'assistant',
      type: 'text',
      title: 'Resposta técnica',
      text: faq.answer,
    });
  }

  function submitMessage(text) {
    const trimmed = text.trim();
    if (!trimmed) {
      return;
    }

    appendMessage({
      role: 'user',
      type: 'text',
      text: trimmed,
    });

    const faq = findMatchingFaq(trimmed);
    const inferredArea = inferAreaFromText(trimmed);
    const urgent = detectUrgencySignals(trimmed);
    const faqStyleQuestion = looksLikeFaqQuestion(trimmed);

    if (urgent) {
      appendMessage({
        role: 'assistant',
        type: 'text',
        title: 'Prioridade elevada',
        text: 'Entendido. Detectei sinal de prazo crítico e marquei a triagem como URGENTE para priorização imediata.',
      });
    }

    if (inferredArea && inferredArea !== selectedArea && !faqStyleQuestion) {
      setSelectedArea(inferredArea);
      setWorkspaceTab('dados');
      appendMessage({
        role: 'assistant',
        type: 'text',
        title: 'Roteamento automático',
        text: `Pelo contexto da mensagem, a demanda se encaixa melhor em ${AREA_CONFIG[inferredArea].label.toLowerCase()}. Já deixei a ficha correspondente preparada para você.`,
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

    appendMessage({
      role: 'assistant',
      type: 'text',
      title: 'Encaminhamento do atendimento',
      text: defaultReply(selectedArea, urgent ? 'urgent' : priority),
    });
  }

  function handleChatSubmit() {
    submitMessage(chatInput);
    setChatInput('');
  }

  function handleShortcutClick(shortcut) {
    if (shortcut.type === 'area') {
      handleAreaSelection(shortcut.areaKey);
      return;
    }

    submitMessage(shortcut.message);
  }

  function handleMeetingSuggestion(slot) {
    setIntake((current) => ({
      ...current,
      meetingType: current.meetingType === 'nao' ? 'online' : current.meetingType,
      preferredWindow: slot,
    }));
  }

  function handleRegisterRequest() {
    if (!selectedArea) {
      appendMessage({
        role: 'assistant',
        type: 'text',
        title: 'Dados insuficientes',
        text: 'Selecione a área da demanda antes de gerar o protocolo de atendimento.',
      });
      return;
    }

    if (!intake.clientName || (!intake.email && !intake.phone)) {
      appendMessage({
        role: 'assistant',
        type: 'text',
        title: 'Contato necessário',
        text: 'Para registrar o atendimento, preciso ao menos do nome e de um canal de contato como e-mail ou telefone.',
      });
      return;
    }

    const nextProtocol = buildProtocol(serviceHistory.length + 1);
    const record = {
      id: makeId('record'),
      protocol: nextProtocol,
      areaKey: selectedArea,
      areaLabel: AREA_CONFIG[selectedArea].label,
      priority,
      expectedReturn: assessment.responseTime,
      assessment,
      clientName: intake.clientName,
      organization: intake.organization,
      createdAt: new Date().toISOString(),
      documents: uploadedFiles.map((file) => ({
        id: file.id,
        name: file.name,
        inferredType: file.inferredType,
      })),
      snapshot: { ...intake },
    };

    setServiceHistory((current) => [record, ...current]);
    setActiveRecordId(record.id);
    setWorkspaceTab('protocolo');

    appendMessage({
      role: 'assistant',
      type: 'protocol',
      record,
    });
    appendMessage({
      role: 'assistant',
      type: 'text',
      title: 'Próximos passos',
      text: `Sua solicitação foi registrada. Prazo estimado de retorno: ${record.expectedReturn}. Se desejar, a Mitsue pode seguir com orçamento formal ou agendamento a partir deste protocolo.`,
    });
  }

  function handleResetDraft() {
    setIntake(EMPTY_INTAKE);
    setUploadedFiles([]);
    setSelectedArea('periciaJudicial');
    setActiveRecordId('');
    setWorkspaceTab('dados');
    setMessages(createWelcomeMessages());
    clearDraft();
  }

  return (
    <div className="support-app">
      <div className="support-backdrop" aria-hidden="true" />
      <input
        ref={fileInputRef}
        className="hidden-file-input"
        type="file"
        multiple
        onChange={handleFileUpload}
      />

      <header className="hero-shell">
        <div className="hero-copy">
          <div className="hero-badges">
            {HERO_BADGES.map((badge) => (
              <span key={badge}>{badge}</span>
            ))}
          </div>

          <p className="eyebrow">Assistente digital para pré-atendimento profissional</p>
          <h1>Uma interface de chatbot 24/7 com cara de central moderna e fluxo real de atendimento.</h1>
          <p className="hero-text">
            Este protótipo foi desenhado para a Mitsue Borges como um assistente profissional de triagem,
            organização documental, orientação inicial, protocolo e encaminhamento de demandas em perícia
            judicial, assistência técnica, licitações e gestão pública.
          </p>

          <div className="hero-actions">
            <button className="button button-primary" onClick={() => handleAreaSelection(selectedArea)}>
              Iniciar triagem nesta área
              <ArrowRight size={16} />
            </button>
            <button className="button button-secondary" onClick={() => fileInputRef.current?.click()}>
              Enviar documentos
              <Paperclip size={16} />
            </button>
          </div>

          <div className="hero-pulse-row">
            <article className="pulse-card">
              <span>Área ativa</span>
              <strong>{selectedConfig.label}</strong>
              <p>{selectedConfig.description}</p>
            </article>
            <article className="pulse-card">
              <span>Último protocolo</span>
              <strong>{latestProtocol}</strong>
              <p>{serviceHistory.length ? 'Histórico persistido localmente no navegador.' : 'Nenhum atendimento protocolado ainda.'}</p>
            </article>
          </div>
        </div>

        <div className="hero-trust-grid">
          {TRUST_ITEMS.map((item) => (
            <article key={item.title} className="trust-card">
              <p className="eyebrow">{item.title}</p>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </header>

      <main className="support-grid">
        <section className="panel mobile-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Experiência mobile</p>
              <h2>Central de conversa</h2>
            </div>
            <span className={`priority-pill ${priority}`}>
              {priority === 'urgent' ? 'Prioridade urgente' : 'Prioridade normal'}
            </span>
          </div>

          <div className="mobile-frame">
            <div className="mobile-statusbar">
              <span>24/7 online</span>
              <span>{assessment?.responseTime}</span>
            </div>

            <div className="mobile-headcard">
              <div className="mobile-brand">
                <div className="brand-seal">MB</div>
                <div>
                  <strong>Assistente Mitsue</strong>
                  <p>Pré-atendimento formal, responsivo e seguro.</p>
                </div>
              </div>
              <div className="mobile-health">
                <span>{priority === 'urgent' ? 'Fila prioritária' : 'Fila padrão'}</span>
                <span>{uploadedFiles.length} anexo(s)</span>
              </div>
            </div>

            <div className="mobile-area-strip">
              {Object.entries(AREA_CONFIG).map(([key, area]) => {
                const Icon = area.icon;
                return (
                  <button
                    key={key}
                    className={`mobile-area-chip ${selectedArea === key ? 'is-active' : ''}`}
                    onClick={() => handleAreaSelection(key)}
                  >
                    <Icon size={16} />
                    {area.shortLabel}
                  </button>
                );
              })}
            </div>

            <div className="shortcut-row">
              {MOBILE_SHORTCUTS.map((shortcut) => (
                <button key={shortcut.label} className="shortcut-chip" onClick={() => handleShortcutClick(shortcut)}>
                  {shortcut.label}
                </button>
              ))}
            </div>

            <div className="message-list">
              {messages.map((message) => (
                <MessageBubble key={message.id} message={message} onProtocolClick={setActiveRecordId} />
              ))}
              <div ref={transcriptEndRef} />
            </div>

            <div className="mobile-faq-row">
              {FAQS.slice(0, 3).map((faq) => (
                <button key={faq.question} className="faq-chip" onClick={() => handleFaqClick(faq)}>
                  {faq.question}
                </button>
              ))}
            </div>

            <div className="mobile-composer">
              <textarea
                rows="3"
                value={chatInput}
                placeholder="Ex.: preciso impugnar um edital com sessão amanhã, ou quero entender a diferença entre perito e assistente técnico."
                onChange={(event) => setChatInput(event.target.value)}
              />
              <div className="composer-actions">
                <button className="button button-secondary" onClick={() => fileInputRef.current?.click()}>
                  <Paperclip size={16} />
                  Anexar
                </button>
                <button className="button button-primary" onClick={handleChatSubmit}>
                  <Send size={16} />
                  Enviar
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="panel cockpit-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Painel operacional</p>
              <h2>Ficha inteligente da demanda</h2>
            </div>
            <div className="mini-status">
              <Sparkles size={16} />
              <span>Atendimento navegável</span>
            </div>
          </div>

          <div className="overview-grid">
            <article className="overview-card overview-card-primary">
              <span className="metric-label">Prontidão geral</span>
              <strong>{completionStats.overall}%</strong>
              <p>Combina cadastro, informações técnicas e cobertura documental da área selecionada.</p>
              <div className="progress-bar">
                <span style={{ width: `${completionStats.overall}%` }} />
              </div>
            </article>

            <article className="overview-card">
              <span className="metric-label">Documentos esperados</span>
              <strong>{completionStats.documentCoverage.matched.length}/{completionStats.documentCoverage.expectedDocs.length}</strong>
              <p>{completionStats.documentCoverage.missing.length ? 'Ainda faltam documentos-chave para a triagem completa.' : 'Cobertura documental principal já identificada.'}</p>
            </article>

            <article className="overview-card">
              <span className="metric-label">Histórico relacionado</span>
              <strong>{relatedRecords.length} atendimento(s)</strong>
              <p>{relatedRecords.length ? 'Cliente recorrente detectado a partir dos dados preenchidos.' : 'Nenhum atendimento anterior vinculado aos dados atuais.'}</p>
            </article>
          </div>

          <article className="selected-area-card">
            <div>
              <p className="eyebrow">Fluxo ativo</p>
              <h3>{selectedConfig.label}</h3>
              <p>{selectedConfig.intro}</p>
            </div>
            <div className="tag-row">
              <span>Cadastro preenchido: {baseFieldPulse}</span>
              {selectedConfig.quickChecks.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          </article>

          <div className="tab-row">
            {WORKSPACE_TABS.map((tab) => (
              <button
                key={tab.id}
                className={`tab-button ${workspaceTab === tab.id ? 'is-active' : ''}`}
                onClick={() => setWorkspaceTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {workspaceTab === 'dados' ? (
            <div className="workspace-stack">
              <article className="info-banner">
                <p>{selectedConfig.description}</p>
                <div className="tag-row">
                  {selectedConfig.expectedDocs.map((item) => (
                    <span key={item}>{item}</span>
                  ))}
                </div>
              </article>

              {relatedRecords.length ? (
                <article className="related-card">
                  <div className="section-head">
                    <FolderKanban size={17} />
                    <h4>Cliente recorrente identificado</h4>
                  </div>
                  <p>
                    Há {relatedRecords.length} atendimento(s) anterior(es) com dados compatíveis. Isso ajuda a
                    reaproveitar contexto e reduzir retrabalho no retorno.
                  </p>
                </article>
              ) : null}

              <div className="section-block">
                <div className="section-head">
                  <BadgeCheck size={17} />
                  <h4>Cadastro e contato</h4>
                </div>
                <div className="field-grid">
                  {BASE_FIELDS.map((field) => (
                    <ChatField
                      key={field.name}
                      field={field}
                      value={intake[field.name]}
                      onChange={handleFieldChange}
                    />
                  ))}
                </div>
              </div>

              <div className="section-block">
                <div className="section-head">
                  <FileText size={17} />
                  <h4>Dados específicos da demanda</h4>
                </div>
                <div className="field-grid">
                  {selectedConfig.fields.map((field) => (
                    <ChatField
                      key={field.name}
                      field={field}
                      value={intake[field.name]}
                      onChange={handleFieldChange}
                    />
                  ))}
                </div>
              </div>

              <div className="section-block">
                <div className="section-head">
                  <CalendarDays size={17} />
                  <h4>Sugestões de agenda</h4>
                </div>
                <div className="tag-row">
                  {suggestedMeetings.map((slot) => (
                    <button key={slot} className="slot-chip" onClick={() => handleMeetingSuggestion(slot)}>
                      {slot}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {workspaceTab === 'documentos' ? (
            <div className="workspace-stack">
              <div className="section-block section-block-first">
                <div className="section-head">
                  <Paperclip size={17} />
                  <h4>Upload e organização</h4>
                </div>
                <button className="upload-surface" onClick={() => fileInputRef.current?.click()}>
                  <Paperclip size={18} />
                  <div>
                    <strong>Adicionar edital, processo, quesitos, contratos, planilhas ou relatórios</strong>
                    <span>Arquivos ficam vinculados à triagem com tipo identificado, horário e leitura preliminar quando possível.</span>
                  </div>
                </button>
              </div>

              <article className="analysis-card">
                <div className="analysis-topline">
                  <span className="analysis-badge">
                    <ShieldCheck size={14} />
                    {assessment?.documentInsights.readableCount} arquivo(s) com leitura rápida
                  </span>
                  <span className="analysis-badge">
                    <Clock3 size={14} />
                    {completionStats.documentCoverage.percentage}% de cobertura documental
                  </span>
                </div>

                <p className="analysis-summary">
                  O sistema identifica tipos de documento e sinaliza indícios de prazo, urgência e risco com base no nome do arquivo e no conteúdo textual disponível.
                </p>

                <div className="analysis-columns">
                  <div>
                    <h5>Leitura automatizada</h5>
                    <ul>
                      {(assessment?.documentInsights.highlights.length
                        ? assessment.documentInsights.highlights
                        : ['Envie arquivos para ativar a leitura preliminar e a cobertura documental.']).map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h5>Documentos ainda esperados</h5>
                    <ul>
                      {(completionStats.documentCoverage.missing.length
                        ? completionStats.documentCoverage.missing
                        : ['Os documentos principais desta área já aparecem na triagem atual.']).map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </article>

              <div className="file-list">
                {uploadedFiles.length ? (
                  uploadedFiles.map((file) => (
                    <article key={file.id} className="file-card">
                      <div>
                        <strong>{file.name}</strong>
                        <p>
                          {file.inferredType} • {file.sizeLabel} • {formatDateTime(file.uploadedAt)}
                        </p>
                      </div>
                      <button className="file-remove" onClick={() => removeFile(file.id)}>
                        remover
                      </button>
                    </article>
                  ))
                ) : (
                  <div className="empty-state">
                    <p>Nenhum documento anexado ainda. O assistente está pronto para organizar arquivos e ligar cada um ao protocolo.</p>
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {workspaceTab === 'protocolo' ? (
            <div className="workspace-stack">
              <article className="analysis-card">
                <div className="analysis-topline">
                  <span className="analysis-badge">
                    {priority === 'urgent' ? <TriangleAlert size={14} /> : <CheckCircle2 size={14} />}
                    {priority === 'urgent' ? 'Fila urgente' : 'Fila normal'}
                  </span>
                  <span className="analysis-badge">
                    <Clock3 size={14} />
                    {assessment?.responseTime}
                  </span>
                </div>

                <p className="analysis-summary">{assessment?.summary}</p>

                <div className="analysis-columns">
                  <div>
                    <h5>Riscos mapeados</h5>
                    <ul>
                      {(assessment?.risks.length ? assessment.risks : ['Sem risco crítico detectado até aqui.']).map((risk) => (
                        <li key={risk}>{risk}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h5>Providências imediatas</h5>
                    <ul>
                      {(assessment?.actions || []).map((action) => (
                        <li key={action}>{action}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {assessment?.dates.length ? (
                  <div className="tag-row tag-row-top">
                    {assessment.dates.map((dateLabel) => (
                      <span key={dateLabel}>{dateLabel}</span>
                    ))}
                  </div>
                ) : null}

                <div className="quote-banner">
                  <Sparkles size={15} />
                  <p>{assessment?.budgetHint}</p>
                </div>
                <p className="disclaimer">
                  Valores são indicativos e não substituem proposta formal nem parecer jurídico. A avaliação final depende da análise técnica do material.
                </p>
              </article>

              <article className="schedule-card">
                <div className="section-head">
                  <CalendarDays size={17} />
                  <h4>Agenda e próximos passos</h4>
                </div>
                <p>
                  Se desejar, o protocolo já sai com intenção de agenda registrada para reunião online, presencial
                  ou chamada rápida, conforme os campos de contato e disponibilidade preenchidos.
                </p>
                <div className="tag-row">
                  <span>Reunião online</span>
                  <span>Presencial</span>
                  <span>Chamada rápida</span>
                  <span>Retorno formal</span>
                </div>
              </article>

              <article className="status-note">
                <strong>Pronto para protocolo:</strong>
                <span>
                  {completionStats.protocolReady
                    ? ' os dados mínimos já permitem registrar a solicitação.'
                    : ' complete ao menos nome, contato e um detalhe técnico ou documento.'}
                </span>
              </article>
            </div>
          ) : null}

          <div className="operations-actions">
            <button className="button button-secondary" onClick={handleResetDraft}>
              Limpar triagem
            </button>
            <button className="button button-primary" onClick={handleRegisterRequest}>
              Gerar protocolo automático
              <ArrowRight size={16} />
            </button>
          </div>
        </section>
      </main>

      <section className="records-grid">
        <article className="panel history-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Registro e histórico</p>
              <h2>Atendimentos protocolados</h2>
            </div>
            <div className="mini-status">
              <FolderKanban size={16} />
              <span>{serviceHistory.length} registro(s)</span>
            </div>
          </div>

          <div className="history-search">
            <input
              type="text"
              value={historySearch}
              placeholder="Buscar por protocolo, cliente ou área"
              onChange={(event) => setHistorySearch(event.target.value)}
            />
          </div>

          <div className="history-list">
            {filteredHistory.length ? (
              filteredHistory.map((record) => (
                <button
                  key={record.id}
                  className={`history-card ${record.id === activeRecordId ? 'is-selected' : ''}`}
                  onClick={() => {
                    setActiveRecordId(record.id);
                    setWorkspaceTab('protocolo');
                  }}
                >
                  <div className="history-card-top">
                    <strong>{record.protocol}</strong>
                    <span className={`priority-pill ${record.priority}`}>
                      {record.priority === 'urgent' ? 'Urgente' : 'Normal'}
                    </span>
                  </div>
                  <p>{record.areaLabel}</p>
                  <span>
                    {record.clientName}
                    {record.organization ? ` • ${record.organization}` : ''}
                  </span>
                </button>
              ))
            ) : (
              <div className="empty-state">
                <p>Quando um atendimento for registrado, ele aparecerá aqui com protocolo, prioridade e resumo.</p>
              </div>
            )}
          </div>
        </article>

        <article className="panel dossier-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Dossiê selecionado</p>
              <h2>{activeRecord ? activeRecord.protocol : 'Selecione um protocolo'}</h2>
            </div>
            <div className="mini-status">
              <UserRound size={16} />
              <span>{activeRecord ? activeRecord.clientName : 'Sem registro ativo'}</span>
            </div>
          </div>

          {activeRecord ? (
            <div className="dossier-content">
              <div className="dossier-block">
                <h4>Resumo executivo</h4>
                <p>{activeRecord.assessment.summary}</p>
              </div>

              <div className="dossier-meta-grid">
                <div>
                  <span>Área</span>
                  <strong>{activeRecord.areaLabel}</strong>
                </div>
                <div>
                  <span>Retorno estimado</span>
                  <strong>{activeRecord.expectedReturn}</strong>
                </div>
                <div>
                  <span>Registrado em</span>
                  <strong>{formatDateTime(activeRecord.createdAt)}</strong>
                </div>
                <div>
                  <span>Documentos</span>
                  <strong>{activeRecord.documents.length}</strong>
                </div>
              </div>

              <div className="dossier-columns">
                <div>
                  <h4>Riscos</h4>
                  <ul>
                    {(activeRecord.assessment.risks.length
                      ? activeRecord.assessment.risks
                      : ['Sem risco crítico adicional salvo no protocolo.']).map((risk) => (
                      <li key={risk}>{risk}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4>Providências</h4>
                  <ul>
                    {activeRecord.assessment.actions.map((action) => (
                      <li key={action}>{action}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="dossier-block">
                <h4>Informações capturadas</h4>
                <div className="dossier-tag-grid">
                  {buildRecordHighlights(activeRecord).map((item) => (
                    <span key={`${item.label}-${item.value}`}>
                      {item.label}: {item.value}
                    </span>
                  ))}
                </div>
              </div>

              <div className="dossier-block">
                <h4>Documentos relacionados</h4>
                <div className="dossier-tag-grid">
                  {activeRecord.documents.length ? (
                    activeRecord.documents.map((document) => (
                      <span key={document.id}>
                        {document.inferredType}: {document.name}
                      </span>
                    ))
                  ) : (
                    <span>Sem arquivos anexados neste protocolo.</span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="empty-state">
              <p>Selecione um atendimento no histórico para visualizar o dossiê organizado com riscos, providências e informações capturadas.</p>
            </div>
          )}
        </article>
      </section>

      <footer className="page-footer">
        <p>
          O assistente organiza e direciona o atendimento, mas não substitui análise técnica
          individualizada nem orientação jurídica.
        </p>
      </footer>
    </div>
  );
}
