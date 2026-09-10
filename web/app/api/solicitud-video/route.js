// El video de ataque que mando un aspirante, para verlo desde el panel.
//
// Un file_id de Telegram solo lo puede resolver el bot que recibio el
// archivo, y la URL de descarga lleva el token del bot dentro. Por eso no
// se le da al navegador un enlace: se descarga aqui, con el token del
// servidor, y se le pasan los bytes. El token no sale nunca.
//
// Telegram solo deja bajar por la API archivos de hasta 20 MB. Uno mas
// grande no se pierde: en el momento de la solicitud ya se le reenvio a
// los lideres por privado, y desde Telegram se ve entero.

import { admin } from '../../../lib/supabase-admin';

export const dynamic = 'force-dynamic';

const TOKEN_DE = {
  heraldo: process.env.TELEGRAM_BOT_TOKEN,
  recluta: process.env.RECLUTA_BOT_TOKEN,
};

export async function GET(request) {
  const jwt = (request.headers.get('authorization') ?? '').replace(/^Bearer /, '');
  if (!jwt) return Response.json({ ok: false, error: 'sin sesión' }, { status: 401 });
  const { data: usuario, error } = await admin.auth.getUser(jwt);
  if (error || !usuario?.user) return Response.json({ ok: false, error: 'sesión inválida' }, { status: 401 });
  const { data: lider } = await admin
    .from('dashboard_users')
    .select('user_id')
    .eq('user_id', usuario.user.id)
    .maybeSingle();
  if (!lider) return Response.json({ ok: false, error: 'no autorizado' }, { status: 403 });

  const id = new URL(request.url).searchParams.get('id');
  if (!id) return Response.json({ ok: false, error: 'falta el id' }, { status: 400 });

  const { data: sol } = await admin.from('solicitudes').select('via, respuestas').eq('id', id).maybeSingle();
  const video = sol?.respuestas?.video;
  if (!video?.file_id) return Response.json({ ok: false, error: 'esa solicitud no tiene video' }, { status: 404 });

  const token = TOKEN_DE[sol.via] ?? TOKEN_DE.heraldo;
  if (!token) return Response.json({ ok: false, error: 'bot sin token' }, { status: 503 });

  const info = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${encodeURIComponent(video.file_id)}`)
    .then((r) => r.json())
    .catch(() => null);
  if (!info?.ok || !info.result?.file_path) {
    // Lo mas probable: pesa mas de 20 MB. No es un fallo del sistema.
    return Response.json(
      { ok: false, error: 'Telegram no deja bajarlo por aquí (suele ser por tamaño). Míralo en el chat: se lo reenvió a los líderes.' },
      { status: 413 }
    );
  }

  const archivo = await fetch(`https://api.telegram.org/file/bot${token}/${info.result.file_path}`);
  if (!archivo.ok || !archivo.body) {
    return Response.json({ ok: false, error: 'no se pudo descargar' }, { status: 502 });
  }

  return new Response(archivo.body, {
    headers: {
      'Content-Type': archivo.headers.get('content-type') || 'video/mp4',
      'Cache-Control': 'private, max-age=300',
    },
  });
}
