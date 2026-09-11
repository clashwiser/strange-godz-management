// Las guerras en curso de la alianza, clan por clan, para el cerebro.
//
// "¿Quién falta por atacar?" no se contesta con la liga pasada: se mira
// que clan esta en guerra AHORA (normal o ronda de CWL), en que fase, y
// quien tiene ataques sin usar. Si nadie esta en guerra, se dice eso.
//
// Solo lideres con sesion: gasta llamadas de la API de Clash.

import { admin } from '../../../lib/supabase-admin';
import { guerrasAbiertas } from '../../../lib/castillo-foto';
import { estadoDelClan } from '../../../lib/guerras';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

async function quienLlama(request) {
  const jwt = (request.headers.get('authorization') ?? '').replace(/^Bearer /, '');
  if (!jwt) return null;
  const { data: usuario, error } = await admin.auth.getUser(jwt);
  if (error || !usuario?.user) return null;
  const { data: lider } = await admin.from('dashboard_users').select('nombre').eq('user_id', usuario.user.id).maybeSingle();
  return lider ?? null;
}

export async function GET(request) {
  const lider = await quienLlama(request);
  if (!lider) return Response.json({ ok: false, error: 'no autorizado' }, { status: 401 });

  const { data: clans } = await admin.from('clans').select('clan_tag, nombre, escuadra').order('escuadra');
  const guerras = await Promise.all(
    (clans ?? []).map(async (c) => {
      const { abiertas, privado } = await guerrasAbiertas(c.clan_tag);
      return estadoDelClan(c, abiertas, { privado });
    })
  );
  return Response.json({ ok: true, ahora: new Date().toISOString(), guerras });
}
