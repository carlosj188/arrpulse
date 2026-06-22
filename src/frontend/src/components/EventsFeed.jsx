import { useState, useEffect, useRef } from 'react';
import { ago } from '../api.js';
import { Search, X } from 'lucide-react';

const SEV = {
  critical: { dot: 'bg-down', text: 'text-down', label: 'Crítico' },
  warning: { dot: 'bg-degraded', text: 'text-degraded', label: 'Alerta' },
  info: { dot: 'bg-up', text: 'text-up', label: 'Info' },
};

const SEV_FILTERS = [
  { value: null, label: 'Todos' },
  { value: 'critical', label: 'Crítico' },
  { value: 'warning', label: 'Alerta' },
  { value: 'info', label: 'Info' },
];

export default function EventsFeed({ events, onFilter, onLoadHistory, hasFilter, showingHistory }) {
  const [search, setSearch] = useState('');
  const [severity, setSeverity] = useState(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onFilter?.({ severity, search: search.trim() });
    }, 400);
    return () => clearTimeout(debounceRef.current);
  }, [search, severity]);

  function clearFilters() {
    setSearch('');
    setSeverity(null);
    onFilter?.({ severity: null, search: '' });
  }

  const pillBase = 'rounded-full px-3 py-1 text-xs font-medium transition-colors';
  const pillActive = 'bg-secondary text-white';
  const pillInactive = 'bg-panel2 text-mute border border-edge hover:border-secondary hover:text-secondary';

  return (
    <section className="mt-6">
      {/* Barra de filtros */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar eventos…"
            className="w-full rounded-lg border border-edge bg-panel2 py-1.5 pl-7 pr-3 text-xs text-ink placeholder:text-faint outline-none focus:border-accentdim"
          />
        </div>

        <div className="flex items-center gap-1">
          {SEV_FILTERS.map((f) => (
            <button
              key={String(f.value)}
              onClick={() => setSeverity(f.value)}
              className={`${pillBase} ${severity === f.value ? pillActive : pillInactive}`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {hasFilter && (
          <button onClick={clearFilters} className="flex items-center gap-1 rounded-full border border-edge px-2.5 py-1 text-xs text-mute hover:text-down hover:border-down">
            <X size={11} />
            limpar
          </button>
        )}
      </div>

      {/* Feed */}
      <h2 className="mb-3 flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-mute">
        {showingHistory ? 'Histórico — últimos 7 dias' : hasFilter ? `Resultados (${events.length})` : 'Eventos recentes'}
      </h2>

      {(!events || events.length === 0) ? (
        <div className="rounded-xl border border-dashed border-edge bg-panel/40 p-6 text-center">
          <p className="text-sm text-mute">
            {hasFilter ? 'Nenhum evento encontrado para esse filtro.' : 'Nenhum evento ainda — tudo tranquilo por aqui.'}
          </p>
          {hasFilter && (
            <button onClick={clearFilters} className="mt-2 text-xs text-secondary hover:underline">Limpar filtro</button>
          )}
        </div>
      ) : (
        <ul className="divide-y divide-edge overflow-hidden rounded-xl border border-edge bg-panel/60">
          {events.map((e) => {
            const s = SEV[e.severity] || SEV.info;
            return (
              <li key={e.id} className="flex items-start gap-3 px-4 py-3">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${s.dot}`} />
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-medium ${s.text}`}>{e.title}</p>
                  {e.message && <p className="truncate font-mono text-xs text-faint">{e.message}</p>}
                </div>
                <span className="shrink-0 font-mono text-[11px] text-faint">{ago(e.created_at)}</span>
              </li>
            );
          })}
        </ul>
      )}

      {/* Botão de histórico */}
      {!hasFilter && (
        <div className="mt-4 text-center">
          <button
            onClick={onLoadHistory}
            className="font-mono text-xs text-mute hover:text-ink transition-colors"
          >
            {showingHistory ? '← Voltar ao feed live' : 'Ver histórico dos últimos 7 dias →'}
          </button>
        </div>
      )}
    </section>
  );
}
