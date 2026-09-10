// Manda un mensaje del outbox al grupo, por Heraldo.
//
// Existe porque hasta ahora los mensajes que genera un lider a mano -la
// alineacion de CWL, por ejemplo- se quedaban en la pestaña Mensajes
// esperando a que alguien los copiara y pegara, mientras que los que genera
// un JOB salian solos. Eso confundia: unos aparecian en el grupo y otros no,
// sin ninguna diferencia visible en el panel.
//
// Solo los lideres, con la misma comprobacion que el resto: estar en
// dashboard_users con puede_editar.

import { admin } from '../../../lib/supabase-admin';

export const dynamic = 'force-dynamic';

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const SITIO = (process.env.SITIO_URL || 'https://strange-godz-management.vercel.app').replace(/\/$/, '');

/** WhatsApp -> HTML de Telegram. Igual que src/lib/telegram.js. */
function aHtml(texto) {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return texto
    .split('```')
    .map((parte, i) =>
      i % 2 === 1
        ? `<pre>${esc(parte)}</pre>`
        : esc(parte)
            .replace(/\*([^*\n]+)\*/g, '<b>$1</b>')
            .replace(/_([^_\n]+)_/g, '<i>$1</i>')
    )
    .join('');
}

export async function POST(request) {
  if (!TOKEN || !CHAT_ID) {
    return Response.json({ ok: false, error: 'Telegram sin configurar' }, { status: 503 });
  }

  // El token del usuario que esta en el panel. Sin esto, cualquiera con la
  // URL podria hacer que Heraldo escriba en el grupo del clan.
  const auth = request.headers.get('authorization') ?? '';
  const jwt = auth.replace(/^Bearer /, '');
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

  const { id } = await request.json().catch(() => ({}));
  if (!id) return Response.json({ ok: false, error: 'falta el id' }, { status: 400 });

  const { data: msg } = await admin
    .from('outbox')
    .select('id, tipo, cuerpo, estado')
    .eq('id', id)
    .maybeSingle();
  if (!msg) return Response.json({ ok: false, error: 'no existe' }, { status: 404 });
  if (msg.estado === 'enviado') {
    return Response.json({ ok: false, error: 'ya se envió' }, { status: 409 });
  }

  const html = aHtml(msg.cuerpo);

  // Heraldo en video, con la pose que pide el mensaje: una felicitacion o
  // los premios se anuncian con corneta; la alineacion o un aviso suelto se
  // leen del pergamino. Es sendAnimation y no sendVideo a proposito: un MP4
  // sin sonido Telegram lo trata como GIF, arranca solo y se repite.
  //
  // Escalera de respaldo: video -> foto -> texto. Un pie de mas de 1024
  // caracteres o una imagen sin publicar nunca se llevan por delante el
  // mensaje. Igual que src/lib/telegram.js.
  const pose = /premio|felicitacion|bono/.test(msg.tipo ?? '') ? 'corneta' : 'lee';
  const intentos =
    html.length <= 1024
      ? [
          ['sendAnimation', { animation: `${SITIO}/heraldo-${pose}.mp4`, caption: html }],
          ['sendPhoto', { photo: `${SITIO}/heraldo-${pose}.jpg`, caption: html }],
          ['sendMessage', { text: html }],
        ]
      : [['sendMessage', { text: html }]];

  let detalle = '';
  let enviado = false;
  for (const [metodo, cuerpo] of intentos) {
    const r = await fetch(`https://api.telegram.org/bot${TOKEN}/${metodo}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: CHAT_ID, parse_mode: 'HTML', ...cuerpo }),
    }).catch(() => null);
    if (r?.ok) {
      enviado = true;
      break;
    }
    detalle = r ? (await r.text().catch(() => '')).slice(0, 200) : 'sin respuesta de Telegram';
  }

  if (!enviado) {
    // Queda escrito el porque: si no, el lider ve "fallido" y no sabe nada.
    await admin.from('outbox').update({ estado: 'fallido', error: detalle }).eq('id', id);
    return Response.json({ ok: false, error: detalle }, { status: 502 });
  }

  await admin
    .from('outbox')
    .update({ estado: 'enviado', enviado_en: new Date().toISOString(), error: null })
    .eq('id', id);

  return Response.json({ ok: true });
}
