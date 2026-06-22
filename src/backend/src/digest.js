// Digest diário de faltantes: conta wanted/missing do Radarr/Sonarr e envia
// UMA notificação no horário configurado (ou sob demanda via /api/digest/test).

import { db } from './db.js';
import { decrypt } from './crypto.js';
import { fetchMissing } from './connectors/index.js';
import { getSettings } from './settings.js';
import { emitEvent } from './emit.js';

const selectArr = db.prepare("SELECT * FROM services WHERE type IN ('radarr','sonarr')");

export async function buildDigest() {
  const rows = selectArr.all();
  let totalMovies = 0;
  let totalEps = 0;
  const perService = [];
  for (const svc of rows) {
    const apiKey = svc.api_key_enc ? decrypt(svc.api_key_enc) : null;
    const r = await fetchMissing(svc.type, svc.base_url, apiKey);
    if (r.ok) {
      perService.push({ name: svc.name, type: svc.type, count: r.count });
      if (svc.type === 'radarr') totalMovies += r.count; else totalEps += r.count;
    } else {
      perService.push({ name: svc.name, type: svc.type, error: r.error });
    }
  }
  return { totalMovies, totalEps, perService, services: rows.length };
}

export function buildDigestEvent(d) {
  const bits = [];
  if (d.totalMovies > 0) bits.push(`${d.totalMovies} filme${d.totalMovies > 1 ? 's' : ''}`);
  if (d.totalEps > 0) bits.push(`${d.totalEps} episódio${d.totalEps > 1 ? 's' : ''}`);
  const hasErr = d.perService.some((s) => s.error);
  const nothing = bits.length === 0;

  const title = nothing ? 'Digest: nada faltando' : `Digest: ${bits.join(' + ')} faltando`;
  const lines = d.perService.length
    ? d.perService.map((s) => (s.error ? `${s.name}: erro (${s.error})` : `${s.name}: ${s.count}`))
    : ['nenhum Radarr/Sonarr conectado'];

  return {
    type: 'digest',
    severity: nothing && !hasErr ? 'info' : 'warning',
    title,
    message: lines.join(' · '),
    push: true,
  };
}

export async function runDigest() {
  const d = await buildDigest();
  const ev = buildDigestEvent(d);
  const { pushed } = await emitEvent(ev);
  return { ...d, title: ev.title, message: ev.message, pushed };
}

let lastDate = null;

function tick() {
  const s = getSettings();
  if (!s.digest_enabled) return;
  const now = new Date();
  const hm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const today = now.toISOString().slice(0, 10);
  if (hm === s.digest_time && lastDate !== today) {
    lastDate = today;
    runDigest().catch((e) => console.error('[ArrPulse] digest agendado falhou:', e.message));
  }
}

export function startDigestScheduler() {
  return setInterval(tick, 30000); // verifica a cada 30s; dispara 1x quando bater o horário
}
