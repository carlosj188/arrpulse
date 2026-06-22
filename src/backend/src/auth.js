// Gestão do usuário único (estilo Radarr/Sonarr): credenciais em settings,
// setup no primeiro acesso, sessão por token assinado.
import { db } from './db.js';
import { hashPassword, verifyPassword, signToken } from './authcrypto.js';

const getS = db.prepare('SELECT value FROM settings WHERE key = ?');
const setS = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
const delS = db.prepare("DELETE FROM settings WHERE key IN ('auth_user', 'auth_pass')");

const get = (k) => { const r = getS.get(k); return r ? r.value : null; };

export function isConfigured() {
  return !!get('auth_pass');
}

export function getUsername() {
  return get('auth_user') || 'admin';
}

export function setCredentials(username, password) {
  setS.run('auth_user', String(username || 'admin').trim() || 'admin');
  setS.run('auth_pass', hashPassword(password));
}

// Valida login. Retorna a sessão { token, exp } ou null.
export function login(username, password, remember) {
  const u = get('auth_user') || 'admin';
  const pass = get('auth_pass');
  const userOk = String(username || '').trim().toLowerCase() === u.toLowerCase();
  if (!userOk || !verifyPassword(password, pass)) return null;
  return makeSession(remember);
}

export function makeSession(remember) {
  const days = remember ? 90 : 1;
  const exp = Date.now() + days * 864e5;
  return { token: signToken({ u: getUsername(), exp }), exp, username: getUsername() };
}

// Troca de credenciais (exige a senha atual). Retorna { ok } ou { error }.
export function changeCredentials({ currentPassword, newUsername, newPassword }) {
  if (!verifyPassword(currentPassword, get('auth_pass'))) return { error: 'senha atual incorreta' };
  if (newUsername && newUsername.trim()) setS.run('auth_user', newUsername.trim());
  if (newPassword && newPassword.trim()) {
    if (newPassword.trim().length < 6) return { error: 'a nova senha deve ter ao menos 6 caracteres' };
    setS.run('auth_pass', hashPassword(newPassword.trim()));
  }
  return { ok: true, username: getUsername() };
}

// Bootstrap opcional via .env no primeiro boot (não sobrescreve se já configurado).
export function seedAuthFromEnv() {
  if (!isConfigured() && process.env.AUTH_PASSWORD) {
    setCredentials(process.env.AUTH_USERNAME || 'admin', process.env.AUTH_PASSWORD);
    console.warn('[ArrPulse] credenciais iniciais definidas via AUTH_USERNAME/AUTH_PASSWORD (.env).');
  }
}

// Recuperação: AUTH_RESET=1 apaga credenciais e reabre o cadastro no próximo acesso.
export function resetAuthIfRequested() {
  if (process.env.AUTH_RESET === '1') {
    delS.run();
    console.warn('[ArrPulse] AUTH_RESET=1: credenciais apagadas — refaça o cadastro no próximo acesso.');
  }
}
