import { db } from './db.js';
import { decrypt } from './crypto.js';
import { probe, statusFromProbe } from './connectors/index.js';
import { getSettings } from './settings.js';
import { emitEvent } from './emit.js';

const selectAll = db.prepare('SELECT * FROM services');
const update = db.prepare(`
  UPDATE services
  SET status = ?, status_since = ?, last_check = ?, last_error = ?, version = ?, health_json = ?
  WHERE id = ?
`);

// contagem de torrents travados por serviço (em memória), p/ detectar transições
const lastStuck = new Map();
// hashes de torrents já vistos concluídos por serviço (em memória), p/ notificar só os novos
const qbitDone = new Map();

// Resume os motivos reais de degradação numa frase curta (p/ last_error e push).
function summarizeIssues(issues) {
  const msgs = (issues || []).map((i) => i.message).filter(Boolean);
  if (!msgs.length) return null;
  const head = msgs.slice(0, 2).join(' · ');
  return msgs.length > 2 ? `${head} · +${msgs.length - 2}` : head;
}

// falhas consecutivas por serviço (em memória), p/ debounce do status "down"
const failStreak = new Map();
// só marca "down" depois de N verificações seguidas falhando (evita alarme por soluço de 1 poll)
const FAIL_THRESHOLD = 2;

function buildTransitionEvent(svc, newStatus, detail) {
  if (newStatus === 'down') {
    return { type: 'status_change', service_id: svc.id, service_name: svc.name, service_type: svc.type,
      severity: 'critical', title: `${svc.name} ficou fora`, message: detail || 'inacessível' };
  }
  if (newStatus === 'degraded') {
    return { type: 'status_change', service_id: svc.id, service_name: svc.name, service_type: svc.type,
      severity: 'warning', title: `${svc.name} degradado`, message: detail || 'alertas de saúde' };
  }
  return { type: 'status_change', service_id: svc.id, service_name: svc.name, service_type: svc.type,
    severity: 'info', title: `${svc.name} voltou ao normal`, message: 'serviço saudável', prev_status: svc.status };
}

export async function checkService(svc) {
  const apiKey = svc.api_key_enc ? decrypt(svc.api_key_enc) : null;
  const password = svc.password_enc ? decrypt(svc.password_enc) : null;
  const p = await probe({
    type: svc.type,
    base_url: svc.base_url,
    api_key: apiKey,
    username: svc.username,
    password,
    timeout_ms: svc.timeout_ms,
  });
  const rawStatus = statusFromProbe(p);
  const now = new Date().toISOString();

  // Debounce: uma única falha não derruba o serviço. Só confirma "down" após
  // FAIL_THRESHOLD verificações seguidas falhando; antes disso mantém o status anterior.
  let status = rawStatus;
  if (rawStatus === 'down') {
    const streak = (failStreak.get(svc.id) || 0) + 1;
    failStreak.set(svc.id, streak);
    const wasUp = svc.status === 'up' || svc.status === 'degraded';
    if (streak < FAIL_THRESHOLD && wasUp) {
      status = svc.status; // segura a queda — provável soluço transitório
    }
  } else {
    failStreak.delete(svc.id);
  }
  const held = status !== rawStatus; // falha engolida pelo debounce neste ciclo

  // status_since só reinicia quando o status muda
  const statusSince = svc.status === status && svc.status_since ? svc.status_since : now;

  const issuesSummary = p.ok ? summarizeIssues(p.issues) : null;
  let lastError = null;
  if (status === 'down') lastError = p.error || 'falha';
  else if (status === 'degraded') lastError = issuesSummary || 'alertas de saúde';
  else if (held) lastError = svc.last_error || null; // mantém o erro anterior (não cria alarme)

  // snapshot do /health p/ a UI (selo de update + lista de motivos do degradado)
  const healthJson = p.ok ? JSON.stringify({ issues: p.issues || [], update: p.update || null }) : svc.health_json || null;

  const version = p.version || svc.version || null;
  update.run(status, statusSince, now, lastError, version, healthJson, svc.id);

  // Emite evento + push apenas na transição de status
  const changed = svc.status !== status;
  const firstSeenUp = svc.status === 'unknown' && status === 'up'; // baseline silencioso
  if (changed && !firstSeenUp) {
    const detail = status === 'up' ? 'serviço saudável' : lastError;
    await emitEvent(buildTransitionEvent(svc, status, detail));
  }

  // qBittorrent: torrents travados (erro / arquivos ausentes / estagnado) — só nas transições
  if (svc.type === 'qbittorrent' && p.ok && p.stuck && getSettings().qbit_stuck_enabled) {
    const prev = lastStuck.get(svc.id) || 0;
    const cur = p.stuck.count;
    let ev = null;
    if (cur > 0 && prev === 0) {
      const names = p.stuck.names?.length ? ` (${p.stuck.names.join(', ')}${cur > p.stuck.names.length ? '…' : ''})` : '';
      ev = { type: 'qbit_stuck', service_id: svc.id, service_name: svc.name, service_type: svc.type,
        severity: 'warning', title: `${svc.name}: ${cur} torrent(s) travado(s)`, message: `erro / sem progresso${names}` };
    } else if (cur === 0 && prev > 0) {
      ev = { type: 'qbit_stuck', service_id: svc.id, service_name: svc.name, service_type: svc.type,
        severity: 'info', title: `${svc.name}: torrents normalizados`, message: 'nenhum torrent travado' };
    }
    if (ev) await emitEvent(ev);
    lastStuck.set(svc.id, cur);
  }

  // qBittorrent: downloads concluídos — 1 resumo por ciclo, só dos novos desde a última passagem
  if (svc.type === 'qbittorrent' && p.ok && Array.isArray(p.completed) && getSettings().qbit_done_enabled) {
    const seen = qbitDone.get(svc.id);
    if (!seen) {
      // baseline silencioso: ao ligar/reiniciar não notifica o que já estava concluído
      qbitDone.set(svc.id, new Set(p.completed.map((t) => t.hash)));
    } else {
      const fresh = p.completed.filter((t) => !seen.has(t.hash));
      for (const t of fresh) seen.add(t.hash);
      if (fresh.length) {
        const n = fresh.length;
        const names = fresh.slice(0, 3).map((t) => t.name).join(', ');
        const more = n > 3 ? '…' : '';
        await emitEvent({
          type: 'qbit_done', service_id: svc.id, service_name: svc.name, service_type: svc.type,
          severity: 'info', title: `${svc.name}: ${n} download${n > 1 ? 's' : ''} concluído${n > 1 ? 's' : ''}`,
          message: names ? `${names}${more}` : 'download concluído',
        });
      }
    }
  }

  return { ...svc, status, status_since: statusSince, last_check: now, last_error: lastError, version };
}

export async function pollAll() {
  for (const svc of selectAll.all()) {
    try {
      await checkService(svc);
    } catch (e) {
      console.error(`[arr-watch] erro ao verificar serviço ${svc.id} (${svc.name}):`, e.message);
    }
  }
}

export function startPoller(intervalSec) {
  pollAll();
  return setInterval(pollAll, Math.max(15, intervalSec) * 1000);
}
