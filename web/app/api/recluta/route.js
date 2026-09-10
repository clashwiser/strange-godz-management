// Webhook de VALQUIRIA, el bot de reclutar (@Valqui_bot).
//
// Existe por una razon boba y real: @Strange_godz_heraldo_bot son 24
// caracteres para teclear desde la pantalla del juego. Valquiria tiene un
// @usuario corto y es el que va en la descripcion del clan.
//
// Dos sitios, dos comportamientos:
//
// EN PRIVADO es la puerta: un desconocido le escribe, ella le pide el tag,
// mira como ha peleado y se lo pasa a los lideres. Nada mas pasa por
// aqui: ni comandos, ni datos del clan, ni bases. No es que se filtren;
// es que el codigo no esta.
//
// EN EL GRUPO -solo en el de la comunidad- hace dos cosas: explicar como
// se entra, que es lo que mas van a preguntar, y presentar a los que ella
// eligio cuando cruzan la puerta. Y tiene personalidad, que es lo que
// hace que la gente se quede. Todo lo que sea de Heraldo lo manda a
// Heraldo. Solo habla si la nombran o le contestan a un mensaje suyo: con
// el modo privacidad quitado le llega TODO el chat, y un bot que opina
// sin que le pregunten es un bot al que echan.
//
// Variables en Vercel:
//   RECLUTA_BOT_TOKEN      el token del bot (BotFather)
//   RECLUTA_SECRET_TOKEN   uno inventado, el mismo que lleva el webhook

import { admin } from '../../../lib/supabase-admin';
import { flujoSolicitud, decirCon, decirConVideo, esc } from '../../../lib/solicitud';
import {
  entenderValquiria,
  cuantosEsperan,
  presentaElegido,
  bienvenidaValquiria,
} from '../../../lib/charla-valquiria';

export const dynamic = 'force-dynamic';

const TOKEN = process.env.RECLUTA_BOT_TOKEN;
// El propio sitio: de aqui se descarga Telegram el video de la bienvenida.
const SITIO = (process.env.SITIO_URL || 'https://strange-godz-management.vercel.app').replace(/\/$/, '');
const SECRETO = process.env.RECLUTA_SECRET_TOKEN;

// Su propio id de usuario: es la parte del token antes de los dos puntos.
// Hace falta para saber si un mensaje es respuesta a ELLA y no a Heraldo.
const MI_ID = Number((TOKEN || '').split(':')[0]) || 0;

// El unico grupo donde habla: el id negativo de la lista blanca.
const GRUPO = (process.env.TELEGRAM_CHAT_ID || '')
  .split(',')
  .map((x) => x.trim())
  .find((x) => x.startsWith('-'));

export async function POST(request) {
  // Falla cerrado, igual que el de Heraldo: sin variables, inerte.
  if (!TOKEN || !SECRETO) return new Response('bot de reclutar sin configurar', { status: 503 });

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
  if (!chatId) return Response.json({ ok: true });
  const texto = (msg.text || '').trim();

  // ---- En privado: la puerta ----
  //
  // Se le pasa el mensaje entero aunque no traiga texto: en el paso del
  // video lo que llega es un archivo, y la conversacion es la que sabe si
  // lo esta esperando.
  if (msg.chat.type === 'private') {
    const respuesta = await flujoSolicitud(admin, msg, texto, 'recluta');
    if (respuesta) await decirCon(TOKEN, chatId, respuesta);
    return Response.json({ ok: true });
  }

  // ---- En un grupo: solo en el nuestro ----
  if (String(chatId) !== String(GRUPO)) return Response.json({ ok: true });

  // Alguien entro. La bienvenida la da ELLA -es la que elige quien entra,
  // asi que es la que recibe- y sale con su video saludando. Heraldo se
  // calla mientras Valquiria exista: dos saludos seguidos es ruido.
  //
  // Se filtran los bots: cuando la añaden a un grupo, ella misma llega en
  // new_chat_members y se daria la bienvenida sola.
  if (msg.new_chat_members?.length) {
    const gente = msg.new_chat_members.filter((u) => u && !u.is_bot);
    if (!gente.length) return Response.json({ ok: true });

    const nombra = (u) =>
      `<a href="tg://user?id=${u.id}">${esc(u.first_name || u.username || 'el nuevo')}</a>`;
    const quien =
      gente.length > 1
        ? `${gente.slice(0, -1).map(nombra).join(', ')} y ${nombra(gente[gente.length - 1])}`
        : nombra(gente[0]);

    await decirConVideo(
      TOKEN,
      chatId,
      `${SITIO}/valquiria-saluda.mp4`,
      bienvenidaValquiria(gente.length > 1).replace('{quien}', quien)
    );

    // Y si a alguno lo eligio ella, lo dice: es su carta de presentacion
    // ante el clan, y el que lo va a retar en amistosa ya sabe a quien.
    const { data: elegidos } = await admin
      .from('solicitudes')
      .select('tg_user_id, perfil')
      .in('tg_user_id', gente.map((u) => u.id))
      .in('estado', ['prueba', 'aceptada']);
    for (const s of elegidos ?? []) {
      const nombre = s.perfil?.nombre ?? gente.find((u) => u.id === s.tg_user_id)?.first_name ?? 'el nuevo';
      await decirCon(TOKEN, chatId, presentaElegido(esc(nombre), s.perfil?.th ?? '?'));
    }
    return Response.json({ ok: true });
  }

  if (!texto) return Response.json({ ok: true });

  // Los comandos con barra son de Heraldo. Con la privacidad quitada le
  // llegan tambien a ella, y contestarlos seria hablar los dos a la vez.
  if (texto.startsWith('/')) return Response.json({ ok: true });

  // Solo si es con ella: la nombran, o responden a un mensaje suyo.
  const respondeAElla = msg.reply_to_message?.from?.id === MI_ID;
  const nombrada = /valqui/i.test(texto);
  if (!respondeAElla && !nombrada) return Response.json({ ok: true });

  const leido = entenderValquiria(texto);
  if (!leido) return Response.json({ ok: true });

  if (leido.tipo === 'esperando') {
    const { count } = await admin
      .from('solicitudes')
      .select('*', { count: 'exact', head: true })
      .in('estado', ['pendiente', 'prueba']);
    await decirCon(TOKEN, chatId, cuantosEsperan(count ?? 0));
    return Response.json({ ok: true });
  }

  await decirCon(TOKEN, chatId, leido.texto);
  return Response.json({ ok: true });
}

export async function GET() {
  return Response.json({
    ok: true,
    bot: 'recluta',
    configurado: {
      token: Boolean(TOKEN),
      secreto: Boolean(SECRETO),
      grupo: Boolean(GRUPO),
      // Sin Heraldo no hay avisos a los lideres ni forma de saber quien
      // es de casa; la solicitud se guarda igual.
      heraldo: Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
      clash: Boolean(process.env.COC_TOKEN),
    },
  });
}
