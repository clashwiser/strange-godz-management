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
import { decirCon, esc } from '../../../lib/solicitud';

export const dynamic = 'force-dynamic';

// Dos bots reciben solicitudes, y a cada persona hay que contestarle por
// el MISMO por el que escribio: Telegram no deja que un bot le hable a
// quien nunca le hablo a el. Contestar por el otro es un 403 silencioso y
// alguien esperando un enlace que no llega.
const TOKEN_DE = {
  heraldo: process.env.TELEGRAM_BOT_TOKEN,
  recluta: process.env.RECLUTA_BOT_TOKEN,
};

// El grupo de la comunidad: el id negativo de la lista blanca de Heraldo.
const GRUPO = (process.env.TELEGRAM_CHAT_ID || '')
  .split(',')
  .map((x) => x.trim())
  .find((x) => x.startsWith('-'));

const enlaceClan = (tag) =>
  `https://link.clashofclans.com/es?action=OpenClanProfile&tag=${encodeURIComponent(tag)}`;

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
    // Cada bot con su voz: Valquiria elige, Heraldo acepta.
    const ella = sol.via === 'recluta';
    const aviso = await decirCon(
      TOKEN_DE[sol.via] ?? TOKEN_DE.heraldo,
      sol.tg_user_id,
      (ella
        ? `⚔️ <b>Elegido, mi cielo.</b>\n\nPeleaste bien y hay sitio para ti en <b>${esc(clan.nombre)}</b>. Aquí tienes la puerta:\n\n`
        : `✅ <b>¡Te aceptaron!</b>\n\nBienvenido a <b>${esc(clan.nombre)}</b>. Aquí tienes la puerta:\n\n`) +
        `<a href="${enlaceClan(clan.clan_tag)}">Abrir ${esc(clan.nombre)} en el juego</a>\n\n` +
        `Tag del clan: <code>${esc(clan.clan_tag)}</code>\n\n` +
        `Cuando entres, uno de los líderes te va a retar a una <b>amistosa</b> para ver cómo atacas. ` +
        (ella
          ? `Tranquilo, mi vida: no es un examen, es para saber en qué guerra ponerte.\n\n`
          : `Tómatelo con calma: no es un examen, es para saber en qué guerra ponerte.\n\n`) +
        `Y una cosa importante, que es la que más pesa aquí: <b>enciende la guerra</b> en los ajustes ` +
        `y <b>dona</b>, aunque sea poco. Eso es lo que mira todo el mundo. ${ella ? '⚔️' : '📯'}`
    );

    // Y lo anuncia en el grupo. Que el clan sepa que viene alguien crea
    // expectativa y prepara la amistosa: el que lo va a retar ya sabe a
    // quien. Lo dice Valquiria con su propio token, asi que solo sale si
    // esta dentro del grupo; si no, Telegram devuelve 403 y no pasa nada.
    // Nombre y estrellas son datos publicos del juego, no cuenta nada que
    // no pueda ver cualquiera buscando el tag.
    if (ella && GRUPO && sol.perfil) {
      const r = sol.perfil;
      await decirCon(
        TOKEN_DE.recluta,
        GRUPO,
        `⚔️ Elegí a un guerrero nuevo: <b>${esc(r.nombre)}</b> · TH${r.th} · ` +
          `${Number(r.guerraVida ?? 0).toLocaleString('es-ES')} ★ de guerra.\n\n` +
          `Va para <b>${esc(clan.nombre)}</b> a probarse en una amistosa. Traten bien a mi elegido.`
      );
    }

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
    const aviso = await decirCon(
      TOKEN_DE[sol.via] ?? TOKEN_DE.heraldo,
      sol.tg_user_id,
      sol.via === 'recluta'
        ? `Esta vez no, mi corazón. Por ahora no hay sitio para ti.\n\n` +
            `No lo tomes a mal, mi vida: sigue peleando, escríbeme más adelante y te miro otra vez. ⚔️`
        : `Gracias por escribirnos, mi hermano. Por ahora no tenemos hueco para ti.\n\n` +
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
