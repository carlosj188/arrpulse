import { useState } from 'react';
import { testService, addService } from '../api.js';

const TYPES = [
  { value: 'radarr', label: 'Radarr', placeholder: 'http://192.168.1.x:7878' },
  { value: 'sonarr', label: 'Sonarr', placeholder: 'http://192.168.1.x:8989' },
  { value: 'prowlarr', label: 'Prowlarr', placeholder: 'http://192.168.1.x:9696' },
  { value: 'jellyfin', label: 'Jellyfin', placeholder: 'http://192.168.1.x:8096' },
  { value: 'qbittorrent', label: 'qBittorrent', placeholder: 'http://192.168.1.x:8080' },
];

const field =
  'w-full rounded-lg border border-edge bg-panel2 px-3 py-2 text-sm text-ink placeholder:text-faint outline-none focus:border-accentdim';
const labelCls = 'mb-1.5 block font-mono text-[11px] uppercase tracking-wider text-mute';

// timeout default por tipo (s) — só p/ exibir o placeholder "auto"
const defaultTimeoutSec = (type) => (type === 'qbittorrent' ? 12 : 6);

export default function AddServiceModal({ onClose, onAdded }) {
  const [type, setType] = useState('radarr');
  const [name, setName] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [timeoutSec, setTimeoutSec] = useState('');
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);

  const meta = TYPES.find((t) => t.value === type);
  const isQbit = type === 'qbittorrent';
  const isJellyfin = type === 'jellyfin';
  const canSubmit = name.trim() && baseUrl.trim();

  function payload() {
    const t = timeoutSec.trim();
    return {
      type, name: name.trim(), base_url: baseUrl.trim(), api_key: apiKey.trim(), username: username.trim(), password,
      timeout_ms: t ? Math.round(Number(t) * 1000) : '',
    };
  }

  async function handleTest() {
    setTesting(true);
    setResult(null);
    try {
      setResult(await testService(payload()));
    } catch (e) {
      setResult({ ok: false, error: e.message });
    } finally {
      setTesting(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      onAdded(await addService(payload()));
    } catch (e) {
      setResult({ ok: false, error: e.message });
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="rise relative w-full max-w-md rounded-2xl border border-edge2 bg-panel p-6 shadow-card">
        <h2 className="text-lg font-bold tracking-tight text-ink">Adicionar serviço</h2>
        <p className="mt-1 text-sm text-mute">As credenciais são criptografadas antes de salvar.</p>

        <div className="mt-5 space-y-4">
          <div>
            <label className={labelCls}>Tipo</label>
            <div className="grid grid-cols-3 gap-2">
              {TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => { setType(t.value); setResult(null); }}
                  className={`rounded-lg border px-2 py-2 text-[13px] transition-colors ${
                    type === t.value ? 'border-accentdim bg-accent/15 font-semibold text-ink' : 'border-edge bg-panel2 text-mute hover:border-edge2'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={labelCls}>Nome</label>
            <input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="ex.: Radarr 4K" />
          </div>

          <div>
            <label className={labelCls}>URL base</label>
            <input className={`${field} font-mono`} value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder={meta?.placeholder} />
          </div>

          {isQbit ? (
            <>
              <div>
                <label className={labelCls}>Usuário</label>
                <input className={`${field} font-mono`} value={username} onChange={(e) => setUsername(e.target.value)} placeholder="admin" />
              </div>
              <div>
                <label className={labelCls}>Senha</label>
                <input className={`${field} font-mono`} type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <p className="text-xs text-faint">Deixe em branco se o IP do app estiver liberado na whitelist do qBit.</p>
            </>
          ) : (
            <div>
              <label className={labelCls}>API key {isJellyfin && <span className="text-faint">(opcional)</span>}</label>
              <input
                className={`${field} font-mono`}
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={isJellyfin ? 'Dashboard → API Keys' : 'Settings → General → Security'}
              />
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
              placeholder={`auto (${defaultTimeoutSec(type)}s)`}
            />
            <p className="mt-1 text-xs text-faint">Quanto esperar a resposta antes de marcar como fora. Só cai após 2 falhas seguidas.</p>
          </div>

          {result && (
            <div className={`rounded-lg border px-3 py-2 font-mono text-xs ${result.ok ? 'border-up/40 bg-up/5 text-up' : 'border-down/40 bg-down/5 text-down'}`}>
              {result.ok
                ? `conectado${result.version ? ` · v${result.version}` : ''}${result.issues ? ` · ${result.issues} alerta(s)` : ''}`
                : `falha: ${result.error}`}
            </div>
          )}
        </div>

        <div className="mt-6 flex items-center justify-between gap-2">
          <button
            onClick={handleTest}
            disabled={testing || !baseUrl.trim()}
            className="rounded-lg border border-edge bg-panel2 px-4 py-2 text-sm text-ink hover:border-accentdim disabled:opacity-40"
          >
            {testing ? 'testando…' : 'Testar conexão'}
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-mute hover:text-ink">Cancelar</button>
            <button
              onClick={handleSave}
              disabled={!canSubmit || saving}
              className="rounded-lg bg-secondary px-4 py-2 text-sm font-semibold text-white hover:bg-secondarydim disabled:opacity-40"
            >
              {saving ? 'salvando…' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
