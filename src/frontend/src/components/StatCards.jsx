import { HeartPulse, CalendarClock, TriangleAlert, ListChecks } from 'lucide-react';

function Card({ icon: Icon, label, value, sub, subTone, tint }) {
  return (
    <div className="rounded-xl border border-edge2 bg-panel p-4 shadow-card">
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium text-mute">{label}</p>
        <span className={`flex h-9 w-9 items-center justify-center rounded-full ${tint}`}>
          <Icon size={17} />
        </span>
      </div>
      <p className="mt-2 text-3xl font-extrabold tracking-tight text-ink">{value}</p>
      {sub && <p className={`mt-0.5 text-xs ${subTone || 'text-faint'}`}>{sub}</p>}
    </div>
  );
}

export default function StatCards({ stats }) {
  const s = stats?.services || {};
  const e = stats?.events || {};
  const total = s.total || 0;
  const up = s.up || 0;
  const problems = (s.degraded || 0) + (s.down || 0);
  const allOk = total > 0 && problems === 0;

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <Card
        icon={HeartPulse}
        label="Serviços saudáveis"
        value={`${up}/${total}`}
        sub={allOk ? '100% operacionais' : `${problems} com problema`}
        subTone={allOk ? 'font-medium text-up' : 'font-medium text-degraded'}
        tint="bg-up/10 text-up"
      />
      <Card icon={CalendarClock} label="Eventos hoje" value={e.today ?? 0} sub="desde 00h" tint="bg-secondary/10 text-secondary" />
      <Card icon={TriangleAlert} label="Alertas (7d)" value={e.alerts ?? 0} sub="warning + crítico" tint="bg-degraded/10 text-degraded" />
      <Card icon={ListChecks} label="Eventos (7d)" value={e.total ?? 0} sub="total registrado" tint="bg-accent/15 text-accentdim" />
    </div>
  );
}
