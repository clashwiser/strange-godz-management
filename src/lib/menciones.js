// Convierte tags de jugador en menciones de Telegram.
//
// Un aviso que solo lista nombres no avisa a nadie: el que no ataco es
// justo el que no esta mirando el grupo. Mencionado, le suena el telefono.
//
// Solo se puede mencionar a quien se haya atado con "Heraldo yo soy
// Fulano". Al que no lo hizo se le sigue nombrando en la lista de texto,
// como hasta ahora — no se pierde nada, simplemente no le vibra.

import { db } from './db.js';

/**
 * @param {string[]} tags  player_tag de la gente a mencionar
 * @returns {Promise<Array<{id:number, nombre:string}>>}
 */
export async function mencionesDe(tags) {
  const unicos = [...new Set(tags.filter(Boolean))];
  if (!unicos.length) return [];

  const { data, error } = await db
    .from('tg_vinculos')
    .select('tg_user_id, player_tag, tg_nombre')
    .in('player_tag', unicos);

  // Un fallo aqui no puede tumbar el aviso: sin menciones sigue saliendo.
  if (error) {
    console.log(`  [menciones] no se pudieron leer: ${error.message}`);
    return [];
  }

  const { data: jugadores } = await db
    .from('players')
    .select('player_tag, nombre_actual')
    .in('player_tag', unicos);
  const nombre = Object.fromEntries((jugadores ?? []).map((p) => [p.player_tag, p.nombre_actual]));

  return (data ?? []).map((v) => ({
    id: v.tg_user_id,
    // El nombre del JUEGO, no el de Telegram: es el que la gente reconoce
    // en la lista de arriba del mismo mensaje.
    nombre: nombre[v.player_tag] ?? v.tg_nombre ?? 'jugador',
  }));
}
