import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Info, TriangleAlert, OctagonAlert } from 'lucide-react';

const SEG = [
  { key: 'info', name: 'Informativo', color: '#16A34A', Icon: Info },
  { key: 'warning', name: 'Alerta', color: '#D97706', Icon: TriangleAlert },
  { key: 'critical', name: 'Crítico', color: '#DC2626', Icon: OctagonAlert },
];

function TipBox({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="rounded-lg border border-edge2 bg-panel px-3 py-2 text-xs shadow-card">
      <p className="font-semibold text-ink">{d.name}</p>
      <p className="text-mute">{d.value} evento(s)</p>
    </div>
  );
}

export default function SeverityDonut({ stats }) {
  const sev = stats?.events?.bySeverity || { info: 0, warning: 0, critical: 0 };
  const data = SEG.map((s) => ({ name: s.name, value: sev[s.key] || 0, color: s.color, Icon: s.Icon }));
  const total = data.reduce((a, b) => a + b.value, 0);

  return (
    <div className="flex flex-col rounded-xl border border-edge2 bg-panel p-5 shadow-card">
      <h3 className="text-sm font-semibold text-ink">Eventos por severidade (7d)</h3>
      <div className="relative mt-4 h-48">
        {total === 0 ? (
          <div className="flex h-full items-center justify-center font-mono text-xs text-faint">sem eventos no período</div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="value" nameKey="name" innerRadius="60%" outerRadius="85%" paddingAngle={2} stroke="none">
                  {data.map((d) => (
                    <Cell key={d.name} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip content={<TipBox />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-ink">{total}</span>
              <span className="font-mono text-[10px] uppercase tracking-wider text-faint">total</span>
            </div>
          </>
        )}
      </div>
      <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 font-mono text-[11px] text-mute">
        {data.map((d) => (
          <span key={d.name} className="flex items-center gap-1.5">
            <d.Icon size={13} style={{ color: d.color }} />
            {d.name} <span className="text-faint">{d.value}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
