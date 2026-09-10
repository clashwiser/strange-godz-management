// Pedirle a Supercell el perfil de un jugador.
//
// Va en un archivo aparte de aspirante.js porque lee process.env: ese
// modulo lo importa tambien la pestaña del panel, que corre en el
// navegador, y ahi ni hay variables de entorno ni tiene por que haberlas.
// Lo puro por un lado, lo que toca el servidor por otro.

/**
 * Pide el perfil a Supercell.
 *
 * Va por el proxy de RoyaleAPI, que es lo que permite consultarla desde
 * Vercel: la llave de Clash esta atada a una IP fija y las de Vercel
 * cambian en cada despliegue.
 *
 * Devuelve null en vez de tirar. Si la llave no esta puesta, la solicitud
 * tiene que seguir adelante sin la ficha -el lider mirara el tag a mano-
 * antes que dejar a alguien plantado a mitad de la conversacion.
 */
export async function pedirPerfil(tag) {
  const token = process.env.COC_TOKEN;
  if (!token) return null;
  const base = process.env.COC_BASE_URL || 'https://cocproxy.royaleapi.dev/v1';
  try {
    const res = await fetch(`${base}/players/${encodeURIComponent(tag)}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
