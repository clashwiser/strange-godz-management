// De donde salen los clanes de la alianza.
//
// Antes salian SOLO de la variable CLAN_TAGS del entorno. Eso significaba
// que anadir un clan obligaba a editar un secreto de GitHub, o sea que ni
// Carlos ni Deibis podian hacerlo por su cuenta aunque fueran lideres. Y
// peor: si daban de alta un clan desde el panel, los jobs seguian leyendo
// los tags viejos y ese clan no se sincronizaba nunca. La pantalla decia
// una cosa y el cron hacia otra.
//
// Ahora manda la BASE DE DATOS, que es lo que el panel escribe. El entorno
// queda como respaldo de arranque: la primera vez la tabla `clans` esta
// vacia y hay que sembrarla desde algun lado.

import { db } from './db.js';

/** "#AAAA:A,#BBBB:B" -> [{clan_tag, escuadra}] */
function delEntorno() {
  return (process.env.CLAN_TAGS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((par) => {
      const [tag, escuadra] = par.split(':').map((x) => x.trim());
      if (!tag) throw new Error(`CLAN_TAGS mal formado en "${par}". Formato: #TAG:A`);
      return { clan_tag: tag.toUpperCase(), escuadra: (escuadra || 'A').toUpperCase() };
    });
}

/**
 * Los clanes que hay que sincronizar, en orden.
 *
 * Solo los activos: retirar un clan es marcarlo `activo = false`, nunca
 * borrarlo, porque borrarlo se lleva en cascada meses de snapshots y
 * ataques que la API ya no devuelve.
 */
export async function clanes() {
  const { data, error } = await db
    .from('clans')
    .select('clan_tag, escuadra, es_principal, cwl_tamano, activo')
    .eq('activo', true)
    .order('orden', { nullsFirst: false })
    .order('clan_tag');

  // Un fallo de red leyendo la tabla no debe dejar al cron sin hacer nada:
  // se cae al entorno, que como minimo trae la alianza original.
  if (error) {
    console.warn(`[config] no se pudo leer clans (${error.message}); uso CLAN_TAGS`);
    return validar(delEntorno());
  }

  if (data?.length) return data;

  // Primer arranque: la tabla esta vacia y hay que sembrarla.
  console.log('[config] tabla clans vacia; uso CLAN_TAGS del entorno');
  return validar(delEntorno());
}

function validar(lista) {
  if (!lista.length) {
    throw new Error(
      'No hay clanes. La tabla `clans` esta vacia y CLAN_TAGS tampoco trae nada. ' +
        'Formato: "#AAAA:A,#BBBB:B,#CCCC:C"'
    );
  }
  return lista;
}

/** Temporada de CWL en formato YYYY-MM segun la fecha UTC de hoy. */
export function temporadaActual(d = new Date()) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Fecha UTC de hoy en YYYY-MM-DD. */
export function hoyUTC(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

/** Cuantas horas faltan para un instante dado. */
export function horasHasta(fecha, ahora = new Date()) {
  return (fecha.getTime() - ahora.getTime()) / 3_600_000;
}

// ---------- Los interruptores de la pestaña Bots ----------
//
// Viven en la tabla `config` (sql/008_config.sql y 024_entrenar.sql) y los
// edita el panel. Hasta septiembre de 2026 los jobs NO los leian: la
// pestaña enseñaba "Ataques de CWL sin usar: apagado" y el job avisaba
// igual. Ahora cada job pregunta aqui al arrancar.
//
// Si la tabla no contesta, manda el valor por defecto: un fallo de red no
// puede apagar un aviso, ni encenderlo.

let cacheAjustes = null;

async function ajustes() {
  if (cacheAjustes) return cacheAjustes;
  const { data, error } = await db.from('config').select('clave, valor');
  if (error) {
    console.warn(`[config] no se pudo leer config (${error.message}); valores por defecto`);
    return {};
  }
  cacheAjustes = Object.fromEntries((data ?? []).map((r) => [r.clave, r.valor]));
  return cacheAjustes;
}

/** Un interruptor (booleano) de la tabla config. */
export async function ajuste(clave, porDefecto = true) {
  const v = (await ajustes())[clave];
  return v === undefined || v === null ? porDefecto : Boolean(v);
}

/** Un valor cualquiera de la tabla config (numero, lista, texto). */
export async function valorDe(clave, porDefecto = null) {
  const v = (await ajustes())[clave];
  return v === undefined || v === null ? porDefecto : v;
}

/**
 * El id del grupo de Telegram que vale AHORA. Telegram le cambia el id a un
 * grupo cuando lo convierte en supergrupo (paso el 12 sep 2026) y el
 * secreto TELEGRAM_CHAT_ID de GitHub se queda viejo hasta que alguien lo
 * cambie a mano: por eso manda config.telegram_grupo_id, que escribe el
 * webhook al ver la migracion (web/lib/grupo.js). Sin eso, el env.
 */
export async function grupoTelegram() {
  const delEnv = (process.env.TELEGRAM_CHAT_ID || '')
    .split(',')
    .map((x) => x.trim())
    .find((x) => x.startsWith('-')) ?? null;
  const migrado = await valorDe('telegram_grupo_id', null);
  const limpio = migrado == null ? null : String(migrado).replace(/"/g, '').trim();
  return limpio || delEnv;
}

/** Lo que dice un job cuando lo apagaron desde el panel. */
export function apagado(clave) {
  console.log(`  apagado desde el panel (${clave})`);
  return { filas: 0, detalle: { apagado: clave } };
}
