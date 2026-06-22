import { useState } from 'react';
import { updateService } from '../api.js';

const field =
  'w-full rounded-lg border border-edge bg-panel2 px-3 py-2 text-sm text-ink placeholder:text-faint outline-none focus:border-accentdim';
const labelCls = 'mb-1.5 block font-mono text-[11px] uppercase tracking-wider text-mute';
const TYPE_LABEL = { radarr: 'Radarr', sonarr: 'Sonarr', prowlarr: 'Prowlarr', jellyfin: 'Jellyfin', qbittorrent: 'qBittorrent' };
const defaultTimeoutSec = (type) => (type === 'qbittorrent' ? 12 : 6);

export default function EditServiceModal({ svc, onClose, onSaved }) {
  const isQbit = svc.type === 'qbittorrent';
  const [name, setName] = useState(svc.name || '');
  const [baseUrl, setBaseUrl] = useState(svc.base_url || '');
  const [apiKey, setApiKey] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [timeoutSec, setTimeoutSec] = useState(svc.timeout_ms ? String(svc.timeout_ms / 1000) : '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const t = timeoutSec.trim();
      const body = { name: name.trim(), base_url: baseUrl.trim(), timeout_ms: t ? Math.round(Number(t) * 1000) : '' };
      if (isQbit) {
        if (username.trim()) body.username = username.trim();
        if (password) body.password = password;
      } else if (apiKey.trim()) {
        body.api_key = apiKey.trim();
      }
      const updated = await updateService(svc.id, body);
      onSaved(updated);
    } catch (e) {
      setError(e.message);
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="rise relative w-full max-w-md rounded-2xl border border-edge2 bg-panel p-6 shadow-card">
        <h2 className="text-lg font-bold tracking-tight text-ink">Editar serviço</h2>
        <p className="mt-1 text-sm text-mute">
          {TYPE_LABEL[svc.type] || svc.type} · deixe a credencial em branco para manter a atual.
        </p>

        <div className="mt-5 space-y-4">
          <div>
            <label className={labelCls}>Nome</label>
            <input className={field} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>URL base</label>
            <input className={`${field} font-mono`} value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
          </div>

          {isQbit ? (
            <>
              <div>
                <label className={labelCls}>Usuário <span className="text-faint">(em branco mantém)</span></label>
                <input className={`${field} font-mono`} value={username} onChange={(e) => setUsername(e.target.value)} placeholder={svc.username || 'admin'} />
              </div>
              <div>
                <label className={labelCls}>Senha <span className="text-faint">(em branco mantém)</span></label>
                <input className={`${field} font-mono`} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••" />
              </div>
            </>
          ) : (
            <div>
              <label className={labelCls}>API key <span className="text-faint">(em branco mantém)</span></label>
              <input className={`${field} font-mono`} type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="••••••" />
            </div>
          )}

          <div>
            <label className={labelCls}>Timeout <span className="text-faint">(s · vazio = auto)</span></label>
            <input
              className={`${field} font-mono`}
              type="number"
              min="1"
              max="60"
              value={timeoutSec}
              onChange={(e) => setTimeoutSec(e.target.value)}
              placeholder={`auto (${defaultTimeoutSec(svc.type)}s)`}
            />
            <p className="mt-1 text-xs text-faint">Quanto esperar a resposta antes de marcar como fora. Só cai após 2 falhas seguidas.</p>
          </div>

          {error && (
            <div className="rounded-lg border border-down/40 bg-down/5 px-3 py-2 font-mono text-xs text-down">falha: {error}</div>
          )}
        </div>

        <div className="mt-6 flex items-center justify-end gap-2">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-mute hover:text-ink">Cancelar</button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim() || !baseUrl.trim()}
            className="rounded-lg bg-secondary px-4 py-2 text-sm font-semibold text-white hover:bg-secondarydim disabled:opacity-40"
          >
            {saving ? 'salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}
