import { db } from './db.js';

const DEFAULTS = {
  push_enabled: '0',
  ntfy_url: process.env.NTFY_URL || '',
  ntfy_topic: process.env.NTFY_TOPIC || '',
  ntfy_token: process.env.NTFY_TOKEN || '',
  lang_enabled: '0',
  default_language: process.env.DEFAULT_LANGUAGE || 'pt',
  // quiet hours
  quiet_enabled: '0',
  quiet_start: '23:00',
  quiet_end: '07:00',
  quiet_allow_critical: '1',
  // represa os pushes barrados no silêncio e entrega um resumo ao fim do intervalo
  quiet_queue: '1',
  // canais extras
  discord_enabled: '0',
  discord_webhook_url: '',
  telegram_enabled: '0',
  telegram_bot_token: '',
  telegram_chat_id: '',
  // monitoramento qBit
  qbit_stuck_enabled: '1',
  // notificar downloads concluídos no qBit (resumo por ciclo) — default off p/ evitar avalanche
  qbit_done_enabled: '0',
  // notificações de degraded
  notify_degraded: '0',
  // notificações de importação (Radarr/Sonarr Download/Upgrade)
  notify_imports: '1',
  // digest diário de faltantes
  digest_enabled: '0',
  digest_time: '09:00',
  // aviso diário de atualizações disponíveis (apps desatualizados)
  notify_updates: '1',
  updates_time: '09:00',
};

const getStmt = db.prepare('SELECT value FROM settings WHERE key = ?');
const upsertStmt = db.prepare(`
  INSERT INTO settings (key, value) VALUES (?, ?)
  ON CONFLICT(key) DO UPDATE SET value = excluded.value
`);

function raw(key) {
  const row = getStmt.get(key);
  return row ? row.value : (DEFAULTS[key] ?? '');
}

function normalizeHM(v, fallback) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(v || '').trim());
  if (!m) return fallback;
  const h = Number(m[1]); const min = Number(m[2]);
  if (h > 23 || min > 59) return fallback;
  return `${String(h).padStart(2, '0')}:${m[2]}`;
}

// Uso interno (notify) — inclui segredos em texto puro
export function getSettings() {
  return {
    push_enabled: raw('push_enabled') === '1',
    ntfy_url: (raw('ntfy_url') || '').replace(/\/+$/, ''),
    ntfy_topic: raw('ntfy_topic') || '',
    ntfy_token: raw('ntfy_token') || '',
    lang_enabled: raw('lang_enabled') === '1',
    default_language: raw('default_language') || 'pt',
    quiet_enabled: raw('quiet_enabled') === '1',
    quiet_start: raw('quiet_start') || '23:00',
    quiet_end: raw('quiet_end') || '07:00',
    quiet_allow_critical: raw('quiet_allow_critical') === '1',
    quiet_queue: raw('quiet_queue') === '1',
    discord_enabled: raw('discord_enabled') === '1',
    discord_webhook_url: raw('discord_webhook_url') || '',
    telegram_enabled: raw('telegram_enabled') === '1',
    telegram_bot_token: raw('telegram_bot_token') || '',
    telegram_chat_id: raw('telegram_chat_id') || '',
    qbit_stuck_enabled: raw('qbit_stuck_enabled') === '1',
    qbit_done_enabled: raw('qbit_done_enabled') === '1',
    notify_degraded: raw('notify_degraded') === '1',
    notify_imports: raw('notify_imports') === '1',
    digest_enabled: raw('digest_enabled') === '1',
    digest_time: raw('digest_time') || '09:00',
    notify_updates: raw('notify_updates') === '1',
    updates_time: raw('updates_time') || '09:00',
  };
}

// Uso na API — mascara segredos
export function getPublicSettings() {
  const s = getSettings();
  return {
    push_enabled: s.push_enabled,
    ntfy_url: s.ntfy_url,
    ntfy_topic: s.ntfy_topic,
    ntfy_token_set: !!s.ntfy_token,
    lang_enabled: s.lang_enabled,
    default_language: s.default_language,
    quiet_enabled: s.quiet_enabled,
    quiet_start: s.quiet_start,
    quiet_end: s.quiet_end,
    quiet_allow_critical: s.quiet_allow_critical,
    quiet_queue: s.quiet_queue,
    discord_enabled: s.discord_enabled,
    discord_url_set: !!s.discord_webhook_url,
    telegram_enabled: s.telegram_enabled,
    telegram_chat_id: s.telegram_chat_id,
    telegram_token_set: !!s.telegram_bot_token,
    qbit_stuck_enabled: s.qbit_stuck_enabled,
    qbit_done_enabled: s.qbit_done_enabled,
    notify_degraded: s.notify_degraded,
    notify_imports: s.notify_imports,
    digest_enabled: s.digest_enabled,
    digest_time: s.digest_time,
    notify_updates: s.notify_updates,
    updates_time: s.updates_time,
  };
}

export function setSettings(obj = {}) {
  const tx = db.transaction((o) => {
    if ('push_enabled' in o) upsertStmt.run('push_enabled', o.push_enabled ? '1' : '0');
    if ('ntfy_url' in o) upsertStmt.run('ntfy_url', String(o.ntfy_url || '').replace(/\/+$/, ''));
    if ('ntfy_topic' in o) upsertStmt.run('ntfy_topic', String(o.ntfy_topic || '').trim());
    // segredos: só mudam se vier valor novo não-vazio (em branco mantém o atual)
    if ('ntfy_token' in o && String(o.ntfy_token || '').trim()) {
      upsertStmt.run('ntfy_token', String(o.ntfy_token).trim());
    }
    if ('lang_enabled' in o) upsertStmt.run('lang_enabled', o.lang_enabled ? '1' : '0');
    if ('default_language' in o) upsertStmt.run('default_language', String(o.default_language || 'pt').trim());

    if ('quiet_enabled' in o) upsertStmt.run('quiet_enabled', o.quiet_enabled ? '1' : '0');
    if ('quiet_start' in o) upsertStmt.run('quiet_start', normalizeHM(o.quiet_start, '23:00'));
    if ('quiet_end' in o) upsertStmt.run('quiet_end', normalizeHM(o.quiet_end, '07:00'));
    if ('quiet_allow_critical' in o) upsertStmt.run('quiet_allow_critical', o.quiet_allow_critical ? '1' : '0');
    if ('quiet_queue' in o) upsertStmt.run('quiet_queue', o.quiet_queue ? '1' : '0');

    if ('discord_enabled' in o) upsertStmt.run('discord_enabled', o.discord_enabled ? '1' : '0');
    if ('discord_webhook_url' in o && String(o.discord_webhook_url || '').trim()) {
      upsertStmt.run('discord_webhook_url', String(o.discord_webhook_url).trim());
    }
    if ('telegram_enabled' in o) upsertStmt.run('telegram_enabled', o.telegram_enabled ? '1' : '0');
    if ('telegram_bot_token' in o && String(o.telegram_bot_token || '').trim()) {
      upsertStmt.run('telegram_bot_token', String(o.telegram_bot_token).trim());
    }
    if ('telegram_chat_id' in o) upsertStmt.run('telegram_chat_id', String(o.telegram_chat_id || '').trim());
    if ('qbit_stuck_enabled' in o) upsertStmt.run('qbit_stuck_enabled', o.qbit_stuck_enabled ? '1' : '0');
    if ('qbit_done_enabled' in o) upsertStmt.run('qbit_done_enabled', o.qbit_done_enabled ? '1' : '0');
    if ('notify_degraded' in o) upsertStmt.run('notify_degraded', o.notify_degraded ? '1' : '0');
    if ('notify_imports' in o) upsertStmt.run('notify_imports', o.notify_imports ? '1' : '0');
    if ('digest_enabled' in o) upsertStmt.run('digest_enabled', o.digest_enabled ? '1' : '0');
    if ('digest_time' in o) upsertStmt.run('digest_time', normalizeHM(o.digest_time, '09:00'));
    if ('notify_updates' in o) upsertStmt.run('notify_updates', o.notify_updates ? '1' : '0');
    if ('updates_time' in o) upsertStmt.run('updates_time', normalizeHM(o.updates_time, '09:00'));
  });
  tx(obj);
  return getPublicSettings();
}

// Semeia a partir do .env no primeiro boot (não sobrescreve o que já existe)
export function seedSettingsFromEnv() {
  for (const [k, v] of Object.entries(DEFAULTS)) {
    if (v && !getStmt.get(k)) upsertStmt.run(k, v);
  }
}
