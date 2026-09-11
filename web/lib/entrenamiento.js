// Lo que los lideres enseñan a los bots desde la pestaña Bots, leido por
// los webhooks: las lecciones, la memoria y los interruptores. Ver
// sql/024_entrenar.sql.
//
// Todo va con cache de un minuto en memoria: un mensaje en el grupo no
// tiene que costar tres lecturas a la base, y Vercel de todas formas
// recicla la funcion cada poco. Un minuto de retraso entre guardar en el
// panel y que el bot lo aplique es aceptable; se avisa en la pantalla.
//
// Y nunca revienta: si la base no contesta, no hay lecciones, la memoria
// esta vacia y los interruptores estan como por defecto. Un bot que se
// cae porque la tabla de lecciones no existe es peor que uno sin lecciones.

import { elegirLeccion, aplicarLeccion } from './lecciones.js';

const CACHE_MS = 60_000;
const CLAVES = ['bots_memoria', 'ia_activa', 'valquiria_grupo', 'bienvenida', 'avisos_youtube'];
let cache = { hasta: 0, lecciones: [], config: {} };

async function cargar(admin) {
  if (Date.now() < cache.hasta) return cache;
  try {
    const [l, c] = await Promise.all([
      admin.from('lecciones').select('id, bot, cuando, respuesta, activa').eq('activa', true).limit(300),
      admin.from('config').select('clave, valor').in('clave', CLAVES),
    ]);
    cache = {
      hasta: Date.now() + CACHE_MS,
      lecciones: l?.data ?? [],
      config: Object.fromEntries((c?.data ?? []).map((x) => [x.clave, x.valor])),
    };
  } catch {
    cache = { hasta: Date.now() + CACHE_MS, lecciones: [], config: {} };
  }
  return cache;
}

/** Para que el panel vea el cambio sin esperar el minuto (misma instancia). */
export function olvidarCache() {
  cache = { hasta: 0, lecciones: [], config: {} };
}

/**
 * La respuesta enseñada para este texto, o null. Cuenta el uso.
 * @param {'heraldo'|'valquiria'} bot
 */
export async function leccionPara(admin, bot, texto, nombre = null) {
  const { lecciones } = await cargar(admin);
  const l = elegirLeccion(lecciones, texto, bot);
  if (!l) return null;
  try {
    await admin.rpc('leccion_usada', { p_id: l.id });
  } catch {
    /* el contador es informativo */
  }
  console.log(`[leccion] #${l.id} "${l.cuando}" por ${bot}`);
  return aplicarLeccion(l, nombre);
}

/** El texto libre de los lideres para la IA, recortado. Vacio si no hay. */
export async function memoriaDeLideres(admin) {
  const { config } = await cargar(admin);
  return String(config.bots_memoria ?? '').trim().slice(0, 2000);
}

/** Un interruptor de la tabla config. Si no existe, lo que se pase por defecto. */
export async function ajusteWeb(admin, clave, porDefecto = true) {
  const { config } = await cargar(admin);
  const v = config[clave];
  return v === undefined || v === null ? porDefecto : Boolean(v);
}
