const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000/api').replace(/\/$/, '');
const ADMIN_TOKEN_KEY = 'mitsue-admin-token';

function isBrowser() {
  return typeof window !== 'undefined';
}

function getAdminToken() {
  if (!isBrowser()) {
    return '';
  }

  return window.localStorage.getItem(ADMIN_TOKEN_KEY) || '';
}

function setAdminToken(token) {
  if (!isBrowser()) {
    return;
  }

  if (token) {
    window.localStorage.setItem(ADMIN_TOKEN_KEY, token);
    return;
  }

  window.localStorage.removeItem(ADMIN_TOKEN_KEY);
}

async function request(path, options = {}) {
  const isFormData = options.body instanceof FormData;
  const headers = {
    Accept: 'application/json',
    ...(options.body && !isFormData ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(payload.message || 'Nao foi possivel concluir a solicitacao.');
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

function adminHeaders() {
  const token = getAdminToken();

  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function hasAdminSession() {
  return Boolean(getAdminToken());
}

export async function askAssistant(message, area, history = []) {
  return request('/assistant/chat', {
    method: 'POST',
    body: JSON.stringify({ message, area, history }),
  });
}

function buildTicketFormData(data, files = []) {
  const formData = new FormData();

  Object.entries(data).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      formData.append(key, value);
    }
  });

  files.forEach((file) => {
    formData.append('attachments[]', file);
  });

  return formData;
}

export async function createTicket(data, files = []) {
  if (files.length) {
    return request('/tickets', {
      method: 'POST',
      body: buildTicketFormData(data, files),
    });
  }

  return request('/tickets', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function lookupTicket(protocol, email) {
  const params = new URLSearchParams({ protocol, email });
  return request(`/tickets/lookup?${params.toString()}`);
}

export async function sendTicketMessage(protocol, email, message) {
  return request(`/tickets/${encodeURIComponent(protocol)}/messages`, {
    method: 'POST',
    body: JSON.stringify({ email, message }),
  });
}

export async function uploadTicketAttachments(protocol, email, files = []) {
  const formData = new FormData();
  formData.append('email', email);
  files.forEach((file) => {
    formData.append('attachments[]', file);
  });

  return request(`/tickets/${encodeURIComponent(protocol)}/attachments`, {
    method: 'POST',
    body: formData,
  });
}

export async function sendTicketFeedback(protocol, email, feedback) {
  return request(`/tickets/${encodeURIComponent(protocol)}/feedback`, {
    method: 'POST',
    body: JSON.stringify({ email, ...feedback }),
  });
}

export async function adminLogin(email, password) {
  const payload = await request('/admin/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

  setAdminToken(payload.token);
  return payload;
}

export async function adminLogout() {
  try {
    return await request('/admin/logout', {
      method: 'POST',
      headers: adminHeaders(),
    });
  } finally {
    setAdminToken('');
  }
}

export async function adminListTickets(filters = {}) {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, value);
    }
  });

  const query = params.toString();
  return request(`/admin/tickets${query ? `?${query}` : ''}`, {
    headers: adminHeaders(),
  });
}

export async function adminGetTicket(id) {
  return request(`/admin/tickets/${id}`, {
    headers: adminHeaders(),
  });
}

export async function adminSendMessage(id, message) {
  return request(`/admin/tickets/${id}/messages`, {
    method: 'POST',
    headers: adminHeaders(),
    body: JSON.stringify({ message }),
  });
}

export async function adminUpdateStatus(id, status) {
  return request(`/admin/tickets/${id}/status`, {
    method: 'PATCH',
    headers: adminHeaders(),
    body: JSON.stringify({ status }),
  });
}

export async function adminDownloadAttachment(attachment) {
  const response = await fetch(`${API_URL}/admin/attachments/${attachment.id}/download`, {
    headers: adminHeaders(),
  });

  if (!response.ok) {
    throw new Error('Nao foi possivel baixar o anexo.');
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = attachment.original_name || 'anexo';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
