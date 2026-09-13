// /asignar: un administrador del grupo dice quien es quien en el juego.
//
// Valquiria le dice al que entra "presentate con /soy", y muchos no lo
// hacen. Un lider contesta al mensaje de esa persona (o la menciona) y:
//
//   /asignar Drakon              -> esa cuenta (por nombre, como /soy)
//   /asignar #20RVR0LP0          -> por tag
//   /asignar Drakon, LIO D10S    -> varias de una vez
//   /asignar                     -> botones: clan, y luego el nombre
//   /asignar solo Drakon         -> deja esa nada mas
//   /asignar quitar              -> le quita todas
//
// Solo administradores: lo comprueba la ruta antes de llegar aqui. Los
// botones llevan el id de la persona y el del lider que abrio el menu.

import { tagsDe, vincular, desvincular } from './vinculos.js';
import { esTag, tagLimpio, buscarPorNombre, jugadorPorTag, miembrosDelClan } from './soy.js';

const MAX_BOTON = 28;
const corto = (s) => (String(s).length > MAX_BOTON ? String(s).slice(0, MAX_BOTON - 1) + '…' : String(s));

// ---------- Quien escribe en el grupo, apuntado para poder mencionarlo ----------

/** Apunta (o refresca) a quien acaba de escribir. Nunca falla hacia fuera. */
export async function anotarUsuario(admin, from) {
  if (!from?.id || from.is_bot) return;
  try {
    await admin
      .from('tg_usuarios')
      .upsert({ tg_user_id: from.id, username: from.username ?? null, nombre: from.first_name ?? null, visto_en: new Date().toISOString() }, { onConflict: 'tg_user_id' });
  } catch {
    /* es un apunte; si falla, nada */
  }
}

async function usuarioPorNombre(admin, username) {
  const { data } = await admin.from('tg_usuarios').select('tg_user_id, nombre, username').ilike('username', username.replace(/^@/, '')).limit(1).maybeSingle();
  return data ? { id: data.tg_user_id, nombre: data.nombre, username: data.username } : null;
}

/**
 * A quien va dirigido el /asignar: la persona a la que se contesta, o la
 * mencionada (por @usuario o por nombre sin @, que Telegram manda como
 * text_mention con el id). Devuelve { id, nombre } o null.
 */
export async function objetivoDe(admin, msg) {
  const r = msg?.reply_to_message?.from;
  if (r && !r.is_bot) return { id: r.id, nombre: r.first_name || r.username || String(r.id) };
  for (const e of msg?.entities ?? []) {
    if (e.type === 'text_mention' && e.user && !e.user.is_bot) return { id: e.user.id, nombre: e.user.first_name || String(e.user.id) };
  }
  const m = /@([A-Za-z0-9_]{4,})/.exec(msg?.text ?? '');
  if (m) {
    const u = await usuarioPorNombre(admin, m[1]);
    if (u) return { id: u.id, nombre: u.nombre || `@${u.username}` };
  }
  return null;
}

// ---------- Botones ----------

const dato = (...p) => p.join(':');

const botonesClanes = (clans, objetivo, lider) => [
  ...clans.map((c) => [{ text: corto(c.nombre), callback_data: dato('asg', 'c', c.clan_tag, objetivo, lider) }]),
  [{ text: '✖️ Cerrar', callback_data: dato('asg', 'x', objetivo, lider) }],
];

function botonesMiembros(miembros, objetivo, lider) {
  const filas = [];
  for (let i = 0; i < miembros.length; i += 2) {
    filas.push(miembros.slice(i, i + 2).map((m) => ({ text: corto(m.nombre), callback_data: dato('asg', 't', m.tag, objetivo, lider) })));
  }
  filas.push([{ text: '⬅️ Otro clan', callback_data: dato('asg', 'm', objetivo, lider) }, { text: '✖️ Cerrar', callback_data: dato('asg', 'x', objetivo, lider) }]);
  return filas;
}

const botonesCandidatos = (candidatos, objetivo, lider) => [
  ...candidatos.map((c) => [{ text: corto(c.nombre), callback_data: dato('asg', 't', c.tag, objetivo, lider) }]),
  [{ text: '✖️ Cerrar', callback_data: dato('asg', 'x', objetivo, lider) }],
];

const botonesDespues = (objetivo, lider) => [
  [{ text: '➕ Otra cuenta suya', callback_data: dato('asg', 'm', objetivo, lider) }, { text: '✔️ Listo', callback_data: dato('asg', 'x', objetivo, lider) }],
];

// ---------- Textos ----------

const mencion = (o, esc) => `<a href="tg://user?id=${o.id}">${esc(o.nombre)}</a>`;

const TEXTO = {
  sinObjetivo:
    'Dime a quién, mi hermano: contesta al mensaje de la persona (o menciónala) y escribe <code>/asignar Nombre</code>, ' +
    '<code>/asignar #Tag</code>, o <code>/asignar</code> a secas para elegir de la lista.',
  elegirClan: (o, esc) => `¿Quién es ${mencion(o, esc)} en el juego? Toca su clan y luego su nombre:`,
  elegirMiembro: (clan, o, esc) => `<b>${clan}</b> — toca la cuenta de ${mencion(o, esc)}:`,
  sinMiembros: (clan) => `Ahora mismo no puedo leer la lista de <b>${clan}</b>. Prueba en un rato, o dame el tag: <code>/asignar #Tag</code>.`,
  noEncontrado: (nombre, o, esc) => `No encuentro a nadie que se llame "${nombre}". Toca el clan de ${mencion(o, esc)} y elígelo en la lista, o dame su tag.`,
  tagMalo: (tag) => `No encuentro ningún jugador con el tag <code>${tag}</code>.`,
  varios: (n, nombre) => `Hay ${n} que se parecen a "${nombre}". ¿Cuál es? Tócalo:`,
  ajeno: 'Ese menú lo abrió otro líder, asere.',
};

// ---------- Atar ----------

async function nombresDe(admin, tags) {
  if (!tags.length) return [];
  const { data } = await admin.from('players').select('player_tag, nombre_actual').in('player_tag', tags);
  const n = Object.fromEntries((data ?? []).map((p) => [p.player_tag, p.nombre_actual]));
  return tags.map((t) => n[t] ?? t);
}

async function atarA(admin, objetivo, elegidas, esc, { solo = false, lider = null } = {}) {
  const tags = await vincular(admin, { tgId: objetivo.id, tgNombre: objetivo.nombre ?? null, tags: elegidas.map((e) => e.tag), reemplazar: solo });
  const todas = await nombresDe(admin, tags);
  const lista = todas.map((n) => `<b>${esc(n)}</b>`).join(', ');
  return {
    texto:
      `Anotado: ${mencion(objetivo, esc)} es ${lista}. 📜` +
      (todas.length > 1 ? `\nSi alguna no es suya: <code>/asignar solo Nombre</code>.` : ''),
    botones: botonesDespues(objetivo.id, lider),
  };
}

// ---------- La orden ----------

/**
 * Lo que contesta /asignar. `msg` es el mensaje entero (para saber a quien
 * se contesta o menciona); `quien` el lider. Devuelve { texto, botones? }
 * o un texto.
 */
export async function ordenAsignar(admin, { arg, msg, quien, esc }) {
  const objetivo = await objetivoDe(admin, msg);
  if (!objetivo) return TEXTO.sinObjetivo;
  const lider = quien.id;
  // Lo escrito, sin la mencion si iba en el texto.
  let texto = String(arg ?? '').replace(/@[A-Za-z0-9_]{4,}/g, ' ').trim();
  if (msg?.entities?.some((e) => e.type === 'text_mention')) {
    // La mencion sin @ va como texto normal: se quita por su nombre.
    for (const e of msg.entities.filter((x) => x.type === 'text_mention')) {
      const trozo = String(msg.text ?? '').slice(e.offset, e.offset + e.length);
      texto = texto.replace(trozo, ' ').trim();
    }
  }

  if (/^(quitar|quita|borrar|borra|nada|ninguna)$/i.test(texto)) {
    const antes = await tagsDe(admin, objetivo.id);
    if (!antes.length) return `${mencion(objetivo, esc)} no tenía ninguna cuenta atada.`;
    await desvincular(admin, { tgId: objetivo.id, tags: antes });
    return `Listo: ${mencion(objetivo, esc)} ya no tiene cuentas atadas.`;
  }

  const solo = /^solo\s+/i.test(texto);
  texto = texto.replace(/^solo\s+/i, '').trim();

  if (!texto) {
    const { data: clans } = await admin.from('clans').select('clan_tag, nombre').order('orden');
    return { texto: TEXTO.elegirClan(objetivo, esc), botones: botonesClanes(clans ?? [], objetivo.id, lider) };
  }

  // Varias cuentas de una vez: "Drakon, LIO D10S, #2GC".
  const pedidas = texto.split(/\s*[,;]\s*|\s+y\s+/).map((x) => x.trim()).filter(Boolean);
  const { data: jugadores, error } = await admin.from('players').select('player_tag, nombre_actual');
  if (error) throw error;

  const elegidas = [];
  const dudas = [];
  const noHallados = [];
  for (const pedida of pedidas) {
    if (esTag(pedida)) {
      const j = await jugadorPorTag(admin, pedida);
      if (j) elegidas.push(j);
      else noHallados.push(tagLimpio(pedida));
      continue;
    }
    const { exactos, hallados } = buscarPorNombre(jugadores ?? [], pedida);
    if (!hallados.length) noHallados.push(pedida);
    else if (hallados.length === 1 || exactos.length === 1) {
      const p = exactos.length === 1 ? exactos[0] : hallados[0];
      elegidas.push({ tag: p.player_tag, nombre: p.nombre_actual });
    } else dudas.push({ pedida, candidatos: hallados.slice(0, 8).map((p) => ({ tag: p.player_tag, nombre: p.nombre_actual })) });
  }

  // Una sola pedida y ambigua: botones para elegir.
  if (!elegidas.length && dudas.length === 1 && !noHallados.length) {
    const d = dudas[0];
    return { texto: TEXTO.varios(d.candidatos.length, esc(d.pedida)), botones: botonesCandidatos(d.candidatos, objetivo.id, lider) };
  }
  if (!elegidas.length && noHallados.length && !dudas.length) {
    const { data: clans } = await admin.from('clans').select('clan_tag, nombre').order('orden');
    return { texto: TEXTO.noEncontrado(esc(noHallados.join(', ')), objetivo, esc), botones: botonesClanes(clans ?? [], objetivo.id, lider) };
  }

  const r = elegidas.length ? await atarA(admin, objetivo, elegidas, esc, { solo, lider }) : { texto: '', botones: botonesDespues(objetivo.id, lider) };
  const avisos = [];
  if (noHallados.length) avisos.push(`No encontré: ${noHallados.map(esc).join(', ')}.`);
  for (const d of dudas) avisos.push(`"${esc(d.pedida)}" se parece a varios (${d.candidatos.map((c) => esc(c.nombre)).join(', ')}): dímelo completo o elígelo con <code>/asignar</code> a secas.`);
  if (avisos.length) r.texto = `${r.texto}${r.texto ? '\n\n' : ''}${avisos.join('\n')}`;
  return r;
}

// ---------- Los botones tocados ----------

/** Un boton "asg:..." tocado. Solo el lider que abrio el menu. */
export async function atenderBotonAsignar(admin, cq, { tg, esc }) {
  const partes = String(cq.data ?? '').split(':');
  const accion = partes[1];
  const lider = Number(partes[partes.length - 1]);
  const objetivoId = Number(partes[partes.length - 2]);
  const chatId = cq.message?.chat?.id;
  const editar = (texto, botones) =>
    tg('editMessageText', {
      chat_id: chatId,
      message_id: cq.message?.message_id,
      text: texto,
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
      reply_markup: { inline_keyboard: botones ?? [] },
    });

  if (lider !== cq.from?.id) {
    await tg('answerCallbackQuery', { callback_query_id: cq.id, text: TEXTO.ajeno });
    return;
  }
  await tg('answerCallbackQuery', { callback_query_id: cq.id });

  // El nombre de la persona, apuntado cuando escribio (o el que haya).
  const { data: u } = await admin.from('tg_usuarios').select('nombre, username').eq('tg_user_id', objetivoId).maybeSingle();
  const { data: v } = await admin.from('tg_vinculos').select('tg_nombre').eq('tg_user_id', objetivoId).limit(1).maybeSingle();
  const objetivo = { id: objetivoId, nombre: u?.nombre || v?.tg_nombre || (u?.username ? `@${u.username}` : String(objetivoId)) };

  if (accion === 'x') {
    const t = cq.message?.text && /^Anotado:/.test(cq.message.text) ? esc(cq.message.text) : 'Listo.';
    return await editar(t, null);
  }
  if (accion === 'm') {
    const { data: clans } = await admin.from('clans').select('clan_tag, nombre').order('orden');
    return await editar(TEXTO.elegirClan(objetivo, esc), botonesClanes(clans ?? [], objetivoId, lider));
  }
  if (accion === 'c') {
    const clanTag = partes[2];
    const { data: clan } = await admin.from('clans').select('nombre').eq('clan_tag', clanTag).maybeSingle();
    const nombreClan = esc(clan?.nombre ?? clanTag);
    const miembros = await miembrosDelClan(clanTag);
    if (!miembros.length) {
      const { data: clans } = await admin.from('clans').select('clan_tag, nombre').order('orden');
      return await editar(TEXTO.sinMiembros(nombreClan), botonesClanes(clans ?? [], objetivoId, lider));
    }
    return await editar(TEXTO.elegirMiembro(nombreClan, objetivo, esc), botonesMiembros(miembros, objetivoId, lider));
  }
  if (accion === 't') {
    const j = await jugadorPorTag(admin, partes[2]);
    if (!j) return await editar(TEXTO.tagMalo(esc(partes[2])), botonesDespues(objetivoId, lider));
    const r = await atarA(admin, objetivo, [j], esc, { lider });
    return await editar(r.texto, r.botones);
  }
}
