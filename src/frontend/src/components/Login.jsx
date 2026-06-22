import { useState } from 'react';
import { User, Lock, Eye, EyeOff, LogIn, UserPlus, Activity, Bell, LineChart, ShieldCheck, Heart } from 'lucide-react';
import { authLogin, authSetup } from '../api.js';

const CDN = 'https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/png';

const FLOATERS = [
  { t: 'sonarr',      top: '8%',  right: '5%',  s: 64 },
  { t: 'radarr',      top: '22%', right: '18%', s: 56 },
  { t: 'jellyfin',    top: '40%', right: '3%',  s: 60 },
  { t: 'qbittorrent', top: '59%', right: '16%', s: 58 },
  { t: 'prowlarr',    top: '76%', right: '5%',  s: 54 },
];

const PROPS = [
  { icon: Activity,    title: 'Monitoramento', sub: 'em tempo real' },
  { icon: Bell,        title: 'Alertas',       sub: 'inteligentes'  },
  { icon: LineChart,   title: 'Histórico e',   sub: 'métricas'      },
  { icon: ShieldCheck, title: 'Confiável e',   sub: 'leve'          },
];

const field =
  'w-full rounded-xl border border-edge bg-panel2 py-2.5 pl-10 pr-10 text-sm text-ink placeholder:text-faint outline-none focus:border-accentdim transition-colors';

function Hero() {
  return (
    <div className="relative hidden flex-1 overflow-hidden lg:block">
      {/* fundo real */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/fundo.png')" }}
      />
      {/* overlay leve para garantir legibilidade do texto */}
      <div className="absolute inset-0 bg-[#0a1c26]/30" />

      {/* chips dos serviços flutuando na direita (acima da janela) */}
      {FLOATERS.map((f) => (
        <div
          key={f.t}
          className="absolute z-20 flex items-center justify-center rounded-2xl bg-white p-2 shadow-xl ring-1 ring-black/10"
          style={{ top: f.top, right: f.right, width: f.s, height: f.s }}
        >
          <img src={`${CDN}/${f.t}.png`} alt={f.t} className="h-full w-full object-contain" />
        </div>
      ))}

      {/* janela do dashboard — posicionada e dimensionada como no mockup */}
      <div
        className="absolute z-10"
        style={{ left: '6%', top: '40%', width: '78%', filter: 'drop-shadow(0 40px 60px rgba(0,0,0,0.55))' }}
      >
        <img
          src="/janela tela login.png"
          alt="Dashboard ArrPulse"
          className="w-full h-auto"
          style={{ transform: 'perspective(1400px) rotateY(5deg) rotate(-1.5deg)', transformOrigin: 'center' }}
        />
      </div>

      {/* card inferior sobreposto */}
      <div className="absolute bottom-[5%] left-[7%] z-30 flex max-w-sm items-center gap-3 rounded-2xl border border-white/10 bg-black/50 px-4 py-3 backdrop-blur-sm">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/20 text-accent">
          <Heart size={18} fill="currentColor" />
        </span>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-white">Menos downtime, mais tranquilidade.</p>
          <p className="text-xs text-white/55">ArrPulse cuida da sua stack para você.</p>
        </div>
      </div>

      {/* conteúdo (texto no topo) */}
      <div className="relative z-10 px-14 py-12">
        <h2 className="max-w-md text-[34px] font-extrabold leading-[1.15] text-white">
          Visão completa da sua stack,<br />
          <span className="text-accent">em tempo real.</span>
        </h2>
        <p className="mt-4 max-w-sm text-sm text-white/65">
          Monitore serviços, receba alertas e mantenha tudo funcionando sem interrupções.
        </p>

        <div className="mt-7 grid max-w-lg grid-cols-4 gap-4">
          {PROPS.map((p) => (
            <div key={p.title}>
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-accent ring-1 ring-white/15">
                <p.icon size={18} />
              </span>
              <p className="mt-2 text-xs font-semibold leading-tight text-white">{p.title}</p>
              <p className="text-xs leading-tight text-white/45">{p.sub}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Login({ configured, onAuthed }) {
  const setup = !configured;
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [remember, setRemember] = useState(true);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function submit() {
    setError(null);

    if (setup) {
      if (password.length < 6) return setError('A senha deve ter ao menos 6 caracteres.');
      if (password !== confirm) return setError('As senhas não conferem.');
    }
    setBusy(true);
    try {
      const s = setup
        ? await authSetup(username.trim() || 'admin', password)
        : await authLogin(username.trim(), password, remember);
      onAuthed(s.username || username.trim() || 'admin');
    } catch (e) {
      setError(e.message || 'falha ao entrar');
      setBusy(false);
    }
  }

  const onKey = (e) => { if (e.key === 'Enter') submit(); };

  return (
    <div className="flex min-h-screen bg-base">
      {/* ── Painel esquerdo (formulário) ── */}
      <div className="flex w-full flex-col justify-center px-6 py-10 sm:px-12 lg:w-[460px] lg:shrink-0">
        <div className="mx-auto w-full max-w-sm">

          {/* logo */}
          <div className="flex items-center gap-3">
            <img src="/arrpulse-logo.png" alt="" className="h-12 w-12 object-contain" />
            <div>
              <p className="text-2xl font-extrabold tracking-tight text-secondary">
                Arr<span className="text-accent">Pulse</span>
              </p>
              <p className="text-xs text-mute">Monitoramento inteligente da sua stack Arr</p>
            </div>
          </div>

          <h1 className="mt-10 text-2xl font-bold tracking-tight text-ink">
            {setup ? 'Crie sua conta 👋' : 'Bem-vindo de volta! 👋'}
          </h1>
          <p className="mt-1 text-sm text-mute">
            {setup
              ? 'Defina o usuário e a senha de acesso (primeiro acesso).'
              : 'Faça login para continuar'}
          </p>

          {/* campos */}
          <div className="mt-7 space-y-4">

            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink">Usuário ou e-mail</label>
              <div className="relative">
                <User size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
                <input
                  className={field}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onKeyDown={onKey}
                  placeholder="exemplo@arrpulse.local"
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink">Senha</label>
              <div className="relative">
                <Lock size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
                <input
                  className={field}
                  type={show ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={onKey}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShow((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-faint hover:text-mute"
                >
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {setup && (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-ink">Confirmar senha</label>
                <div className="relative">
                  <Lock size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
                  <input
                    className={field}
                    type={show ? 'text' : 'password'}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    onKeyDown={onKey}
                    placeholder="••••••••"
                  />
                </div>
              </div>
            )}

            {/* lembrar + esqueci */}
            {!setup && (
              <div className="flex items-center justify-between">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-mute">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="h-4 w-4 rounded border-edge2 accent-accent"
                  />
                  Lembrar de mim
                </label>
                <span className="text-sm font-medium text-accent cursor-pointer hover:text-accentdim select-none">
                  Esqueci minha senha
                </span>
              </div>
            )}

            {error && (
              <p className="rounded-lg border border-down/40 bg-down/5 px-3 py-2 text-sm text-down">
                {error}
              </p>
            )}

            <button
              onClick={submit}
              disabled={busy || !password}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-3 text-sm font-semibold text-white transition-colors hover:bg-accentdim disabled:opacity-50"
            >
              {setup ? <UserPlus size={16} /> : <LogIn size={16} />}
              {busy ? 'aguarde…' : setup ? 'Criar conta e entrar' : 'Entrar'}
            </button>
          </div>

          <p className="mt-10 text-xs text-faint">
            © {new Date().getFullYear()} ArrPulse · Todos os direitos reservados
          </p>
        </div>
      </div>

      <Hero />
    </div>
  );
}
