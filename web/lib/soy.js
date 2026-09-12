// /soy: quien eres en el juego. De tres formas, porque los nombres del juego
// son imposibles de teclear ("DR∆K⚫️N", "﹏⪻ΛSSΛSSINS⪼﹏"):
//
//   /soy                  -> botones: elige tu clan, y luego tu nombre en la lista
//   /soy Drakon           -> por nombre, con los adornos traducidos (nombres.js)
//   /soy #20RVR0LP0       -> por tag, el que sale en el perfil del juego
//
// Si el nombre casa con varios, salen botones para elegir (o "las dos");
// si no casa con ninguno, salen los clanes para elegirse de la lista. Todo
// se contesta en el mismo mensaje, que se va editando: un solo mensaje en
// el grupo por persona, no una conversacion de diez lineas.
//
// Los botones llevan el id de quien pregunto: en un grupo los ve todo el
// mundo, y solo el dueno puede tocarlos.

import { plano, planoLaxo, parecidos } from './nombres.js';
import { pedirPerfil } from './coc-perfil.js';
import { tagsDe, vincular, guardarSoyPendiente, olvidarSoyPendiente, soyPendiente, interpretarEleccion } from './vinculos.js';

/** Un tag del juego: #, y letras/numeros del alfabeto de Supercell (la O se escribe como 0). */
export const esTag = (s) => {
  const t = String(s ?? '').trim();
  // Con # es un tag seguro; sin #, solo si trae algun digito: "POLLO" es un nombre.
  return /^#[0289PYLQGRJCUVO]{3,12}$/i.test(t) || (/^[0289PYLQGRJCUVO]{5,12}$/i.test(t) && /\d/.test(t));
};
export const tagLimpio = (s) => '#' + String(s ?? '').trim().toUpperCase().replace(/^#/, '').replace(/O/g, '0');

const MAX_BOTON = 28;
const corto = (s) => (String(s).length > MAX_BOTON ? String(s).slice(0, MAX_BOTON - 1) + '…' : String(s));

// ---------- Buscar ----------

/**
 * Los jugadores que casan con lo escrito, en tres pasadas de menos a mas
 * laxa: igual o contenido, parecido (una o dos letras), y con los digitos
 * como letras ("lio dios" -> "LIO D10S"). Devuelve { exactos, hallados }.
 */
export function buscarPorNombre(jugadores, nombre) {
  const q = plano(nombre);
  if (!q) return { exactos: [], hallados: [] };
  const exactos = jugadores.filter((p) => plano(p.nombre_actual) === q);
  let hallados = jugadores.filter((p) => {
    const n = plano(p.nombre_actual);
    return n === q || (n.length >= 3 && q.length >= 3 && (n.includes(q) || q.includes(n)));
  });
  if (!hallados.length) hallados = jugadores.filter((p) => parecidos(p.nombre_actual, nombre));
  if (!hallados.length) {
    const l = planoLaxo(nombre);
    hallados = jugadores.filter((p) => {
      const n = planoLaxo(p.nombre_actual);
      return n === l || (n.length >= 3 && l.length >= 3 && (n.includes(l) || l.includes(n)));
    });
  }
  // Los exactos primero.
  hallados.sort((a, b) => Number(exactos.includes(b)) - Number(exactos.includes(a)));
  return { exactos, hallados };
}

/**
 * Un jugador por su tag, preguntando al juego. Si no esta en la tabla de
 * jugadores (una cuenta en otro clan), se apunta para poder atarla.
 */
export async function jugadorPorTag(admin, tag) {
  const perfil = await pedirPerfil(tagLimpio(tag));
  if (!perfil?.tag || !perfil.name) return null;
  const { data: clans } = await admin.from('clans').select('clan_tag');
  const deCasa = (clans ?? []).some((c) => c.clan_tag === perfil.clan?.tag);
  const { data: existe } = await admin.from('players').select('player_tag').eq('player_tag', perfil.tag).maybeSingle();
  if (!existe) {
    await admin.from('players').insert({ player_tag: perfil.tag, nombre_actual: perfil.name, activo: deCasa });
    await admin.from('player_names').upsert({ player_tag: perfil.tag, nombre: perfil.name }, { onConflict: 'player_tag,nombre', ignoreDuplicates: true });
  }
  return { tag: perfil.tag, nombre: perfil.name, clan: perfil.clan?.name ?? null, deCasa };
}

/** Los miembros de un clan ahora mismo, por el juego (los recien llegados aun no estan en la tabla). */
export async function miembrosDelClan(clanTag) {
  const token = process.env.COC_TOKEN;
  if (!token) return [];
  const base = process.env.COC_BASE_URL || 'https://cocproxy.royaleapi.dev/v1';
  try {
    const r = await fetch(`${base}/clans/${encodeURIComponent(clanTag)}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return [];
    const j = await r.json();
    return (j.memberList ?? []).map((m) => ({ tag: m.tag, nombre: m.name, th: m.townHallLevel })).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }));
  } catch {
    return [];
  }
}

// ---------- Botones ----------

const dato = (...partes) => partes.join(':');

export const botonesClanes = (clans, uid) => [
  ...clans.map((c) => [{ text: corto(c.nombre), callback_data: dato('soy', 'c', c.clan_tag, uid) }]),
  [{ text: '✖️ Cerrar', callback_data: dato('soy', 'x', uid) }],
];

export function botonesMiembros(miembros, uid) {
  const filas = [];
  for (let i = 0; i < miembros.length; i += 2) {
    filas.push(miembros.slice(i, i + 2).map((m) => ({ text: corto(m.nombre), callback_data: dato('soy', 't', m.tag, uid) })));
  }
  filas.push([{ text: '⬅️ Otro clan', callback_data: dato('soy', 'm', uid) }, { text: '✖️ Cerrar', callback_data: dato('soy', 'x', uid) }]);
  return filas;
}

export const botonesCandidatos = (candidatos, uid) => [
  ...candidatos.map((c) => [{ text: corto(c.nombre), callback_data: dato('soy', 't', c.tag, uid) }]),
  [{ text: candidatos.length === 2 ? '✌️ Las dos son mías' : '🙌 Todas son mías', callback_data: dato('soy', 'a', uid) }],
  [{ text: '✖️ Cerrar', callback_data: dato('soy', 'x', uid) }],
];

export const botonesDespues = (uid) => [
  [{ text: '➕ Tengo otra cuenta', callback_data: dato('soy', 'm', uid) }, { text: '✔️ Listo', callback_data: dato('soy', 'x', uid) }],
];

// ---------- Textos ----------

const TEXTO = {
  elegirClan: (nombre) =>
    `¿Quién eres en el juego, ${nombre}? Toca tu clan y luego tu nombre en la lista.\n` +
    `También puedes escribir <code>/soy TuNombre</code> o <code>/soy #TuTag</code> (el tag está en tu perfil del juego).`,
  elegirMiembro: (clan) => `<b>${clan}</b> — toca tu nombre:`,
  sinMiembros: (clan) => `Ahora mismo no puedo leer la lista de <b>${clan}</b>. Prueba en un rato, o mándame tu tag: <code>/soy #TuTag</code>.`,
  noEncontrado: (nombre) =>
    `No encuentro a nadie que se llame "${nombre}" en los clanes. Toca tu clan y elígete en la lista, ` +
    `o mándame tu tag: <code>/soy #TuTag</code> (está en tu perfil del juego).`,
  tagMalo: (tag) => `No encuentro ningún jugador con el tag <code>${tag}</code>. Cópialo de tu perfil del juego (empieza por #).`,
  varios: (n) => `Hay ${n} con ese nombre. ¿Cuál eres? Tócalo:`,
  ajeno: 'Ese menú es de otra persona, asere. Escribe /soy y te sale el tuyo.',
};

// ---------- La orden ----------

/**
 * Lo que contesta /soy. Devuelve { texto, botones? }. `quien` = { id, nombre }
 * (nombre ya escapado), `esc` escapa HTML.
 */
export async function ordenSoy(admin, arg, quien, esc) {
  const uid = quien.id;
  const solo = /^solo\s+/i.test(arg.trim());
  const nombre = arg.trim().replace(/^solo\s+/i, '');

  // Sin nada: el menu.
  if (!nombre) {
    const { data: clans } = await admin.from('clans').select('clan_tag, nombre').order('orden');
    return { texto: TEXTO.elegirClan(esc(quien.nombre ?? 'mi hermano')), botones: botonesClanes(clans ?? [], uid) };
  }

  // Un tag: al juego.
  if (esTag(nombre)) {
    const j = await jugadorPorTag(admin, nombre);
    if (!j) return { texto: TEXTO.tagMalo(esc(tagLimpio(nombre))) };
    return await atar(admin, [j], quien, esc, { solo });
  }

  const { data: jugadores, error } = await admin.from('players').select('player_tag, nombre_actual');
  if (error) throw error;
  const { exactos, hallados } = buscarPorNombre(jugadores ?? [], nombre);

  if (!hallados.length) {
    const { data: clans } = await admin.from('clans').select('clan_tag, nombre').order('orden');
    return { texto: TEXTO.noEncontrado(esc(nombre)), botones: botonesClanes(clans ?? [], uid) };
  }

  const comoCandidato = (p) => ({ tag: p.player_tag, nombre: p.nombre_actual });
  if (hallados.length > 1 && exactos.length !== 1) {
    // Varios y ninguno igualito: que elija tocando (o escribiendo el numero).
    const candidatos = hallados.slice(0, 8).map(comoCandidato);
    await guardarSoyPendiente(admin, uid, candidatos);
    return { texto: TEXTO.varios(hallados.length), botones: botonesCandidatos(candidatos, uid) };
  }

  const p = exactos.length === 1 ? exactos[0] : hallados[0];
  const r = await atar(admin, [comoCandidato(p)], quien, esc, { solo });
  const otras = hallados.filter((x) => x !== p).slice(0, 5).map((x) => ({ ...comoCandidato(x), ofrecida: true }));
  if (otras.length && !solo) {
    await guardarSoyPendiente(admin, uid, otras);
    r.texto +=
      `\n\nVi ${otras.length === 1 ? 'otra cuenta parecida' : 'otras cuentas parecidas'}: ${otras.map((o) => `<b>${esc(o.nombre)}</b>`).join(', ')}. ` +
      `Si ${otras.length === 1 ? 'también es tuya' : 'también son tuyas'}, dime <b>también</b>.`;
    r.botones = [...otras.map((o) => [{ text: `➕ También soy ${corto(o.nombre)}`, callback_data: dato('soy', 't', o.tag, uid) }]), ...botonesDespues(uid)];
  }
  return r;
}

/**
 * Ata las cuentas elegidas y arma la respuesta (texto y botones de
 * "otra cuenta" / "listo"). Con `solo`, quita las demas.
 */
export async function atar(admin, elegidas, quien, esc, { solo = false } = {}) {
  const antes = solo ? [] : await tagsDe(admin, quien.id);
  const tags = await vincular(admin, { tgId: quien.id, tgNombre: quien.nombre ?? null, tags: elegidas.map((e) => e.tag), reemplazar: solo });
  await olvidarSoyPendiente(admin, quien.id);

  const nombres = elegidas.map((e) => `<b>${esc(e.nombre)}</b>`);
  const lista = nombres.length > 1 ? `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}` : nombres[0];
  const nuevas = elegidas.filter((e) => !antes.includes(e.tag)).length;
  let texto;
  if (nuevas === 0) {
    texto = `Ya te tenía anotado como ${lista}, mi hermano. 📜`;
  } else if (antes.length && tags.length > elegidas.length) {
    const { data: todas } = await admin.from('players').select('nombre_actual').in('player_tag', tags);
    const nombresTodas = (todas ?? []).map((p) => `<b>${esc(p.nombre_actual)}</b>`).join(', ');
    texto =
      `Anotado: también eres ${lista}. Ahora te reconozco con ${tags.length} cuentas: ${nombresTodas}. 📜\n` +
      `Si alguna no es tuya, dime <code>/soy solo TuNombre</code>.`;
  } else {
    texto =
      elegidas.length > 1
        ? `Anotado: tú eres ${lista}. Ya te reconozco con las ${elegidas.length === 2 ? 'dos' : elegidas.length} cuentas. 📜`
        : `Anotado: tú eres ${lista}. Ya te reconozco. 📜`;
  }
  return { texto, botones: botonesDespues(quien.id) };
}

/**
 * Si esta persona tiene un /soy a medias, lee su respuesta escrita ("las
 * dos", "1", "también", el nombre) y ata lo elegido. Null si no hay nada
 * pendiente o no se entiende.
 */
export async function contestarSoy(admin, texto, quien, esc) {
  const candidatos = await soyPendiente(admin, quien.id);
  if (!candidatos) return null;
  const elegidas = interpretarEleccion(texto, candidatos);
  if (!elegidas.length) return null;
  return await atar(admin, elegidas, quien, esc);
}

// ---------- Los botones tocados ----------

/**
 * Un boton "soy:..." tocado. `tg(metodo, cuerpo)` llama a Telegram con el
 * token de Heraldo. Contesta el callback y edita el mensaje del menu.
 */
export async function atenderBotonSoy(admin, cq, { tg, esc }) {
  const partes = String(cq.data ?? '').split(':');
  const accion = partes[1];
  const uid = Number(partes[partes.length - 1]);
  const chatId = cq.message?.chat?.id;
  const messageId = cq.message?.message_id;
  const editar = (texto, botones) =>
    tg('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text: texto,
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
      reply_markup: botones ? { inline_keyboard: botones } : { inline_keyboard: [] },
    });

  if (uid !== cq.from?.id) {
    await tg('answerCallbackQuery', { callback_query_id: cq.id, text: TEXTO.ajeno, show_alert: false });
    return;
  }
  await tg('answerCallbackQuery', { callback_query_id: cq.id });
  const quien = { id: uid, nombre: cq.from.first_name || cq.from.username || null };
  const nombreVisible = esc(quien.nombre ?? 'mi hermano');

  if (accion === 'x') {
    // Cerrar: se quitan los botones y queda lo dicho (o un cierre corto).
    const texto = cq.message?.text && !/toca tu (clan|nombre)|¿Cuál eres\?/.test(cq.message.text) ? esc(cq.message.text) : 'Listo. Cuando quieras, /soy.';
    await editar(texto, null);
    return;
  }
  if (accion === 'm') {
    const { data: clans } = await admin.from('clans').select('clan_tag, nombre').order('orden');
    await editar(TEXTO.elegirClan(nombreVisible), botonesClanes(clans ?? [], uid));
    return;
  }
  if (accion === 'c') {
    const clanTag = partes[2];
    const { data: clan } = await admin.from('clans').select('nombre').eq('clan_tag', clanTag).maybeSingle();
    const nombreClan = esc(clan?.nombre ?? clanTag);
    const miembros = await miembrosDelClan(clanTag);
    if (!miembros.length) return await editar(TEXTO.sinMiembros(nombreClan), botonesClanes((await admin.from('clans').select('clan_tag, nombre').order('orden')).data ?? [], uid));
    await editar(TEXTO.elegirMiembro(nombreClan), botonesMiembros(miembros, uid));
    return;
  }
  if (accion === 't') {
    const j = await jugadorPorTag(admin, partes[2]);
    if (!j) return await editar(TEXTO.tagMalo(esc(partes[2])), botonesDespues(uid));
    const r = await atar(admin, [j], quien, esc);
    await editar(r.texto, r.botones);
    return;
  }
  if (accion === 'a') {
    const candidatos = await soyPendiente(admin, uid);
    if (!candidatos) return await editar('Eso ya caducó, mi hermano. Escribe /soy otra vez.', null);
    const r = await atar(admin, candidatos, quien, esc);
    await editar(r.texto, r.botones);
  }
}
