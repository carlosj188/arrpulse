// Conectores de serviço.
// Fase 1: Radarr/Sonarr/Prowlarr (Servarr), Jellyfin e qBittorrent.

const SERVARR = {
  radarr: { apiBase: '/api/v3' },
  sonarr: { apiBase: '/api/v3' },
  prowlarr: { apiBase: '/api/v1' },
};

// estados de torrent considerados "travados" no qBittorrent
const STUCK_STATES = new Set(['error', 'missingFiles', 'stalledDL']);
// estados que indicam download concluído (seeding / parado após completar)
const DONE_STATES = new Set(['uploading', 'stalledUP', 'pausedUP', 'forcedUP', 'queuedUP', 'checkingUP']);

// "New update is available: 5.14.0.9383" -> "5.14.0.9383" (best-effort)
function updateVersion(msg) {
  const m = /(\d+(?:\.\d+){1,3})/.exec(String(msg || ''));
  return m ? m[1] : null;
}
// uma issue do /health é "update disponível" (informativa), não degradação
function isUpdateIssue(i) {
  return i?.source === 'UpdateCheck' || /update is available/i.test(i?.message || '');
}

// timeout padrão por tipo (ms). qBittorrent tem WebUI mais lenta sob carga de disco/IO.
const DEFAULT_TIMEOUT = { qbittorrent: 12000 };
const FALLBACK_TIMEOUT = 6000;
function resolveTimeout(type, t) {
  const n = Number(t);
  if (Number.isFinite(n) && n > 0) return n;
  return DEFAULT_TIMEOUT[type] || FALLBACK_TIMEOUT;
}

async function timedFetch(url, opts = {}, timeoutMs = FALLBACK_TIMEOUT) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...opts, signal: ctrl.signal });
    return { res };
  } catch (e) {
    return { error: e.name === 'AbortError' ? 'timeout' : (e.message || 'erro de rede') };
  } finally {
    clearTimeout(t);
  }
}

async function fetchJson(url, headers = {}, timeoutMs) {
  const { res, error } = await timedFetch(url, { headers }, timeoutMs);
  if (error) return { ok: false, error };
  if (!res.ok) return { ok: false, status: res.status };
  try {
    return { ok: true, status: res.status, json: await res.json() };
  } catch {
    return { ok: true, status: res.status, json: null };
  }
}

// --- Servarr (Radarr / Sonarr / Prowlarr) ---
export async function probeServarr(type, baseUrl, apiKey, timeoutMs) {
  const cfg = SERVARR[type];
  const url = baseUrl.replace(/\/+$/, '');
  const headers = { 'X-Api-Key': apiKey || '' };

  const status = await fetchJson(`${url}${cfg.apiBase}/system/status`, headers, timeoutMs);
  if (!status.ok) {
    let error;
    if (status.status === 401) error = 'API key inválida (401)';
    else if (status.status) error = `HTTP ${status.status}`;
    else error = status.error || 'inacessível';
    return { ok: false, error };
  }
  const health = await fetchJson(`${url}${cfg.apiBase}/health`, headers, timeoutMs);
  const all = Array.isArray(health.json) ? health.json : [];
  // separa "update disponível" (informativo, não degrada) dos alertas reais de saúde
  const updateIssue = all.find(isUpdateIssue);
  const issues = all.filter((i) => !isUpdateIssue(i));
  const update = updateIssue
    ? { available: true, version: updateVersion(updateIssue.message) }
    : { available: false };
  return { ok: true, version: status.json?.version || null, instanceName: status.json?.instanceName || null, issues, update };
}

// --- Jellyfin (up/down via endpoint público; sem necessidade de key) ---
export async function probeJellyfin(baseUrl, timeoutMs) {
  const url = baseUrl.replace(/\/+$/, '');
  const r = await fetchJson(`${url}/System/Info/Public`, {}, timeoutMs);
  if (!r.ok) return { ok: false, error: r.status ? `HTTP ${r.status}` : (r.error || 'inacessível') };
  return { ok: true, version: r.json?.Version || null, instanceName: r.json?.ServerName || null, issues: [] };
}

// --- qBittorrent (sessão por cookie; ou IP liberado na whitelist) ---
export async function probeQbit(baseUrl, username, password, timeoutMs) {
  const url = baseUrl.replace(/\/+$/, '');
  let cookie = null;

  if (username) {
    const body = new URLSearchParams({ username, password: password || '' });
    const { res, error } = await timedFetch(`${url}/api/v2/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Referer: url },
      body,
    }, timeoutMs);
    if (error) return { ok: false, error };
    if (res.status === 403) return { ok: false, error: 'acesso negado (403) — verifique IP/host no qBit' };
    const text = (await res.text()).trim();
    // qBit < 5.2 responde 200 "Ok."/"Fails."; qBit >= 5.2 responde 204 vazio no sucesso
    if (!res.ok || text === 'Fails.') return { ok: false, error: 'login falhou (usuário/senha)' };
    // encaminha qualquer cookie de sessão (SID= antigo ou QBT_SID_<porta>= a partir do 5.2)
    const setCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    cookie = setCookies.map((c) => c.split(';')[0].trim()).filter(Boolean).join('; ') || null;
  }

  const headers = { Referer: url };
  if (cookie) headers.Cookie = cookie;
  const { res, error } = await timedFetch(`${url}/api/v2/app/version`, { headers }, timeoutMs);
  if (error) return { ok: false, error };
  if (res.status === 403) return { ok: false, error: 'sem acesso — defina usuário/senha ou libere o IP no qBit' };
  if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
  const version = (await res.text()).trim().replace(/^v/, '');

  // torrents travados (erro / ausentes / estagnado) + concluídos (progress 1 ou estado de seed)
  let stuck = null;
  let completed = null;
  const ti = await timedFetch(`${url}/api/v2/torrents/info`, { headers }, timeoutMs);
  if (ti.res && ti.res.ok) {
    try {
      const list = await ti.res.json();
      const arr = Array.isArray(list) ? list : [];
      const bad = arr.filter((t) => STUCK_STATES.has(t.state));
      stuck = { count: bad.length, names: bad.slice(0, 3).map((t) => t.name) };
      const done = arr.filter((t) => t.progress === 1 || DONE_STATES.has(t.state));
      completed = done.map((t) => ({ hash: t.hash, name: t.name }));
    } catch { /* ignora corpo inválido */ }
  }

  return { ok: true, version, issues: [], stuck, completed };
}

export async function probe({ type, base_url, api_key, username, password, timeout_ms }) {
  const to = resolveTimeout(type, timeout_ms);
  if (SERVARR[type]) return probeServarr(type, base_url, api_key, to);
  if (type === 'jellyfin') return probeJellyfin(base_url, to);
  if (type === 'qbittorrent') return probeQbit(base_url, username, password, to);
  return { ok: false, error: `tipo desconhecido: ${type}` };
}

// Timeout efetivo (default por tipo se não houver override). Exposto p/ a UI exibir o valor real.
export function effectiveTimeout(type, t) {
  return resolveTimeout(type, t);
}

export function statusFromProbe(p) {
  if (!p.ok) return 'down';
  return p.issues && p.issues.length > 0 ? 'degraded' : 'up';
}

// Conta itens faltantes (wanted/missing) no Radarr/Sonarr — para o digest diário.
export async function fetchMissing(type, baseUrl, apiKey) {
  if (type !== 'radarr' && type !== 'sonarr') return { ok: false, error: 'tipo sem wanted/missing' };
  const url = baseUrl.replace(/\/+$/, '');
  const r = await fetchJson(`${url}/api/v3/wanted/missing?page=1&pageSize=1&monitored=true`, { 'X-Api-Key': apiKey || '' });
  if (!r.ok) {
    if (r.status === 401) return { ok: false, error: 'API key inválida (401)' };
    return { ok: false, error: r.status ? `HTTP ${r.status}` : (r.error || 'inacessível') };
  }
  return { ok: true, count: Number(r.json?.totalRecords || 0) };
}
