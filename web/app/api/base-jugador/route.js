// Heraldo le manda una base al jugador al que se le asigno.
//
// Sale del panel, desde la pestaña Bases: se elige a quien va la base en el
// desplegable y se le da al boton. Heraldo la publica en el grupo con la
// miniatura y mencionando a la persona, para que le suene el telefono.
//
// Por que en el GRUPO y no por privado: el bot no puede escribirle primero
// a alguien que nunca le ha hablado — Telegram no lo permite, y la mitad
// del clan nunca le va a escribir al bot. Mencionado en el grupo llega
// igual, y ademas los demas ven que esa base ya tiene dueño.
//
// El aviso de "no la compartas" no es adorno: el pack se paga, y una base
// de guerra deja de servir en cuanto la tiene medio mundo.

import { admin } from '../../../lib/supabase-admin';

export const dynamic = 'force-dynamic';

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const SITIO = (process.env.SITIO_URL || 'https://strange-godz-management.vercel.app').replace(/\/$/, '');

const esc = (s) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export async function POST(request) {
  if (!TOKEN || !CHAT_ID) {
    return Response.json({ ok: false, error: 'Telegram sin configurar' }, { status: 503 });
  }

  const jwt = (request.headers.get('authorization') ?? '').replace(/^Bearer /, '');
  if (!jwt) return Response.json({ ok: false, error: 'sin sesión' }, { status: 401 });

  const { data: usuario, error: errUser } = await admin.auth.getUser(jwt);
  if (errUser || !usuario?.user) {
    return Response.json({ ok: false, error: 'sesión inválida' }, { status: 401 });
  }
  const { data: lider } = await admin
    .from('dashboard_users')
    .select('puede_editar')
    .eq('user_id', usuario.user.id)
    .maybeSingle();
  if (!lider?.puede_editar) {
    return Response.json({ ok: false, error: 'no autorizado' }, { status: 403 });
  }

  const { baseId } = await request.json().catch(() => ({}));
  if (!baseId) return Response.json({ ok: false, error: 'falta la base' }, { status: 400 });

  const { data: base } = await admin
    .from('bases')
    .select('id, url, th, tipo, etiqueta, nota, preview, asignada_a')
    .eq('id', baseId)
    .maybeSingle();
  if (!base) return Response.json({ ok: false, error: 'esa base no existe' }, { status: 404 });
  if (!base.asignada_a) {
    return Response.json(
      { ok: false, error: 'la base no está asignada a nadie' },
      { status: 400 }
    );
  }

  const { data: jugador } = await admin
    .from('players')
    .select('player_tag, nombre_actual')
    .eq('player_tag', base.asignada_a)
    .maybeSingle();
  const nombre = jugador?.nombre_actual ?? base.asignada_a;

  // Si se ato con "Heraldo yo soy Fulano", se le menciona de verdad y le
  // vibra el telefono. Si no, sale su nombre en negrita: llega igual, pero
  // tiene que estar mirando el grupo.
  const { data: vinculo } = await admin
    .from('tg_vinculos')
    .select('tg_user_id')
    .eq('player_tag', base.asignada_a)
    .limit(1)
    .maybeSingle();

  const mencion = vinculo
    ? `<a href="tg://user?id=${vinculo.tg_user_id}">${esc(nombre)}</a>`
    : `<b>${esc(nombre)}</b>`;

  const pie =
    `🏰 ${mencion}, copia esta base para la liga de hoy, por favor.\n\n` +
    `<b>TH${base.th ?? '?'} · ${base.tipo === 'WB' ? 'guerra' : 'aldea'}</b>` +
    (base.etiqueta ? ` · ${esc(base.etiqueta)}` : '') +
    (base.nota ? `\n🛡 <i>${esc(base.nota)}</i>` : '') +
    `\n\n<a href="${esc(base.url)}">Abrir en el juego</a>\n\n` +
    `⚠️ <b>No compartas la distribución.</b> Esta base es solo para ${esc(nombre)}.`;

  const conFoto = Boolean(base.preview) && pie.length <= 1024;

  const r = await fetch(
    `https://api.telegram.org/bot${TOKEN}/${conFoto ? 'sendPhoto' : 'sendMessage'}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        conFoto
          ? { chat_id: CHAT_ID, photo: `${SITIO}${base.preview}`, caption: pie, parse_mode: 'HTML' }
          : { chat_id: CHAT_ID, text: pie, parse_mode: 'HTML' }
      ),
    }
  );

  if (!r.ok) {
    const detalle = (await r.text().catch(() => '')).slice(0, 200);
    return Response.json({ ok: false, error: detalle }, { status: 502 });
  }

  // NO se anota en base_pedidos a proposito. Esa tabla lleva el cupo del
  // autoservicio -una por persona y diez por grupo al dia-, y esto es otra
  // cosa: un lider repartiendo la alineacion. Si contara, diez envios desde
  // el panel dejarian al clan entero sin poder pedir base ese dia.
  //
  // De a quien se le asigno cada base ya queda constancia en bases.asignada_a.
  return Response.json({ ok: true, jugador: nombre, mencionado: Boolean(vinculo) });
}
