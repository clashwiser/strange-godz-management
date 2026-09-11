// Las correcciones del grupo se vuelven lecciones propuestas.
//
// Alguien contesta a un mensaje del bot: "no, Heraldo, los castillos se
// donan antes del dia de batalla". El cerebro guarda una leccion
// PROPUESTA (inactiva) con lo que dijo el bot y la correccion, y un lider
// la completa -que frase la dispara- y la aprueba en Cerebro > Entrenar.
// Nada se aprende solo: eso lo deciden ellos.

import { esCorreccion, limpiarCorreccion } from './lecciones.js';

const MARCADOR = '(por decidir)';
const TOPE_DIA = 10;

export { esCorreccion };

/**
 * Anota la propuesta. Devuelve el texto para el grupo, o null si no
 * procede (tope del dia, correccion vacia).
 *
 * @param {object} admin
 * @param {{ bot:'heraldo'|'valquiria', dijo:string, correccion:string, quien:string }} p
 */
export async function proponerLeccion(admin, { bot, dijo, correccion, quien }) {
  // "no, Heraldo, eso esta mal" no trae la respuesta buena: se guarda con
  // el marcador y el lider la escribe al aprobar.
  const respuesta = limpiarCorreccion(correccion).slice(0, 1500) || MARCADOR;

  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Havana' });
  const { count } = await admin
    .from('lecciones')
    .select('*', { count: 'exact', head: true })
    .eq('propuesta', true)
    .gte('creado_en', `${hoy}T00:00:00-04:00`);
  if ((count ?? 0) >= TOPE_DIA) return null;

  const { error } = await admin.from('lecciones').insert({
    bot,
    cuando: MARCADOR,
    respuesta,
    activa: false,
    propuesta: true,
    contexto: String(dijo ?? '').slice(0, 1500),
    propuesta_por: String(quien ?? '').slice(0, 60),
  });
  if (error) {
    console.error(`[correcciones] ${error.message}`);
    return null;
  }
  return `📝 Anotado, ${quien}. Lo reviso con los líderes y, si lo aprueban, lo aprendo.`;
}
