import { useEffect, useState, useCallback } from 'react';
import { listServices, deleteService, refreshService, listEvents, getStats, clearEvents, since, authStatus, authMe, getToken, logout } from './api.js';
import { RefreshCw, Menu } from 'lucide-react';
import ServiceCard from './components/ServiceCard.jsx';
import ServiceModal from './components/ServiceModal.jsx';
import Login from './components/Login.jsx';
import EventsFeed from './components/EventsFeed.jsx';
import SettingsModal from './components/SettingsModal.jsx';
import AccountModal from './components/AccountModal.jsx';
import Sidebar from './components/Sidebar.jsx';
import StatCards from './components/StatCards.jsx';
import EventsChart from './components/EventsChart.jsx';
import SeverityDonut from './components/SeverityDonut.jsx';

const POLL_MS = 20000;

export default function App() {
  const [services, setServices] = useState([]);
  const [events, setEvents] = useState([]);
  const [filteredEvents, setFilteredEvents] = useState(null);
  const [showingHistory, setShowingHistory] = useState(false);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('dashboard');
  const [showModal, setShowModal] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  const [editing, setEditing] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [configured, setConfigured] = useState(true);
  const [username, setUsername] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const st = await authStatus();
        setConfigured(st.configured);
        if (st.configured && getToken()) {
          try { const me = await authMe(); setUsername(me.username); setAuthed(true); } catch { /* token inválido */ }
        }
      } catch { /* offline */ } finally {
        setAuthChecked(true);
      }
    })();
    const onUnauth = () => setAuthed(false);
    window.addEventListener('arrpulse:unauth', onUnauth);
    return () => window.removeEventListener('arrpulse:unauth', onUnauth);
  }, []);

  function handleLogout() {
    logout();
    setAuthed(false);
    setServices([]);
    setEvents([]);
    setStats(null);
  }

  async function handleRefreshAll() {
    setRefreshing(true);
    await load();
    setTimeout(() => setRefreshing(false), 400);
  }

  const load = useCallback(async () => {
    try {
      const [svcs, evs, st] = await Promise.all([listServices(), listEvents({ limit: 50 }), getStats()]);
      setServices(svcs);
      setEvents(evs);
      setStats(st);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  async function applyFilter(filter) {
    if (!filter.severity && !filter.type && !filter.search) {
      setFilteredEvents(null);
      setShowingHistory(false);
      return;
    }
    try {
      const evs = await listEvents({ limit: 300, ...filter });
      setFilteredEvents(evs);
      setShowingHistory(false);
    } catch (e) {
      console.error(e);
    }
  }

  async function loadHistory() {
    if (showingHistory) {
      setFilteredEvents(null);
      setShowingHistory(false);
      return;
    }
    try {
      const evs = await listEvents({ days: 7, limit: 1000 });
      setFilteredEvents(evs);
      setShowingHistory(true);
    } catch (e) {
      console.error(e);
    }
  }

  useEffect(() => {
    if (!authed) return undefined;
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [authed, load]);

  async function handleRefresh(id) {
    try {
      const updated = await refreshService(id);
      setServices((prev) => prev.map((s) => (s.id === id ? updated : s)));
    } catch (e) {
      console.error(e);
    }
  }

  async function handleDelete(svc) {
    if (!window.confirm(`Remover "${svc.name}"?`)) return;
    await deleteService(svc.id);
    setServices((prev) => prev.filter((s) => s.id !== svc.id));
  }

  async function handleClearEvents() {
    if (!window.confirm('Limpar todos os eventos do feed?')) return;
    try {
      await clearEvents();
      setEvents([]);
      setFilteredEvents(null);
      setShowingHistory(false);
      const st = await getStats();
      setStats(st);
    } catch (e) {
      console.error(e);
    }
  }

  if (!authChecked) {
    return <div className="flex min-h-screen items-center justify-center bg-base font-mono text-sm text-mute">carregando…</div>;
  }
  if (!authed) {
    return <Login configured={configured} onAuthed={(u) => { setUsername(u); setConfigured(true); setAuthed(true); }} />;
  }

  const title = view === 'dashboard' ? 'Dashboard' : 'Eventos';
  const lastCheck = services.reduce((acc, s) => (s.last_check && (!acc || s.last_check > acc) ? s.last_check : acc), null);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar view={view} onView={setView} onNotifications={() => setShowNotifications(true)} onConfig={() => setShowAccount(true)} summary={stats?.services} open={navOpen} onClose={() => setNavOpen(false)} username={username} onLogout={handleLogout} />

      <main className="flex-1 overflow-x-hidden overflow-y-auto">
        {/* Top bar */}
        <header className="flex items-center justify-between gap-3 border-b border-edge bg-panel px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={() => setNavOpen(true)}
              className="rounded-md p-1.5 text-mute hover:bg-panel2 hover:text-ink lg:hidden"
              title="Menu"
            >
              <Menu size={22} />
            </button>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-bold tracking-tight text-ink">{title}</h1>
              {view === 'dashboard' && (
                <p className="mt-0.5 hidden truncate font-mono text-xs text-faint sm:block">
                  Última verificação: {lastCheck ? `há ${since(lastCheck)}` : '—'} · {services.length} serviço(s) monitorado(s)
                </p>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {view === 'eventos' && events.length > 0 && (
              <button
                onClick={handleClearEvents}
                className="rounded-lg border border-edge bg-panel px-3 py-2 text-sm text-mute transition-colors hover:border-down hover:text-down sm:px-4"
              >
                Limpar
              </button>
            )}
            {view === 'dashboard' && (
              <>
                <button
                  onClick={() => setShowModal(true)}
                  className="rounded-lg bg-secondary px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-secondarydim sm:px-4"
                >
                  <span className="hidden sm:inline">+ Adicionar serviço</span>
                  <span className="sm:hidden">+ Serviço</span>
                </button>
                <button
                  onClick={handleRefreshAll}
                  title="Atualizar agora"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-edge bg-panel text-mute transition-colors hover:border-secondary hover:text-secondary"
                >
                  <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
                </button>
              </>
            )}
          </div>
        </header>

        <div className="mx-auto max-w-[1600px] px-4 py-4 sm:px-6 sm:py-6">
          {loading ? (
            <p className="font-mono text-sm text-mute">carregando…</p>
          ) : view === 'dashboard' ? (
            <div className="space-y-6">
              <section>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-mute">Resumo</h2>
                <StatCards stats={stats} />
              </section>

              {services.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-edge2 bg-panel p-12 text-center shadow-card">
                  <p className="text-[15px] font-semibold text-ink">Nenhum serviço conectado</p>
                  <p className="mx-auto mt-2 max-w-sm text-sm text-mute">
                    Adicione Radarr, Sonarr, Prowlarr, Jellyfin ou qBittorrent para acompanhar a saúde de cada um aqui.
                  </p>
                  <button
                    onClick={() => setShowModal(true)}
                    className="mt-5 rounded-lg bg-secondary px-4 py-2 text-sm font-semibold text-white hover:bg-secondarydim"
                  >
                    + Adicionar o primeiro
                  </button>
                </div>
              ) : (
                <section>
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-mute">Serviços</h2>
                    <span className="font-mono text-xs text-faint">{services.length} conectado(s)</span>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                    {services.map((svc) => (
                      <ServiceCard key={svc.id} svc={svc} onRefresh={handleRefresh} onDelete={handleDelete} onEdit={setEditing} />
                    ))}
                  </div>
                </section>
              )}

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <div className="lg:col-span-2">
                  <EventsChart stats={stats} />
                </div>
                <SeverityDonut stats={stats} />
              </div>
            </div>
          ) : (
            <EventsFeed
              events={filteredEvents ?? events}
              onFilter={applyFilter}
              onLoadHistory={loadHistory}
              hasFilter={filteredEvents !== null && !showingHistory}
              showingHistory={showingHistory}
            />
          )}
        </div>
      </main>

      {(showModal || editing) && (
        <ServiceModal
          service={editing}
          onClose={() => { setShowModal(false); setEditing(null); }}
          onSaved={(saved) => {
            setServices((prev) =>
              prev.some((s) => s.id === saved.id) ? prev.map((s) => (s.id === saved.id ? saved : s)) : [...prev, saved]
            );
            setShowModal(false);
            setEditing(null);
          }}
        />
      )}

      {showNotifications && <SettingsModal onClose={() => setShowNotifications(false)} />}
      {showAccount && <AccountModal username={username} onClose={() => setShowAccount(false)} onUsernameChange={setUsername} />}
    </div>
  );
}
