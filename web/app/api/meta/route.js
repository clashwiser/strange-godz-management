// El digesto del meta: lo que dicen esta semana los creadores de
// confianza y el blog de Blueprint, junto en un texto para la IA. Ver
// web/lib/meta-fuentes.js.
//
//   GET   el digesto guardado (lideres con sesion)
//   POST  rehacerlo ahora: el boton de la pestaña Bots (lider con
//         puede_editar). El cron de GitHub hace lo mismo cada seis horas
//         con src/jobs/meta.js, sin pasar por aqui.
//
// Cuesta 2 unidades de la cuota de YouTube por canal (channels +
// playlistItems): 16 por corrida con ocho canales, de 10.000 al dia.

import { admin } from '../../../lib/supabase-admin';
import { CANALES_DEFECTO, FEEDS_DEFECTO, construirDigesto } from '../../../lib/meta-fuentes';
import { olvidarCache } from '../../../lib/entrenamiento';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function lider(request, { editar = false } = {}) {
  const jwt = (request.headers.get('authorization') ?? '').replace(/^Bearer /, '');
  if (!jwt) return null;
  const { data: usuario } = await admin.auth.getUser(jwt);
  if (!usuario?.user) return null;
  const { data: l } = await admin.from('dashboard_users').select('puede_editar').eq('user_id', usuario.user.id).maybeSingle();
  if (!l || (editar && !l.puede_editar)) return null;
  return l;
}

async function config(clave, porDefecto) {
  const { data } = await admin.from('config').select('valor').eq('clave', clave).maybeSingle();
  return data?.valor ?? porDefecto;
}

export async function GET(request) {
  if (!(await lider(request))) return Response.json({ ok: false, error: 'no autorizado' }, { status: 401 });
  return Response.json({ ok: true, digesto: await config('meta_digest', null) });
}

export async function POST(request) {
  if (!(await lider(request, { editar: true }))) {
    return Response.json({ ok: false, error: 'no autorizado' }, { status: 401 });
  }
  const digesto = await construirDigesto({
    llave: process.env.YOUTUBE_API_KEY,
    canales: await config('meta_canales', CANALES_DEFECTO),
    feeds: await config('meta_feeds', FEEDS_DEFECTO),
  });
  const { error } = await admin.from('config').upsert(
    {
      clave: 'meta_digest',
      valor: digesto,
      descripcion: 'Digesto del meta para la IA (lo rehacen /api/meta y src/jobs/meta.js)',
      actualizado: new Date().toISOString(),
    },
    { onConflict: 'clave' }
  );
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  olvidarCache();
  console.log(
    `[meta] digesto: ${digesto.videos} videos, ${digesto.articulos} articulos, ${digesto.texto.length} chars, ${digesto.ms} ms` +
      (digesto.errores.length ? ` · errores: ${digesto.errores.join(' | ')}` : '')
  );
  return Response.json({ ok: true, ...digesto, texto: undefined, chars: digesto.texto.length });
}
