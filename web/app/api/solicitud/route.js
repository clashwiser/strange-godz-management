// Decidir una solicitud de ingreso, y avisar al que la mandó.
//
// Por que no lo hace el navegador contra Supabase directamente: cambiar la
// fila SI podria -hay politica de update para puede_editar()-, pero el que
// espera no se enteraria. Escribirle por Telegram necesita el token del
// bot, y ese no puede salir del servidor.
//
// El aspirante SI puede recibir el mensaje aunque nunca haya estado en el
// grupo: Telegram deja contestarle a quien te escribio primero, y para
// llegar hasta aqui tuvo que escribirle al bot.

import { admin } from '../../../lib/supabase-admin';

export const dynamic = 'force-dynamic';

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;

const esc = (s) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const enlaceClan = (tag) =>
  `https://link.clashofclans.com/es?action=OpenClanProfile&tag=${encodeURIComponent(tag)}`;

async function decir(chatId, texto) {
  if (!TOKEN) return false;
  const r = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: texto,
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
    }),
  });
  return r.ok;
}

export async function POST(request) {
  const jwt = (request.headers.get('authorization') ?? '').replace(/^Bearer /, '');
  if (!jwt) return Response.json({ ok: false, error: 'sin sesión' }, { status: 401 });

  const { data: usuario, error: errUser } = await admin.auth.getUser(jwt);
  if (errUser || !usuario?.user) {
    return Response.json({ ok: false, error: 'sesión inválida' }, { status: 401 });
  }
  const { data: lider } = await admin
    .from('dashboard_users')
    .select('puede_editar, nombre')
    .eq('user_id', usuario.user.id)
    .maybeSingle();
  if (!lider?.puede_editar) {
    return Response.json({ ok: false, error: 'no autorizado' }, { status: 403 });
  }

  const { id, accion, clanTag, nota, pruebaOk } = await request.json().catch(() => ({}));
  if (!id) return Response.json({ ok: false, error: 'falta la solicitud' }, { status: 400 });

  const { data: sol } = await admin.from('solicitudes').select('*').eq('id', id).maybeSingle();
  if (!sol) return Response.json({ ok: false, error: 'esa solicitud no existe' }, { status: 404 });

  const quien = lider.nombre || usuario.user.email || 'un líder';
  const sello = new Date().toISOString();

  // ---- Anotar el resultado del reto amistoso ----
  //
  // Las amistosas no salen en ningun endpoint de la API, asi que esto solo
  // puede venir a mano. Es el ultimo filtro: ya esta dentro, y aqui se
  // decide si se queda.
  if (accion === 'prueba') {
    await admin
      .from('solicitudes')
      .update({ prueba_ok: pruebaOk === true, nota: nota ?? sol.nota, actualizado_en: sello })
      .eq('id', id);
    return Response.json({ ok: true });
  }

  if (accion === 'aceptar') {
    if (!clanTag) return Response.json({ ok: false, error: 'elige el clan' }, { status: 400 });
    const { data: clan } = await admin
      .from('clans')
      .select('clan_tag, nombre')
      .eq('clan_tag', clanTag)
      .maybeSingle();
    if (!clan) return Response.json({ ok: false, error: 'ese clan no existe' }, { status: 400 });

    await admin
      .from('solicitudes')
      .update({
        estado: 'prueba',
        clan_destino: clan.clan_tag,
        nota: nota ?? sol.nota,
        decidido_en: sello,
        decidido_por: quien,
        actualizado_en: sello,
      })
      .eq('id', id);

    // Se le avisa del reto ANTES de que entre, no despues. Que te reten
    // nada mas poner un pie dentro, sin habertelo dicho, parece una
    // novatada; avisado, es parte del trato.
    const aviso = await decir(
      sol.tg_user_id,
      `✅ <b>¡Te aceptaron!</b>\n\n` +
        `Bienvenido a <b>${esc(clan.nombre)}</b>. Aquí tienes la puerta:\n\n` +
        `<a href="${enlaceClan(clan.clan_tag)}">Abrir ${esc(clan.nombre)} en el juego</a>\n\n` +
        `Tag del clan: <code>${esc(clan.clan_tag)}</code>\n\n` +
        `Cuando entres, uno de los líderes te va a retar a una <b>amistosa</b> para ver cómo atacas. ` +
        `Tómatelo con calma: no es un examen, es para saber en qué guerra ponerte.\n\n` +
        `Y una cosa importante, que es la que más pesa aquí: <b>enciende la guerra</b> en los ajustes ` +
        `y <b>dona</b>, aunque sea poco. Eso es lo que mira todo el mundo. 📯`
    );

    return Response.json({ ok: true, avisado: aviso, estado: 'prueba' });
  }

  if (accion === 'rechazar') {
    await admin
      .from('solicitudes')
      .update({
        estado: 'rechazada',
        nota: nota ?? sol.nota,
        decidido_en: sello,
        decidido_por: quien,
        actualizado_en: sello,
      })
      .eq('id', id);

    // Corto y sin dar explicaciones que no se pidieron, pero sin portazo:
    // el que hoy no entra puede ser el que dentro de tres meses si, y el
    // mundillo de Clash es mas pequeño de lo que parece.
    const aviso = await decir(
      sol.tg_user_id,
      `Gracias por escribirnos, mi hermano. Por ahora no tenemos hueco para ti.\n\n` +
        `No lo tomes a mal: vuelve a escribirme más adelante y lo miramos otra vez. 📯`
    );

    return Response.json({ ok: true, avisado: aviso, estado: 'rechazada' });
  }

  // ---- Confirmar que se queda, ya pasada la amistosa ----
  if (accion === 'confirmar') {
    await admin
      .from('solicitudes')
      .update({ estado: 'aceptada', nota: nota ?? sol.nota, actualizado_en: sello })
      .eq('id', id);
    return Response.json({ ok: true, estado: 'aceptada' });
  }

  return Response.json({ ok: false, error: 'acción desconocida' }, { status: 400 });
}
