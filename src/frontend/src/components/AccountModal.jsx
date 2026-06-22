import { useState, useEffect } from 'react';
import { User, Lock, X } from 'lucide-react';
import { authChange } from '../api.js';

const field = 'w-full rounded-lg border border-edge bg-panel2 px-3 py-2 text-sm text-ink placeholder:text-faint outline-none focus:border-accentdim';
const labelCls = 'mb-1.5 block font-mono text-[11px] uppercase tracking-wider text-mute';

export default function AccountModal({ username, onClose, onUsernameChange }) {
  const [curPass, setCurPass] = useState('');
  const [newUser, setNewUser] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function handleSave() {
    setMsg(null);
    if (!curPass) return setMsg({ ok: false, text: 'Informe a senha atual.' });
    if (!newUser.trim() && !newPass) return setMsg({ ok: false, text: 'Nada para alterar.' });
    if (newPass && newPass.length < 6) return setMsg({ ok: false, text: 'A nova senha deve ter ao menos 6 caracteres.' });
    if (newPass && newPass !== confirm) return setMsg({ ok: false, text: 'As senhas não conferem.' });
    setSaving(true);
    try {
      const r = await authChange({ currentPassword: curPass, newUsername: newUser.trim() || undefined, newPassword: newPass || undefined });
      setMsg({ ok: true, text: 'Conta atualizada com sucesso.' });
      if (r.username && onUsernameChange) onUsernameChange(r.username);
      setCurPass(''); setNewUser(''); setNewPass(''); setConfirm('');
    } catch (e) {
      setMsg({ ok: false, text: e.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-secondarydim/50 backdrop-blur-sm" onClick={onClose} />
      <div className="rise relative flex max-h-[88vh] w-full max-w-md flex-col rounded-2xl border border-edge2 bg-panel shadow-card">
        <div className="relative border-b border-edge px-6 py-5">
          <button onClick={onClose} className="absolute right-4 top-4 rounded-lg p-1.5 text-faint transition-colors hover:bg-panel2 hover:text-ink">
            <X size={18} />
          </button>
          <h2 className="text-lg font-bold tracking-tight text-ink">Configurações</h2>
          <p className="mt-1 text-sm text-mute">Gerencie o usuário e a senha de acesso ao ArrPulse.</p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-lg border border-edge bg-panel2 px-3 py-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary/10 text-secondary">
                <User size={18} />
              </span>
              <div className="leading-tight">
                <p className="text-sm font-semibold text-ink">{username || 'admin'}</p>
                <p className="text-xs text-faint">usuário atual</p>
              </div>
            </div>

            <div className="space-y-3">
              <p className="font-mono text-[11px] uppercase tracking-wider text-secondary">Alterar credenciais</p>
              <div>
                <label className={labelCls}>Senha atual</label>
                <div className="relative">
                  <Lock size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
                  <input className={`${field} pl-9 font-mono`} type="password" value={curPass} onChange={(e) => setCurPass(e.target.value)} placeholder="••••••••" />
                </div>
              </div>
              <div>
                <label className={labelCls}>Novo usuário</label>
                <input className={`${field} font-mono`} value={newUser} onChange={(e) => setNewUser(e.target.value)} placeholder="manter atual" />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className={labelCls}>Nova senha</label>
                  <input className={`${field} font-mono`} type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} placeholder="manter atual" />
                </div>
                <div className="flex-1">
                  <label className={labelCls}>Confirmar</label>
                  <input className={`${field} font-mono`} type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="repita a senha" />
                </div>
              </div>
              {msg && (
                <p className={`rounded-lg border px-3 py-2 text-sm ${msg.ok ? 'border-up/40 bg-up/5 text-up' : 'border-down/40 bg-down/5 text-down'}`}>{msg.text}</p>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-edge px-6 py-4">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-mute hover:text-ink">Fechar</button>
          <button onClick={handleSave} disabled={saving}
            className="rounded-lg bg-secondary px-4 py-2 text-sm font-semibold text-white hover:bg-secondarydim disabled:opacity-40">
            {saving ? 'salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}
