import { getSettings } from './settings.js';
import { listDeferred, clearDeferred } from './events.js';

const PRIORITY = { critical: 'high', warning: 'default', info: 'default' };
const SEV_RANK = { info: 0, warning: 1, critical: 2 };
const TAGS = { critical: 'rotating_light', warning: 'warning', info: 'white_check_mark' };
const DISCORD_COLOR = { critical: 0xdc2626, warning: 0xd97706, info: 0x16a34a };

// Cabeçalhos HTTP só aceitam ASCII — limpa acentos/emoji do título (usado no ntfy)
function asciiSafe(s) {
  return (s || '').normalize('NFKD').replace(/[^\x20-\x7E]/g, '').trim();
}

async function httpPost(url, { headers = {}, body, timeout = 6000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, { method: 'POST', headers, body, signal: ctrl.signal });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.name === 'AbortError' ? 'timeout' : (e.message || 'erro de rede') };
  } finally {
    clearTimeout(t);
  }
}

function parseHM(v) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(v || '').trim());
  if (!m) return null;
  const h = Number(m[1]); const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

// Está dentro do horário silencioso? (usa o fuso do container — defina TZ no compose)
export function isQuietNow(s, now = new Date()) {
  if (!s.quiet_enabled) return false;
  const start = parseHM(s.quiet_start);
  const end = parseHM(s.quiet_end);
  if (start == null || end == null || start === end) return false;
  const cur = now.getHours() * 60 + now.getMinutes();
  return start < end ? (cur >= start && cur < end) : (cur >= start || cur < end);
}

async function postNtfy(s, { title, message, severity }) {
  if (!s.ntfy_url || !s.ntfy_topic) return { ok: false, error: 'ntfy não configurado (URL/tópico)' };
  const headers = { Title: asciiSafe(title) || 'ArrPulse' };
  const pr = PRIORITY[severity]; if (pr) headers.Priority = pr;
  const tg = TAGS[severity]; if (tg) headers.Tags = tg;
  if (s.ntfy_token) headers.Authorization = `Bearer ${s.ntfy_token}`;
  return httpPost(`${s.ntfy_url}/${s.ntfy_topic}`, { headers, body: message || '' });
}

async function postDiscord(s, { title, message, severity }) {
  if (!s.discord_webhook_url) return { ok: false, error: 'webhook do Discord não configurado' };
  const body = JSON.stringify({
    username: 'ArrPulse',
    embeds: [{ title: title || 'ArrPulse', description: message || '', color: DISCORD_COLOR[severity] ?? 0x1f4e5f }],
  });
  return httpPost(s.discord_webhook_url, { headers: { 'Content-Type': 'application/json' }, body });
}

async function postTelegram(s, { title, message }) {
  if (!s.telegram_bot_token || !s.telegram_chat_id) return { ok: false, error: 'Telegram não configurado (token/chat id)' };
  const url = `https://api.telegram.org/bot${s.telegram_bot_token}/sendMessage`;
  const text = `${title || 'ArrPulse'}\n${message || ''}`.trim();
  const body = JSON.stringify({ chat_id: s.telegram_chat_id, text, disable_web_page_preview: true });
  return httpPost(url, { headers: { 'Content-Type': 'application/json' }, body });
}

async function sendTo(channels, s, payload) {
  const results = [];
  for (const c of channels) {
    if (c === 'ntfy') results.push({ channel: 'ntfy', ...(await postNtfy(s, payload)) });
    else if (c === 'discord') results.push({ channel: 'discord', ...(await postDiscord(s, payload)) });
    else if (c === 'telegram') results.push({ channel: 'telegram', ...(await postTelegram(s, payload)) });
  }
  return results;
}

// Canais habilitados para eventos automáticos (o push_enabled mestre é checado pelo chamador)
function enabledChannels(s) {
  const ch = [];
  if (s.ntfy_url && s.ntfy_topic) ch.push('ntfy');
  if (s.discord_enabled && s.discord_webhook_url) ch.push('discord');
  if (s.telegram_enabled && s.telegram_bot_token && s.telegram_chat_id) ch.push('telegram');
  return ch;
}

// Canais configurados (para o teste manual — ignora habilitado/quiet)
function configuredChannels(s) {
  const ch = [];
  if (s.ntfy_url && s.ntfy_topic) ch.push('ntfy');
  if (s.discord_webhook_url) ch.push('discord');
  if (s.telegram_bot_token && s.telegram_chat_id) ch.push('telegram');
  return ch;
}

export async function pushEvent(ev) {
  const s = getSettings();
  const payload = { title: ev.title || 'ArrPulse', message: ev.message || ev.title || '', severity: ev.severity };

  // notify_degraded governa SÓ o status degradado do serviço (status_change).
  // Alertas de import (idioma/ação manual/health) e qBit têm seus próprios toggles.
  if (ev.type === 'status_change' && !s.notify_degraded) {
    if (ev.severity === 'warning') return { ok: true, skipped: 'degraded_muted', results: [] };
    // recuperação de degradação só alerta se notify_degraded estiver ligado
    if (ev.severity === 'info' && ev.prev_status === 'degraded') {
      return { ok: true, skipped: 'degraded_muted', results: [] };
    }
  }

  if (isQuietNow(s)) {
    const allowed = ev.severity === 'critical' && s.quiet_allow_critical;
    if (!allowed) {
      // Com a fila ligada, represa o evento p/ entregar em lote ao fim do silêncio.
      if (s.quiet_queue) return { ok: false, deferred: true, skipped: 'quiet_hours' };
      return { ok: true, skipped: 'quiet_hours', results: [] };
    }
  }

  const results = await sendTo(enabledChannels(s), s, payload);
  return { ok: results.length === 0 ? false : results.every((r) => r.ok), results };
}

// Entrega, num único resumo, os eventos represados durante o silêncio.
// Em caso de falha de envio, mantém os eventos represados para nova tentativa.
export async function flushQuietQueue() {
  const s = getSettings();
  if (!s.push_enabled) return { ok: false, skipped: 'push_off', flushed: 0 };
  const pending = listDeferred();
  if (!pending.length) return { ok: true, flushed: 0 };

  let maxSev = 'info';
  for (const e of pending) if (SEV_RANK[e.severity] > SEV_RANK[maxSev]) maxSev = e.severity;

  const n = pending.length;
  const MAX_LINES = 20;
  const lines = pending.slice(0, MAX_LINES).map((e) => `• ${e.title || 'evento'}`);
  if (n > MAX_LINES) lines.push(`… e mais ${n - MAX_LINES}`);

  const payload = {
    title: `${n} ${n === 1 ? 'aviso acumulado' : 'avisos acumulados'} no silêncio`,
    message: lines.join('\n'),
    severity: maxSev,
  };

  const channels = enabledChannels(s);
  const results = await sendTo(channels, s, payload);
  // Basta UM canal entregar para descarregar a fila. Reter os eventos porque um canal
  // secundário falhou (ex.: ntfy offline) faz o flush repetir a cada tick e spammar os
  // canais que já receberam. Só re-tenta quando NADA foi entregue; sem canais habilitados
  // também limpa, p/ não deixar eventos órfãos presos para sempre.
  const deliveredAny = results.some((r) => r.ok);
  if (deliveredAny || channels.length === 0) clearDeferred();
  return { ok: deliveredAny, flushed: deliveredAny ? n : 0, results };
}

// Verifica a cada 30s; assim que sair do silêncio, descarrega os eventos represados.
// Não checa quiet_queue aqui: o toggle só decide se NOVOS eventos são represados;
// o que já está pendente deve ser entregue (evita órfãos se a fila for desligada no meio).
function quietTick() {
  const s = getSettings();
  if (!s.push_enabled || isQuietNow(s)) return;
  flushQuietQueue().catch((e) => console.error('[ArrPulse] flush do silêncio falhou:', e.message));
}

export function startQuietScheduler() {
  return setInterval(quietTick, 30000);
}

export async function pushTest() {
  const s = getSettings();
  const channels = configuredChannels(s);
  if (!channels.length) return { ok: false, error: 'nenhum canal configurado', results: [] };
  const payload = { title: 'ArrPulse', message: 'Notificacao de teste OK', severity: 'info' };
  const results = await sendTo(channels, s, payload);
  return { ok: results.every((r) => r.ok), results };
}
