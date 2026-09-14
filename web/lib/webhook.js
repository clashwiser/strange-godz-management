// Lo comun de los dos webhooks de Telegram (Heraldo y Valquiria).
//
// Telegram reenvia el MISMO update si no le contestamos rapido, y sigue
// reenviandolo hasta que le contesten. El 14 sep 2026 Supabase estuvo
// caido unos minutos, cada peticion se quedo colgada hasta que Vercel la
// mato (30-60 s), y el grupo vio tres bienvenidas de Valquiria y a Heraldo
// contestando dos veces cada cosa. Dos defensas:
//
//   1. Contestar 200 al instante y atender el update DESPUES (after() de
//      Next: Vercel mantiene la funcion viva hasta terminar).
//   2. Un update_id ya visto se ignora, por si el reenvio llega igual.

const vistos = new Map();
const TTL_MS = 10 * 60 * 1000;
const TOPE = 2000;

/** True si este update_id ya paso por aqui (en esta instancia, ultimos 10 min). */
export function yaVisto(updateId) {
  if (updateId == null) return false;
  const ahora = Date.now();
  const antes = vistos.get(updateId);
  if (antes && ahora - antes < TTL_MS) return true;
  vistos.set(updateId, ahora);
  if (vistos.size > TOPE) {
    for (const [id, t] of vistos) {
      if (vistos.size <= TOPE / 2) break;
      if (ahora - t >= TTL_MS || vistos.size > TOPE) vistos.delete(id);
    }
  }
  return false;
}

/** Solo para las pruebas. */
export function olvidarVistos() {
  vistos.clear();
}
