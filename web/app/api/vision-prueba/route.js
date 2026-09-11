// TEMPORAL: banco de pruebas de la lectura de capturas. Se quita despues.
// Protegido con el mismo secreto que el webhook de Telegram.

import { admin } from '../../../lib/supabase-admin';
import { leerImagen } from '../../../lib/vision';
import { INSTRUCCIONES_MAPA, juzgar } from '../../../lib/castillo-foto';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(request) {
  const SECRETO = process.env.TELEGRAM_SECRET_TOKEN;
  if (!SECRETO || request.headers.get('x-telegram-bot-api-secret-token') !== SECRETO) {
    return new Response('no', { status: 401 });
  }
  const { url, abajo, oponente } = await request.json().catch(() => ({}));
  if (!url) return Response.json({ ok: false, error: 'falta url' }, { status: 400 });
  const t0 = Date.now();
  const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!r.ok) return Response.json({ ok: false, error: `imagen ${r.status}` });
  const mime = (r.headers.get('content-type') || 'image/jpeg').split(';')[0];
  const buf = Buffer.from(await r.arrayBuffer());
  const lectura = await leerImagen(admin, { base64: buf.toString('base64'), mime, instrucciones: INSTRUCCIONES_MAPA });
  const juicio = abajo ? juzgar({ lectura, abajo, oponente: oponente ?? null }) : null;
  return Response.json({ ok: true, ms: Date.now() - t0, bytes: buf.length, mime, modelo: lectura?.modelo ?? null, lectura: lectura?.json ?? null, crudo: lectura?.texto ?? null, juicio });
}
