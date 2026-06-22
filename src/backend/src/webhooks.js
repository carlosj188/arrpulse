// Parser dos webhooks do Servarr (Radarr/Sonarr/Prowlarr).
// Retorna um evento { type, severity, title, message, push } ou null (ignorar).

import { extractLanguages, familyLabel } from './lang.js';

const LABEL = { radarr: 'Radarr', sonarr: 'Sonarr', prowlarr: 'Prowlarr', jellyfin: 'Jellyfin', qbittorrent: 'qBittorrent' };
const pad = (n) => String(n ?? 0).padStart(2, '0');

function mediaTitle(type, b) {
  if (type === 'sonarr' && b.series) {
    const ep = Array.isArray(b.episodes) && b.episodes.length ? b.episodes[0] : null;
    const tag = ep ? ` S${pad(ep.seasonNumber)}E${pad(ep.episodeNumber)}` : '';
    return `${b.series.title}${tag}`;
  }
  if (type === 'radarr' && b.movie) {
    return `${b.movie.title}${b.movie.year ? ` (${b.movie.year})` : ''}`;
  }
  return b.movie?.title || b.series?.title || b.remoteMovie?.title || 'item';
}

function quality(b) {
  const q = b.movieFile?.quality ?? b.episodeFile?.quality ?? b.release?.quality;
  return typeof q === 'string' ? q : '';
}

// Detecta idioma diferente do padrão (compartilhado por importEvent/importItem).
// Retorna { mismatch, msg } — alerta só quando NENHUMA faixa é o idioma padrão.
function langMismatch(body, settings) {
  if (!settings.lang_enabled || !settings.default_language) return { mismatch: false, msg: '' };
  const langs = extractLanguages(body);
  if (langs.length && !langs.includes(settings.default_language)) {
    return { mismatch: true, msg: `áudio: ${langs.map(familyLabel).join(' + ')}` };
  }
  return { mismatch: false, msg: '' };
}

// Monta o evento de import, ciente do idioma padrão configurado.
function importEvent(type, body, settings = {}) {
  const title = mediaTitle(type, body);
  const up = body.eventType === 'Upgrade' || body.isUpgrade;
  const q = quality(body);

  let severity = 'info';
  let prefix = `Importado${up ? ' (upgrade)' : ''}`;
  let message = q ? `qualidade: ${q}` : '';

  const lm = langMismatch(body, settings);
  if (lm.mismatch) {
    // idioma diferente é informativo (não degrada), mas sempre notifica nos canais
    prefix = 'Idioma diferente';
    message = lm.msg;
  }

  // Idioma diferente sempre passa; imports "limpos" respeitam o toggle de importações.
  const push = lm.mismatch ? true : settings.notify_imports !== false;
  return { type: 'webhook', severity, title: `${prefix}: ${title}`, message, push };
}

// Item estruturado para o agrupador (Sonarr): por série, com episódios e flags.
function importItem(body, settings, et) {
  const series = body.series?.title || 'Série';
  const eps = (Array.isArray(body.episodes) ? body.episodes : [])
    .map((ep) => `S${pad(ep.seasonNumber)}E${pad(ep.episodeNumber)}`);

  if (et === 'ManualInteractionRequired') {
    return { series, manual: eps.length ? eps : ['(episódio)'] };
  }

  const upgrade = et === 'Upgrade' || body.isUpgrade === true;
  const lm = langMismatch(body, settings);
  return { series, eps: eps.length ? eps : ['(item)'], upgrade, langMismatch: lm.mismatch, langMsg: lm.msg };
}

export function parseWebhook(type, body = {}, settings = {}) {
  const et = body.eventType || body.EventType || '';
  const label = LABEL[type] || type;

  switch (et) {
    case 'Test':
      return { type: 'test', severity: 'info', title: `Webhook conectado (${label})`, message: 'teste do Connect recebido', push: false };

    case 'Grab':
      return { type: 'webhook', severity: 'info', title: `Baixando: ${mediaTitle(type, body)}`, message: body.release?.releaseTitle || quality(body) || label, push: false };

    case 'Download':
    case 'Upgrade':
      if (type === 'sonarr') return { batch: true, item: importItem(body, settings, et) };
      return importEvent(type, body, settings);

    case 'ManualInteractionRequired':
      if (type === 'sonarr') return { batch: true, item: importItem(body, settings, et) };
      return { type: 'webhook', severity: 'warning', title: `Import manual necessário (${label})`, message: mediaTitle(type, body), push: true };

    case 'Health':
      return { type: 'webhook', severity: 'warning', title: `${label}: alerta de saúde`, message: body.message || body.Message || 'health issue', push: true };

    case 'HealthRestored':
      return { type: 'webhook', severity: 'info', title: `${label}: saúde restaurada`, message: body.message || 'ok', push: false };

    default:
      return null; // ignora Rename, *Delete, *Added, ApplicationUpdate, etc.
  }
}
