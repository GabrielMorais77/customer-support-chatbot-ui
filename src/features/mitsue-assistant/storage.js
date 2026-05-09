const HISTORY_STORAGE_KEY = 'mitsue-assistant-history-v2';
const LEGACY_HISTORY_STORAGE_KEY = 'mitsue-assistant-history-v1';
const DRAFT_STORAGE_KEY = 'mitsue-assistant-draft-v2';

function isBrowser() {
  return typeof window !== 'undefined';
}

function safeParse(rawValue, fallback) {
  if (!rawValue) {
    return fallback;
  }

  try {
    return JSON.parse(rawValue);
  } catch {
    return fallback;
  }
}

export function loadHistory() {
  if (!isBrowser()) {
    return [];
  }

  const current = safeParse(window.localStorage.getItem(HISTORY_STORAGE_KEY), null);
  if (Array.isArray(current)) {
    return current;
  }

  const legacy = safeParse(window.localStorage.getItem(LEGACY_HISTORY_STORAGE_KEY), []);
  return Array.isArray(legacy) ? legacy : [];
}

export function saveHistory(records) {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(records));
}

export function loadDraft() {
  if (!isBrowser()) {
    return null;
  }

  return safeParse(window.localStorage.getItem(DRAFT_STORAGE_KEY), null);
}

export function saveDraft(draftState) {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draftState));
}

export function clearDraft() {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.removeItem(DRAFT_STORAGE_KEY);
}
