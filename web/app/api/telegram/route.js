// Webhook del bot de Telegram, alojado en Vercel.
//
// Telegram hace POST aca cada vez que alguien le escribe al bot. Al vivir en
// la misma app que ya esta desplegada, sale gratis y responde al instante:
// no hace falta polling ni un servidor encendido.
//
// Variables en Vercel (NINGUNA con NEXT_PUBLIC_):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
//   TELEGRAM_BOT_TOKEN, TELEGRAM_SECRET_TOKEN, TELEGRAM_CHAT_ID

import { admin } from '../../../lib/supabase-admin';

export const dynamic = 'force-dynamic';

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const SECRETO = process.env.TELEGRAM_SECRET_TOKEN;
// Lista blanca de chats. Sin esto, cualquiera que encuentre al bot consulta
// los datos del clan.
const PERMITIDOS = (process.env.TELEGRAM_CHAT_ID || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const esc = (s) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const temporadaActual = () => new Date().toISOString().slice(0, 7);

async function responder(chatId, texto) {
  await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: texto,
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
    }),
  });
}

export async function POST(request) {
  // Falla CERRADO. Antes esta comprobacion iba como "if (SECRETO && ...)":
  // si la variable no estaba puesta, se saltaba entera y el endpoint quedaba
  // abierto a cualquiera que adivinara la URL. Se vio en el primer despliegue
  // a Vercel, hecho a proposito sin variables: devolvia 200 en vez de 401.
  //
  // Una app a medio configurar tiene que ser inerte, no permisiva.
  if (!SECRETO || !TOKEN || !PERMITIDOS.length) {
    return new Response('webhook sin configurar', { status: 503 });
  }

  // Telegram reenvia el secreto en cada peticion. Sin esta comprobacion,
  // cualquiera que adivine la URL puede inyectar mensajes falsos.
  if (request.headers.get('x-telegram-bot-api-secret-token') !== SECRETO) {
    return new Response('no', { status: 401 });
  }

  let update;
  try {
    update = await request.json();
  } catch {
    return Response.json({ ok: true });
  }

  const msg = update.message ?? update.edited_message;
  const chatId = msg?.chat?.id;
  const texto = (msg?.text || '').trim();

  if (!chatId || !texto.startsWith('/')) return Response.json({ ok: true });

  // Sin "PERMITIDOS.length &&": la lista vacia ya se rechaza arriba con 503,
  // asi que aca un chat que no este en la lista blanca siempre se corta.
  if (!PERMITIDOS.includes(String(chatId))) {
    await responder(chatId, `Este bot es privado.\nTu chat id es <code>${chatId}</code>.`);
    return Response.json({ ok: true });
  }

  // "/jugador@x300bot Cris" -> comando "jugador", argumento "Cris"
  const [crudo, ...resto] = texto.split(/\s+/);
  const comando = crudo.slice(1).split('@')[0].toLowerCase();
  const arg = resto.join(' ');

  try {
    await responder(chatId, await ejecutar(comando, arg));
  } catch (e) {
    await responder(chatId, `⚠️ Error: <code>${esc(e.message)}</code>`);
  }

  return Response.json({ ok: true });
}

// Telegram reintenta si no recibe 200; responder rapido evita duplicados.
export async function GET() {
  return Response.json({ ok: true, bot: 'x300' });
}

// ------------------------------------------------------------- Comandos
async function ejecutar(comando, arg) {
  switch (comando) {
    case 'start':
    case 'ayuda':
    case 'help':
      return (
        `<b>x300 · bot de líderes</b>\n\n` +
        `/resumen — estado de los 3 clanes y de los jobs\n` +
        `/faltan — quién no ha atacado en la CWL de ahora\n` +
        `/estrellas — tabla de estrellas de la temporada\n` +
        `/jugador &lt;nombre&gt; — ficha de un jugador\n` +
        `/base [th] [guerra|aldea] — enlaces de bases del pack\n` +
        `/reporte — último mensaje generado, para pegar en WhatsApp`
      );

    case 'resumen':
      return await cmdResumen();
    case 'faltan':
      return await cmdFaltan();
    case 'estrellas':
      return await cmdEstrellas();
    case 'jugador':
      return await cmdJugador(arg);
    case 'base':
    case 'bases':
      return await cmdBases(arg);
    case 'reporte':
      return await cmdReporte();
    default:
      return `No conozco <code>/${esc(comando)}</code>. Prueba /ayuda.`;
  }
}

async function cmdResumen() {
  const [{ data: clans }, { data: snapUlt }, { data: jobs }, { data: pend }] = await Promise.all([
    admin.from('clans').select('clan_tag, nombre, escuadra').order('escuadra'),
    admin.from('snapshots').select('fecha').order('fecha', { ascending: false }).limit(1),
    admin.from('job_runs').select('job, started_at, ok, filas, error').order('started_at', { ascending: false }).limit(40),
    admin.from('outbox').select('id').eq('estado', 'pendiente'),
  ]);

  const fecha = snapUlt?.[0]?.fecha ?? null;
  let conteo = [];
  if (fecha) {
    const { data } = await admin.from('snapshots').select('clan_tag').eq('fecha', fecha);
    conteo = data ?? [];
  }

  const lineas = (clans ?? []).map((c) => {
    const n = conteo.filter((s) => s.clan_tag === c.clan_tag).length;
    return `  ${esc(c.nombre)} (${c.escuadra}): ${n} miembros`;
  });

  const vistos = new Set();
  const ultimos = [];
  for (const j of jobs ?? []) {
    if (vistos.has(j.job)) continue;
    vistos.add(j.job);
    ultimos.push(`  ${j.ok === true ? '✅' : j.ok === false ? '❌' : '⏳'} ${j.job}${j.error ? ` — ${esc(j.error.slice(0, 60))}` : ''}`);
  }

  return (
    `<b>Resumen x300</b>\n\n` +
    (lineas.length ? lineas.join('\n') : '  (sin clanes cargados)') +
    `\n\n<b>Último snapshot:</b> ${fecha ?? '—'}\n` +
    `<b>Mensajes por enviar:</b> ${pend?.length ?? 0}\n\n` +
    `<b>Jobs</b>\n${ultimos.join('\n') || '  (ninguno todavía)'}`
  );
}

async function cmdFaltan() {
  const { data: seasons } = await admin
    .from('cwl_seasons')
    .select('id, clan_tag')
    .eq('temporada', temporadaActual());

  if (!seasons?.length) return 'No hay CWL registrada para este mes.';

  const { data: wars } = await admin
    .from('cwl_wars')
    .select('id, ronda, estado, end_time, season_id')
    .in('season_id', seasons.map((s) => s.id))
    .eq('estado', 'inWar');

  if (!wars?.length) return 'No hay ninguna ronda de CWL en curso ahora mismo.';

  const ids = wars.map((w) => w.id);
  const [{ data: roster }, { data: ataques }, { data: players }] = await Promise.all([
    admin.from('cwl_roster').select('war_id, player_tag, posicion_mapa').in('war_id', ids),
    admin.from('cwl_attacks').select('war_id, player_tag').in('war_id', ids),
    admin.from('players').select('player_tag, nombre_actual'),
  ]);

  const nombre = Object.fromEntries((players ?? []).map((p) => [p.player_tag, p.nombre_actual]));
  const atacó = new Set((ataques ?? []).map((a) => `${a.war_id}|${a.player_tag}`));
  const clanDe = Object.fromEntries(seasons.map((s) => [s.id, s.clan_tag]));

  const bloques = [];
  for (const w of wars) {
    const faltan = (roster ?? [])
      .filter((r) => r.war_id === w.id && !atacó.has(`${w.id}|${r.player_tag}`))
      .sort((a, b) => (a.posicion_mapa ?? 99) - (b.posicion_mapa ?? 99));
    if (!faltan.length) continue;

    const horas = w.end_time ? (new Date(w.end_time) - Date.now()) / 3600000 : null;
    bloques.push(
      `<b>${esc(clanDe[w.season_id] ?? '?')} · ronda ${w.ronda}</b>` +
        (horas !== null ? ` — cierra en ${horas.toFixed(1)}h` : '') +
        `\n<pre>${faltan.map((r) => `#${String(r.posicion_mapa).padStart(2)} ${esc(nombre[r.player_tag] ?? r.player_tag)}`).join('\n')}</pre>`
    );
  }

  return bloques.length ? `⚔️ <b>SIN ATACAR</b>\n\n${bloques.join('\n')}` : '✅ Todos atacaron.';
}

async function cmdEstrellas() {
  const { data: seasons } = await admin
    .from('cwl_seasons')
    .select('id')
    .eq('temporada', temporadaActual());
  if (!seasons?.length) return 'No hay CWL registrada para este mes.';

  const { data: wars } = await admin.from('cwl_wars').select('id').in('season_id', seasons.map((s) => s.id));
  if (!wars?.length) return 'Todavía no hay rondas guardadas.';

  const [{ data: ataques }, { data: players }] = await Promise.all([
    admin.from('cwl_attacks').select('player_tag, estrellas, destruccion_pct').in('war_id', wars.map((w) => w.id)),
    admin.from('players').select('player_tag, nombre_actual'),
  ]);

  const nombre = Object.fromEntries((players ?? []).map((p) => [p.player_tag, p.nombre_actual]));
  const m = new Map();
  for (const a of ataques ?? []) {
    const v = m.get(a.player_tag) ?? { e: 0, n: 0, d: 0 };
    v.e += a.estrellas ?? 0;
    v.d += Number(a.destruccion_pct ?? 0);
    v.n += 1;
    m.set(a.player_tag, v);
  }

  const tabla = [...m.entries()]
    .map(([tag, v]) => ({ nombre: nombre[tag] ?? tag, ...v, prom: v.n ? v.d / v.n : 0 }))
    .sort((a, b) => b.e - a.e || b.prom - a.prom)
    .slice(0, 25)
    .map((p, i) => `${String(i + 1).padStart(2)}. ${p.e}★ ${p.prom.toFixed(0).padStart(3)}%  ${p.nombre}`);

  return tabla.length
    ? `⭐ <b>Estrellas · ${temporadaActual()}</b>\n<pre>${esc(tabla.join('\n'))}</pre>`
    : 'Todavía no hay ataques registrados.';
}

async function cmdJugador(arg) {
  if (!arg) return 'Usa: <code>/jugador Cris</code>';

  const { data: encontrados } = await admin
    .from('players')
    .select('player_tag, nombre_actual')
    .ilike('nombre_actual', `%${arg}%`)
    .limit(5);

  if (!encontrados?.length) return `No encontré a nadie con "${esc(arg)}".`;
  if (encontrados.length > 1) {
    return `Hay varios:\n<pre>${esc(encontrados.map((p) => p.nombre_actual).join('\n'))}</pre>`;
  }

  const p = encontrados[0];
  const { data: snaps } = await admin
    .from('snapshots')
    .select('fecha, th_level, trofeos, liga, war_stars, donaciones')
    .eq('player_tag', p.player_tag)
    .order('fecha', { ascending: false })
    .limit(30);

  if (!snaps?.length) return `${esc(p.nombre_actual)}: sin snapshots todavía.`;

  const hoy = snaps[0];
  const viejo = snaps[snaps.length - 1];
  const dTrofeos = (hoy.trofeos ?? 0) - (viejo.trofeos ?? 0);
  const dEstrellas = (hoy.war_stars ?? 0) - (viejo.war_stars ?? 0);

  return (
    `<b>${esc(p.nombre_actual)}</b> <code>${esc(p.player_tag)}</code>\n\n` +
    `TH${hoy.th_level ?? '?'} · ${hoy.liga ?? 'sin liga'}\n` +
    `Trofeos: ${hoy.trofeos ?? '—'} (${dTrofeos >= 0 ? '+' : ''}${dTrofeos} en ${snaps.length}d)\n` +
    `Estrellas de guerra: ${hoy.war_stars ?? '—'} (+${dEstrellas} en ${snaps.length}d)\n` +
    `Donaciones: ${hoy.donaciones ?? '—'}`
  );
}

async function cmdReporte() {
  const { data } = await admin
    .from('outbox')
    .select('tipo, cuerpo, estado, creado_en')
    .order('creado_en', { ascending: false })
    .limit(1);

  if (!data?.length) return 'No hay mensajes generados todavía.';
  const m = data[0];
  return `<b>${esc(m.tipo)}</b> · ${esc(m.estado)}\n\n<pre>${esc(m.cuerpo)}</pre>`;
}

/**
 * Bases del pack, con el enlace que abre el juego.
 *
 * Es la peticion mas repetida del grupo y hasta ahora se contestaba a mano
 * buscando el PDF. Acepta filtros sueltos y en cualquier orden:
 *
 *   /base            las ultimas que haya
 *   /base 17         solo TH17
 *   /base guerra     solo bases de guerra
 *   /base 17 guerra  las dos cosas
 *
 * Va con la nota del proveedor -que donar en el castillo- porque es la
 * mitad del valor del pack y es justo lo que se pregunta despues.
 */
async function cmdBases(arg) {
  const texto = (arg || '').toLowerCase();
  // Un numero suelto es el ayuntamiento, con o sin "th" delante.
  const th = Number((/(?:th)?\s*(\d{1,2})/.exec(texto) || [])[1]) || null;
  const tipo = /guerra|war|wb/.test(texto) ? 'WB' : /aldea|home|hv/.test(texto) ? 'HV' : null;

  let q = admin
    .from('bases')
    .select('url, th, tipo, etiqueta, nota')
    .order('th', { ascending: false })
    .limit(10);
  if (th) q = q.eq('th', th);
  if (tipo) q = q.eq('tipo', tipo);

  const { data, error } = await q;
  if (error) throw error;

  if (!data?.length) {
    const filtro = [th ? `TH${th}` : null, tipo === 'WB' ? 'guerra' : tipo === 'HV' ? 'aldea' : null]
      .filter(Boolean)
      .join(' ');
    return `No hay bases${filtro ? ' de ' + esc(filtro) : ''} en el pack.\nPrueba <code>/base</code> a secas.`;
  }

  const linea = (b, i) => {
    const cabeza =
      `${i + 1}. <b>TH${b.th ?? '?'}</b> · ${b.tipo === 'WB' ? 'guerra' : 'aldea'}` +
      (b.etiqueta ? ` · ${esc(b.etiqueta)}` : '');
    // El enlace va como <a>: pegar la URL cruda llena el chat de texto y
    // dentro de una lista no siempre queda tocable.
    const enlace = `<a href="${esc(b.url)}">abrir en el juego</a>`;
    const nota = b.nota ? `\n   <i>${esc(b.nota)}</i>` : '';
    return `${cabeza} — ${enlace}${nota}`;
  };

  return `<b>Bases del pack</b> (${data.length})\n\n` + data.map(linea).join('\n\n');
}
