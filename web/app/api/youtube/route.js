// YouTube avisa AQUI en cuanto uno de los canales sube un video.
//
// Es WebSub (PubSubHubbub): en vez de que nosotros preguntemos cada doce
// horas "¿hay algo nuevo?", YouTube nos hace un POST a los segundos de la
// subida. Instantaneo y sin gastar ni una unidad de la cuota.
//
// Ojo con la ruta del feed: el 'topic' es
//   https://www.youtube.com/xml/feeds/videos.xml?channel_id=...
// con /xml/ delante. La otra -/feeds/videos.xml- devuelve 404 desde hace
// tiempo, que es lo que hizo pensar que los feeds ya no existian.
//
// Se suscribe con `npm run youtube:suscribir`, que hay que repetir cada
// pocos dias porque la suscripcion caduca. Lo hace el cron.
//
// EL CRON DE youtube.js SIGUE EXISTIENDO y no sobra: WebSub pierde avisos
// de vez en cuando -es un "mejor esfuerzo", no una garantia- y el cron es
// la red debajo. Los dos escriben con la misma clave de deduplicacion, asi
// que un video anunciado por aqui no se repite alla.

import { admin } from '../../../lib/supabase-admin';

export const dynamic = 'force-dynamic';

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const LLAVE = process.env.YOUTUBE_API_KEY;
const SITIO = (process.env.SITIO_URL || 'https://strange-godz-management.vercel.app').replace(/\/$/, '');

// Los unicos canales de los que aceptamos avisos.
// Las claves van entrecomilladas: dos de estos ids llevan guion, y sin
// comillas eso no es un nombre valido de propiedad.
export const CANALES = {
  'UCD1Em4q90ZUK2R5HKesszJg': { nombre: 'Clash of Clans', etiqueta: '📢 Oficial' },
  'UC3TsnHL_rW3ig7_oCFS-Ohw': { nombre: 'Gonca Clash', etiqueta: '🇪🇸 En español' },
  'UC85aYbNSFjsJdxfpxgQr8tA': { nombre: 'Judo Sloth Gaming', etiqueta: '🧠 Estrategia' },
};

const esc = (s) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * La verificacion de la suscripcion.
 *
 * Al suscribirnos, el hub llama a esta URL con hub.challenge y hay que
 * devolverlo TAL CUAL, en texto plano. Si se devuelve JSON o cualquier otra
 * cosa, el hub da la suscripcion por rechazada y no vuelve a avisar nunca.
 */
export async function GET(request) {
  const u = new URL(request.url);
  const reto = u.searchParams.get('hub.challenge');
  const modo = u.searchParams.get('hub.mode');
  const topic = u.searchParams.get('hub.topic') ?? '';

  if (!reto) return Response.json({ ok: true, endpoint: 'youtube-websub' });

  // Solo confirmamos suscripciones a NUESTROS canales. Sin esto, cualquiera
  // podria suscribir este endpoint al canal que quisiera y llenarnos el
  // grupo de videos ajenos.
  const suyo = Object.keys(CANALES).some((id) => id && topic.includes(id));
  if (!suyo) return new Response('topic no reconocido', { status: 404 });

  console.log(`[youtube] ${modo} confirmado para ${topic}`);
  return new Response(reto, {
    status: 200,
    headers: { 'Content-Type': 'text/plain' },
  });
}

/** Saca el primer valor de una etiqueta del Atom que manda YouTube. */
const etiqueta = (xml, nombre) =>
  (new RegExp(`<${nombre}>([^<]*)</${nombre}>`).exec(xml) || [])[1] ?? null;

export async function POST(request) {
  if (!TOKEN || !CHAT_ID) return new Response('sin configurar', { status: 503 });

  const xml = await request.text().catch(() => '');
  const videoId = etiqueta(xml, 'yt:videoId');
  const canalId = etiqueta(xml, 'yt:channelId');
  const titulo = etiqueta(xml, 'title');

  // Un aviso sin video es un borrado o un cambio de titulo: se ignora.
  if (!videoId || !canalId) return new Response('', { status: 204 });

  const canal = CANALES[canalId];
  if (!canal) {
    console.log(`[youtube] aviso de un canal que no seguimos: ${canalId}`);
    return new Response('', { status: 204 });
  }

  // Contra un aviso falsificado: este endpoint es publico y no lleva
  // secreto, asi que se comprueba con la API que el video existe DE VERDAD y
  // que es de ese canal. Lo peor que puede hacer alguien que descubra la URL
  // es forzarnos a anunciar un video real de uno de los tres canales, que es
  // justo lo que el endpoint hace de todas formas.
  if (LLAVE) {
    try {
      const r = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${encodeURIComponent(videoId)}&key=${LLAVE}`,
        { signal: AbortSignal.timeout(10000) }
      );
      const j = await r.json();
      const real = j.items?.[0]?.snippet;
      if (!real || real.channelId !== canalId) {
        console.log(`[youtube] ${videoId} no existe o no es de ${canalId}`);
        return new Response('', { status: 204 });
      }
    } catch (e) {
      console.log(`[youtube] no se pudo verificar ${videoId}: ${e.message}`);
      return new Response('', { status: 204 });
    }
  }

  const cuerpo =
    `${canal.etiqueta}  <b>${esc(canal.nombre)}</b>\n\n` +
    `${esc(titulo ?? 'Video nuevo')}\n\n` +
    `https://www.youtube.com/watch?v=${videoId}`;

  // Al outbox con la MISMA clave que usa el cron: si por lo que sea los dos
  // ven el mismo video, solo sale una vez.
  const { data, error } = await admin
    .from('outbox')
    .upsert(
      { tipo: 'youtube', cuerpo, clave_dedupe: `yt:${videoId}`, destino: 'grupo_clan' },
      { onConflict: 'clave_dedupe', ignoreDuplicates: true }
    )
    .select('id');

  if (error) {
    console.log(`[youtube] error guardando: ${error.message}`);
    return new Response('', { status: 204 });
  }
  // Ya estaba: lo anuncio el cron o un aviso repetido del hub.
  if (!data?.length) return new Response('', { status: 204 });

  await fetch(`https://api.telegram.org/bot${TOKEN}/sendPhoto`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: CHAT_ID,
      photo: `${SITIO}/heraldo-corneta.jpg`,
      caption: cuerpo,
      parse_mode: 'HTML',
    }),
  }).catch(() => {});

  console.log(`[youtube] anunciado ${videoId} de ${canal.nombre}`);
  return new Response('', { status: 204 });
}
