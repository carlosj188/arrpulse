import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { db } from './db.js';
import { encrypt, decrypt } from './crypto.js';
import { probe } from './connectors/index.js';
import { parseWebhook } from './webhooks.js';
import { checkService, startPoller } from './poller.js';
import { getPublicSettings, getSettings, setSettings, seedSettingsFromEnv } from './settings.js';
import { listEvents, clearServiceEventsByType, clearAllEvents, eventStats } from './events.js';
import { pushTest, startQuietScheduler } from './notify.js';
import { addImport, configureImportSink } from './import-batcher.js';
import { startDigestScheduler, runDigest } from './digest.js';
import { startUpdatesScheduler, runUpdates } from './updates.js';
import { emitEvent } from './emit.js';
import { verifyToken } from './authcrypto.js';
import { isConfigured, getUsername, setCredentials, login, makeSession, changeCredentials, seedAuthFromEnv, resetAuthIfRequested } from './auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST || '0.0.0.0';
const POLL_INTERVAL = Number(process.env.POLL_INTERVAL || 60);

// Tipos liberados na Fase 1
const ALLOWED_TYPES = ['radarr', 'sonarr', 'prowlarr', 'jellyfin', 'qbittorrent'];

// Normaliza timeout vindo da UI: vazio/inválido => null (usa default por tipo); senão clampa 1s..60s.
function normTimeout(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(60000, Math.max(1000, Math.round(n)));
}

const PUBLIC_COLS = 'id, type, name, base_url, status, status_since, last_check, last_error, version, health_json, timeout_ms, webhook_token, created_at';
const listStmt = db.prepare(`SELECT ${PUBLIC_COLS} FROM services ORDER BY created_at ASC`);
const getStmt = db.prepare('SELECT * FROM services WHERE id = ?');
const getPublicStmt = db.prepare(`SELECT ${PUBLIC_COLS} FROM services WHERE id = ?`);
const getByTokenStmt = db.prepare('SELECT * FROM services WHERE webhook_token = ?');
const insertStmt = db.prepare(
  'INSERT INTO services (type, name, base_url, api_key_enc, username, password_enc, webhook_token, timeout_ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
);
const delStmt = db.prepare('DELETE FROM services WHERE id = ?');
const updateStmt = db.prepare('UPDATE services SET name = ?, base_url = ?, api_key_enc = ?, username = ?, password_enc = ?, timeout_ms = ? WHERE id = ?');

const app = Fastify({ logger: true });

// --- Autenticação: protege /api/* (exceto login/setup/status, health e webhooks) ---
const AUTH_PUBLIC = new Set(['/api/health', '/api/auth/status', '/api/auth/login', '/api/auth/setup']);
app.addHook('onRequest', async (req, reply) => {
  const url = req.raw.url || '';
  if (!url.startsWith('/api')) return; // arquivos estáticos / SPA
  const path = url.split('?')[0];
  if (AUTH_PUBLIC.has(path) || path.startsWith('/api/hooks/')) return; // webhooks têm token próprio na URL
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!verifyToken(token)) return reply.code(401).send({ error: 'não autenticado' });
});

// --- API ---
app.get('/api/health', async () => ({ ok: true, name: 'arrpulse' }));

// status do cadastro (público): decide entre tela de cadastro x login
app.get('/api/auth/status', async () => ({ configured: isConfigured() }));

// primeiro acesso: cria o usuário único (só se ainda não configurado)
app.post('/api/auth/setup', async (req, reply) => {
  if (isConfigured()) return reply.code(409).send({ error: 'já configurado' });
  const { username, password } = req.body || {};
  if (!password || String(password).length < 6) return reply.code(400).send({ error: 'senha de ao menos 6 caracteres' });
  setCredentials(username || 'admin', password);
  return makeSession(true);
});

app.post('/api/auth/login', async (req, reply) => {
  const { username, password, remember } = req.body || {};
  const sess = login(username, password, !!remember);
  if (!sess) {
    await new Promise((r) => setTimeout(r, 400)); // atrasa tentativa inválida
    return reply.code(401).send({ error: 'usuário ou senha inválidos' });
  }
  return sess;
});

app.get('/api/auth/me', async () => ({ username: getUsername() }));

app.post('/api/auth/change', async (req, reply) => {
  const r = changeCredentials(req.body || {});
  if (r.error) return reply.code(400).send(r);
  return r;
});

app.get('/api/services', async () => listStmt.all());

app.post('/api/services', async (req, reply) => {
  const { type, name, base_url, api_key, username, password, timeout_ms } = req.body || {};
  if (!ALLOWED_TYPES.includes(type)) return reply.code(400).send({ error: 'tipo não suportado nesta fase' });
  if (!name || !base_url) return reply.code(400).send({ error: 'name e base_url são obrigatórios' });

  const isQbit = type === 'qbittorrent';
  const info = insertStmt.run(
    type,
    name,
    base_url.replace(/\/+$/, ''),
    isQbit ? null : encrypt(api_key),
    isQbit ? (username || null) : null,
    isQbit ? encrypt(password) : null,
    crypto.randomBytes(16).toString('hex'),
    normTimeout(timeout_ms)
  );
  const row = getStmt.get(info.lastInsertRowid);
  try { await checkService(row); } catch (e) { app.log.warn(e.message); }
  return reply.code(201).send(getPublicStmt.get(info.lastInsertRowid));
});

// Testa sem salvar
app.post('/api/services/test', async (req, reply) => {
  const { type, base_url, api_key, username, password, id, timeout_ms } = req.body || {};
  if (!ALLOWED_TYPES.includes(type)) return reply.code(400).send({ ok: false, error: 'tipo não suportado nesta fase' });
  if (!base_url) return reply.code(400).send({ ok: false, error: 'base_url é obrigatório' });

  // edição: se um campo veio em branco, usa o que está salvo no serviço
  let key = api_key, pass = password, user = username;
  let to = normTimeout(timeout_ms);
  if (id) {
    const row = getStmt.get(id);
    if (row) {
      if (!key) key = row.api_key_enc ? decrypt(row.api_key_enc) : null;
      if (!pass) pass = row.password_enc ? decrypt(row.password_enc) : null;
      if (!user) user = row.username;
      if (timeout_ms === undefined) to = row.timeout_ms;
    }
  }

  const p = await probe({ type, base_url: base_url.replace(/\/+$/, ''), api_key: key, username: user, password: pass, timeout_ms: to });
  return {
    ok: p.ok,
    version: p.version || null,
    instanceName: p.instanceName || null,
    issues: p.issues?.length || 0,
    error: p.error || null,
  };
});

// Editar conexão de um serviço (campos de credencial em branco = manter o atual)
app.put('/api/services/:id', async (req, reply) => {
  const row = getStmt.get(req.params.id);
  if (!row) return reply.code(404).send({ error: 'não encontrado' });

  const { name, base_url, api_key, username, password, timeout_ms } = req.body || {};
  const newName = (name && name.trim()) || row.name;
  const newUrl = ((base_url && base_url.trim()) || row.base_url).replace(/\/+$/, '');
  // timeout: ausente no body mantém o atual; presente (inclui vazio) regrava (vazio = auto/null)
  const newTimeout = timeout_ms === undefined ? row.timeout_ms : normTimeout(timeout_ms);

  // credenciais: só mudam se vier valor novo (em branco mantém o atual)
  const isQbit = row.type === 'qbittorrent';
  let apiKeyEnc = row.api_key_enc;
  let usernameVal = row.username;
  let passwordEnc = row.password_enc;
  if (isQbit) {
    if (username !== undefined) usernameVal = (username && username.trim()) || null;
    if (password && password.trim()) passwordEnc = encrypt(password.trim());
  } else if (api_key && api_key.trim()) {
    apiKeyEnc = encrypt(api_key.trim());
  }

  updateStmt.run(newName, newUrl, apiKeyEnc, usernameVal, passwordEnc, newTimeout, req.params.id);
  const updated = getStmt.get(req.params.id);
  try { await checkService(updated); } catch (e) { app.log.warn(e.message); }
  return getPublicStmt.get(req.params.id);
});

app.post('/api/services/:id/refresh', async (req, reply) => {
  const row = getStmt.get(req.params.id);
  if (!row) return reply.code(404).send({ error: 'não encontrado' });
  try { await checkService(row); } catch (e) { return reply.code(502).send({ error: String(e.message) }); }
  return getPublicStmt.get(req.params.id);
});

app.delete('/api/services/:id', async (req, reply) => {
  delStmt.run(req.params.id);
  return reply.code(204).send();
});

// --- Receptor de webhooks dos arr (Connect -> Webhook) ---
// URL por serviço: POST /api/hooks/<webhook_token>
app.post('/api/hooks/:token', async (req, reply) => {
  const svc = getByTokenStmt.get(req.params.token);
  if (!svc) return reply.code(404).send({ error: 'token inválido' });

  const parsed = parseWebhook(svc.type, req.body || {}, getSettings());
  if (!parsed) return { ok: true, ignored: true };

  // imports do Sonarr são agrupados por série (1 notificação no fim da janela)
  if (parsed.batch) {
    addImport({ serviceId: svc.id, serviceName: svc.name, serviceType: svc.type, ...parsed.item });
    return { ok: true, batched: true };
  }

  const ev = { ...parsed, service_id: svc.id, service_name: svc.name, service_type: svc.type };
  // eventos de teste não acumulam: mantém só o último por serviço
  if (parsed.type === 'test') clearServiceEventsByType(svc.id, 'test');
  await emitEvent(ev, { push: parsed.push });
  return { ok: true };
});

// --- Eventos ---
app.get('/api/events', async (req) => {
  const { limit, severity, type, search, days } = req.query || {};
  return listEvents({ limit, severity, type, search, days });
});

app.delete('/api/events', async () => ({ ok: true, cleared: clearAllEvents() }));

// --- Estatísticas (dashboard) ---
const svcSummaryStmt = db.prepare('SELECT status, COUNT(*) AS c FROM services GROUP BY status');
app.get('/api/stats', async () => {
  const services = { total: 0, up: 0, degraded: 0, down: 0, unknown: 0 };
  for (const r of svcSummaryStmt.all()) {
    services[r.status] = r.c;
    services.total += r.c;
  }
  return { services, events: eventStats(7) };
});

// --- Configurações (ntfy) ---
app.get('/api/settings', async () => getPublicSettings());

app.put('/api/settings', async (req) => setSettings(req.body || {}));

// Envia uma notificação de teste para todos os canais configurados
app.post('/api/notify/test', async () => pushTest());

// Roda o digest de faltantes agora (e envia push se habilitado) — para teste
app.post('/api/digest/test', async () => runDigest());

// Roda o aviso de atualizações agora (e envia push se habilitado) — para teste
app.post('/api/updates/test', async () => runUpdates());

// --- Frontend estático (servido pelo mesmo container em produção) ---
if (fs.existsSync(PUBLIC_DIR)) {
  await app.register(fastifyStatic, { root: PUBLIC_DIR, prefix: '/' });
  app.setNotFoundHandler((req, reply) => {
    if (req.raw.method === 'GET' && !req.raw.url.startsWith('/api')) {
      return reply.sendFile('index.html');
    }
    reply.code(404).send({ error: 'não encontrado' });
  });
}

try {
  seedSettingsFromEnv();
  resetAuthIfRequested();
  seedAuthFromEnv();
  configureImportSink((agg) => {
    // imports "limpos" (info) respeitam o toggle de importações; alertas (manual/idioma) sempre passam
    const push = agg.force ? true : getSettings().notify_imports;
    return emitEvent({
      type: 'webhook', severity: agg.severity, title: agg.title, message: agg.message,
      service_id: agg.serviceId, service_name: agg.serviceName, service_type: agg.serviceType,
    }, { push });
  });
  await app.listen({ port: PORT, host: HOST });
  startPoller(POLL_INTERVAL);
  startDigestScheduler();
  startUpdatesScheduler();
  startQuietScheduler();
  app.log.info(`ArrPulse ouvindo em ${HOST}:${PORT} — poll a cada ${POLL_INTERVAL}s`);
} catch (e) {
  app.log.error(e);
  process.exit(1);
}
