const READABLE_TEXT_EXTENSIONS = ['txt', 'md', 'json', 'csv', 'xml', 'html'];

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
  if (!value) {
    return 'Nao informado';
  }

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function formatShortDate(value) {
  if (!value) {
    return 'Nao informado';
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
  if (name.includes('retific')) return 'Retificacao';
  if (name.includes('prova') || name.includes('caderno')) return 'Caderno de prova';
  if (name.includes('gabarito')) return 'Gabarito';
  if (name.includes('espelho') || name.includes('correcao')) return 'Espelho de correcao';
  if (name.includes('recurso')) return 'Recurso administrativo';
  if (name.includes('indefer') || name.includes('decisao') || name.includes('resultado')) return 'Decisao da banca';
  if (name.includes('taf')) return 'TAF';
  if (name.includes('hetero') || name.includes('cota') || name.includes('ppp')) return 'Cotas / heteroidentificacao';
  if (name.includes('pcd') || name.includes('pericia medica')) return 'PCD / pericia medica';
  if (name.includes('laudo')) return 'Laudo';
  if (name.includes('parecer')) return 'Parecer tecnico';
  if (name.includes('process')) return 'Processo judicial';
  if (name.includes('print') || name.includes('protocolo')) return 'Protocolo / print';
  if (name.includes('documento') || name.includes('rg') || name.includes('cpf')) return 'Documento pessoal';

  return 'Documento complementar';
}

export function canReadFilePreview(file) {
  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  return READABLE_TEXT_EXTENSIONS.includes(extension) || file.type.startsWith('text/');
}
