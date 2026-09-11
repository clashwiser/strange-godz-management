// Las normas del clan, publicas: las lee la pagina /reglas y cualquiera
// con el enlace que manda Valquiria antes de entrar. Sin sesion a
// proposito: el que todavia no es del clan es justo el que tiene que
// leerlas. Solo sale el texto de las normas; nada mas de config.

import { admin } from '../../../lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { data } = await admin.from('config').select('clave, valor').in('clave', ['reglas', 'reglas_resumen', 'reglas_fecha']);
  const c = Object.fromEntries((data ?? []).map((r) => [r.clave, r.valor]));
  return Response.json(
    { ok: true, reglas: String(c.reglas ?? ''), resumen: String(c.reglas_resumen ?? ''), fecha: c.reglas_fecha ?? null },
    { headers: { 'Cache-Control': 'public, max-age=60' } }
  );
}
