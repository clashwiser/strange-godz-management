// El pulso: lo que hay que mirar cada pocos minutos, no cada dos horas.
//
//   npm run pulso
//
// Dos cosas, las dos en vivo por la API de Clash:
//
//   1. La guerra que esta por empezar. Cuando faltan ~10 minutos para el
//      dia de batalla (guerra normal o ronda de liga), Heraldo lo grita en
//      el grupo: "x300: la guerra contra Canadian Elite empieza en 10
//      minutos, ¡a ganar!". Lo pidio Cris el 12 sep 2026: la gente se
//      entera y entra a atacar. Si el cron llego tarde y ya empezo, avisa
//      igual durante los primeros minutos.
//
//   2. Miembros nuevos en los clanes. Al que no habia visto nunca en ese
//      clan (ni en la tabla de membresias), Valquiria pregunta a los
//      lideres, en el grupo y en privado, si ya hablaron con el para
//      traerlo al grupo o es solo un visitante. Contestan con un boton
//      (web/app/api/recluta). A las dos horas sin respuesta recuerda una
//      vez; a las 24 lo deja como "sin respuesta". La primera vez que ve un
//      clan apunta a todos como conocidos, sin preguntar.
//
// El cron de GitHub corre cada cinco minutos pero llega cuando puede (a
// veces diez tarde): por eso las ventanas son anchas y todo lleva llave
// de deduplicacion.

import { getClan, getCurrentWar, getLeagueGroup, getLeagueWar, parseCocDate, opcional } from '../lib/coc.js';
import { clanes, grupoTelegram } from '../lib/config.js';
import { encolar, negrita } from '../lib/outbox.js';
import { db, chk, correrJob } from '../lib/db.js';

const HERALDO = process.env.TELEGRAM_BOT_TOKEN;
// Pregunta Valquiria; si a GitHub le falta su token (RECLUTA_BOT_TOKEN),
// pregunta Heraldo antes que quedarse callado. Los botones los atiende el
// bot que mando el mensaje (web/lib/nuevos.js, en las dos rutas).
const VALQUIRIA = process.env.RECLUTA_BOT_TOKEN || HERALDO;
// El grupo que vale ahora (config manda sobre el env; ver config.js).
let GRUPO = null;

// Ventana del aviso: de 15 minutos antes a 12 minutos despues de empezar.
const AVISO_ANTES_MIN = 15;
const AVISO_DESPUES_MIN = 12;
// El recordatorio a los lideres, y cuando se deja de esperar.
const RECORDAR_H = 2;
const RENDIRSE_H = 24;

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

async function tg(token, metodo, cuerpo) {
  if (!token) return { ok: false, description: 'sin token' };
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/${metodo}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
      signal: AbortSignal.timeout(15000),
    });
    return await r.json();
  } catch (e) {
    return { ok: false, description: String(e.message ?? e) };
  }
}

// ---------------------------------------------------------------- 1. La guerra empieza

const minutosHasta = (fecha) => Math.round((fecha.getTime() - Date.now()) / 60000);

function textoEmpieza(nombreClan, rival, minutos, ronda) {
  const que = ronda ? `la ronda ${ronda} de liga contra ${negrita(rival)}` : `la guerra contra ${negrita(rival)}`;
  if (minutos > 0) {
    return `⚔️ ${negrita(nombreClan)}: ${que} empieza en ${negrita(`${minutos} minutos`)}. ¡A ganar! 🔥\n\nEntren, miren el mapa y a atacar temprano. Los ataques no se dejan sin usar.`;
  }
  return `⚔️ ${negrita(nombreClan)}: ¡empezó ${que}! 🔥\n\nA atacar temprano, que aquí los ataques no se dejan sin usar.`;
}

/** Guerra normal o ronda de liga en preparacion (con nuestro clan en `clan`). */
async function guerrasPorEmpezar(clanTag) {
  const abiertas = [];
  const normal = await opcional(getCurrentWar(clanTag));
  if (normal?.state === 'preparation' || normal?.state === 'inWar') abiertas.push({ guerra: normal, ronda: null });
  const grupo = await opcional(getLeagueGroup(clanTag));
  const rondas = (grupo?.rounds ?? []).filter((r) => (r.warTags ?? []).some((t) => t && t !== '#0'));
  const mio = String(clanTag).toUpperCase();
  for (const [i, ronda] of rondas.slice(-2).entries()) {
    const numero = rondas.length - rondas.slice(-2).length + i + 1;
    for (const tag of ronda.warTags) {
      if (!tag || tag === '#0') continue;
      const g = await opcional(getLeagueWar(tag));
      if (!g || !['preparation', 'inWar'].includes(g.state)) continue;
      if (String(g.clan?.tag).toUpperCase() === mio) abiertas.push({ guerra: g, ronda: numero });
      else if (String(g.opponent?.tag).toUpperCase() === mio) abiertas.push({ guerra: { ...g, clan: g.opponent, opponent: g.clan }, ronda: numero });
      else continue;
      break;
    }
  }
  return abiertas;
}

async function avisarGuerras(lista) {
  let avisos = 0;
  for (const c of lista) {
    for (const { guerra, ronda } of await guerrasPorEmpezar(c.clan_tag)) {
      const empieza = parseCocDate(guerra.startTime);
      if (!empieza) continue;
      const min = minutosHasta(empieza);
      // Solo alrededor del arranque; el resto del tiempo, nada.
      if (min > AVISO_ANTES_MIN || min < -AVISO_DESPUES_MIN) continue;
      const nombreClan = guerra.clan?.name ?? c.clan_tag;
      const rival = guerra.opponent?.name ?? '?';
      const nuevo = await encolar({
        tipo: 'guerra_empieza',
        cuerpo: textoEmpieza(nombreClan, rival, min, ronda),
        clave: `guerra-empieza:${c.clan_tag}:${guerra.startTime}`,
      });
      if (nuevo) avisos += 1;
    }
  }
  return avisos;
}

// ---------------------------------------------------------------- 2. Miembros nuevos

const botonesDe = (id) => ({
  inline_keyboard: [
    [
      { text: '🏠 Es de casa', callback_data: `nm:casa:${id}` },
      { text: '👀 Solo visita', callback_data: `nm:visita:${id}` },
    ],
    [{ text: '❓ Todavía no sé', callback_data: `nm:nose:${id}` }],
  ],
});

async function lideres() {
  const r = await tg(HERALDO, 'getChatAdministrators', { chat_id: GRUPO });
  return (r.result ?? []).map((m) => m.user).filter((u) => u && !u.is_bot);
}

const mencion = (u) => `<a href="tg://user?id=${u.id}">${esc(u.first_name || u.username || 'líder')}</a>`;

function textoNuevo(fila, nombreClan, admins) {
  const quienes = admins.map(mencion).join(', ');
  return (
    `👀 ${quienes}: acaba de entrar <b>${esc(fila.nombre ?? fila.player_tag)}</b>${fila.th ? ` (TH${fila.th})` : ''} al clan <b>${esc(nombreClan)}</b>, y no lo tenía visto.\n\n` +
    `¿Ya hablaron con él para traerlo aquí, o es solo un visitante? Díganmelo con un botón.`
  );
}

async function preguntarPorNuevo(fila, nombreClan, admins) {
  const texto = textoNuevo(fila, nombreClan, admins);
  const avisos = [];
  const enGrupo = await tg(VALQUIRIA, 'sendMessage', { chat_id: GRUPO, text: texto, parse_mode: 'HTML', reply_markup: botonesDe(fila.id) });
  if (enGrupo.ok) avisos.push({ chat_id: Number(GRUPO), message_id: enGrupo.result.message_id });
  // Y en privado, a los que la tengan abierta (a los demas Telegram no deja).
  for (const u of admins) {
    const r = await tg(VALQUIRIA, 'sendMessage', { chat_id: u.id, text: texto, parse_mode: 'HTML', reply_markup: botonesDe(fila.id) });
    if (r.ok) avisos.push({ chat_id: u.id, message_id: r.result.message_id });
  }
  await db.from('miembros_vistos').update({ avisos }).eq('id', fila.id);
  return avisos.length;
}

async function vigilarMiembros(lista) {
  let preguntas = 0;
  const admins = await lideres();
  for (const c of lista) {
    const clan = await opcional(getClan(c.clan_tag));
    if (!clan?.memberList) continue;
    const nombreClan = clan.name ?? c.clan_tag;

    const vistos = chk(await db.from('miembros_vistos').select('player_tag').eq('clan_tag', c.clan_tag), `vistos ${c.clan_tag}`);
    const vistosSet = new Set(vistos.map((v) => v.player_tag));
    const nuevos = clan.memberList.filter((m) => !vistosSet.has(m.tag));
    if (!nuevos.length) continue;

    // Primera vez con este clan: todos conocidos, sin preguntar.
    if (!vistos.length) {
      chk(
        await db.from('miembros_vistos').upsert(
          nuevos.map((m) => ({ player_tag: m.tag, clan_tag: c.clan_tag, nombre: m.name, th: m.townHallLevel ?? null, estado: 'conocido' })),
          { onConflict: 'player_tag,clan_tag' }
        ),
        `sembrar ${c.clan_tag}`
      );
      console.log(`  ${nombreClan}: primera vez, ${nuevos.length} apuntados como conocidos`);
      continue;
    }

    // Los que ya estuvieron en el clan (membresias) vuelven, no son nuevos.
    const { data: membresias } = await db.from('memberships').select('player_tag').eq('clan_tag', c.clan_tag).in('player_tag', nuevos.map((m) => m.tag));
    const yaEstuvo = new Set((membresias ?? []).map((m) => m.player_tag));

    for (const m of nuevos) {
      const estado = yaEstuvo.has(m.tag) ? 'conocido' : 'pendiente';
      const { data: fila, error } = await db
        .from('miembros_vistos')
        .upsert({ player_tag: m.tag, clan_tag: c.clan_tag, nombre: m.name, th: m.townHallLevel ?? null, estado }, { onConflict: 'player_tag,clan_tag', ignoreDuplicates: true })
        .select('id, player_tag, nombre, th, estado')
        .maybeSingle();
      if (error || !fila || fila.estado !== 'pendiente') continue;
      const mandados = await preguntarPorNuevo(fila, nombreClan, admins);
      console.log(`  ${nombreClan}: nuevo ${m.name} (${m.tag}) → pregunté (${mandados} avisos)`);
      preguntas += 1;
    }
  }

  // Los que siguen sin respuesta: un recordatorio a las dos horas, y a las 24 se cierra.
  const { data: pendientes } = await db.from('miembros_vistos').select('id, player_tag, nombre, clan_tag, primera_vez, recordado_en, avisos').eq('estado', 'pendiente');
  for (const p of pendientes ?? []) {
    const horas = (Date.now() - new Date(p.primera_vez).getTime()) / 3600000;
    if (horas >= RENDIRSE_H) {
      await db.from('miembros_vistos').update({ estado: 'sin_respuesta' }).eq('id', p.id);
      continue;
    }
    if (horas >= RECORDAR_H && !p.recordado_en) {
      const enGrupo = (p.avisos ?? []).find((a) => String(a.chat_id) === String(GRUPO));
      await tg(VALQUIRIA, 'sendMessage', {
        chat_id: GRUPO,
        text: `⏳ ${admins.map(mencion).join(', ')}: sigo esperando por <b>${esc(p.nombre ?? p.player_tag)}</b>. ¿De casa o de visita?`,
        parse_mode: 'HTML',
        reply_markup: botonesDe(p.id),
        ...(enGrupo ? { reply_parameters: { message_id: enGrupo.message_id } } : {}),
      });
      await db.from('miembros_vistos').update({ recordado_en: new Date().toISOString() }).eq('id', p.id);
    }
  }
  return preguntas;
}

// ---------------------------------------------------------------- El job

await correrJob('pulso', async () => {
  GRUPO = await grupoTelegram();
  const lista = await clanes();
  const avisos = await avisarGuerras(lista);
  console.log(`guerras por empezar: ${avisos} aviso(s)`);
  let preguntas = 0;
  if (!process.env.RECLUTA_BOT_TOKEN) console.log('sin RECLUTA_BOT_TOKEN: pregunta Heraldo en vez de Valquiria');
  if (VALQUIRIA && GRUPO) preguntas = await vigilarMiembros(lista);
  else console.log('sin token de bot o sin grupo: no se vigilan miembros nuevos');
  console.log(`miembros nuevos: ${preguntas} pregunta(s)`);
  return { filas: avisos + preguntas, detalle: { avisos, preguntas } };
});
