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

// El propio sitio. De aqui salen las miniaturas de las bases, que Telegram
// descarga solo con pasarle la URL.
const SITIO = (process.env.SITIO_URL || 'https://strange-godz-management.vercel.app').replace(/\/$/, '');

/**
 * Manda la respuesta. Si el comando devolvio {foto, pie} va como imagen con
 * el texto de pie: una base sin ver la mini obliga a abrir el enlace en el
 * juego solo para saber si sirve.
 */
async function responder(chatId, respuesta) {
  const conFoto = respuesta && typeof respuesta === 'object' && respuesta.foto;
  const cuerpo = conFoto
    ? { chat_id: chatId, photo: respuesta.foto, caption: respuesta.pie, parse_mode: 'HTML' }
    : {
        chat_id: chatId,
        text: String(respuesta),
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
      };

  const res = await fetch(
    `https://api.telegram.org/bot${TOKEN}/${conFoto ? 'sendPhoto' : 'sendMessage'}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
    }
  );

  // Si falla la foto -miniatura no publicada todavia- se manda el texto, que
  // lleva el enlace. Perder la respuesta entera por la imagen seria absurdo.
  if (!res.ok && conFoto) {
    await responder(chatId, respuesta.pie);
  }
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

  if (!chatId || !texto) return Response.json({ ok: true });

  // Sin "PERMITIDOS.length &&": la lista vacia ya se rechaza arriba con 503,
  // asi que aca un chat que no este en la lista blanca siempre se corta.
  if (!PERMITIDOS.includes(String(chatId))) {
    await responder(chatId, `Este bot es privado.\nTu chat id es <code>${chatId}</code>.`);
    return Response.json({ ok: true });
  }

  // Quien pregunta. El id numerico no cambia aunque se cambie el @usuario,
  // y es lo que usa el cupo diario de bases.
  const quien = {
    id: msg.from?.id ?? chatId,
    nombre: msg.from?.first_name || msg.from?.username || null,
  };

  let comando;
  let arg;

  if (texto.startsWith('/')) {
    // "/jugador@x300bot Cris" -> comando "jugador", argumento "Cris"
    const [crudo, ...resto] = texto.split(/\s+/);
    comando = crudo.slice(1).split('@')[0].toLowerCase();
    arg = resto.join(' ');
  } else {
    // Sin barra: nadie escribe comandos, la gente pregunta. Con el modo
    // privacidad puesto, Telegram solo nos manda los mensajes que mencionan
    // al bot o que responden a uno suyo — asi que si esto llego, nos
    // estaban hablando a nosotros.
    const leido = entender(texto);
    if (!leido) return Response.json({ ok: true });
    ({ comando, arg } = leido);
  }

  try {
    await responder(chatId, await ejecutar(comando, arg, quien));
  } catch (e) {
    await responder(chatId, `⚠️ Error: <code>${esc(e.message)}</code>`);
  }

  return Response.json({ ok: true });
}

/**
 * Traduce una frase suelta a un comando.
 *
 *   "@Heraldo me puedes dar una base buena para guerra"  ->  base, "guerra"
 *
 * A proposito NO es un modelo de lenguaje: costaria dinero todos los meses
 * y aqui hay cinco intenciones contadas. Los patrones son laxos porque la
 * gente escribe como habla, sin tildes y con faltas.
 */
export function entender(texto) {
  const q = texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/@\w+/g, ' ');

  // La base va primero: es lo que mas se pide, y "guerra" aparece tambien
  // en las frases de las otras intenciones.
  if (/\b(base|bases|dise|layout|aldea)\b/.test(q)) return { comando: 'base', arg: q };
  if (/(falta|sin atacar|no\s+(ha\s+|han\s+)?atac|quien debe|pendiente)/.test(q))
    return { comando: 'faltan', arg: '' };
  if (/(estrella|tabla|ranking|quien va gan|mejor)/.test(q)) return { comando: 'estrellas', arg: '' };
  if (/(resumen|como vamos|estado|situacion)/.test(q)) return { comando: 'resumen', arg: '' };

  const m = /(?:jugador|ficha|quien es|como va)\s+(.+)/.exec(q);
  if (m) return { comando: 'jugador', arg: m[1].trim() };

  // Si nos hablaron pero no se entiende, mejor decirlo que callar: en un
  // grupo, un bot que ignora una mencion parece roto.
  if (/(heraldo|hola|ayuda|que sabes|puedes)/.test(q)) return { comando: 'ayuda', arg: '' };

  return null;
}

// Telegram reintenta si no recibe 200; responder rapido evita duplicados.
export async function GET() {
  return Response.json({ ok: true, bot: 'x300' });
}

// ------------------------------------------------------------- Comandos
async function ejecutar(comando, arg, quien = { id: 0, nombre: null }) {
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
        `/base [th] [guerra|cwl|aldea] — una base del pack, con su mini\n` +
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
      return await cmdBase(arg, quien);
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

// ---------------------------------------------------------- Bases
// El pack es contenido PAGADO. Soltar los diecisiete enlaces de golpe es
// regalarlo: basta con que alguien reenvie el mensaje. Va de una en una y
// con cupo diario. Ver sql/016_base_pedidos.sql.

const CUPO_DIARIO = 1;

/** El dia de hoy en Cuba, que es donde vive la gente que pide. */
const diaCuba = () =>
  new Date().toLocaleDateString('en-CA', { timeZone: 'America/Havana' });

/**
 * Una base al azar, con su miniatura y con lo que hay que donarle al
 * castillo.
 *
 * Evita repetir: primero busca entre las que esa persona NO ha pedido nunca.
 * Solo si ya las pidio todas vuelve a entrar en el saco completo — asi el
 * que pide dos al dia durante una semana ve catorce distintas, no la misma
 * tres veces.
 */
async function cmdBase(arg, quien) {
  const texto = (arg || '').toLowerCase();
  // El ayuntamiento vale si lleva "th"/"ayuntamiento" delante, o si es un
  // numero suelto en rango de ayuntamiento. Sin lo segundo, "dame 2 bases"
  // se leia como TH2 y no devolvia nada: el numero de la frase no siempre
  // es un nivel.
  const conPrefijo = /(?:th|ayuntamiento)\s*(\d{1,2})/.exec(texto);
  const suelto = /\b(\d{1,2})\b/.exec(texto);
  const candidato = Number(conPrefijo?.[1] ?? suelto?.[1]);
  const th = candidato >= 6 && candidato <= 20 ? candidato : null;
  const tipo = /guerra|war|cwl|wb/.test(texto) ? 'WB' : /aldea|home|hv/.test(texto) ? 'HV' : null;

  const hoy = diaCuba();
  const { count: llevaHoy, error: errCupo } = await admin
    .from('base_pedidos')
    .select('id', { count: 'exact', head: true })
    .eq('tg_user_id', quien.id)
    .eq('dia', hoy);
  if (errCupo) throw errCupo;

  if ((llevaHoy ?? 0) >= CUPO_DIARIO) {
    // El texto se adapta al cupo: con CUPO_DIARIO en 1, "tus 1 bases de hoy"
    // canta a plantilla mal hecha, y el bot pierde toda la gracia.
    const cuantas = CUPO_DIARIO === 1 ? 'tu <b>base de hoy</b>' : `tus <b>${CUPO_DIARIO} bases de hoy</b>`;
    return (
      `📜 Ya pediste ${cuantas}.\n\n` +
      `Mañana hay ${CUPO_DIARIO === 1 ? 'otra' : `${CUPO_DIARIO} más`}. El pack es de pago, y la base ` +
      `se pide cuando se va a atacar — no para coleccionarlas.`
    );
  }

  let q = admin.from('bases').select('id, url, th, tipo, etiqueta, nota, preview');
  if (th) q = q.eq('th', th);
  if (tipo) q = q.eq('tipo', tipo);
  const { data: todas, error } = await q;
  if (error) throw error;

  if (!todas?.length) {
    const filtro = [th ? `TH${th}` : null, tipo === 'WB' ? 'de guerra' : tipo === 'HV' ? 'de aldea' : null]
      .filter(Boolean)
      .join(' ');
    return `No tengo ninguna base ${esc(filtro)} en el pack.\nPrueba <code>/base</code> a secas.`;
  }

  // Las que esta persona ya vio, para no repetirselas mientras haya nuevas.
  const { data: vistas } = await admin
    .from('base_pedidos')
    .select('base_id')
    .eq('tg_user_id', quien.id);
  const yaVio = new Set((vistas ?? []).map((v) => v.base_id));
  const nuevas = todas.filter((b) => !yaVio.has(b.id));
  const saco = nuevas.length ? nuevas : todas;

  const base = saco[Math.floor(Math.random() * saco.length)];

  await admin.from('base_pedidos').insert({
    tg_user_id: quien.id,
    tg_nombre: quien.nombre ?? null,
    base_id: base.id,
    dia: hoy,
  });

  const quedan = CUPO_DIARIO - (llevaHoy ?? 0) - 1;
  const cierre =
    quedan === 0
      ? 'Es tu base de hoy. Mañana hay otra.'
      : `Te ${quedan === 1 ? 'queda' : 'quedan'} ${quedan} de hoy.`;
  const pie =
    `🏰 <b>TH${base.th ?? '?'} · ${base.tipo === 'WB' ? 'guerra' : 'aldea'}</b>` +
    (base.etiqueta ? ` · ${esc(base.etiqueta)}` : '') +
    (base.nota ? `\n\n🛡 <i>${esc(base.nota)}</i>` : '') +
    `\n\n<a href="${esc(base.url)}">Abrir en el juego</a>` +
    `\n\n<i>${cierre}</i>`;

  // Con miniatura si el pack la trae; los packs de solo texto no la tienen.
  if (base.preview) {
    return { foto: `${SITIO}${base.preview}`, pie };
  }
  return pie;
}
