// Webhook del bot de RECLUTAR. El del nombre corto.
//
// Existe por una razon boba y real: @Strange_godz_heraldo_bot son 24
// caracteres para teclear desde la pantalla del juego, y la mitad de la
// gente se equivoca a la tercera letra. Este bot tiene un @usuario corto
// y es el que va en la descripcion del clan.
//
// Y de paso es mas seguro que la rendija de Heraldo: por aqui NO EXISTE
// otra cosa que la solicitud. Ni comandos, ni datos del clan, ni bases.
// No es que se filtren: es que el codigo no esta.
//
// Variables en Vercel:
//   RECLUTA_BOT_TOKEN      el token del bot nuevo (BotFather)
//   RECLUTA_SECRET_TOKEN   uno inventado, el mismo que se pasa al registrar
//                          el webhook con BOT=recluta npm run tg:webhook
//
// Los avisos a los lideres y la pregunta "¿este es de casa?" siguen
// saliendo por Heraldo, que es el que esta en el grupo. Ver
// web/lib/solicitud.js.

import { admin } from '../../../lib/supabase-admin';
import { flujoSolicitud, decirCon } from '../../../lib/solicitud';

export const dynamic = 'force-dynamic';

const TOKEN = process.env.RECLUTA_BOT_TOKEN;
const SECRETO = process.env.RECLUTA_SECRET_TOKEN;

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
  const texto = (msg?.text || '').trim();

  // Solo en privado. Si alguien mete este bot en un grupo, se calla: no
  // tiene nada que hacer ahi y no va a ponerse a pedir tags a sesenta
  // personas.
  if (!chatId || !texto || msg.chat?.type !== 'private') return Response.json({ ok: true });

  const respuesta = await flujoSolicitud(admin, msg, texto, 'recluta');
  if (respuesta) await decirCon(TOKEN, chatId, respuesta);

  return Response.json({ ok: true });
}

export async function GET() {
  return Response.json({
    ok: true,
    bot: 'recluta',
    configurado: {
      token: Boolean(TOKEN),
      secreto: Boolean(SECRETO),
      // Sin Heraldo no hay avisos a los lideres ni forma de saber quien
      // es de casa; la solicitud se guarda igual.
      heraldo: Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
      clash: Boolean(process.env.COC_TOKEN),
    },
  });
}
