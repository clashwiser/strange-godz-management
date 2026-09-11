// El cerebro del panel: los signos vitales del sistema y lo que sabe.
//
// La medida vive en web/lib/cerebro.js (la comparte con el latido de
// GitHub Actions); aqui solo se comprueba la sesion y se devuelve. Solo
// lideres con sesion: son las tripas del sistema.

import { admin } from '../../../lib/supabase-admin';
import { medirSalud, resumenDeSalud } from '../../../lib/cerebro';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

async function quienLlama(request) {
  const jwt = (request.headers.get('authorization') ?? '').replace(/^Bearer /, '');
  if (!jwt) return null;
  const { data: usuario, error } = await admin.auth.getUser(jwt);
  if (error || !usuario?.user) return null;
  const { data: lider } = await admin.from('dashboard_users').select('puede_editar, nombre').eq('user_id', usuario.user.id).maybeSingle();
  return lider ?? null;
}

export async function GET(request) {
  const lider = await quienLlama(request);
  if (!lider) return Response.json({ ok: false, error: 'no autorizado' }, { status: 401 });
  const salud = await medirSalud(admin);
  return Response.json({ ...salud, resumen: resumenDeSalud(salud), lider: lider.nombre ?? null });
}
