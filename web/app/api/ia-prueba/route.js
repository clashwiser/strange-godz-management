// TEMPORAL: banco de pruebas del proveedor de IA, para ver la respuesta
// cruda de Groq sin redesplegar por cada variante. Solo con el secreto del
// webhook de Valquiria. Se quita en cuanto la busqueda web quede afinada.

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(request) {
  if (request.headers.get('x-telegram-bot-api-secret-token') !== process.env.RECLUTA_SECRET_TOKEN) {
    return new Response('no', { status: 401 });
  }
  const { cuerpo, cabeceras = {} } = await request.json();
  const base = (process.env.IA_URL || '').replace(/\/$/, '');
  const t0 = Date.now();
  try {
    const r = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.IA_LLAVE}`, ...cabeceras },
      body: JSON.stringify(cuerpo),
      signal: AbortSignal.timeout(25000),
    });
    const texto = await r.text();
    let json = null;
    try {
      json = JSON.parse(texto);
    } catch {
      /* no era json */
    }
    return Response.json({ status: r.status, ms: Date.now() - t0, json, texto: json ? undefined : texto.slice(0, 2000) });
  } catch (e) {
    return Response.json({ error: String(e?.message ?? e), ms: Date.now() - t0 });
  }
}
