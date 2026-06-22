import { createEvent, markNotified, markDeferred } from './events.js';
import { getSettings } from './settings.js';
import { pushEvent } from './notify.js';

// Grava o evento e dispara o push (se habilitado e push !== false).
// Centraliza a lógica que antes estava repetida no poller, webhook, digest e agrupador.
export async function emitEvent(ev, { push = true } = {}) {
  const id = createEvent(ev);
  let pushed = false;
  if (push && getSettings().push_enabled) {
    try {
      const r = await pushEvent(ev);
      if (r.deferred) markDeferred(id);          // represado pelo silêncio: entregue depois em lote
      else if (r.ok) { markNotified(id); pushed = true; }
    } catch (e) {
      console.error('[ArrPulse] falha no push:', e.message);
    }
  }
  return { id, pushed };
}
