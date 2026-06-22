import Database from 'better-sqlite3';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'data', 'arr-watch.db');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS services (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  type          TEXT NOT NULL,              -- radarr | sonarr | prowlarr | jellyfin | qbittorrent
  name          TEXT NOT NULL,
  base_url      TEXT NOT NULL,
  api_key_enc   TEXT,                       -- API key criptografada (Servarr/Jellyfin)
  username      TEXT,                       -- reservado p/ qBittorrent (próxima fase)
  password_enc  TEXT,                       -- reservado p/ qBittorrent (próxima fase)
  status        TEXT NOT NULL DEFAULT 'unknown',  -- up | degraded | down | unknown
  status_since  TEXT,                       -- ISO: quando o status atual começou
  last_check    TEXT,                       -- ISO: última verificação
  last_error    TEXT,
  version        TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

db.exec(`
CREATE TABLE IF NOT EXISTS events (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  type         TEXT NOT NULL,              -- status_change | test
  service_id   INTEGER,
  service_name TEXT,
  service_type TEXT,
  severity     TEXT NOT NULL DEFAULT 'info',  -- info | warning | critical
  title        TEXT,
  message      TEXT,
  notified     INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);
`);

// Migração: coluna webhook_token + backfill para serviços existentes
const cols = db.prepare('PRAGMA table_info(services)').all().map((c) => c.name);
if (!cols.includes('webhook_token')) {
  db.exec('ALTER TABLE services ADD COLUMN webhook_token TEXT');
}
const missing = db.prepare("SELECT id FROM services WHERE webhook_token IS NULL OR webhook_token = ''").all();
const setToken = db.prepare('UPDATE services SET webhook_token = ? WHERE id = ?');
for (const r of missing) setToken.run(crypto.randomBytes(16).toString('hex'), r.id);

// Migração: timeout de verificação por serviço (ms). NULL = usa o default por tipo no conector.
if (!cols.includes('timeout_ms')) {
  db.exec('ALTER TABLE services ADD COLUMN timeout_ms INTEGER');
}

// Migração: snapshot JSON do /health do serviço — { issues:[...], update:{available,version} }.
// Alimenta o selo de "atualização disponível" e a lista de motivos do degradado no card.
if (!cols.includes('health_json')) {
  db.exec('ALTER TABLE services ADD COLUMN health_json TEXT');
}

// Migração: coluna 'deferred' — eventos represados no horário silencioso, entregues
// em lote (um resumo) assim que o silêncio termina.
const evCols = db.prepare('PRAGMA table_info(events)').all().map((c) => c.name);
if (!evCols.includes('deferred')) {
  db.exec('ALTER TABLE events ADD COLUMN deferred INTEGER NOT NULL DEFAULT 0');
}

// Limpeza única: eventos de teste antigos ficaram com type 'webhook' (antes da dedup).
// Os novos usam type 'test', então isso só remove o legado.
db.prepare("DELETE FROM events WHERE type = 'webhook' AND message = 'teste do Connect recebido'").run();
