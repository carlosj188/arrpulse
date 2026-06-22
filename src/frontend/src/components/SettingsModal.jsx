import { useState, useEffect } from 'react';
import { getSettings, saveSettings, testPush, testDigest, testUpdates } from '../api.js';
import {
  Bell, BellOff, X, Radio, Send, MessageCircle, Moon, Zap, CalendarClock,
  Languages, Film, AlertTriangle, AlertCircle, CheckCircle, ClipboardList,
  ArrowUpCircle, SendHorizontal, Check,
} from 'lucide-react';

const field =
  'w-full rounded-lg border border-edge bg-panel px-3 py-2 text-sm text-ink placeholder:text-faint outline-none transition-colors focus:border-accentdim focus:ring-2 focus:ring-accent/20';
const labelCls = 'mb-1.5 block font-mono text-[10px] uppercase tracking-[0.12em] text-mute';

const LANGS = [
  { code: 'pt', label: 'Português' }, { code: 'en', label: 'English' }, { code: 'es', label: 'Español' },
  { code: 'ja', label: 'Japonês' }, { code: 'fr', label: 'Francês' }, { code: 'de', label: 'Alemão' },
  { code: 'it', label: 'Italiano' }, { code: 'ko', label: 'Coreano' },
];

const TABS = [
  { id: 'canais', label: 'Canais', icon: Radio },
  { id: 'eventos', label: 'Eventos', icon: Zap },
  { id: 'agenda', label: 'Agenda', icon: CalendarClock },
  { id: 'silencio', label: 'Silêncio', icon: Moon },
];

function Toggle({ on, onToggle, disabled }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 disabled:opacity-40 ${on ? 'bg-accent' : 'bg-edge2'}`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-panel shadow-sm transition-all duration-200 ${on ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  );
}

// Chip de estado (configurado / inativo)
function StatusChip({ ok, okLabel = 'configurado', offLabel = 'pendente' }) {
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wide ${ok ? 'bg-up/10 text-up' : 'bg-edge2/60 text-faint'}`}>
      {ok ? okLabel : offLabel}
    </span>
  );
}

// Linha padrão: ícone + título/descrição + controle à direita, com área expansível embaixo
function Row({ icon, iconClass = 'text-secondary', title, desc, on, onToggle, control, children }) {
  return (
    <div className="rounded-xl border border-edge bg-panel2/40 px-3.5 py-3">
      <div className="flex items-center gap-3">
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-edge bg-panel ${iconClass}`}>{icon}</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold tracking-tight text-ink">{title}</p>
          {desc && <p className="mt-0.5 text-xs leading-snug text-mute">{desc}</p>}
        </div>
        {control ?? <Toggle on={on} onToggle={onToggle} />}
      </div>
      {children}
    </div>
  );
}

export default function SettingsModal({ onClose }) {
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState('canais');

  const [pushEnabled, setPushEnabled] = useState(false);
  const [url, setUrl] = useState('');
  const [topic, setTopic] = useState('');
  const [token, setToken] = useState('');
  const [tokenSet, setTokenSet] = useState(false);
  const [langEnabled, setLangEnabled] = useState(false);
  const [defaultLang, setDefaultLang] = useState('pt');
  // quiet hours
  const [quietEnabled, setQuietEnabled] = useState(false);
  const [quietStart, setQuietStart] = useState('23:00');
  const [quietEnd, setQuietEnd] = useState('07:00');
  const [quietAllowCritical, setQuietAllowCritical] = useState(true);
  const [quietQueue, setQuietQueue] = useState(true);
  // discord
  const [discordEnabled, setDiscordEnabled] = useState(false);
  const [discordUrl, setDiscordUrl] = useState('');
  const [discordUrlSet, setDiscordUrlSet] = useState(false);
  // telegram
  const [tgEnabled, setTgEnabled] = useState(false);
  const [tgToken, setTgToken] = useState('');
  const [tgTokenSet, setTgTokenSet] = useState(false);
  const [tgChatId, setTgChatId] = useState('');
  // monitoramento
  const [notifyDegraded, setNotifyDegraded] = useState(false);
  const [notifyImports, setNotifyImports] = useState(true);
  const [qbitStuck, setQbitStuck] = useState(true);
  const [qbitDone, setQbitDone] = useState(false);
  const [digestEnabled, setDigestEnabled] = useState(false);
  const [digestTime, setDigestTime] = useState('09:00');
  const [digestResult, setDigestResult] = useState(null);
  const [digesting, setDigesting] = useState(false);
  const [notifyUpdates, setNotifyUpdates] = useState(true);
  const [updatesTime, setUpdatesTime] = useState('09:00');
  const [updatesResult, setUpdatesResult] = useState(null);
  const [updating, setUpdating] = useState(false);

  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    getSettings()
      .then((s) => {
        setPushEnabled(s.push_enabled);
        setUrl(s.ntfy_url || ''); setTopic(s.ntfy_topic || ''); setTokenSet(s.ntfy_token_set);
        setLangEnabled(s.lang_enabled); setDefaultLang(s.default_language || 'pt');
        setQuietEnabled(s.quiet_enabled); setQuietStart(s.quiet_start || '23:00');
        setQuietEnd(s.quiet_end || '07:00'); setQuietAllowCritical(s.quiet_allow_critical);
        setQuietQueue(s.quiet_queue);
        setDiscordEnabled(s.discord_enabled); setDiscordUrlSet(s.discord_url_set);
        setTgEnabled(s.telegram_enabled); setTgTokenSet(s.telegram_token_set); setTgChatId(s.telegram_chat_id || '');
        setNotifyDegraded(s.notify_degraded);
        setNotifyImports(s.notify_imports);
        setQbitStuck(s.qbit_stuck_enabled);
        setQbitDone(s.qbit_done_enabled);
        setDigestEnabled(s.digest_enabled); setDigestTime(s.digest_time || '09:00');
        setNotifyUpdates(s.notify_updates); setUpdatesTime(s.updates_time || '09:00');
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function body() {
    const b = {
      push_enabled: pushEnabled, ntfy_url: url.trim(), ntfy_topic: topic.trim(),
      lang_enabled: langEnabled, default_language: defaultLang,
      quiet_enabled: quietEnabled, quiet_start: quietStart, quiet_end: quietEnd, quiet_allow_critical: quietAllowCritical,
      quiet_queue: quietQueue,
      discord_enabled: discordEnabled,
      telegram_enabled: tgEnabled, telegram_chat_id: tgChatId.trim(),
      notify_degraded: notifyDegraded,
      notify_imports: notifyImports,
      qbit_stuck_enabled: qbitStuck,
      qbit_done_enabled: qbitDone,
      digest_enabled: digestEnabled, digest_time: digestTime,
      notify_updates: notifyUpdates, updates_time: updatesTime,
    };
    if (token.trim()) b.ntfy_token = token.trim();
    if (discordUrl.trim()) b.discord_webhook_url = discordUrl.trim();
    if (tgToken.trim()) b.telegram_bot_token = tgToken.trim();
    return b;
  }

  async function handleSave() {
    setSaving(true);
    try {
      await saveSettings(body());
      onClose();
    } catch (e) {
      setResult({ ok: false, error: e.message });
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setResult(null);
    try {
      await saveSettings(body());
      setResult(await testPush());
    } catch (e) {
      setResult({ ok: false, error: e.message });
    } finally {
      setTesting(false);
    }
  }

  async function handleDigest() {
    setDigesting(true);
    setDigestResult(null);
    try {
      await saveSettings(body());
      setDigestResult(await testDigest());
    } catch (e) {
      setDigestResult({ title: 'falha', message: e.message });
    } finally {
      setDigesting(false);
    }
  }

  async function handleUpdates() {
    setUpdating(true);
    setUpdatesResult(null);
    try {
      await saveSettings(body());
      setUpdatesResult(await testUpdates());
    } catch (e) {
      setUpdatesResult({ title: 'falha', message: e.message });
    } finally {
      setUpdating(false);
    }
  }

  const ntfyOk = !!(url.trim() && topic.trim());
  const discordOk = !!(discordUrlSet || discordUrl.trim());
  const tgOk = !!((tgTokenSet || tgToken.trim()) && tgChatId.trim());

  // Bloco de resultado de "enviar agora" (digest / updates) — reutilizado
  const ResultBox = ({ data }) => data && (
    <div className="mt-2.5 rounded-lg border border-edge bg-panel px-3 py-2 font-mono text-xs">
      <p className="font-semibold text-ink">{data.title}</p>
      {data.message && <p className="mt-0.5 text-mute">{data.message}</p>}
      {'pushed' in (data || {}) && (
        <p className={`mt-0.5 ${data.pushed ? 'text-up' : 'text-faint'}`}>push: {data.pushed ? 'enviado ✓' : 'não enviado'}</p>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-secondarydim/50 backdrop-blur-sm" onClick={onClose} />

      <div className="rise relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-edge2 bg-panel shadow-card">
        {/* Cabeçalho */}
        <div className="relative border-b border-edge px-6 pb-5 pt-6">
          <button onClick={onClose} className="absolute right-4 top-4 rounded-lg p-1.5 text-faint transition-colors hover:bg-panel2 hover:text-ink">
            <X size={18} />
          </button>
          <h2 className="font-sans text-xl font-extrabold tracking-tight text-ink">Notificações</h2>
          <p className="mt-1 text-sm text-mute">Defina os canais, os eventos e quando o ArrPulse pode falar.</p>

          {/* Interruptor-mestre */}
          <button
            type="button"
            onClick={() => setPushEnabled((v) => !v)}
            className={`mt-4 flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors ${pushEnabled ? 'border-secondary/30 bg-gradient-to-r from-secondary/[0.07] to-accent/[0.07]' : 'border-edge bg-panel2/60'}`}
          >
            <span className="flex items-center gap-3">
              <span className={`grid h-9 w-9 place-items-center rounded-lg transition-colors ${pushEnabled ? 'bg-secondary text-white' : 'bg-edge2/70 text-mute'}`}>
                {pushEnabled ? <Bell size={16} /> : <BellOff size={16} />}
              </span>
              <span>
                <span className="block text-sm font-bold tracking-tight text-ink">Push global</span>
                <span className="block text-xs text-mute">{pushEnabled ? 'Notificações ativas' : 'Tudo pausado — nada será enviado'}</span>
              </span>
            </span>
            <Toggle on={pushEnabled} onToggle={() => setPushEnabled((v) => !v)} />
          </button>
        </div>

        {/* Abas */}
        <div className="flex border-b border-edge px-3">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`relative flex flex-1 flex-col items-center gap-1 py-2.5 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] transition-colors ${active ? 'text-secondary' : 'text-faint hover:text-mute'}`}
              >
                <Icon size={16} strokeWidth={active ? 2.4 : 2} />
                {t.label}
                <span className={`absolute -bottom-px left-2 right-2 h-0.5 rounded-full transition-all ${active ? 'bg-accent' : 'bg-transparent'}`} />
              </button>
            );
          })}
        </div>

        {!loaded ? (
          <p className="px-6 py-10 text-center font-mono text-sm text-mute">carregando…</p>
        ) : (
          <div key={tab} className="rise flex-1 space-y-3 overflow-y-auto px-6 py-5">

            {!pushEnabled && (
              <div className="flex items-center gap-2 rounded-lg border border-degraded/30 bg-degraded/5 px-3 py-2 text-xs text-degraded">
                <BellOff size={14} className="shrink-0" />
                Push global desligado — os ajustes ficam salvos, mas nada é enviado.
              </div>
            )}

            {/* ───── CANAIS ───── */}
            {tab === 'canais' && (
              <>
                {/* ntfy — canal principal */}
                <Row
                  icon={<Radio size={16} />}
                  title="ntfy"
                  desc="Canal principal. Ativo quando URL e tópico estão preenchidos."
                  control={<StatusChip ok={ntfyOk} okLabel="ativo" offLabel="vazio" />}
                >
                  <div className="mt-3 space-y-3">
                    <div>
                      <label className={labelCls}>URL</label>
                      <input className={`${field} font-mono`} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="http://192.168.1.7:8090" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelCls}>Tópico</label>
                        <input className={`${field} font-mono`} value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="arrpulse" />
                      </div>
                      <div>
                        <label className={labelCls}>Token <span className="text-faint normal-case tracking-normal">(opcional)</span></label>
                        <input className={`${field} font-mono`} type="password" value={token} onChange={(e) => setToken(e.target.value)}
                          placeholder={tokenSet ? '•••• (mantém)' : 'tk_…'} />
                      </div>
                    </div>
                  </div>
                </Row>

                {/* Discord */}
                <Row
                  icon={<MessageCircle size={16} />}
                  iconClass="text-[#5865F2]"
                  title="Discord"
                  desc="Envia os avisos via webhook de um canal."
                  on={discordEnabled}
                  onToggle={() => setDiscordEnabled((v) => !v)}
                >
                  <div className={`mt-3 transition-opacity ${discordEnabled ? '' : 'pointer-events-none opacity-40'}`}>
                    <label className={labelCls}>Webhook URL</label>
                    <input className={`${field} font-mono`} type="password" value={discordUrl} onChange={(e) => setDiscordUrl(e.target.value)}
                      placeholder={discordUrlSet ? '•••••• (em branco mantém)' : 'https://discord.com/api/webhooks/…'} />
                    <p className="mt-1.5 text-[11px] text-faint">Servidor → Editar canal → Integrações → Webhooks → Copiar URL.</p>
                  </div>
                </Row>

                {/* Telegram */}
                <Row
                  icon={<Send size={15} />}
                  iconClass="text-[#229ED9]"
                  title="Telegram"
                  desc="Bot do @BotFather entregando no seu chat."
                  on={tgEnabled}
                  onToggle={() => setTgEnabled((v) => !v)}
                >
                  <div className={`mt-3 space-y-3 transition-opacity ${tgEnabled ? '' : 'pointer-events-none opacity-40'}`}>
                    <div>
                      <label className={labelCls}>Bot token</label>
                      <input className={`${field} font-mono`} type="password" value={tgToken} onChange={(e) => setTgToken(e.target.value)}
                        placeholder={tgTokenSet ? '•••••• (em branco mantém)' : '123456:ABC-…'} />
                    </div>
                    <div>
                      <label className={labelCls}>Chat ID</label>
                      <input className={`${field} font-mono`} value={tgChatId} onChange={(e) => setTgChatId(e.target.value)} placeholder="-1001234567890" />
                      <p className="mt-1.5 text-[11px] text-faint">Mande algo ao bot e veja em api.telegram.org/bot&lt;token&gt;/getUpdates.</p>
                    </div>
                  </div>
                </Row>

                {/* Teste */}
                <div className="rounded-xl border border-dashed border-edge2 bg-panel2/30 p-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <SendHorizontal size={15} className="text-secondary" />
                      <span className="text-sm text-ink">Disparar um teste em todos os canais</span>
                    </div>
                    <button onClick={handleTest} disabled={testing}
                      className="shrink-0 rounded-lg bg-secondary px-3.5 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-secondarydim disabled:opacity-40">
                      {testing ? 'enviando…' : 'Testar'}
                    </button>
                  </div>
                  {result && (
                    <div className="mt-3 space-y-1.5">
                      {result.results?.length ? (
                        result.results.map((r) => (
                          <div key={r.channel} className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 font-mono text-[11px] ${r.ok ? 'border-up/40 bg-up/5 text-up' : 'border-down/40 bg-down/5 text-down'}`}>
                            {r.ok ? <Check size={12} /> : <AlertCircle size={12} />}
                            <span className="font-semibold uppercase tracking-wide">{r.channel}</span>
                            <span className="text-mute">{r.ok ? 'enviado' : `falha — ${r.error}`}</span>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-lg border border-down/40 bg-down/5 px-3 py-1.5 font-mono text-[11px] text-down">{result.error || 'nenhum canal configurado'}</div>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* ───── EVENTOS ───── */}
            {tab === 'eventos' && (
              <>
                <Row
                  icon={<AlertTriangle size={16} />}
                  iconClass="text-degraded"
                  title="Serviços degradados"
                  desc="Avisa quando um serviço fica degradado. Quedas críticas (fora) sempre notificam."
                  on={notifyDegraded}
                  onToggle={() => setNotifyDegraded((v) => !v)}
                />
                <Row
                  icon={<Film size={16} />}
                  title="Importações"
                  desc="Filmes/episódios importados (Radarr/Sonarr). Idioma diferente e ação manual sempre avisam."
                  on={notifyImports}
                  onToggle={() => setNotifyImports((v) => !v)}
                />
                <Row
                  icon={<Languages size={16} />}
                  iconClass="text-secondary"
                  title="Idioma diferente"
                  desc="Avisa quando o import não tem o idioma padrão em nenhuma faixa (dual com o padrão é ok)."
                  on={langEnabled}
                  onToggle={() => setLangEnabled((v) => !v)}
                >
                  <div className={`mt-3 transition-opacity ${langEnabled ? '' : 'pointer-events-none opacity-40'}`}>
                    <label className={labelCls}>Idioma padrão</label>
                    <select className={`${field}`} value={defaultLang} onChange={(e) => setDefaultLang(e.target.value)}>
                      {LANGS.map((l) => <option key={l.code} value={l.code} className="bg-panel">{l.label}</option>)}
                    </select>
                  </div>
                </Row>
                <Row
                  icon={<AlertCircle size={16} />}
                  iconClass="text-down"
                  title="Torrents travados (qBit)"
                  desc="Erro, arquivos ausentes ou download estagnado."
                  on={qbitStuck}
                  onToggle={() => setQbitStuck((v) => !v)}
                />
                <Row
                  icon={<CheckCircle size={16} />}
                  iconClass="text-up"
                  title="Downloads concluídos (qBit)"
                  desc="Um resumo por verificação. Ao ligar, os já concluídos não são reenviados."
                  on={qbitDone}
                  onToggle={() => setQbitDone((v) => !v)}
                />
              </>
            )}

            {/* ───── AGENDA ───── */}
            {tab === 'agenda' && (
              <>
                <Row
                  icon={<ClipboardList size={16} />}
                  title="Digest de faltantes"
                  desc="Resumo diário dos itens wanted/missing do Radarr/Sonarr."
                  on={digestEnabled}
                  onToggle={() => setDigestEnabled((v) => !v)}
                >
                  <div className={`mt-3 transition-opacity ${digestEnabled ? '' : 'pointer-events-none opacity-40'}`}>
                    <label className={labelCls}>Horário</label>
                    <div className="flex items-center gap-2">
                      <input type="time" className={`${field} font-mono`} value={digestTime} onChange={(e) => setDigestTime(e.target.value)} />
                      <button type="button" onClick={handleDigest} disabled={digesting}
                        className="shrink-0 rounded-lg border border-edge bg-panel px-3 py-2 text-sm text-ink transition-colors hover:border-accentdim disabled:opacity-40">
                        {digesting ? 'enviando…' : 'Enviar agora'}
                      </button>
                    </div>
                    <ResultBox data={digestResult} />
                  </div>
                </Row>

                <Row
                  icon={<ArrowUpCircle size={16} />}
                  iconClass="text-secondary"
                  title="Aviso de atualizações"
                  desc="Lista, 1×/dia, os apps com update disponível. Atualizar não marca mais o serviço como degradado — vira só um selo no card."
                  on={notifyUpdates}
                  onToggle={() => setNotifyUpdates((v) => !v)}
                >
                  <div className={`mt-3 transition-opacity ${notifyUpdates ? '' : 'pointer-events-none opacity-40'}`}>
                    <label className={labelCls}>Horário</label>
                    <div className="flex items-center gap-2">
                      <input type="time" className={`${field} font-mono`} value={updatesTime} onChange={(e) => setUpdatesTime(e.target.value)} />
                      <button type="button" onClick={handleUpdates} disabled={updating}
                        className="shrink-0 rounded-lg border border-edge bg-panel px-3 py-2 text-sm text-ink transition-colors hover:border-accentdim disabled:opacity-40">
                        {updating ? 'enviando…' : 'Enviar agora'}
                      </button>
                    </div>
                    <ResultBox data={updatesResult} />
                  </div>
                </Row>
              </>
            )}

            {/* ───── SILÊNCIO ───── */}
            {tab === 'silencio' && (
              <>
                <Row
                  icon={<Moon size={16} />}
                  iconClass="text-secondary"
                  title="Horário silencioso"
                  desc="Não envia push dentro do intervalo (vira a meia-noite se o fim for menor que o início)."
                  on={quietEnabled}
                  onToggle={() => setQuietEnabled((v) => !v)}
                >
                  <div className={`mt-3 space-y-3 transition-opacity ${quietEnabled ? '' : 'pointer-events-none opacity-40'}`}>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelCls}>Início</label>
                        <input type="time" className={`${field} font-mono`} value={quietStart} onChange={(e) => setQuietStart(e.target.value)} />
                      </div>
                      <div>
                        <label className={labelCls}>Fim</label>
                        <input type="time" className={`${field} font-mono`} value={quietEnd} onChange={(e) => setQuietEnd(e.target.value)} />
                      </div>
                    </div>
                  </div>
                </Row>

                <label className={`flex cursor-pointer items-center justify-between rounded-xl border border-edge bg-panel2/40 px-3.5 py-3 transition-opacity ${quietEnabled ? '' : 'pointer-events-none opacity-40'}`}>
                  <span className="pr-3">
                    <span className="block text-sm font-semibold text-ink">Deixar passar críticos</span>
                    <span className="block text-xs text-mute">Serviço fora rompe o silêncio.</span>
                  </span>
                  <Toggle on={quietAllowCritical} onToggle={() => setQuietAllowCritical((v) => !v)} />
                </label>

                <label className={`flex cursor-pointer items-center justify-between rounded-xl border border-edge bg-panel2/40 px-3.5 py-3 transition-opacity ${quietEnabled ? '' : 'pointer-events-none opacity-40'}`}>
                  <span className="pr-3">
                    <span className="block text-sm font-semibold text-ink">Entregar acumulados ao fim</span>
                    <span className="block text-xs text-mute">Ligado: vira um resumo único quando o silêncio termina. Desligado: descarta.</span>
                  </span>
                  <Toggle on={quietQueue} onToggle={() => setQuietQueue((v) => !v)} />
                </label>
              </>
            )}
          </div>
        )}

        {/* Rodapé */}
        <div className="flex items-center justify-end gap-2 border-t border-edge bg-panel2/30 px-6 py-4">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-mute transition-colors hover:text-ink">Cancelar</button>
          <button onClick={handleSave} disabled={saving || !loaded}
            className="rounded-lg bg-accent px-5 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-accentdim disabled:opacity-40">
            {saving ? 'salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}
