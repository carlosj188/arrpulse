// Cripto de autenticação — funções puras (sem DB), testáveis isoladamente.
import crypto from 'node:crypto';

const SECRET = process.env.APP_SECRET || '';

// --- Senha: scrypt com salt aleatório ---
export function hashPassword(plain) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(plain), salt, 64);
  return `scrypt:${salt.toString('base64')}:${hash.toString('base64')}`;
}

export function verifyPassword(plain, stored) {
  if (!stored) return false;
  const [scheme, saltB, hashB] = String(stored).split(':');
  if (scheme !== 'scrypt' || !saltB || !hashB) return false;
  try {
    const salt = Buffer.from(saltB, 'base64');
    const expected = Buffer.from(hashB, 'base64');
    const got = crypto.scryptSync(String(plain), salt, expected.length);
    return crypto.timingSafeEqual(got, expected);
  } catch {
    return false;
  }
}

// --- Token de sessão: base64url(payload).hmacHex (stateless, assinado com APP_SECRET) ---
function b64url(s) {
  return Buffer.from(s).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(s) {
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
}
function hmac(data) {
  return crypto.createHmac('sha256', SECRET).update(data).digest('hex');
}

export function signToken(payload) {
  const body = b64url(JSON.stringify(payload));
  return `${body}.${hmac(body)}`;
}

export function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expect = hmac(body);
  if (sig.length !== expect.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return null;
  let payload;
  try { payload = JSON.parse(b64urlDecode(body)); } catch { return null; }
  if (!payload || !payload.exp || Date.now() > payload.exp) return null;
  return payload;
}
