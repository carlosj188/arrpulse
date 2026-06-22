import { db } from './db.js';

const insertStmt = db.prepare(`
  INSERT INTO events (type, service_id, service_name, service_type, severity, title, message, notified)
  VALUES (?, ?, ?, ?, ?, ?, ?, 0)
`);
const markStmt = db.prepare('UPDATE events SET notified = 1 WHERE id = ?');
const markDeferredStmt = db.prepare('UPDATE events SET deferred = 1, notified = 0 WHERE id = ?');
const listDeferredStmt = db.prepare('SELECT * FROM events WHERE deferred = 1 ORDER BY id ASC');
const clearDeferredStmt = db.prepare('UPDATE events SET deferred = 0, notified = 1 WHERE deferred = 1');
const clearByTypeStmt = db.prepare('DELETE FROM events WHERE service_id = ? AND type = ?');
const pruneByDateStmt = db.prepare("DELETE FROM events WHERE created_at < datetime('now', '-7 days')");
const pruneByCapStmt = db.prepare('DELETE FROM events WHERE id NOT IN (SELECT id FROM events ORDER BY id DESC LIMIT 2000)');
const clearAllStmt = db.prepare('DELETE FROM events');
const perDayStmt = db.prepare(`
  SELECT date(created_at, 'localtime') AS day,
         COUNT(*) AS total,
         SUM(CASE WHEN severity IN ('warning','critical') THEN 1 ELSE 0 END) AS alerts
  FROM events
  WHERE created_at >= datetime('now', ?)
  GROUP BY day
  ORDER BY day
`);
const todayStmt = db.prepare("SELECT COUNT(*) AS c FROM events WHERE date(created_at, 'localtime') = date('now', 'localtime')");
const alertsSinceStmt = db.prepare("SELECT COUNT(*) AS c FROM events WHERE severity IN ('warning','critical') AND created_at >= datetime('now', ?)");
const totalSinceStmt = db.prepare("SELECT COUNT(*) AS c FROM events WHERE created_at >= datetime('now', ?)");
const bySeverityStmt = db.prepare("SELECT severity, COUNT(*) AS c FROM events WHERE created_at >= datetime('now', ?) GROUP BY severity");

export function createEvent(ev) {
  const info = insertStmt.run(
    ev.type,
    ev.service_id ?? null,
    ev.service_name ?? null,
    ev.service_type ?? null,
    ev.severity || 'info',
    ev.title || null,
    ev.message || null
  );
  pruneByDateStmt.run();
  pruneByCapStmt.run();
  return info.lastInsertRowid;
}

export function markNotified(id) {
  markStmt.run(id);
}

// Marca um evento como represado (silêncio): fica pendente até o flush ao fim do silêncio.
export function markDeferred(id) {
  markDeferredStmt.run(id);
}

// Eventos represados aguardando entrega em lote.
export function listDeferred() {
  return listDeferredStmt.all();
}

// Marca todos os represados como entregues (chamado após enviar o resumo).
export function clearDeferred() {
  return clearDeferredStmt.run().changes;
}

// Remove eventos de um tipo para um serviço (usado p/ deduplicar os 'test')
export function clearServiceEventsByType(serviceId, type) {
  clearByTypeStmt.run(serviceId, type);
}

export function listEvents({ limit = 50, severity = null, search = null, days = null } = {}) {
  const where = [];
  const params = [];

  if (severity) {
    where.push('severity = ?');
    params.push(severity);
  }
  if (search) {
    where.push('(title LIKE ? OR message LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }
  if (days) {
    where.push("created_at >= datetime('now', ?)");
    params.push(`-${Math.max(1, Number(days) || 7)} days`);
  }

  const cap = days ? Math.min(2000, Math.max(1, Number(limit) || 1000)) : Math.min(500, Math.max(1, Number(limit) || 50));
  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  params.push(cap);

  return db.prepare(`SELECT * FROM events ${whereClause} ORDER BY id DESC LIMIT ?`).all(...params);
}

export function clearAllEvents() {
  return clearAllStmt.run().changes;
}

export function eventStats(days = 7) {
  const off = `-${Math.max(1, Number(days) || 7)} days`;
  const sev = { info: 0, warning: 0, critical: 0 };
  for (const r of bySeverityStmt.all(off)) {
    if (r.severity in sev) sev[r.severity] = r.c;
  }
  return {
    today: todayStmt.get().c,
    alerts: alertsSinceStmt.get(off).c,
    total: totalSinceStmt.get(off).c,
    perDay: perDayStmt.all(off),
    bySeverity: sev,
  };
}
