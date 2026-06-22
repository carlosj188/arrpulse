import { LayoutDashboard, Activity, Bell, Settings, X, LogOut } from 'lucide-react';

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'eventos', label: 'Eventos', icon: Activity },
];

export default function Sidebar({ view, onView, onNotifications, onConfig, summary, open, onClose, username, onLogout }) {
  const item = (active) =>
    `relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
      active
        ? 'bg-gradient-to-r from-accent to-accentdim font-semibold text-white shadow-sm'
        : 'text-white/70 hover:bg-white/10 hover:text-white'
    }`;
  const indicator = (active) =>
    active ? <span className="absolute -left-3 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-accent" /> : null;

  const go = (id) => { onView(id); onClose?.(); };
  const openNotifications = () => { onNotifications(); onClose?.(); };
  const openConfig = () => { onConfig(); onClose?.(); };

  return (
    <>
      {/* backdrop no mobile */}
      {open && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={onClose} />}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-screen w-64 flex-col bg-secondary text-white transition-transform duration-200 lg:sticky lg:top-0 lg:z-auto lg:w-56 lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center gap-3 px-5 py-6">
          <img src="/arrpulse-mark.png" alt="ArrPulse" className="h-11 w-11 object-contain" />
          <div className="leading-tight">
            <p className="text-[18px] font-extrabold tracking-tight">Arr<span className="text-accent">Pulse</span></p>
            <p className="font-mono text-[10px] text-white/50">monitor da stack</p>
          </div>
          <button onClick={onClose} className="ml-auto rounded-md p-1 text-white/60 hover:bg-white/10 hover:text-white lg:hidden">
            <X size={20} />
          </button>
        </div>

        <nav className="mt-2 flex-1 space-y-1 px-3">
          {NAV.map((n) => {
            const Icon = n.icon;
            const active = view === n.id;
            return (
              <button key={n.id} onClick={() => go(n.id)} className={item(active)}>
                {indicator(active)}
                <Icon size={18} />
                {n.label}
              </button>
            );
          })}

          <button onClick={openNotifications} className={item(false)}>
            <Bell size={18} />
            Notificações
          </button>
          <button onClick={openConfig} className={item(false)}>
            <Settings size={18} />
            Configurações
          </button>
        </nav>

        {summary && (
          <div className="border-t border-white/10 px-5 py-3 font-mono text-[11px] text-white/60">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-up" />{summary.up || 0}</span>
              <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-degraded" />{summary.degraded || 0}</span>
              <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-down" />{summary.down || 0}</span>
            </div>
            <p className="mt-1.5 text-white/40">
              {(summary.up || 0) === (summary.total || 0) && (summary.total || 0) > 0 ? 'todos operacionais' : 'atenção em alguns'}
            </p>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 border-t border-white/10 px-5 py-3">
          <span className="min-w-0 truncate text-xs text-white/70">{username || 'admin'}</span>
          <button onClick={onLogout} title="Sair" className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-white/60 hover:bg-white/10 hover:text-white">
            <LogOut size={15} /> Sair
          </button>
        </div>
      </aside>
    </>
  );
}
