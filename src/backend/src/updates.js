// Aviso diário de atualizações disponíveis: varre o snapshot de saúde (health_json)
// dos serviços e envia UMA notificação listando os apps desatualizados.
// Mensagem própria (independente do digest de faltantes), no horário configurado.

import { db } from './db.js';
import { getSettings } from './settings.js';
import { emitEvent } from './emit.js';

const selectAll = db.prepare('SELECT name, type, version, health_json FROM services');

const TYPE_LABEL = { radarr: 'Radarr', sonarr: 'Sonarr', prowlarr: 'Prowlarr', jellyfin: 'Jellyfin', qbittorrent: 'qBittorrent' };

// Serviços com update disponível, a partir do health_json persistido pelo poller.
export function listOutdated() {
  const out = [];
  for (const svc of selectAll.all()) {
    if (!svc.health_json) continue;
    let h;
    try { h = JSON.parse(svc.health_json); } catch { continue; }
    if (h?.update?.available) {
      out.push({ name: svc.name, type: svc.type, current: svc.version || null, target: h.update.version || null });
    }
  }
  return out;
}

export function buildUpdatesEvent(outdated) {
  const n = outdated.length;
  const lines = outdated.map((s) => {
    const label = TYPE_LABEL[s.type] || s.type;
    const ver = s.target ? ` → v${s.target}` : '';
    return `${s.name} (${label})${ver}`;
  });
  return {
    type: 'update_digest',
    severity: 'info',
    title: `${n} ${n === 1 ? 'atualização disponível' : 'atualizações disponíveis'}`,
    message: lines.join(' · '),
  };
}

// Roda o aviso agora. Se não houver nada desatualizado, não emite (evita poluir).
export async function runUpdates() {
  const outdated = listOutdated();
  if (!outdated.length) return { count: 0, title: 'Tudo atualizado', message: '', pushed: false };
  const ev = buildUpdatesEvent(outdated);
  const { pushed } = await emitEvent(ev);
  return { count: outdated.length, title: ev.title, message: ev.message, pushed };
}

let lastDate = null;

function tick() {
  const s = getSettings();
  if (!s.notify_updates) return;
  const now = new Date();
  const hm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const today = now.toISOString().slice(0, 10);
  if (hm === s.updates_time && lastDate !== today) {
    lastDate = today;
    runUpdates().catch((e) => console.error('[ArrPulse] aviso de updates falhou:', e.message));
  }
}

export function startUpdatesScheduler() {
  return setInterval(tick, 30000); // verifica a cada 30s; dispara 1x quando bater o horário
}
