import crypto from 'node:crypto';

const SECRET = process.env.APP_SECRET || '';
if (!SECRET) {
  console.warn('[arrpulse] AVISO: APP_SECRET não definido. Defina no .env para proteger as credenciais no banco.');
}
// 32 bytes derivados do APP_SECRET
const key = crypto.createHash('sha256').update(SECRET).digest();

// Formato armazenado: base64(iv):base64(tag):base64(ciphertext)
export function encrypt(plain) {
  if (plain == null || plain === '') return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('base64'), tag.toString('base64'), ct.toString('base64')].join(':');
}

export function decrypt(enc) {
  if (!enc) return null;
  try {
    const [ivB, tagB, ctB] = enc.split(':');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivB, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(ctB, 'base64')), decipher.final()]).toString('utf8');
  } catch {
    // APP_SECRET trocada ou dado corrompido — degrada sem derrubar (serviço aparecerá como 401/down)
    console.warn('[ArrPulse] falha ao descriptografar credencial (APP_SECRET mudou?).');
    return null;
  }
}
