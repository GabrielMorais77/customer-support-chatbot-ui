import {
  FileText,
  FolderKanban,
  Landmark,
  PhoneCall,
  Scale,
  ShieldCheck,
} from 'lucide-react';

export const AREA_CONFIG = {
  periciaJudicial: {
    label: 'Perícia judicial',
    shortLabel: 'Perícia',
    icon: Scale,
    description:
      'Triagem de nomeações, honorários, quesitos, diligências e entrega de laudo técnico com comunicação formal.',
    intro:
      'Para perícia judicial, vou organizar processo, comarca, prazo, honorários e quesitos para deixar a análise pronta para a Mitsue Borges.',
    expectedDocs: ['Processo judicial', 'Quesitos', 'Nomeação', 'Comprovante de honorários'],
    quickChecks: ['Prazo do laudo', 'Depósito de honorários', 'Quesitos já apresentados'],
    fields: [
      {
        name: 'processNumber',
        label: 'Número do processo',
        type: 'text',
        placeholder: '0000000-00.0000.0.00.0000',
      },
      {
        name: 'court',
        label: 'Vara / Comarca',
        type: 'text',
        placeholder: '2ª Vara Cível de Campo Grande/MS',
      },
      {
        name: 'expertiseDeadline',
        label: 'Prazo do laudo',
        type: 'date',
      },
      {
        name: 'judgeOffice',
        label: 'Juiz ou cartório',
        type: 'text',
        placeholder: 'Gabinete ou cartório responsável',
      },
      {
        name: 'expertiseObject',
        label: 'Objeto da perícia',
        type: 'select',
        options: [
          { value: '', label: 'Selecione' },
          { value: 'contabil', label: 'Contábil' },
          { value: 'documental', label: 'Documental' },
          { value: 'administrativa', label: 'Administrativa' },
          { value: 'engenharia', label: 'Engenharia' },
          { value: 'outra', label: 'Outra natureza técnica' },
        ],
      },
      {
        name: 'feeDeposit',
        label: 'Já houve depósito de honorários?',
        type: 'select',
        options: [
          { value: '', label: 'Selecione' },
          { value: 'sim', label: 'Sim' },
          { value: 'nao', label: 'Não' },
          { value: 'parcial', label: 'Parcial / pendente' },
        ],
      },
      {
        name: 'partyQuestions',
        label: 'Já existem quesitos das partes?',
        type: 'select',
        options: [
          { value: '', label: 'Selecione' },
          { value: 'sim', label: 'Sim' },
          { value: 'nao', label: 'Não' },
          { value: 'parcial', label: 'Apenas de uma das partes' },
        ],
      },
    ],
    keywords: ['perícia', 'pericia', 'laudo', 'quesitos', 'juiz', 'cartório', 'nomeação', 'nomeacao'],
  },
  assistenciaTecnica: {
    label: 'Assistência técnica',
    shortLabel: 'Assistência',
    icon: ShieldCheck,
    description:
      'Pré-atendimento para parecer, impugnação, acompanhamento técnico e suporte à estratégia processual.',
    intro:
      'Na assistência técnica, preciso entender a fase do processo, a necessidade principal e o prazo para organizar um parecer ou impugnação com precisão.',
    expectedDocs: ['Petição', 'Laudo', 'Quesitos', 'Documentos de apoio'],
    quickChecks: ['Fase processual', 'Prazo para manifestação', 'Laudo anexado'],
    fields: [
      {
        name: 'assistantProcessNumber',
        label: 'Número do processo',
        type: 'text',
        placeholder: '0000000-00.0000.0.00.0000',
      },
      {
        name: 'assistantPhase',
        label: 'Fase atual',
        type: 'select',
        options: [
          { value: '', label: 'Selecione' },
          { value: 'inicial', label: 'Fase inicial' },
          { value: 'producao_prova', label: 'Produção de prova' },
          { value: 'laudo_apresentado', label: 'Laudo já apresentado' },
          { value: 'manifestacao', label: 'Prazo para manifestação' },
        ],
      },
      {
        name: 'assistantNeed',
        label: 'Necessidade principal',
        type: 'select',
        options: [
          { value: '', label: 'Selecione' },
          { value: 'parecer', label: 'Parecer técnico' },
          { value: 'impugnacao', label: 'Impugnação técnica' },
          { value: 'acompanhamento', label: 'Acompanhamento da perícia' },
          { value: 'quesitos', label: 'Elaboração de quesitos' },
        ],
      },
      {
        name: 'assistantDeadline',
        label: 'Prazo relevante',
        type: 'date',
      },
      {
        name: 'assistantCounterpart',
        label: 'Parte ou assistido',
        type: 'text',
        placeholder: 'Autor, réu, empresa ou órgão assistido',
      },
      {
        name: 'assistantGap',
        label: 'Ponto crítico identificado',
        type: 'textarea',
        placeholder: 'Resuma inconsistências, dúvidas técnicas ou risco processual.',
      },
    ],
    keywords: ['assistência', 'assistencia', 'parecer', 'impugnação', 'impugnacao', 'assistente técnico'],
  },
  licitacoes: {
    label: 'Licitações e contratos',
    shortLabel: 'Licitações',
    icon: FileText,
    description:
      'Triagem para edital, recurso, impugnação, termo de referência, habilitação e análise de risco.',
    intro:
      'Para licitações, vou mapear edital, modalidade, órgão responsável e o problema encontrado para direcionar a medida adequada com rapidez.',
    expectedDocs: ['Edital', 'Termo de referência', 'Planilha', 'Ata', 'Recurso anterior'],
    quickChecks: ['Data da sessão', 'Exigência abusiva', 'Ação desejada'],
    fields: [
      {
        name: 'modality',
        label: 'Modalidade',
        type: 'select',
        options: [
          { value: '', label: 'Selecione' },
          { value: 'pregao', label: 'Pregão' },
          { value: 'concorrencia', label: 'Concorrência' },
          { value: 'dispensa', label: 'Dispensa' },
          { value: 'credenciamento', label: 'Credenciamento' },
          { value: 'outra', label: 'Outra modalidade' },
        ],
      },
      {
        name: 'agency',
        label: 'Órgão responsável',
        type: 'text',
        placeholder: 'Município, secretaria, autarquia ou empresa pública',
      },
      {
        name: 'noticeNumber',
        label: 'Número do edital',
        type: 'text',
        placeholder: 'PE 014/2026',
      },
      {
        name: 'sessionDate',
        label: 'Data da sessão',
        type: 'date',
      },
      {
        name: 'issueType',
        label: 'Problema encontrado',
        type: 'select',
        options: [
          { value: '', label: 'Selecione' },
          { value: 'exigencia_abusiva', label: 'Exigência abusiva' },
          { value: 'habilitacao', label: 'Dúvida de habilitação' },
          { value: 'planilha', label: 'Planilha ou composição de custos' },
          { value: 'tr_deficiente', label: 'TR ou ETP mal estruturado' },
          { value: 'desclassificacao', label: 'Risco de desclassificação' },
        ],
      },
      {
        name: 'desiredAction',
        label: 'Ação desejada',
        type: 'select',
        options: [
          { value: '', label: 'Selecione' },
          { value: 'impugnar', label: 'Impugnar edital' },
          { value: 'recurso', label: 'Elaborar recurso' },
          { value: 'riscos', label: 'Analisar riscos' },
          { value: 'documentacao', label: 'Montar documentação' },
        ],
      },
    ],
    keywords: [
      'licitação',
      'licitacao',
      'edital',
      'pregão',
      'pregao',
      'recurso',
      'impugnação',
      'impugnacao',
      'termo de referência',
      'tr',
    ],
  },
  gestaoPublica: {
    label: 'Gestão pública',
    shortLabel: 'Gestão',
    icon: Landmark,
    description:
      'Atendimento prévio para fiscalização contratual, auditoria documental, conformidade e prestação de contas.',
    intro:
      'Na gestão pública, vou estruturar município, contrato, documento-base e objetivo da análise para agilizar pareceres e auditorias.',
    expectedDocs: ['Contrato', 'Nota técnica', 'Prestação de contas', 'Relatório', 'Portaria'],
    quickChecks: ['Município ou órgão', 'Documento-base', 'Escopo da análise'],
    fields: [
      {
        name: 'municipality',
        label: 'Município / órgão',
        type: 'text',
        placeholder: 'Prefeitura, câmara, secretaria ou órgão de controle',
      },
      {
        name: 'department',
        label: 'Unidade responsável',
        type: 'text',
        placeholder: 'Secretaria de Saúde, Educação, Infraestrutura...',
      },
      {
        name: 'contractType',
        label: 'Tipo de contrato ou projeto',
        type: 'text',
        placeholder: 'Obra, terceirização, ata de registro, convênio...',
      },
      {
        name: 'analysisScope',
        label: 'Tema da demanda',
        type: 'select',
        options: [
          { value: '', label: 'Selecione' },
          { value: 'fiscalizacao', label: 'Fiscalização contratual' },
          { value: 'parecer', label: 'Parecer técnico' },
          { value: 'conformidade', label: 'Conformidade e auditoria' },
          { value: 'prestacao', label: 'Prestação de contas' },
          { value: 'documentos', label: 'Análise documental administrativa' },
        ],
      },
      {
        name: 'baseDocument',
        label: 'Documento-base principal',
        type: 'text',
        placeholder: 'Contrato, edital, nota técnica ou relatório',
      },
      {
        name: 'currentChallenge',
        label: 'Questão central',
        type: 'textarea',
        placeholder: 'Explique o risco, inconsistência ou necessidade do órgão.',
      },
    ],
    keywords: ['gestão pública', 'gestao publica', 'prestação de contas', 'auditoria', 'fiscalização', 'contrato administrativo'],
  },
  orcamento: {
    label: 'Orçamento / contratação',
    shortLabel: 'Orçamento',
    icon: FolderKanban,
    description:
      'Levantamento inicial de escopo, urgência e volume documental para orçamento formal sem compromisso vinculante.',
    intro:
      'Posso coletar escopo, urgência e volume documental para preparar um orçamento inicial e encaminhar para proposta formal.',
    expectedDocs: ['Escopo', 'Edital', 'Processo', 'Minuta', 'Relatório'],
    quickChecks: ['Serviço desejado', 'Volume documental', 'Prazo pretendido'],
    fields: [
      {
        name: 'serviceFocus',
        label: 'Serviço desejado',
        type: 'select',
        options: [
          { value: '', label: 'Selecione' },
          { value: 'laudo', label: 'Laudo pericial' },
          { value: 'assistencia', label: 'Assistência técnica' },
          { value: 'edital', label: 'Análise de edital' },
          { value: 'recurso', label: 'Recurso ou impugnação' },
          { value: 'auditoria', label: 'Auditoria documental' },
        ],
      },
      {
        name: 'budgetDeadline',
        label: 'Prazo pretendido',
        type: 'date',
      },
      {
        name: 'documentVolume',
        label: 'Volume documental',
        type: 'select',
        options: [
          { value: '', label: 'Selecione' },
          { value: 'baixo', label: 'Baixo até 50 páginas' },
          { value: 'medio', label: 'Médio até 200 páginas' },
          { value: 'alto', label: 'Alto acima de 200 páginas' },
        ],
      },
      {
        name: 'budgetNeed',
        label: 'Objetivo principal',
        type: 'textarea',
        placeholder: 'Conte o que precisa, prazo e contexto da contratação.',
      },
    ],
    keywords: ['orçamento', 'orcamento', 'valor', 'proposta', 'contratação', 'contratacao'],
  },
  falarComMitsue: {
    label: 'Falar diretamente com a Mitsue',
    shortLabel: 'Contato direto',
    icon: PhoneCall,
    description:
      'Encaminhamento de atendimento prioritário, reunião ou alinhamento direto com a profissional.',
    intro:
      'Vou preparar um registro objetivo para contato direto com a Mitsue, incluindo motivo, urgência e melhor janela de retorno.',
    expectedDocs: ['Mensagem-resumo', 'Documentos essenciais'],
    quickChecks: ['Motivo do contato', 'Melhor horário', 'Contexto da urgência'],
    fields: [
      {
        name: 'contactReason',
        label: 'Motivo do contato',
        type: 'select',
        options: [
          { value: '', label: 'Selecione' },
          { value: 'urgencia', label: 'Urgência processual / administrativa' },
          { value: 'reuniao', label: 'Solicitar reunião' },
          { value: 'contratacao', label: 'Alinhar contratação' },
          { value: 'caso_especifico', label: 'Caso específico ou recorrente' },
        ],
      },
      {
        name: 'bestMoment',
        label: 'Melhor horário',
        type: 'text',
        placeholder: 'Ex.: hoje após 15h, amanhã cedo, horário comercial',
      },
      {
        name: 'priorityContext',
        label: 'Contexto do atendimento',
        type: 'textarea',
        placeholder: 'Informe o motivo do contato direto e eventual prazo crítico.',
      },
    ],
    keywords: ['mitsue', 'falar com a mitsue', 'contato direto', 'atendimento humano'],
  },
};

export const FAQS = [
  {
    question: 'O que é perícia judicial?',
    answer:
      'Perícia judicial é a prova técnica produzida por especialista nomeado no processo para esclarecer fatos que dependem de conhecimento específico. O atendimento automatizado organiza dados e documentos, mas a conclusão técnica depende da análise profissional da Mitsue Borges.',
    keywords: ['o que é perícia judicial', 'perícia judicial', 'pericia judicial'],
  },
  {
    question: 'Qual a diferença entre perito e assistente técnico?',
    answer:
      'O perito atua por nomeação do juízo e responde com imparcialidade aos pontos técnicos do processo. O assistente técnico acompanha a perícia em favor de uma das partes, formula quesitos, analisa o laudo e aponta inconsistências.',
    keywords: ['diferença entre perito e assistente', 'assistente técnico', 'perito'],
  },
  {
    question: 'O que é impugnação de edital?',
    answer:
      'É a medida administrativa usada para contestar cláusulas ilegais, restritivas ou desproporcionais do edital antes da sessão pública. Normalmente exige análise rápida do instrumento convocatório e atenção rigorosa ao prazo previsto.',
    keywords: ['impugnação de edital', 'impugnacao de edital', 'contestar edital'],
  },
  {
    question: 'O que é recurso administrativo?',
    answer:
      'Recurso administrativo é a manifestação formal apresentada contra uma decisão do procedimento licitatório ou administrativo, como inabilitação, desclassificação ou julgamento. A estratégia depende do ato recorrido e do prazo disponível.',
    keywords: ['recurso administrativo', 'recurso', 'inabilitação', 'desclassificação'],
  },
  {
    question: 'Quais documentos preciso para habilitação?',
    answer:
      'Os documentos variam conforme o edital, mas em regra incluem habilitação jurídica, regularidade fiscal, qualificação técnica e econômico-financeira. O ideal é cruzar a lista exigida com a situação atual da empresa para evitar ausência ou vencimento documental.',
    keywords: ['documentos para habilitação', 'habilitação', 'habilitacao'],
  },
  {
    question: 'Como funciona a contratação de perícia?',
    answer:
      'A contratação depende do tipo de demanda. Em nomeações judiciais, há observância ao processo e aos honorários. Em atendimentos privados, a contratação passa por triagem inicial, análise de escopo, orçamento formal e confirmação do cronograma.',
    keywords: ['contratação de perícia', 'contratacao de pericia', 'honorários periciais'],
  },
];

export const BUDGET_HINTS = {
  periciaJudicial:
    'Laudo pericial a partir de R$ 3.500, sujeito à complexidade, diligências e volume documental.',
  assistenciaTecnica:
    'Assistência técnica e pareceres a partir de R$ 1.800, variando conforme prazo e profundidade.',
  licitacoes:
    'Análise preliminar de edital a partir de R$ 900. Recursos e impugnações variam conforme urgência.',
  gestaoPublica:
    'Parecer de conformidade, auditoria e fiscalização a partir de R$ 1.200, conforme escopo e documentação.',
  orcamento:
    'Orçamento inicial sem vínculo contratual. A proposta formal depende do escopo, prazo e material recebido.',
  falarComMitsue:
    'Encaminhamento direto sem custo inicial. Havendo contratação, a proposta é formalizada após triagem.',
};

export const BASE_FIELDS = [
  {
    name: 'clientName',
    label: 'Nome do solicitante',
    type: 'text',
    placeholder: 'Nome completo',
  },
  {
    name: 'organization',
    label: 'Empresa / órgão / escritório',
    type: 'text',
    placeholder: 'Opcional, quando houver',
  },
  {
    name: 'email',
    label: 'E-mail',
    type: 'email',
    placeholder: 'contato@exemplo.com',
  },
  {
    name: 'phone',
    label: 'Telefone / WhatsApp',
    type: 'tel',
    placeholder: '(00) 00000-0000',
  },
  {
    name: 'priorityMode',
    label: 'Prioridade do atendimento',
    type: 'select',
    options: [
      { value: 'auto', label: 'Detectar automaticamente' },
      { value: 'normal', label: 'Normal' },
      { value: 'urgent', label: 'Urgente' },
    ],
  },
  {
    name: 'objective',
    label: 'Objetivo ou resumo do caso',
    type: 'textarea',
    placeholder: 'Explique brevemente a demanda, o contexto e o que precisa.',
  },
  {
    name: 'urgencyNote',
    label: 'Sinais de urgência ou prazo',
    type: 'textarea',
    placeholder: 'Ex.: prazo hoje, sessão amanhã, intimação, entrega de laudo.',
  },
  {
    name: 'meetingType',
    label: 'Agendamento desejado',
    type: 'select',
    options: [
      { value: 'nao', label: 'Não preciso agendar agora' },
      { value: 'online', label: 'Reunião online' },
      { value: 'presencial', label: 'Reunião presencial' },
      { value: 'ligacao', label: 'Chamada rápida' },
    ],
  },
  {
    name: 'preferredWindow',
    label: 'Melhor horário para retorno',
    type: 'text',
    placeholder: 'Ex.: hoje 16h às 18h, amanhã pela manhã',
  },
];

export const EMPTY_INTAKE = {
  clientName: '',
  organization: '',
  email: '',
  phone: '',
  priorityMode: 'auto',
  objective: '',
  urgencyNote: '',
  meetingType: 'nao',
  preferredWindow: '',
};

export const INITIAL_MESSAGES = [
  {
    id: 'welcome-1',
    role: 'assistant',
    type: 'text',
    title: 'Assistente virtual da Mitsue Borges',
    text:
      'Atendimento profissional 24/7 para pré-triagem de perícia judicial, assistência técnica, licitações, contratos administrativos e gestão pública.',
  },
  {
    id: 'welcome-2',
    role: 'assistant',
    type: 'text',
    title: 'Como este atendimento funciona',
    text:
      'Eu organizo sua demanda, identifico prioridade, recebo documentos, preparo protocolo e deixo o pré-atendimento estruturado para análise da Mitsue. Este canal não substitui orientação jurídica.',
  },
  {
    id: 'welcome-3',
    role: 'assistant',
    type: 'text',
    title: 'Escolha a frente de atendimento',
    text:
      'Você pode iniciar por perícia judicial, assistência técnica, licitações, gestão pública, orçamento ou contato direto. Se preferir, descreva a situação em linguagem natural.',
  },
];

export const WORKSPACE_TABS = [
  { id: 'dados', label: 'Ficha' },
  { id: 'documentos', label: 'Documentos' },
  { id: 'protocolo', label: 'Resumo' },
];

export const HERO_BADGES = [
  'Atendimento profissional 24/7',
  'Protocolos automáticos',
  'Triagem formal e navegável',
];

export const TRUST_ITEMS = [
  {
    title: 'Atuação integrada',
    text: 'Perícia judicial, assistência técnica, licitações, contratos administrativos e auditoria documental em um único fluxo.',
  },
  {
    title: 'Pré-atendimento realista',
    text: 'O bot filtra demandas, detecta urgência, organiza documentos e entrega contexto para resposta rápida e formal.',
  },
  {
    title: 'Base pronta para expansão',
    text: 'Estrutura preparada para futuras integrações com API, IA, agenda, banco de dados e sistemas de suporte reais.',
  },
];

export const MOBILE_SHORTCUTS = [
  { label: 'Perícia judicial', type: 'area', areaKey: 'periciaJudicial' },
  { label: 'Licitações', type: 'area', areaKey: 'licitacoes' },
  { label: 'Orçamento formal', type: 'area', areaKey: 'orcamento' },
  { label: 'Falar com a Mitsue', type: 'area', areaKey: 'falarComMitsue' },
  {
    label: 'Prazo hoje',
    type: 'message',
    message: 'Preciso de atendimento urgente porque o prazo é hoje e preciso organizar a demanda.',
  },
  {
    label: 'Sessão amanhã',
    type: 'message',
    message: 'Tenho uma sessão amanhã e preciso de análise rápida do edital.',
  },
];
