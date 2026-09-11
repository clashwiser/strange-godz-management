// TEMPORAL: banco de pruebas de la lectura de fotos de Telegram, con
// tiempos por paso. Se quita despues. Protegido con el secreto del webhook.

import { admin } from '../../../lib/supabase-admin';
import { leerImagen } from '../../../lib/vision';
import { bajarFoto, INSTRUCCIONES_MAPA } from '../../../lib/castillo-foto';
import { esAdminDelGrupo } from '../../../lib/solicitud';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(request) {
  const SECRETO = process.env.TELEGRAM_SECRET_TOKEN;
  if (!SECRETO || request.headers.get('x-telegram-bot-api-secret-token') !== SECRETO) {
    return new Response('no', { status: 401 });
  }
  const { fileId, mime = 'image/jpeg', uid } = await request.json().catch(() => ({}));
  const tiempos = {};
  let t = Date.now();
  const marca = (k) => {
    tiempos[k] = Date.now() - t;
    t = Date.now();
  };
  const esAdmin = uid ? await esAdminDelGrupo(Number(uid)) : null;
  marca('admin');
  const imagen = fileId ? await bajarFoto(process.env.TELEGRAM_BOT_TOKEN, { fileId, mime }) : null;
  marca('bajar');
  const lectura = imagen ? await leerImagen(admin, { base64: imagen.base64, mime: imagen.mime, instrucciones: INSTRUCCIONES_MAPA }) : null;
  marca('leer');
  return Response.json({ ok: true, esAdmin, bytes: imagen ? Math.round((imagen.base64.length * 3) / 4) : null, tiempos, modelo: lectura?.modelo ?? null, lectura: lectura?.json ?? null });
}
