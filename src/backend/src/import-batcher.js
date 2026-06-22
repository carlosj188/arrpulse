// Agrupa imports do Sonarr por série numa janela de tempo, para emitir
// UMA notificação ("Dexter — 12 episódios importados · ação manual: S01E02")
// em vez de uma por episódio.

const WINDOW_MS = Number(process.env.IMPORT_WINDOW_MS) || 45000; // espera novos imports por 45s
const MAX_MS = Number(process.env.IMPORT_MAX_MS) || 5 * 60000;   // teto: força flush após 5min

const pad = (n) => String(n ?? 0).padStart(2, '0');
const buckets = new Map();
let sink = null;

export function configureImportSink(fn) {
  sink = fn;
}

// "S01E01,S01E02,...,S01E12" -> "S01E01–E12" ; agrupa por temporada e faixas contíguas
export function compactEpisodes(labels) {
  const eps = [];
  const other = [];
  for (const l of labels || []) {
    const m = /^S(\d+)E(\d+)$/i.exec(String(l).trim());
    if (m) eps.push([Number(m[1]), Number(m[2])]);
    else if (l) other.push(String(l));
  }
  eps.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const bySeason = new Map();
  for (const [s, e] of eps) {
    if (!bySeason.has(s)) bySeason.set(s, []);
    bySeason.get(s).push(e);
  }
  const parts = [];
  for (const [s, arr] of [...bySeason.entries()].sort((a, b) => a[0] - b[0])) {
    const ranges = [];
    let start = arr[0]; let prev = arr[0];
    for (let i = 1; i < arr.length; i++) {
      const e = arr[i];
      if (e === prev + 1 || e === prev) { prev = e; } else { ranges.push([start, prev]); start = e; prev = e; }
    }
    ranges.push([start, prev]);
    const rstr = ranges.map(([a, b]) => (a === b ? `E${pad(a)}` : `E${pad(a)}–E${pad(b)}`)).join(', ');
    parts.push(`S${pad(s)}${rstr}`);
  }
  return [...parts, ...other].join(', ');
}

export function buildAggregate(b) {
  const allImported = [...b.imported, ...b.upgraded];
  const total = allImported.length;
  const u = b.upgraded.length;
  const hasManual = b.manual.length > 0;
  const hasLang = b.langMismatch.length > 0;
  const series = b.series || 'Série';

  let title;
  if (total > 0) {
    title = `${series} — ${total} ${total === 1 ? 'episódio importado' : 'episódios importados'}`;
  } else if (hasManual) {
    title = `${series} — ${b.manual.length} ${b.manual.length === 1 ? 'episódio pendente' : 'episódios pendentes'}`;
  } else {
    title = series;
  }

  const lines = [];
  if (total > 0) lines.push(compactEpisodes(allImported));
  if (u > 0) lines.push(`${u} upgrade${u > 1 ? 's' : ''}`);
  if (hasLang) lines.push(`idioma diferente: ${compactEpisodes(b.langMismatch.map((x) => x.ep))}`);
  if (hasManual) lines.push(`ação manual: ${compactEpisodes(b.manual)}`);

  return {
    title,
    message: lines.join(' · '),
    // ação manual é acionável (warning); idioma diferente é informativo (info)
    severity: hasManual ? 'warning' : 'info',
    // manual e idioma sempre notificam, mesmo com notify_imports desligado
    force: hasManual || hasLang,
    serviceId: b.serviceId,
    serviceName: b.serviceName,
    serviceType: b.serviceType,
  };
}

function flush(key) {
  const b = buckets.get(key);
  if (!b) return;
  clearTimeout(b.timer);
  buckets.delete(key);
  const agg = buildAggregate(b);
  if (sink) Promise.resolve(sink(agg)).catch(() => {});
}

// it: { serviceId, serviceName, serviceType, series, eps:[labels], upgrade, langMismatch, langMsg, manual:[labels] }
export function addImport(it) {
  const key = `${it.serviceId}::${it.series || 'item'}`;
  let b = buckets.get(key);
  const now = Date.now();
  if (!b) {
    b = {
      serviceId: it.serviceId, serviceName: it.serviceName, serviceType: it.serviceType,
      series: it.series, imported: [], upgraded: [], langMismatch: [], manual: [], firstAt: now, timer: null,
    };
    buckets.set(key, b);
  }
  if (it.manual && it.manual.length) {
    for (const e of it.manual) b.manual.push(e);
  } else {
    for (const e of it.eps || []) (it.upgrade ? b.upgraded : b.imported).push(e);
    if (it.langMismatch) for (const e of it.eps || []) b.langMismatch.push({ ep: e, msg: it.langMsg });
  }
  clearTimeout(b.timer);
  const delay = Math.min(WINDOW_MS, Math.max(1000, MAX_MS - (now - b.firstAt)));
  b.timer = setTimeout(() => flush(key), delay);
}

// Para encerramento gracioso/testes: descarrega tudo agora.
export function flushAllNow() {
  for (const key of [...buckets.keys()]) flush(key);
}
