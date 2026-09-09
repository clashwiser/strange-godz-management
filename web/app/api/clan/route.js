// Consulta un clan en la API de Clash of Clans para validarlo antes de darlo
// de alta.
//
// Por que no lo hace el navegador directamente: la API de Supercell exige
// whitelist de IP y una llave secreta. La llave no puede viajar al navegador,
// y la IP de un telefono cambia cada vez. Esta ruta la consulta desde el
// servidor, a traves del proxy de RoyaleAPI, que es la IP que tenemos
// autorizada.
//
// Variables que necesita en Vercel:
//   COC_TOKEN, COC_BASE_URL          para consultar la API
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY   para comprobar quien pregunta

import { admin } from '../../../lib/supabase-admin';
import { normalizarTag } from '../../../lib/tags';

export const dynamic = 'force-dynamic';

const BASE = process.env.COC_BASE_URL || 'https://cocproxy.royaleapi.dev/v1';
const TOKEN = process.env.COC_TOKEN;

/**
 * Solo los lideres de la lista blanca pueden usar esto.
 *
 * Sin esta comprobacion, cualquiera que descubriera la URL podria consultar
 * clanes gastando nuestra llave de la API. No es catastrofico, pero una ruta
 * que usa una credencial nuestra no puede estar abierta al mundo.
 */
async function esLider(request) {
  const cabecera = request.headers.get('authorization') || '';
  const jwt = cabecera.replace(/^Bearer\s+/i, '').trim();
  if (!jwt) return false;

  const { data, error } = await admin.auth.getUser(jwt);
  if (error || !data?.user) return false;

  const { data: fila } = await admin
    .from('dashboard_users')
    .select('user_id')
    .eq('user_id', data.user.id)
    .maybeSingle();

  return Boolean(fila);
}

export async function GET(request) {
  // Falla cerrado, igual que el webhook de Telegram: una ruta a medio
  // configurar debe ser inerte, no permisiva.
  if (!TOKEN) {
    return Response.json(
      { error: 'Falta COC_TOKEN en Vercel. Sin eso no se puede validar el clan.' },
      { status: 503 }
    );
  }
  if (!(await esLider(request))) {
    return Response.json({ error: 'No autorizado.' }, { status: 401 });
  }

  const crudo = new URL(request.url).searchParams.get('tag');
  const tag = normalizarTag(crudo);
  if (!tag) {
    return Response.json(
      { error: 'Eso no parece un tag. Pega el tag del clan (#2GC) o su enlace de invitacion.' },
      { status: 400 }
    );
  }

  try {
    const res = await fetch(`${BASE}/clans/${encodeURIComponent(tag)}`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
      signal: AbortSignal.timeout(12000),
    });

    if (res.status === 404) {
      return Response.json({ error: `No existe ningun clan con el tag ${tag}.` }, { status: 404 });
    }
    if (!res.ok) {
      const cuerpo = await res.json().catch(() => ({}));
      return Response.json(
        { error: `La API de Clash respondio ${res.status}. ${cuerpo.message || ''}`.trim() },
        { status: 502 }
      );
    }

    const c = await res.json();
    return Response.json({
      clan_tag: c.tag,
      nombre: c.name,
      miembros: c.members,
      nivel: c.clanLevel,
      tipo: c.type,
      registro_publico: c.isWarLogPublic === true,
      ubicacion: c.location?.name ?? null,
      insignia: c.badgeUrls?.small ?? null,
    });
  } catch (e) {
    return Response.json(
      { error: `No se pudo consultar la API: ${e.message}` },
      { status: 502 }
    );
  }
}
