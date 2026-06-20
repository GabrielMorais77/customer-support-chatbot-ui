import {
  FileText,
  FolderKanban,
  Landmark,
  PhoneCall,
  Scale,
  ShieldCheck,
} from 'lucide-react';

export const AREA_CONFIG = {
  edital: {
    label: 'Analise de edital',
    shortLabel: 'Edital',
    icon: FileText,
    description:
      'Leitura orientada de edital, banca, cargo, requisitos, datas, etapas, cotas e criterios de eliminacao.',
    intro:
      'Vou organizar concurso, banca, cargo, formacao, duvida central e nivel de detalhe para preparar uma leitura objetiva do edital.',
    expectedDocs: ['Edital', 'Cronograma', 'Retificacao', 'Anexo do cargo'],
    quickChecks: ['Cargo pretendido', 'Requisitos', 'Etapas e prazos'],
    fields: [
      {
        name: 'contestName',
        label: 'Concurso',
        type: 'text',
        placeholder: 'Ex.: TRT, prefeitura, policia civil...',
      },
      {
        name: 'boardName',
        label: 'Banca',
        type: 'text',
        placeholder: 'Ex.: Cebraspe, FGV, Vunesp, IBFC',
      },
      {
        name: 'targetRole',
        label: 'Cargo pretendido',
        type: 'text',
        placeholder: 'Cargo, area e especialidade',
      },
      {
        name: 'candidateEducation',
        label: 'Sua formacao',
        type: 'text',
        placeholder: 'Nivel medio, superior, curso especifico...',
      },
      {
        name: 'editalGoal',
        label: 'Objetivo da analise',
        type: 'select',
        options: [
          { value: '', label: 'Selecione' },
          { value: 'entender', label: 'Entender o edital' },
          { value: 'concorrer', label: 'Verificar se posso concorrer' },
          { value: 'cotas', label: 'Cotas, PCD, PPP ou heteroidentificacao' },
          { value: 'eliminacao', label: 'Risco de eliminacao' },
          { value: 'detalhada', label: 'Analise tecnica detalhada' },
        ],
      },
      {
        name: 'editalQuestion',
        label: 'Duvida especifica',
        type: 'textarea',
        placeholder: 'Inscricao, requisitos, cotas, etapas, prova, eliminacao...',
      },
    ],
    keywords: ['edital', 'banca', 'cargo', 'requisito', 'data', 'etapa', 'cota', 'pcd', 'ppp'],
  },
  planoEstudos: {
    label: 'Plano de estudos',
    shortLabel: 'Estudos',
    icon: FolderKanban,
    description:
      'Cronograma, ciclo de estudos, metas semanais, revisoes, simulados e estrategia de prova.',
    intro:
      'Vou coletar prova, banca, tempo disponivel, nivel atual e materias fortes/fracas para montar uma estrategia realista.',
    expectedDocs: ['Edital', 'Conteudo programatico', 'Historico de simulados'],
    quickChecks: ['Horas por dia', 'Nivel atual', 'Materias fracas'],
    fields: [
      {
        name: 'contestName',
        label: 'Concurso e cargo',
        type: 'text',
        placeholder: 'Ex.: INSS - Tecnico',
      },
      {
        name: 'boardName',
        label: 'Banca',
        type: 'text',
        placeholder: 'Banca organizadora',
      },
      {
        name: 'testDate',
        label: 'Data da prova',
        type: 'date',
      },
      {
        name: 'dailyHours',
        label: 'Tempo por dia',
        type: 'text',
        placeholder: 'Ex.: 2h durante a semana e 5h no sabado',
      },
      {
        name: 'currentLevel',
        label: 'Nivel atual',
        type: 'select',
        options: [
          { value: '', label: 'Selecione' },
          { value: 'iniciante', label: 'Iniciante' },
          { value: 'intermediario', label: 'Intermediario' },
          { value: 'avancado', label: 'Avancado' },
          { value: 'reta_final', label: 'Reta final' },
        ],
      },
      {
        name: 'studyDifficulties',
        label: 'Dificuldades principais',
        type: 'textarea',
        placeholder: 'Teoria, questoes, discursiva, revisao, simulados...',
      },
    ],
    keywords: ['plano', 'estudo', 'cronograma', 'revisao', 'simulado', 'materia', 'questoes'],
  },
  duvidasMateria: {
    label: 'Duvidas de materias',
    shortLabel: 'Duvidas',
    icon: Landmark,
    description:
      'Explicacao de conteudo, checklist de documentos, questoes simples e orientacao operacional.',
    intro:
      'Posso resolver duvidas simples de materia, prova, documentos e regras operacionais sem prometer resultado.',
    expectedDocs: ['Questao', 'Trecho do edital', 'Material de estudo'],
    quickChecks: ['Materia', 'Tema', 'Nivel da duvida'],
    fields: [
      {
        name: 'subjectMatter',
        label: 'Materia',
        type: 'text',
        placeholder: 'Ex.: Portugues, Administrativo, RLM',
      },
      {
        name: 'questionTheme',
        label: 'Tema',
        type: 'text',
        placeholder: 'Assunto ou topico da duvida',
      },
      {
        name: 'doubtType',
        label: 'Tipo de ajuda',
        type: 'select',
        options: [
          { value: '', label: 'Selecione' },
          { value: 'explicacao', label: 'Explicacao simples' },
          { value: 'questao', label: 'Resolver questao' },
          { value: 'checklist', label: 'Checklist de documentos' },
          { value: 'estrategia', label: 'Estrategia de revisao' },
        ],
      },
      {
        name: 'currentDoubt',
        label: 'Duvida',
        type: 'textarea',
        placeholder: 'Cole a questao ou explique onde travou.',
      },
    ],
    keywords: ['duvida', 'materia', 'questao', 'conteudo', 'documento', 'checklist'],
  },
  recursoRevisao: {
    label: 'Recurso ou revisao',
    shortLabel: 'Recurso',
    icon: ShieldCheck,
    description:
      'Triagem de recurso contra questao, nota, discursiva, TAF, prova oral, prova pratica ou eliminacao.',
    intro:
      'Vou coletar edital, prova, gabarito, alternativa, justificativa da banca, prazo e documentos para classificar a complexidade.',
    expectedDocs: ['Edital', 'Caderno de prova', 'Gabarito', 'Espelho de correcao', 'Decisao da banca'],
    quickChecks: ['Prazo do recurso', 'Questao ou fase', 'Fundamento tecnico'],
    fields: [
      {
        name: 'contestName',
        label: 'Concurso',
        type: 'text',
        placeholder: 'Nome do certame',
      },
      {
        name: 'boardName',
        label: 'Banca',
        type: 'text',
        placeholder: 'Banca responsavel',
      },
      {
        name: 'examStage',
        label: 'Fase contestada',
        type: 'select',
        options: [
          { value: '', label: 'Selecione' },
          { value: 'objetiva', label: 'Questao objetiva' },
          { value: 'discursiva', label: 'Prova discursiva' },
          { value: 'pratica', label: 'Prova pratica' },
          { value: 'taf', label: 'TAF' },
          { value: 'psicologica', label: 'Avaliacao psicologica' },
          { value: 'oral', label: 'Prova oral' },
          { value: 'eliminacao', label: 'Eliminacao' },
        ],
      },
      {
        name: 'contestedItem',
        label: 'Item contestado',
        type: 'text',
        placeholder: 'Numero da questao, nota, fase ou decisao',
      },
      {
        name: 'appealDeadline',
        label: 'Prazo do recurso',
        type: 'date',
      },
      {
        name: 'bankDecision',
        label: 'Decisao ou gabarito da banca',
        type: 'textarea',
        placeholder: 'Alternativa da banca, nota, justificativa, indeferimento...',
      },
    ],
    keywords: ['recurso', 'revisao', 'questao', 'gabarito', 'nota', 'discursiva', 'taf', 'eliminacao'],
  },
  laudoParecer: {
    label: 'Laudo ou parecer',
    shortLabel: 'Laudo',
    icon: Scale,
    description:
      'Coleta estruturada para laudo, parecer tecnico-cientifico, nota tecnica ou relatorio preliminar.',
    intro:
      'Eu nao emito laudo sozinho. Vou organizar finalidade, documentos, prazo e perguntas tecnicas para a perita humana.',
    expectedDocs: ['Edital', 'Prova', 'Espelho', 'Decisao', 'Processo', 'Parecer anterior'],
    quickChecks: ['Finalidade', 'Uso do documento', 'Perguntas tecnicas'],
    fields: [
      {
        name: 'documentPurpose',
        label: 'Documento necessario',
        type: 'select',
        options: [
          { value: '', label: 'Selecione' },
          { value: 'laudo', label: 'Laudo tecnico' },
          { value: 'parecer', label: 'Parecer tecnico-cientifico' },
          { value: 'nota', label: 'Nota tecnica' },
          { value: 'relatorio', label: 'Relatorio preliminar' },
        ],
      },
      {
        name: 'documentUse',
        label: 'Finalidade',
        type: 'select',
        options: [
          { value: '', label: 'Selecione' },
          { value: 'administrativo', label: 'Recurso administrativo' },
          { value: 'judicial', label: 'Processo judicial' },
          { value: 'consulta', label: 'Consulta particular' },
        ],
      },
      {
        name: 'requestedBy',
        label: 'Quem solicitou',
        type: 'text',
        placeholder: 'Candidato, advogado, juizo, familiar...',
      },
      {
        name: 'technicalDeadline',
        label: 'Prazo',
        type: 'date',
      },
      {
        name: 'controversy',
        label: 'Fato controvertido',
        type: 'textarea',
        placeholder: 'Explique o que precisa ser analisado tecnicamente.',
      },
      {
        name: 'technicalQuestions',
        label: 'Perguntas a responder',
        type: 'textarea',
        placeholder: 'Liste os quesitos ou perguntas tecnicas.',
      },
    ],
    keywords: ['laudo', 'parecer', 'nota tecnica', 'relatorio', 'perita', 'cientifico'],
  },
  acaoBanca: {
    label: 'Acao contra banca',
    shortLabel: 'Acao',
    icon: Scale,
    description:
      'Triagem cautelosa para casos que podem exigir analise tecnica humana e avaliacao juridica.',
    intro:
      'Vou organizar o ocorrido sem afirmar direito liquido e certo, sem prometer resultado e sem substituir advogado.',
    expectedDocs: ['Edital', 'Recurso administrativo', 'Indeferimento', 'Protocolos', 'Prints', 'Provas'],
    quickChecks: ['Prejuizo concreto', 'Prazo aberto', 'Documentos comprobatarios'],
    fields: [
      {
        name: 'contestName',
        label: 'Concurso',
        type: 'text',
        placeholder: 'Nome do concurso',
      },
      {
        name: 'boardName',
        label: 'Banca',
        type: 'text',
        placeholder: 'Banca responsavel',
      },
      {
        name: 'examStage',
        label: 'Fase do concurso',
        type: 'text',
        placeholder: 'Inscricao, objetiva, discursiva, cota, PCD, TAF...',
      },
      {
        name: 'bankDecision',
        label: 'Decisao da banca',
        type: 'textarea',
        placeholder: 'O que a banca decidiu e quando?',
      },
      {
        name: 'administrativeAppeal',
        label: 'Ja houve recurso administrativo?',
        type: 'select',
        options: [
          { value: '', label: 'Selecione' },
          { value: 'sim_negado', label: 'Sim, foi negado' },
          { value: 'sim_pendente', label: 'Sim, esta pendente' },
          { value: 'nao', label: 'Nao' },
        ],
      },
      {
        name: 'legalDeadline',
        label: 'Prazo relevante',
        type: 'date',
      },
    ],
    keywords: ['acao', 'judicial', 'liminar', 'banca', 'indeferimento', 'eliminacao', 'advogado'],
  },
  peritaHumana: {
    label: 'Encaminhar a perita',
    shortLabel: 'Perita',
    icon: PhoneCall,
    description:
      'Preparacao do pacote interno para analise da especialista humana responsavel.',
    intro:
      'Vou montar o resumo do caso, linha do tempo, documentos, urgencia e proxima acao sugerida para a perita humana.',
    expectedDocs: ['Edital', 'Prova', 'Decisao', 'Protocolo', 'Documentos pessoais quando indispensaveis'],
    quickChecks: ['Tipo de demanda', 'Urgencia', 'Documentos faltantes'],
    fields: [
      {
        name: 'demandType',
        label: 'Tipo de demanda',
        type: 'select',
        options: [
          { value: '', label: 'Selecione' },
          { value: 'edital', label: 'Edital' },
          { value: 'recurso', label: 'Recurso' },
          { value: 'eliminacao', label: 'Eliminacao' },
          { value: 'laudo', label: 'Laudo ou parecer' },
          { value: 'judicial', label: 'Medida administrativa/judicial' },
        ],
      },
      {
        name: 'timeline',
        label: 'Linha do tempo',
        type: 'textarea',
        placeholder: 'Datas, decisao da banca, recurso, resposta e prazo atual.',
      },
      {
        name: 'candidateGoal',
        label: 'Objetivo do candidato',
        type: 'textarea',
        placeholder: 'O que voce precisa que seja analisado ou preparado?',
      },
      {
        name: 'missingDocs',
        label: 'Documentos que ainda faltam',
        type: 'textarea',
        placeholder: 'Liste o que ja tem e o que ainda nao conseguiu anexar.',
      },
    ],
    keywords: ['perita', 'especialista', 'analise humana', 'encaminhar', 'reuniao'],
  },
};

export const FAQS = [
  {
    question: 'O chat substitui advogado ou perita?',
    answer:
      'Nao. O assistente organiza informacoes, explica regras e prepara triagens. Casos com laudo, parecer, processo judicial ou documento assinado exigem analise humana.',
    keywords: ['substitui advogado', 'substitui perita', 'laudo sozinho'],
  },
  {
    question: 'Posso contestar uma questao?',
    answer:
      'Depende do edital, prazo, gabarito, bibliografia e fundamento tecnico. O chat pode organizar a minuta, mas nao promete anulacao nem resultado.',
    keywords: ['contestar questao', 'anular questao', 'recurso'],
  },
  {
    question: 'O que preciso para analisar edital?',
    answer:
      'Informe concurso, banca, cargo, formacao, objetivo da analise e duvida especifica. Se houver edital ou retificacao, anexe o arquivo.',
    keywords: ['analisar edital', 'entender edital', 'requisito do cargo'],
  },
];

export const BUDGET_HINTS = {
  edital: 'Analise inicial do edital pode ser feita pelo chat; revisao tecnica detalhada pode exigir atendimento humano.',
  planoEstudos: 'Plano de estudos basico e gratuito no MVP; acompanhamento individual pode virar atendimento especializado.',
  duvidasMateria: 'Duvidas simples podem ser resolvidas no fluxo; casos tecnicos sensiveis devem ser revisados por humano.',
  recursoRevisao: 'Recursos simples podem receber minuta inicial; discursiva, eliminacao e prova tecnica exigem revisao humana.',
  laudoParecer: 'Laudo e parecer dependem de especialista humana, documentos e finalidade de uso.',
  acaoBanca: 'Casos judiciais exigem avaliacao juridica; o chat apenas organiza a triagem tecnica.',
  peritaHumana: 'Encaminhamento humano usa o resumo, documentos, prazo e objetivo coletados no protocolo.',
};

export const BASE_FIELDS = [
  {
    name: 'clientName',
    label: 'Nome do candidato',
    type: 'text',
    placeholder: 'Nome completo',
  },
  {
    name: 'organization',
    label: 'Concurso ou orgao',
    type: 'text',
    placeholder: 'Opcional',
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
    label: 'Prioridade',
    type: 'select',
    options: [
      { value: 'auto', label: 'Detectar automaticamente' },
      { value: 'normal', label: 'Normal' },
      { value: 'urgent', label: 'Urgente' },
    ],
  },
  {
    name: 'objective',
    label: 'Relato inicial',
    type: 'textarea',
    placeholder: 'Conte o que aconteceu e o que voce precisa.',
  },
  {
    name: 'urgencyNote',
    label: 'Prazo ou urgencia',
    type: 'textarea',
    placeholder: 'Ex.: recurso vence hoje, prova amanha, prazo judicial aberto.',
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
  dataConsent: false,
};

export const INITIAL_MESSAGES = [
  {
    id: 'welcome-1',
    role: 'assistant',
    type: 'text',
    title: 'Assistente tecnico 24/7',
    text:
      'Primeira camada de triagem para concursos publicos: edital, estudos, duvidas, recursos, revisoes e preparacao de casos para perita humana.',
  },
  {
    id: 'welcome-2',
    role: 'assistant',
    type: 'text',
    title: 'Limites de seguranca',
    text:
      'Nao substituo advogado, nao assino laudo, nao prometo aprovacao, anulacao de questao ou vitoria judicial. Casos sensiveis seguem para analise humana.',
  },
];

export const WORKSPACE_TABS = [
  { id: 'dados', label: 'Ficha' },
  { id: 'documentos', label: 'Documentos' },
  { id: 'protocolo', label: 'Resumo' },
];

export const HERO_BADGES = [
  'Concursos publicos',
  'Triagem tecnica 24/7',
  'Perita humana como autoridade final',
];

export const TRUST_ITEMS = [
  {
    title: 'Resolve o basico',
    text: 'Interpreta edital, orienta estudo, explica prazos, etapas e documentos sem prometer resultado.',
  },
  {
    title: 'Organiza o complexo',
    text: 'Coleta prova, gabarito, espelho, decisao da banca, prazo e fundamento tecnico para revisao humana.',
  },
  {
    title: 'Encaminha com responsabilidade',
    text: 'Laudo, parecer, eliminacao controversa, cotas, PCD, TAF e acao contra banca seguem para especialista.',
  },
];

export const MOBILE_SHORTCUTS = [
  { label: 'Analisar edital', type: 'area', areaKey: 'edital' },
  { label: 'Plano de estudos', type: 'area', areaKey: 'planoEstudos' },
  { label: 'Recurso contra questao', type: 'area', areaKey: 'recursoRevisao' },
  { label: 'Laudo ou parecer', type: 'area', areaKey: 'laudoParecer' },
  {
    label: 'Prazo hoje',
    type: 'message',
    message: 'Tenho prazo vencendo hoje e preciso organizar um recurso ou analise tecnica.',
  },
];
