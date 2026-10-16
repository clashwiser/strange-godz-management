// /guerrallena: el que llena TODOS los castillos de una guerra el solo.
//
// Lo pidio Cris el 16 oct 2026. Yoan dona la guerra entera ("yo dono todas
// las guerras siempre completas"), y /castillo solo da puntos por una foto
// por cuenta: llenar cuarenta castillos valia lo mismo que llenar uno.
//
// SIN FOTO, a proposito. Ninguna captura lo prueba: el mapa hace scroll (en
// una caben 5 u 8 bases) y no dice quien dono. La API tampoco ve dentro de
// los castillos de guerra. Lo que se comprueba solo es que la persona esta
// en una guerra abierta y que nadie mas lo pidio para esa guerra; lo demas
// lo confirma un lider con 👍, que en el juego si lo ve: un castillo lleno
// no lleva encima la etiqueta "0/55", los que faltan si.
//
// Uno por guerra, de quien sea: dos personas no pueden haber llenado las
// dos TODOS los castillos. Si la llenaron entre varias, no es guerra llena.

import { pedirPerfil } from './coc-perfil.js';
import { guerraDe, cuentasDelMismoDueno } from './castillo-foto.js';
import { temporadaDe } from './castillos.js';
import { PUNTOS_GUERRA_LLENA } from './retos-reglas.js';

export { PUNTOS_GUERRA_LLENA };

// Una guerra dura unas 48 horas (preparacion + batalla). Dos guerras
// seguidas contra el mismo rival en tres dias no pasan: con esa ventana la
// firma clan+rival identifica la guerra sin depender de la hora de inicio,
// que la API mueve entre la preparacion y la batalla (16 oct 2026).
const VENTANA_MS = 72 * 3600 * 1000;

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const mismoTag = (a, b) => String(a ?? '').trim().toUpperCase().replace(/^#?/, '#') === String(b ?? '').trim().toUpperCase().replace(/^#?/, '#');

/** La huella de la guerra para no pagarla dos veces: nuestro clan y el rival. */
export function firmaGuerraLlena(clanTag, rivalTag) {
  return `guerra_llena|${String(clanTag ?? '?').toUpperCase()}|${String(rivalTag ?? '?').toUpperCase()}`;
}

/**
 * Lo que se le contesta a quien ya tiene (o ya tiene otro) la guerra llena
 * pedida para esta guerra. Aparte para poder probarlo.
 */
export function textoYaPedida(otra, tgId, nombre) {
  if (Number(otra.tg_user_id) === Number(tgId)) {
    return otra.verificado
      ? `🏰 Ya tienes confirmada la guerra llena de esta guerra, ${nombre} (+${PUNTOS_GUERRA_LLENA}). 📜`
      : `🏰 Ya la tienes pedida para esta guerra, ${nombre}. Falta que un líder la confirme con 👍.`;
  }
  return (
    `🏰 <b>${esc(otra.nombre)}</b> ya pidió la guerra llena de esta guerra. Si los dos llenaron castillos, no la llenó uno solo: ` +
    `cada uno manda lo suyo con <code>/castillo</code>.`
  );
}

/**
 * La guerra en curso (preparacion o batalla) de alguna de estas cuentas,
 * con la cuenta que esta en su mapa. Null si ninguna esta en una.
 */
async function guerraDeAlguna(tags) {
  const porClan = new Map();
  for (const tag of tags) {
    const perfil = await pedirPerfil(tag);
    const clanTag = perfil?.clan?.tag;
    if (!clanTag) continue;
    if (!porClan.has(clanTag)) porClan.set(clanTag, await guerraDe(clanTag));
    const guerra = porClan.get(clanTag);
    if (!guerra || !['preparation', 'inWar'].includes(guerra.state)) continue;
    const cuenta = (guerra.clan?.members ?? []).find((m) => mismoTag(m.tag, tag));
    if (cuenta) return { guerra, clanTag, tag, cuenta };
  }
  return null;
}

/**
 * Anota la guerra llena, pendiente de un lider. Devuelve { texto, id? }:
 * con `id` se creo la fila y hay que recordar el mensaje del bot para que
 * el 👍 de un lider la encuentre (recordarMensajeReto).
 */
export async function anotarGuerraLlena(admin, { tgId, nombre }) {
  const quien = nombre || 'socio';
  const { data: vinculos } = await admin.from('tg_vinculos').select('player_tag').eq('tg_user_id', tgId).order('principal', { ascending: false });
  const atadas = (vinculos ?? []).map((v) => v.player_tag).filter(Boolean);
  if (!atadas.length) {
    return { texto: `🏰 No sé quién eres en el juego, ${quien}. Preséntate con <code>/soy TuNombre</code> y vuelve a mandar <code>/guerrallena</code>.` };
  }
  const tags = [...new Set([...atadas, ...(await cuentasDelMismoDueno(admin, atadas))])];
  const g = await guerraDeAlguna(tags);
  if (!g) {
    return { texto: `🏰 No te veo en el mapa de una guerra en preparación o en batalla, ${quien}. La guerra llena se pide mientras la guerra está abierta.` };
  }

  const rival = g.guerra.opponent?.name ?? 'el rival';
  const bases = (g.guerra.clan?.members ?? []).length || g.guerra.teamSize || null;
  const firma = firmaGuerraLlena(g.clanTag, g.guerra.opponent?.tag);
  const desde = new Date(Date.now() - VENTANA_MS).toISOString();
  const { data: ya } = await admin
    .from('retos')
    .select('id, tg_user_id, nombre, verificado')
    .eq('tipo', 'guerra_llena')
    .eq('firma', firma)
    .gte('creado_en', desde)
    .order('creado_en')
    .limit(1);
  if (ya?.length) return { texto: textoYaPedida(ya[0], tgId, quien) };

  const { data: fila, error } = await admin
    .from('retos')
    .insert({
      temporada: temporadaDe(),
      tg_user_id: tgId,
      player_tag: g.tag,
      nombre: quien,
      tipo: 'guerra_llena',
      puntos: 0,
      verificado: false,
      firma,
      nota: `${g.guerra.clan?.name ?? g.clanTag} vs ${rival}${bases ? `, ${bases} bases` : ''} (${g.guerra.state === 'preparation' ? 'preparación' : 'batalla'})`,
    })
    .select('id')
    .single();
  if (error || !fila) return { texto: `🏰 No pude anotarlo, ${quien}. Díselo a un líder.` };

  return {
    id: fila.id,
    texto:
      `🏰 <b>${quien}</b> dice que llenó <b>todos</b> los castillos de la guerra contra <b>${esc(rival)}</b>${bases ? ` (${bases} bases)` : ''}.\n\n` +
      `Un líder lo confirma con un 👍 a este mensaje: <b>+${PUNTOS_GUERRA_LLENA} puntos</b>. ` +
      `Para revisarlo, basta recorrer el mapa: un castillo lleno no lleva encima la etiqueta "0/55", los que faltan sí.`,
  };
}
