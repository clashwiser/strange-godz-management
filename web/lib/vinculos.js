// Quien es quien: cuenta de Telegram -> cuentas de Clash.
//
// Una persona puede tener varias cuentas en el juego (es lo normal: la
// principal y una o dos mas), asi que tg_vinculos guarda UNA FILA POR
// CUENTA y una de ellas es la principal. Ver sql/032_tg_vinculos_varias.sql.
//
// Y el "/soy" a medias: cuando hay dos con ese nombre ("Dr Strange" son
// DR STRANGE~❤️ y ᴵᴬᴹ◎Dя Strange◎), el bot pregunta cual, y la gente
// contesta como habla: "las dos", "la primera", "1", o el nombre entero.
// Eso se guarda en soy_pendientes hasta que conteste (media hora).

import { plano, parecidos } from './nombres.js';

/** Cuanto se espera la respuesta a "¿cual de los dos eres?". */
const PENDIENTE_MIN = 30;

/** Las cuentas atadas a esta persona, la principal primero. */
export async function cuentasDe(admin, tgId) {
  if (!tgId) return [];
  const { data } = await admin
    .from('tg_vinculos')
    .select('player_tag, principal, creado_en')
    .eq('tg_user_id', tgId)
    .order('principal', { ascending: false })
    .order('creado_en', { ascending: true });
  return data ?? [];
}

/** Los tags atados, la principal primero. */
export async function tagsDe(admin, tgId) {
  return (await cuentasDe(admin, tgId)).map((c) => c.player_tag);
}

/** El tag principal, o null si no se presento. */
export async function tagPrincipal(admin, tgId) {
  return (await tagsDe(admin, tgId))[0] ?? null;
}

/**
 * Ata cuentas a una persona. Las que ya tenia se conservan (salvo con
 * reemplazar, que las quita); la primera que se ata es la principal.
 * Devuelve los tags que quedan atados.
 */
export async function vincular(admin, { tgId, tgNombre = null, tags, reemplazar = false }) {
  const nuevos = [...new Set(tags.filter(Boolean))];
  if (!tgId || !nuevos.length) return [];
  if (reemplazar) {
    await admin.from('tg_vinculos').delete().eq('tg_user_id', tgId);
  }
  const actuales = reemplazar ? [] : await cuentasDe(admin, tgId);
  const hayPrincipal = actuales.some((c) => c.principal);
  const filas = nuevos.map((tag, i) => ({
    tg_user_id: tgId,
    player_tag: tag,
    tg_nombre: tgNombre,
    principal: !hayPrincipal && i === 0 && !actuales.some((c) => c.player_tag === tag),
  }));
  // Las que ya estaban no cambian de principal: el upsert solo toca el nombre.
  const yaEstan = new Set(actuales.map((c) => c.player_tag));
  const aInsertar = filas.filter((f) => !yaEstan.has(f.player_tag));
  if (aInsertar.length) {
    const { error } = await admin.from('tg_vinculos').upsert(aInsertar, { onConflict: 'tg_user_id,player_tag' });
    if (error) throw error;
  }
  if (tgNombre) await admin.from('tg_vinculos').update({ tg_nombre: tgNombre }).eq('tg_user_id', tgId);
  return [...yaEstan, ...aInsertar.map((f) => f.player_tag)];
}

// ---------- El /soy a medias ----------

export async function guardarSoyPendiente(admin, tgId, candidatos) {
  await admin
    .from('soy_pendientes')
    .upsert({ tg_user_id: tgId, candidatos, creado_en: new Date().toISOString() }, { onConflict: 'tg_user_id' });
}

/** Los candidatos entre los que dudaba el bot, o null si no hay (o caduco). */
export async function soyPendiente(admin, tgId) {
  if (!tgId) return null;
  const { data } = await admin.from('soy_pendientes').select('candidatos, creado_en').eq('tg_user_id', tgId).maybeSingle();
  if (!data) return null;
  if (Date.now() - new Date(data.creado_en).getTime() > PENDIENTE_MIN * 60_000) {
    await olvidarSoyPendiente(admin, tgId);
    return null;
  }
  return Array.isArray(data.candidatos) && data.candidatos.length ? data.candidatos : null;
}

export async function olvidarSoyPendiente(admin, tgId) {
  await admin.from('soy_pendientes').delete().eq('tg_user_id', tgId);
}

// ---------- Entender la respuesta ----------

/** Minusculas sin tildes, con los signos convertidos en espacios. */
const suave = (s) =>
  String(s ?? '')
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const TODAS =
  /^(ambos|ambas|los dos|las dos|los 2|las 2|todas|todos|las tres|los tres|las 3|los 3|las cuatro|los cuatro|las 4|los 4|todas son mias|todas mias|las dos son mias|los dos son mios|son mias|son mios|tambien|esa tambien|esas tambien|la otra|las otras|la otra tambien|y la otra|y esa|si tambien|tambien es mia|tambien son mias|es mia|esa es mia)$/;
const ORDINAL = { primer: 1, primera: 1, primero: 1, segunda: 2, segundo: 2, tercera: 3, tercero: 3, cuarta: 4, cuarto: 4, quinta: 5, quinto: 5 };

/**
 * Que cuentas eligio, de entre los candidatos [{tag, nombre}]:
 *   "las dos" / "ambos" / "todas"      -> todas
 *   "también" / "la otra"              -> todas (las que quedaban por atar)
 *   "1", "la 2", "la primera", "1 y 2" -> esas
 *   "DR STRANGE~❤️" (o casi)           -> esa, si solo casa con una
 * Devuelve [] si no se entiende.
 */
export function interpretarEleccion(texto, candidatos) {
  if (!Array.isArray(candidatos) || !candidatos.length) return [];
  const crudo = suave(texto).replace(/^(yo soy|soy)\s+/, '');
  if (!crudo) return [];
  // "las dos", "la otra": antes de quitar articulos, que ahi son parte de la frase.
  if (TODAS.test(crudo)) return candidatos;
  const q = crudo.replace(/^(eres|es|la|el)\s+/, '').trim();
  if (!q) return [];
  if (TODAS.test(q)) return candidatos;

  // Numeros u ordinales, solos: "2", "la 1 y la 2", "el primero".
  const partes = q.split(' ').filter((p) => !['la', 'el', 'las', 'los', 'y', 'e', 'cuenta', 'cuentas', 'opcion', 'numero'].includes(p));
  const numeros = partes.map((p) => (/^\d$/.test(p) ? Number(p) : ORDINAL[p] ?? null));
  if (partes.length && numeros.every((n) => n !== null)) {
    const elegidos = [...new Set(numeros)].filter((n) => n >= 1 && n <= candidatos.length).map((n) => candidatos[n - 1]);
    if (elegidos.length) return elegidos;
    return [];
  }

  // Por nombre: exacto, luego uno dentro del otro, luego casi igual.
  const buscado = plano(texto.replace(/^\/?\s*soy\s+/i, ''));
  if (!buscado) return [];
  const exacto = candidatos.filter((c) => plano(c.nombre) === buscado);
  if (exacto.length === 1) return exacto;
  const dentro = candidatos.filter((c) => {
    const n = plano(c.nombre);
    return n.length >= 3 && buscado.length >= 3 && (n.includes(buscado) || buscado.includes(n));
  });
  if (dentro.length === 1) return dentro;
  const cerca = candidatos.filter((c) => parecidos(c.nombre, texto));
  if (cerca.length === 1) return cerca;
  return [];
}

/** "1. DR STRANGE~❤️\n2. ᴵᴬᴹ◎Dя Strange◎" para preguntar cual. */
export const listaNumerada = (candidatos, esc = (s) => s) => candidatos.map((c, i) => `${i + 1}. ${esc(c.nombre)}`).join('\n');
