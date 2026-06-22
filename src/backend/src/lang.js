// Detecção de idioma a partir do payload de import do Radarr/Sonarr.
// Mapeia nomes (Radarr/Sonarr) e códigos ISO 639-2 para "famílias" de idioma.

const FAMILIES = {
  pt: { label: 'Português', tokens: ['portuguese', 'portuguese (brazil)', 'brazilian', 'por', 'pt', 'pob', 'pt-br', 'ptbr'] },
  en: { label: 'English', tokens: ['english', 'eng', 'en'] },
  es: { label: 'Español', tokens: ['spanish', 'spanish (latino)', 'latino', 'spa', 'es', 'lat'] },
  ja: { label: 'Japonês', tokens: ['japanese', 'jpn', 'ja'] },
  fr: { label: 'Francês', tokens: ['french', 'fra', 'fre', 'fr'] },
  de: { label: 'Alemão', tokens: ['german', 'deu', 'ger', 'de'] },
  it: { label: 'Italiano', tokens: ['italian', 'ita', 'it'] },
  ko: { label: 'Coreano', tokens: ['korean', 'kor', 'ko'] },
};

export function familyLabel(code) {
  return FAMILIES[code]?.label || code;
}

function tokenToFamily(tok) {
  const t = String(tok).trim().toLowerCase();
  if (!t) return null;
  for (const [code, v] of Object.entries(FAMILIES)) {
    if (v.tokens.includes(t)) return code;
  }
  return null; // desconhecido / "original" / "unknown" -> ignora
}

// Retorna as famílias de idioma presentes no import (sem repetição, ignorando desconhecidos)
export function extractLanguages(body = {}) {
  const file = body.movieFile || body.episodeFile || {};
  const tokens = [];

  // 1) array de languages [{ name }]
  const arr = file.languages || body.languages || body.release?.languages || [];
  if (Array.isArray(arr)) for (const l of arr) if (l?.name) tokens.push(l.name);

  // 2) mediaInfo.audioLanguages — "por/eng" ou "Portuguese/English"
  const ai = file.mediaInfo?.audioLanguages || body.mediaInfo?.audioLanguages;
  if (ai) for (const part of String(ai).split(/[/,|]/)) tokens.push(part);

  const fams = [];
  for (const tok of tokens) {
    const f = tokenToFamily(tok);
    if (f && !fams.includes(f)) fams.push(f);
  }
  return fams;
}
