const DRAFT_STORAGE_KEY = 'mitsue-assistant-draft-v2';
const LAST_LOOKUP_STORAGE_KEY = 'mitsue-assistant-last-lookup-v1';

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

export function loadLastLookup() {
  if (!isBrowser()) {
    return { protocol: '', email: '' };
  }

  return safeParse(window.localStorage.getItem(LAST_LOOKUP_STORAGE_KEY), { protocol: '', email: '' });
}

export function saveLastLookup(value) {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.setItem(LAST_LOOKUP_STORAGE_KEY, JSON.stringify(value));
}
