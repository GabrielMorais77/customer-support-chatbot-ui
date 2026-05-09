import { AREA_CONFIG, BASE_FIELDS, BUDGET_HINTS, FAQS } from './config';

const REQUIRED_TEXT_EXTENSIONS = ['txt', 'md', 'json', 'csv', 'xml', 'html'];

const DOCUMENT_SIGNAL_RULES = [
  {
    text: 'Há sinal de prazo crítico ou agenda próxima nos documentos anexados.',
    keywords: ['prazo', 'sessão', 'sessao', 'amanhã', 'amanha', 'deadline'],
  },
  {
    text: 'Os materiais citam intimação, o que pode exigir resposta priorizada.',
    keywords: ['intimação', 'intimacao', 'despacho', 'publicação', 'publicacao'],
  },
  {
    text: 'Foram encontrados termos de risco típicos de edital ou habilitação.',
    keywords: ['exigência', 'exigencia', 'habilitação', 'habilitacao', 'inabilitação', 'inabilitacao'],
    areas: ['licitacoes'],
  },
  {
    text: 'O conteúdo sugere análise de honorários, depósito ou cronograma pericial.',
    keywords: ['honorário', 'honorario', 'depósito', 'deposito', 'quesito', 'laudo'],
    areas: ['periciaJudicial', 'assistenciaTecnica'],
  },
  {
    text: 'Há indícios de fiscalização, conformidade ou prestação de contas no material.',
    keywords: ['fiscalização', 'fiscalizacao', 'prestação de contas', 'prestacao de contas', 'glosa', 'auditoria'],
    areas: ['gestaoPublica'],
  },
];

function removeAccents(value) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function normalizeText(value = '') {
  return removeAccents(String(value)).toLowerCase().trim();
}

export function makeId(prefix = 'id') {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
}

export function formatDateTime(value) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function formatShortDate(value) {
  if (!value) {
    return 'Não informado';
  }

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
  }).format(new Date(value));
}

export function formatFileSize(size) {
  if (!Number.isFinite(size) || size <= 0) {
    return '0 KB';
  }

  if (size < 1024 * 1024) {
    return `${Math.max(1, Math.round(size / 1024))} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function inferDocumentType(fileName) {
  const name = normalizeText(fileName);

  if (name.includes('edital')) return 'Edital';
  if (name.includes('quesit')) return 'Quesitos';
  if (name.includes('process')) return 'Processo';
  if (name.includes('contrat')) return 'Contrato';
  if (name.includes('planilh')) return 'Planilha';
  if (name.includes('nota') || name.includes('relatorio')) return 'Relatório técnico';
  if (name.includes('portaria')) return 'Portaria';
  if (name.includes('ata')) return 'Ata';
  if (name.includes('laudo')) return 'Laudo';
  if (name.includes('termo') || name === 'tr' || name.includes(' tr ')) return 'Termo de referência';
  if (name.includes('recurso')) return 'Recurso';
  if (name.includes('nomeacao') || name.includes('nomea')) return 'Nomeação';
  if (name.includes('comprovante')) return 'Comprovante';

  return 'Documento complementar';
}

export function canReadFilePreview(file) {
  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  return REQUIRED_TEXT_EXTENSIONS.includes(extension) || file.type.startsWith('text/');
}

function daysUntil(dateValue) {
  if (!dateValue) {
    return null;
  }

  const today = new Date();
  const target = new Date(dateValue);
  const diff = target.getTime() - today.getTime();

  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function extractSearchText(messages) {
  return messages
    .filter((message) => message.role === 'user')
    .map((message) => message.text)
    .join(' ');
}

export function detectUrgencySignals(text) {
  const normalized = normalizeText(text);
  const flags = [
    'prazo hoje',
    'sessao amanha',
    'recurso urgente',
    'intimacao',
    'prazo judicial',
    'urgente',
    'prazo final',
    'amanha',
    'sessao',
  ];

  return flags.some((flag) => normalized.includes(flag));
}

export function inferAreaFromText(text) {
  const normalized = normalizeText(text);

  for (const [key, config] of Object.entries(AREA_CONFIG)) {
    if (config.keywords.some((keyword) => normalized.includes(normalizeText(keyword)))) {
      return key;
    }
  }

  return null;
}

export function findMatchingFaq(text) {
  const normalized = normalizeText(text);
  return FAQS.find((faq) => faq.keywords.some((keyword) => normalized.includes(normalizeText(keyword))));
}

export function looksLikeFaqQuestion(text) {
  const normalized = normalizeText(text);
  const patterns = ['o que e', 'qual a diferenca', 'como funciona', 'quais documentos', 'qual documento'];
  return patterns.some((pattern) => normalized.includes(pattern));
}

function estimateResponseTime(areaKey, priority) {
  if (priority === 'urgent') {
    if (areaKey === 'gestaoPublica' || areaKey === 'orcamento') {
      return 'até 4 horas úteis';
    }

    return 'até 2 horas úteis';
  }

  if (areaKey === 'falarComMitsue') {
    return 'até 6 horas úteis';
  }

  if (areaKey === 'gestaoPublica' || areaKey === 'orcamento') {
    return 'até 1 dia útil';
  }

  return 'até 12 horas úteis';
}

export function describeFieldValue(field, value) {
  if (!value) {
    return '';
  }

  if (field.type !== 'select') {
    return value;
  }

  return field.options.find((option) => option.value === value)?.label || value;
}

function expectedDocumentMatches(expectedDocument, file) {
  const target = normalizeText(expectedDocument);
  const fileValue = normalizeText(`${file.inferredType} ${file.name}`);

  if (target.includes('honorarios') && fileValue.includes('comprovante')) {
    return true;
  }

  if (target.includes('termo de referencia') && fileValue.includes('termo de referencia')) {
    return true;
  }

  return fileValue.includes(target.split(' ')[0]);
}

export function getExpectedDocumentCoverage(areaKey, files) {
  const expectedDocs = AREA_CONFIG[areaKey]?.expectedDocs || [];
  const matched = expectedDocs.filter((expectedDoc) =>
    files.some((file) => expectedDocumentMatches(expectedDoc, file)),
  );
  const missing = expectedDocs.filter((expectedDoc) => !matched.includes(expectedDoc));

  return {
    expectedDocs,
    matched,
    missing,
    percentage: expectedDocs.length ? Math.round((matched.length / expectedDocs.length) * 100) : 100,
  };
}

export function buildSummary(areaKey, intake, files) {
  const config = AREA_CONFIG[areaKey];
  const highlights = config.fields
    .map((field) => {
      const value = intake[field.name];
      if (!value) {
        return '';
      }

      return `${field.label}: ${describeFieldValue(field, value)}`;
    })
    .filter(Boolean)
    .slice(0, 3);

  const subject = intake.organization || intake.clientName || 'novo solicitante';
  const docSummary = files.length
    ? `${files.length} documento(s) anexado(s)`
    : 'sem documentos anexados até o momento';

  return `${config.label} para ${subject}. ${highlights.join(' | ') || 'Aguardando detalhamento técnico.'} ${docSummary}.`;
}

export function buildDocumentInsights(areaKey, files) {
  const readableFiles = files.filter((file) => file.preview);
  const combinedText = normalizeText(
    files.map((file) => `${file.name} ${file.inferredType} ${file.preview || ''}`).join(' '),
  );
  const coverage = getExpectedDocumentCoverage(areaKey, files);

  const highlights = DOCUMENT_SIGNAL_RULES.filter((rule) => {
    if (rule.areas && !rule.areas.includes(areaKey)) {
      return false;
    }

    return rule.keywords.some((keyword) => combinedText.includes(normalizeText(keyword)));
  }).map((rule) => rule.text);

  if (!files.length) {
    highlights.unshift('Ainda não há documentos anexados para leitura preliminar automatizada.');
  } else if (!readableFiles.length) {
    highlights.unshift('Os arquivos foram organizados, mas a leitura automática detalhada depende de texto legível.');
  }

  return {
    readableCount: readableFiles.length,
    totalFiles: files.length,
    coverage,
    highlights: highlights.slice(0, 4),
  };
}

export function buildAssessment(areaKey, intake, files, priority) {
  if (!areaKey) {
    return null;
  }

  const risks = [];
  const actions = [];
  const dateSignals = [];
  const fileTypes = files.map((file) => normalizeText(file.inferredType)).join(' ');
  const config = AREA_CONFIG[areaKey];
  const documentInsights = buildDocumentInsights(areaKey, files);

  if (!intake.clientName || (!intake.email && !intake.phone)) {
    risks.push('Dados de contato incompletos podem atrasar a formalização do retorno.');
  }

  if (!files.length) {
    risks.push('Ainda não há documentos anexados para validação técnica preliminar.');
  }

  if (priority === 'urgent') {
    actions.push('Encaminhar para fila prioritária com alerta de urgência ativo.');
  }

  switch (areaKey) {
    case 'periciaJudicial': {
      const deadlineDays = daysUntil(intake.expertiseDeadline);
      if (deadlineDays !== null && deadlineDays <= 3) {
        risks.push('Prazo do laudo muito próximo; convém validar cronograma imediatamente.');
      }
      if (intake.feeDeposit === 'nao' || intake.feeDeposit === 'parcial') {
        risks.push('Honorários pendentes podem impactar diligências e cronograma.');
      }
      if (intake.partyQuestions === 'nao') {
        actions.push('Solicitar quesitos das partes e documentos de apoio antes da análise final.');
      }
      if (!fileTypes.includes('quesitos')) {
        actions.push('Anexar quesitos e decisão de nomeação para pré-revisão completa.');
      }
      if (deadlineDays !== null) {
        dateSignals.push(`Prazo do laudo: ${formatShortDate(intake.expertiseDeadline)}`);
      }
      break;
    }
    case 'assistenciaTecnica': {
      const deadlineDays = daysUntil(intake.assistantDeadline);
      if (deadlineDays !== null && deadlineDays <= 2) {
        risks.push('Manifestação técnica em prazo crítico; priorização recomendada.');
      }
      if (intake.assistantNeed === 'impugnacao') {
        actions.push('Mapear inconsistências do laudo e separar documentos de confronto técnico.');
      }
      if (!fileTypes.includes('laudo') && intake.assistantNeed === 'impugnacao') {
        risks.push('Sem laudo anexado, a impugnação técnica pode perder precisão inicial.');
      }
      if (deadlineDays !== null) {
        dateSignals.push(`Prazo relevante: ${formatShortDate(intake.assistantDeadline)}`);
      }
      break;
    }
    case 'licitacoes': {
      const sessionDays = daysUntil(intake.sessionDate);
      if (sessionDays !== null && sessionDays <= 2) {
        risks.push('Sessão pública muito próxima; revisar imediatamente janelas de impugnação ou recurso.');
      }
      if (intake.issueType === 'exigencia_abusiva') {
        risks.push('Há indicativo de restrição competitiva ou cláusula desproporcional no edital.');
      }
      if (intake.desiredAction === 'impugnar') {
        actions.push('Destacar cláusulas críticas, prazo do edital e fundamentos para impugnação.');
      }
      if (!fileTypes.includes('edital')) {
        actions.push('Anexar edital completo e termo de referência para leitura dirigida.');
      }
      if (sessionDays !== null) {
        dateSignals.push(`Sessão: ${formatShortDate(intake.sessionDate)}`);
      }
      break;
    }
    case 'gestaoPublica': {
      if (intake.analysisScope === 'prestacao') {
        risks.push('Prestação de contas exige checagem documental completa para evitar glosas.');
      }
      if (intake.analysisScope === 'conformidade') {
        actions.push('Separar atos normativos, contrato e relatórios de execução para auditoria.');
      }
      if (!intake.baseDocument && !files.length) {
        risks.push('Sem documento-base informado, o parecer preliminar tende a ficar limitado.');
      }
      break;
    }
    case 'orcamento': {
      const budgetDays = daysUntil(intake.budgetDeadline);
      if (budgetDays !== null && budgetDays <= 2) {
        risks.push('Prazo curto para proposta; convém sinalizar urgência comercial e técnica.');
      }
      if (intake.documentVolume === 'alto') {
        actions.push('Dimensionar equipe e prazo conforme o alto volume documental informado.');
      }
      if (budgetDays !== null) {
        dateSignals.push(`Prazo pretendido: ${formatShortDate(intake.budgetDeadline)}`);
      }
      break;
    }
    case 'falarComMitsue': {
      actions.push('Encaminhar resumo executivo para retorno direto da Mitsue Borges.');
      if (!intake.priorityContext) {
        risks.push('Falta contexto resumido para priorização do contato direto.');
      }
      break;
    }
    default:
      break;
  }

  if (documentInsights.highlights.length && files.length) {
    actions.push(documentInsights.highlights[0]);
  }

  if (!actions.length) {
    actions.push('Confirmar documentos principais e consolidar informações para análise formal.');
  }

  return {
    summary: buildSummary(areaKey, intake, files),
    risks: risks.slice(0, 4),
    actions: actions.slice(0, 4),
    dates: dateSignals,
    responseTime: estimateResponseTime(areaKey, priority),
    budgetHint: BUDGET_HINTS[areaKey],
    expectedDocs: config.expectedDocs,
    documentInsights,
  };
}

export function resolvePriority(areaKey, intake, files, messages) {
  if (intake.priorityMode === 'urgent') {
    return 'urgent';
  }

  if (intake.priorityMode === 'normal') {
    return 'normal';
  }

  const joinedText = [
    intake.objective,
    intake.urgencyNote,
    extractSearchText(messages),
    files.map((file) => `${file.name} ${file.preview || ''}`).join(' '),
  ]
    .filter(Boolean)
    .join(' ');

  if (detectUrgencySignals(joinedText)) {
    return 'urgent';
  }

  const relevantDates = [
    intake.expertiseDeadline,
    intake.assistantDeadline,
    intake.sessionDate,
    intake.budgetDeadline,
  ].filter(Boolean);

  if (
    relevantDates.some((dateValue) => {
      const diff = daysUntil(dateValue);
      return diff !== null && diff <= 2;
    })
  ) {
    return 'urgent';
  }

  if (areaKey === 'falarComMitsue' && intake.contactReason === 'urgencia') {
    return 'urgent';
  }

  return 'normal';
}

export function buildProtocol(sequence) {
  return `MITSUE-${new Date().getFullYear()}-${String(sequence).padStart(5, '0')}`;
}

export function defaultReply(areaKey, priority) {
  if (priority === 'urgent') {
    return 'Entendido. Marquei a solicitação como URGENTE e vou manter a triagem priorizada enquanto você completa os dados do atendimento.';
  }

  if (areaKey) {
    return `Perfeito. Continue com a ficha de ${AREA_CONFIG[areaKey].label.toLowerCase()} e anexe os documentos principais para eu consolidar o protocolo.`;
  }

  return 'Posso ajudar com triagem, documentos, FAQ técnico, orçamento inicial e agendamento. Se quiser, selecione a área da demanda para eu conduzir o fluxo adequado.';
}

export function buildSuggestedMeetings() {
  const slots = [];
  const cursor = new Date();
  const slotHours = [9, 14, 17];

  while (slots.length < 3) {
    cursor.setDate(cursor.getDate() + 1);

    if (cursor.getDay() === 0 || cursor.getDay() === 6) {
      continue;
    }

    const slot = new Date(cursor);
    const hour = slotHours[slots.length % slotHours.length];
    slot.setHours(hour, hour === 17 ? 30 : 0, 0, 0);

    slots.push(
      new Intl.DateTimeFormat('pt-BR', {
        weekday: 'short',
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }).format(slot),
    );
  }

  return slots;
}

export function getCompletionStats(areaKey, intake, files) {
  const selectedFields = AREA_CONFIG[areaKey]?.fields || [];
  const documentCoverage = getExpectedDocumentCoverage(areaKey, files);

  const generalChecks = [
    Boolean(intake.clientName),
    Boolean(intake.email || intake.phone),
    Boolean(intake.objective),
    intake.meetingType === 'nao' || Boolean(intake.preferredWindow),
  ];

  const specificCompleted = selectedFields.filter((field) => Boolean(intake[field.name])).length;
  const generalCompleted = generalChecks.filter(Boolean).length;

  const generalPercentage = Math.round((generalCompleted / generalChecks.length) * 100);
  const specificPercentage = selectedFields.length
    ? Math.round((specificCompleted / selectedFields.length) * 100)
    : 100;
  const overall = Math.round((generalPercentage + specificPercentage + documentCoverage.percentage) / 3);

  return {
    generalCompleted,
    generalTotal: generalChecks.length,
    generalPercentage,
    specificCompleted,
    specificTotal: selectedFields.length,
    specificPercentage,
    overall,
    documentCoverage,
    protocolReady: Boolean(intake.clientName && (intake.email || intake.phone) && (specificCompleted > 0 || files.length)),
  };
}

export function findRelatedRecords(history, intake) {
  const name = normalizeText(intake.clientName);
  const email = normalizeText(intake.email);
  const phone = normalizeText(intake.phone);

  if (!name && !email && !phone) {
    return [];
  }

  return history.filter((record) => {
    const snapshot = record.snapshot || {};
    const recordName = normalizeText(record.clientName || snapshot.clientName);
    const recordEmail = normalizeText(snapshot.email);
    const recordPhone = normalizeText(snapshot.phone);

    return (
      (name && recordName && recordName.includes(name)) ||
      (email && recordEmail && recordEmail === email) ||
      (phone && recordPhone && recordPhone === phone)
    );
  });
}

export function countMeaningfulBaseFields(intake) {
  return BASE_FIELDS.filter((field) => {
    if (field.name === 'priorityMode') {
      return intake[field.name] && intake[field.name] !== 'auto';
    }

    if (field.name === 'meetingType') {
      return intake[field.name] && intake[field.name] !== 'nao';
    }

    return Boolean(intake[field.name]);
  }).length;
}
