import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LabelList } from 'recharts';
import { ShieldCheck } from 'lucide-react';

const WD = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const localKey = (dt) =>
  `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;

function build(stats) {
  const map = {};
  (stats?.events?.perDay || []).forEach((d) => { map[d.day] = d; });
  const out = [];
  for (let i = 6; i >= 0; i--) {
    const dt = new Date(Date.now() - i * 864e5);
    const row = map[localKey(dt)];
    const total = row ? row.total : 0;
    const alerts = row ? row.alerts : 0;
    out.push({ label: WD[dt.getDay()], normal: Math.max(0, total - alerts), alerts, total });
  }
  return out;
}

function TipBox({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-edge2 bg-panel px-3 py-2 text-xs shadow-card">
      <p className="font-semibold text-ink">{label}</p>
      <p className="text-mute">{d.total} evento(s)</p>
      {d.alerts > 0 && <p className="text-down">{d.alerts} alerta(s)</p>}
    </div>
  );
}

const topLabel = (props) => {
  const { x, y, width, value, index, data } = props;
  const row = data[index];
  if (!row || row.total === 0) return null;
  return (
    <text x={x + width / 2} y={y - 6} textAnchor="middle" fill="#64748B" fontSize={11} fontWeight={600}>
      {row.total}
    </text>
  );
};

export default function EventsChart({ stats }) {
  const data = build(stats);
  const empty = (stats?.events?.total ?? 0) === 0;

  return (
    <div className="flex flex-col rounded-xl border border-edge2 bg-panel p-5 shadow-card">
      <h3 className="text-sm font-semibold text-ink">Eventos por dia (7d)</h3>
      <div className="mt-4 h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 18, right: 8, left: -18, bottom: 0 }} barCategoryGap="22%">
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: '#94A3B8', fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fill: '#94A3B8', fontSize: 12 }} axisLine={false} tickLine={false} width={28} />
            <Tooltip content={<TipBox />} cursor={{ fill: 'rgba(31,78,95,0.06)' }} />
            <Legend iconType="circle" wrapperStyle={{ fontSize: 12, color: '#64748B' }} />
            <Bar dataKey="normal" name="normais" stackId="a" fill="#1F4E5F" />
            <Bar dataKey="alerts" name="alertas" stackId="a" fill="#FF8A80" radius={[4, 4, 0, 0]}>
              <LabelList content={(p) => topLabel({ ...p, data })} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {empty && (
        <div className="mt-3 flex items-center gap-3 rounded-lg border border-up/30 bg-up/5 px-4 py-3">
          <ShieldCheck size={20} className="shrink-0 text-up" />
          <p className="text-sm text-ink">
            Tudo funcionando normalmente! <span className="text-mute">Nenhum evento registrado nos últimos 7 dias.</span>
          </p>
        </div>
      )}
    </div>
  );
}
