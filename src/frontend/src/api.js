const TOKEN_KEY = 'arrpulse_token';

export function getToken() {
  try { return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY); } catch { return null; }
}
export function setToken(token, remember) {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_KEY);
    (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, token);
  } catch { /* storage indisponível */ }
}
export function clearToken() {
  try { sessionStorage.removeItem(TOKEN_KEY); localStorage.removeItem(TOKEN_KEY); } catch { /* */ }
}

const jsonHeaders = { 'Content-Type': 'application/json' };

function authHeaders(extra = {}) {
  const t = getToken();
  return t ? { ...extra, Authorization: `Bearer ${t}` } : { ...extra };
}

async function asJson(r) {
  if (r.status === 204) return null;
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
  return data;
}

async function req(path, opts = {}) {
  const res = await fetch(path, { ...opts, headers: authHeaders(opts.headers) });
  if (res.status === 401) {
    clearToken();
    window.dispatchEvent(new Event('arrpulse:unauth'));
    throw new Error('não autenticado');
  }
  return asJson(res);
}

const post = (path, body) => req(path, { method: 'POST', headers: jsonHeaders, body: JSON.stringify(body || {}) });

// --- Auth ---
export const authStatus = () => fetch('/api/auth/status').then((r) => r.json());
export const authMe = () => req('/api/auth/me');
export async function authLogin(username, password, remember) {
  const s = await post('/api/auth/login', { username, password, remember });
  setToken(s.token, remember);
  return s;
}
export async function authSetup(username, password) {
  const s = await post('/api/auth/setup', { username, password });
  setToken(s.token, true);
  return s;
}
export const authChange = (body) => post('/api/auth/change', body);
export const logout = () => clearToken();

// --- Serviços ---
export const listServices = () => req('/api/services');
export const testService = (body) => post('/api/services/test', body);
export const addService = (body) => post('/api/services', body);
export const updateService = (id, body) => req(`/api/services/${id}`, { method: 'PUT', headers: jsonHeaders, body: JSON.stringify(body) });
export const deleteService = (id) => req(`/api/services/${id}`, { method: 'DELETE' });
export const refreshService = (id) => post(`/api/services/${id}/refresh`);

// --- Eventos / stats / settings ---
export function listEvents({ limit = 50, severity, type, search, days } = {}) {
  const p = new URLSearchParams({ limit });
  if (severity) p.set('severity', severity);
  if (type) p.set('type', type);
  if (search) p.set('search', search);
  if (days) p.set('days', days);
  return req(`/api/events?${p}`);
}
export const clearEvents = () => req('/api/events', { method: 'DELETE' });
export const getStats = () => req('/api/stats');
export const getSettings = () => req('/api/settings');
export const saveSettings = (body) => req('/api/settings', { method: 'PUT', headers: jsonHeaders, body: JSON.stringify(body) });
export const testPush = () => post('/api/notify/test');
export const testDigest = () => post('/api/digest/test');
export const testUpdates = () => post('/api/updates/test');

// SQLite grava "YYYY-MM-DD HH:MM:SS" em UTC (sem fuso); normaliza p/ UTC.
function toDate(ts) {
  const s = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(ts) ? `${ts.replace(' ', 'T')}Z` : ts;
  return new Date(s);
}

export function since(iso) {
  if (!iso) return '—';
  const ms = Date.now() - toDate(iso).getTime();
  if (ms < 0) return '0s';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

export function ago(iso) {
  if (!iso) return 'nunca';
  return `há ${since(iso)}`;
}
