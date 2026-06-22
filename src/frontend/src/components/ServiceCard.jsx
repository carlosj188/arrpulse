import { useState } from 'react';
import { since, ago } from '../api.js';
import { ExternalLink, Pencil, RefreshCw, Trash2, Link2, ArrowUpCircle } from 'lucide-react';

// Lê o snapshot de saúde persistido pelo backend (issues reais + update disponível).
function parseHealth(raw) {
  if (!raw) return { issues: [], update: null };
  try {
    const h = JSON.parse(raw);
    return { issues: Array.isArray(h.issues) ? h.issues : [], update: h.update || null };
  } catch {
    return { issues: [], update: null };
  }
}

const STATUS = {
  up: { label: 'saudável', dot: 'bg-up', text: 'text-up', pill: 'bg-up/10 text-up', verb: (t) => `${t} online` },
  degraded: { label: 'degradado', dot: 'bg-degraded', text: 'text-degraded', pill: 'bg-degraded/10 text-degraded', verb: (t) => `degradado há ${t}` },
  down: { label: 'fora', dot: 'bg-down', text: 'text-down', pill: 'bg-down/10 text-down', verb: (t) => `fora há ${t}` },
  unknown: { label: 'aguardando', dot: 'bg-unknown', text: 'text-mute', pill: 'bg-edge2 text-mute', verb: () => 'aguardando verificação…' },
};

const TYPE_LABEL = { radarr: 'Radarr', sonarr: 'Sonarr', prowlarr: 'Prowlarr', jellyfin: 'Jellyfin', qbittorrent: 'qBittorrent' };
const BRAND = { radarr: '#E5A00D', sonarr: '#35C5F0', prowlarr: '#E66000', jellyfin: '#9558AA', qbittorrent: '#3A7BD5' };
const WEBHOOK_TYPES = ['radarr', 'sonarr', 'prowlarr'];
const iconBtn = 'rounded-md border border-edge2 bg-panel p-1.5 text-mute transition-colors hover:border-secondary hover:text-secondary';

// Favicon do próprio serviço (tenta caminhos conhecidos); se nada local servir,
// usa o ícone da marca (dashboard-icons via CDN); por último, monograma colorido.
const ICON_CDN = 'https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/png';

function iconCandidates(svc) {
  const u = (svc.base_url || '').replace(/\/+$/, '');
  const list = [];
  if (u) {
    if (svc.type === 'jellyfin') list.push(`${u}/web/favicon.ico`);
    list.push(`${u}/favicon.ico`);
  }
  list.push(`${ICON_CDN}/${svc.type}.png`);
  return list;
}

function ServiceIcon({ svc }) {
  const cands = iconCandidates(svc);
  const [idx, setIdx] = useState(0);
  const letter = (TYPE_LABEL[svc.type] || svc.type || '?').charAt(0).toUpperCase();
  const color = BRAND[svc.type] || '#1F4E5F';

  if (idx >= cands.length) {
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11px] font-bold text-white" style={{ background: color }}>
        {letter}
      </span>
    );
  }
  return (
    <img
      src={cands[idx]}
      alt=""
      referrerPolicy="no-referrer"
      onError={() => setIdx((i) => i + 1)}
      className="h-6 w-6 shrink-0 rounded-md bg-panel2 object-contain"
    />
  );
}

export default function ServiceCard({ svc, onRefresh, onDelete, onEdit }) {
  const [copied, setCopied] = useState(false);
  const s = STATUS[svc.status] || STATUS.unknown;
  const hasWebhook = WEBHOOK_TYPES.includes(svc.type) && svc.webhook_token;
  const shortUrl = (svc.base_url || '').replace(/^https?:\/\//, '');
  const health = parseHealth(svc.health_json);
  const update = health.update?.available ? health.update : null;
  const issues = svc.status === 'degraded' ? health.issues : [];

  async function copyWebhook() {
    const url = `${window.location.origin}/api/hooks/${svc.webhook_token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt('Cole esta URL no Connect → Webhook:', url);
    }
  }

  const uptimeLine = s.verb(since(svc.status_since));

  return (
    <div className="rise group relative flex flex-col rounded-xl border border-edge2 bg-panel p-3.5 shadow-card transition-shadow hover:shadow-lg">
      <div className="flex items-center gap-2.5">
        <ServiceIcon svc={svc} />
        <h3 className="min-w-0 flex-1 truncate text-[14px] font-semibold tracking-tight text-ink">{svc.name}</h3>
        <span className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide ${s.pill}`}>{s.label}</span>
      </div>

      <div className="mt-2">
        {svc.version && <p className="font-mono text-[11px] text-faint">v{svc.version}</p>}
        <p className={`font-mono text-[12px] ${s.text}`}>{uptimeLine}</p>
        <p className="font-mono text-[10px] text-faint">verificado {ago(svc.last_check)}</p>
      </div>

      {issues.length > 0 ? (
        <div className="mt-2 space-y-1">
          {issues.slice(0, 3).map((it, i) => {
            const color = it.type === 'error' ? 'text-down' : 'text-degraded';
            const body = (
              <span className={`flex items-center gap-1 ${color}`}>
                <span className="truncate">{it.message}</span>
                {it.wikiUrl && <ExternalLink size={10} className="shrink-0 opacity-70" />}
              </span>
            );
            return (
              <div key={i} className="truncate rounded-md border border-edge bg-panel2 px-2 py-1 font-mono text-[11px]" title={it.message}>
                {it.wikiUrl ? <a href={it.wikiUrl} target="_blank" rel="noreferrer" className="hover:underline">{body}</a> : body}
              </div>
            );
          })}
          {issues.length > 3 && <p className="font-mono text-[10px] text-faint">+{issues.length - 3} alerta(s)</p>}
        </div>
      ) : svc.last_error ? (
        <p className="mt-2 truncate rounded-md border border-edge bg-panel2 px-2 py-1 font-mono text-[11px] text-degraded" title={svc.last_error}>
          {svc.last_error}
        </p>
      ) : null}

      {update && (
        <div className="mt-2 flex items-center gap-1.5 rounded-md border border-secondary/30 bg-secondary/5 px-2 py-1 font-mono text-[11px] text-secondary">
          <ArrowUpCircle size={12} className="shrink-0" />
          <span className="truncate">atualização disponível{update.version ? ` · v${update.version}` : ''}</span>
        </div>
      )}

      <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-edge pt-2.5">
        <a
          href={svc.base_url}
          target="_blank"
          rel="noreferrer"
          className="flex min-w-0 items-center gap-1 font-mono text-[11px] text-faint transition-colors hover:text-secondary"
          title={svc.base_url}
        >
          <span className="truncate">{shortUrl}</span>
          <ExternalLink size={11} className="shrink-0" />
        </a>
        <div className="flex shrink-0 items-center gap-1 opacity-100 transition-opacity lg:opacity-0 lg:group-hover:opacity-100">
          {hasWebhook && (
            <button onClick={copyWebhook} title={copied ? 'copiado!' : 'copiar webhook'} className={`${iconBtn} ${copied ? 'border-up text-up' : ''}`}>
              <Link2 size={13} />
            </button>
          )}
          <button onClick={() => onEdit?.(svc)} title="editar" className={iconBtn}><Pencil size={13} /></button>
          <button onClick={() => onRefresh(svc.id)} title="verificar agora" className={iconBtn}><RefreshCw size={13} /></button>
          <button onClick={() => onDelete(svc)} title="remover" className="rounded-md border border-edge2 bg-panel p-1.5 text-mute transition-colors hover:border-down hover:text-down"><Trash2 size={13} /></button>
        </div>
      </div>
    </div>
  );
}
