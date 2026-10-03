// Salud y mandos de los dos bots, para la pestaña Bots del panel.
//
// Hasta ahora saber si un bot estaba bien era correr un job en PowerShell
// y leer JSON. Los lideres no van a hacer eso. Aqui se les pregunta a
// Telegram las tres cosas que importan de cada bot y se devuelven
// masticadas:
//
//   - el webhook apunta a donde debe y no tiene errores
//   - esta dentro del grupo de la comunidad
//   - oye todo el chat o solo cuando le hablan (modo privacidad)
//
// Y tres cosas que se pueden HACER desde el panel sin tocar una terminal:
// mandar un mensaje de prueba al grupo, reinstalar el webhook y publicar
// la lista de comandos en el menu "/" de Telegram.
//
// Ningun token sale de aqui. Solo se dice si esta puesto.

import { admin } from '../../../lib/supabase-admin';
import { usoDeHoy } from '../../../lib/pensar';
import { tg, saludDelBot } from '../../../lib/bots-salud';

export const dynamic = 'force-dynamic';

const SITIO = (process.env.SITIO_URL || 'https://strange-godz-management.vercel.app').replace(/\/$/, '');
const GRUPO = (process.env.TELEGRAM_CHAT_ID || '')
  .split(',')
  .map((x) => x.trim())
  .find((x) => x.startsWith('-'));

const BOTS = {
  heraldo: {
    token: process.env.TELEGRAM_BOT_TOKEN,
    secreto: process.env.TELEGRAM_SECRET_TOKEN,
    ruta: '/api/telegram',
    prueba: '📯 Prueba desde el panel. Heraldo a la orden.',
    // Lo que sale en el menu "/" de Telegram. Solo lo que sirve a todo el
    // mundo: /reporte es de lideres y no hace falta anunciarlo.
    comandos: [
      { command: 'yo', description: 'Tus estrellas y ataques de esta CWL' },
      { command: 'miclan', description: 'A qué clan te toca ir esta CWL' },
      { command: 'cobro', description: 'En qué puesto vas del reparto' },
      { command: 'base', description: 'Una base del pack, por privado (una cada 3 días por cuenta)' },
      { command: 'guerra', description: 'Qué clanes están en guerra ahora y cuánto falta' },
      { command: 'faltan', description: 'Quién no ha atacado en la guerra de ahora' },
      { command: 'premios', description: 'Los premios de este mes' },
      { command: 'contacto', description: 'El Telegram y el WhatsApp de los líderes' },
      { command: 'asignar', description: '(líderes) Decir quién es alguien: contesta a su mensaje y /asignar Nombre' },
      { command: 'estrellas', description: 'Tabla de estrellas de la temporada' },
      { command: 'resumen', description: 'Estado de los clanes' },
      { command: 'soy', description: 'Quién eres en el juego: elige de la lista, o /soy Fulano, o /soy #TuTag' },
      { command: 'reglas', description: 'Las normas del clan' },
      { command: 'castillo', description: 'Con la captura del mapa de guerra: tu castillo donado (+puntos)' },
      { command: 'fc', description: 'Con la captura del chat: 5 desafíos amistosos de 2⭐ o más (+puntos)' },
      { command: 'juegos', description: 'Con la captura de los Juegos del Clan: 4000 = +20, 10000 = +50' },
      { command: 'puntos', description: 'La tabla de puntos del mes' },
      { command: 'idioma', description: 'En qué idioma te contesto por privado (ES · EN · FIL)' },
      { command: 'ayuda', description: 'Todo lo que sabe hacer' },
    ],
    // El mismo menu en ingles. Telegram se lo enseña a quien tenga la app
    // en ingles, sin que esa persona haga nada (setMyCommands acepta
    // language_code). Lo pidio Cris el 3 oct 2026, con Queen en el clan.
    comandosEn: [
      { command: 'yo', description: 'Your stars and attacks in this CWL' },
      { command: 'miclan', description: 'Which clan you play this CWL in' },
      { command: 'cobro', description: 'Where you stand in the prize split' },
      { command: 'base', description: 'A base from the pack, in private (one every 3 days per account)' },
      { command: 'guerra', description: 'Which clans are at war right now and how long is left' },
      { command: 'faltan', description: "Who hasn't attacked in the current war" },
      { command: 'premios', description: "This month's prizes" },
      { command: 'contacto', description: 'The leaders\' Telegram and WhatsApp' },
      { command: 'asignar', description: '(leaders) Say who someone is: reply to them and /asignar Name' },
      { command: 'estrellas', description: 'War stars table for the season' },
      { command: 'resumen', description: 'How the clans are doing' },
      { command: 'soy', description: 'Who you are in game: pick from the list, or /soy Name, or /soy #YourTag' },
      { command: 'reglas', description: 'The clan rules' },
      { command: 'castillo', description: 'With the war map screenshot: your donated castle (+points)' },
      { command: 'fc', description: 'With the chat screenshot: 5 friendly challenges with 2⭐ or more (+points)' },
      { command: 'juegos', description: 'With the Clan Games screenshot: 4000 = +20, 10000 = +50' },
      { command: 'puntos', description: "This month's points table" },
      { command: 'idioma', description: 'Pick the language I answer you in, in private (ES · EN · FIL)' },
      { command: 'ayuda', description: 'Everything I can do' },
    ],
  },
  recluta: {
    token: process.env.RECLUTA_BOT_TOKEN,
    secreto: process.env.RECLUTA_SECRET_TOKEN,
    ruta: '/api/recluta',
    prueba: '⚔️ Prueba desde el panel. Valquiria presente.',
    // Sin comandos a proposito: en el grupo, el menu "/" mezclaria los
    // suyos con los de Heraldo, y ella no atiende comandos.
    comandos: [],
  },
};

async function quienLlama(request) {
  const jwt = (request.headers.get('authorization') ?? '').replace(/^Bearer /, '');
  if (!jwt) return null;
  const { data: usuario, error } = await admin.auth.getUser(jwt);
  if (error || !usuario?.user) return null;
  const { data: lider } = await admin
    .from('dashboard_users')
    .select('puede_editar, nombre')
    .eq('user_id', usuario.user.id)
    .maybeSingle();
  return lider ? { ...lider, email: usuario.user.email } : null;
}

export async function GET(request) {
  const lider = await quienLlama(request);
  if (!lider) return Response.json({ ok: false, error: 'no autorizado' }, { status: 401 });

  // El dia de Cuba, igual que el cupo de bases: a las 11 de la noche en La
  // Habana ya es mañana en UTC y el contador se pondria a cero antes de tiempo.
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Havana' });
  const [heraldo, recluta, sol, vinc, basesHoy, outbox, ia] = await Promise.all([
    saludDelBot('heraldo'),
    saludDelBot('recluta'),
    admin.from('solicitudes').select('estado'),
    admin.from('tg_vinculos').select('*', { count: 'exact', head: true }),
    admin.from('base_pedidos').select('*', { count: 'exact', head: true }).eq('dia', hoy),
    admin.from('outbox').select('*', { count: 'exact', head: true }).eq('estado', 'pendiente'),
    usoDeHoy(admin),
  ]);

  const estados = (sol.data ?? []).reduce((a, s) => ((a[s.estado] = (a[s.estado] ?? 0) + 1), a), {});

  return Response.json({
    ok: true,
    grupo: GRUPO ? { id: GRUPO } : null,
    bots: { heraldo, recluta },
    ia,
    actividad: {
      solicitudesPendientes: (estados.pendiente ?? 0) + (estados.prueba ?? 0),
      solicitudesTotal: (sol.data ?? []).filter((s) => s.estado !== 'borrador').length,
      aceptadas: estados.aceptada ?? 0,
      vinculados: vinc.count ?? 0,
      basesHoy: basesHoy.count ?? 0,
      outboxPendientes: outbox.count ?? 0,
    },
  });
}

export async function POST(request) {
  const lider = await quienLlama(request);
  if (!lider) return Response.json({ ok: false, error: 'no autorizado' }, { status: 401 });
  if (!lider.puede_editar) return Response.json({ ok: false, error: 'solo quien puede editar' }, { status: 403 });

  const { bot, accion } = await request.json().catch(() => ({}));
  const b = BOTS[bot];
  if (!b) return Response.json({ ok: false, error: 'ese bot no existe' }, { status: 400 });
  if (!b.token) return Response.json({ ok: false, error: 'ese bot no tiene token en Vercel' }, { status: 503 });

  if (accion === 'probar') {
    if (!GRUPO) return Response.json({ ok: false, error: 'sin grupo configurado' }, { status: 503 });
    const r = await tg(b.token, 'sendMessage', { chat_id: GRUPO, text: b.prueba });
    return Response.json({ ok: r.ok, error: r.ok ? null : r.description });
  }

  if (accion === 'webhook') {
    if (!b.secreto) return Response.json({ ok: false, error: 'falta el secreto en Vercel' }, { status: 503 });
    const r = await tg(b.token, 'setWebhook', {
      url: `${SITIO}${b.ruta}`,
      secret_token: b.secreto,
      // callback_query: los botones en los mensajes (aceptar las normas).
      allowed_updates: ['message', 'edited_message', 'callback_query', 'message_reaction'],
      drop_pending_updates: true,
    });
    return Response.json({ ok: r.ok, error: r.ok ? null : r.description });
  }

  if (accion === 'comandos') {
    // El menu por defecto (español) y, aparte, el de quien tenga la app en
    // ingles. Telegram elige solo por el idioma de cada cliente.
    const r = await tg(b.token, 'setMyCommands', { commands: b.comandos });
    let idiomas = 1;
    if (r.ok && b.comandosEn?.length) {
      const en = await tg(b.token, 'setMyCommands', { commands: b.comandosEn, language_code: 'en' });
      if (en.ok) idiomas += 1;
    }
    return Response.json({ ok: r.ok, error: r.ok ? null : r.description, cuantos: b.comandos.length, idiomas });
  }

  return Response.json({ ok: false, error: 'acción desconocida' }, { status: 400 });
}
