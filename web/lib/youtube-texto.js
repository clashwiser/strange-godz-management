// El anuncio de un video de YouTube en la voz de Heraldo, para los dos
// caminos por los que llega: el aviso instantaneo (web/app/api/youtube,
// WebSub) y el repaso del cron (src/jobs/youtube.js). Puro: sin red.
//
// El 13 sep 2026 Heraldo anuncio un directo de Gonca como "YouTube video
// feed": el aviso WebSub trae un <title> del feed ANTES del <title> de la
// entrada, y se leia el primero. Y era un directo, no un video: eso hay
// que decirlo, que la gente entra a verlo en vivo.

/** Las entidades que YouTube escapa en el Atom (&amp; &quot; &#39;...). */
export function desescaparXml(s) {
  return String(s ?? '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

/** El titulo de la ENTRADA del Atom de YouTube, no el del feed. */
export function tituloDeEntrada(xml) {
  const desde = String(xml ?? '').indexOf('<entry');
  if (desde < 0) return null;
  const m = /<title>([^<]*)<\/title>/.exec(String(xml).slice(desde));
  const t = m ? desescaparXml(m[1]).trim() : '';
  return t || null;
}

/**
 * Lo que dice la API (videos.list, part=snippet,liveStreamingDetails) de si
 * es un directo: { directo: 'live' | 'upcoming' | 'none', empieza: ISO|null }.
 */
export function directoDe(item) {
  const directo = item?.snippet?.liveBroadcastContent ?? 'none';
  const d = item?.liveStreamingDetails ?? {};
  return { directo, empieza: d.actualStartTime ?? d.scheduledStartTime ?? null };
}

/** "dom 13 sep, 2:02 p. m." en hora de Cuba. */
export function horaCuba(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleString('es', {
    timeZone: 'America/Havana',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * El texto del anuncio. `b` pone negrita en el formato de cada camino
 * (Markdown de WhatsApp en el cron, <b> en la web) y `esc` escapa el titulo
 * si hace falta (la web; el cron escapa despues, en aHtmlTelegram).
 *
 * @param {{ etiqueta:string, canal:string, titulo:string, videoId:string, directo?:string, empieza?:string|null }} v
 */
export function textoVideo(v, { b = (s) => `*${s}*`, esc = (s) => s } = {}) {
  const titulo = esc(v.titulo || 'Video nuevo');
  const url = `https://www.youtube.com/watch?v=${v.videoId}`;
  const cab = `${v.etiqueta}  ${b(esc(v.canal))}`;
  if (v.directo === 'live') return `${cab}\n\n🔴 ${b('EN DIRECTO ahora')}\n${titulo}\n\n${url}`;
  if (v.directo === 'upcoming') {
    const cuando = horaCuba(v.empieza);
    return `${cab}\n\n⏰ ${b(cuando ? `Directo programado: ${cuando}` : 'Directo programado')}\n${titulo}\n\n${url}`;
  }
  return `${cab}\n\n${titulo}\n\n${url}`;
}

/** El segundo aviso de un directo programado: ya esta en vivo. */
export function textoYaEmpezo(v, { b = (s) => `*${s}*`, esc = (s) => s } = {}) {
  const titulo = esc(v.titulo || 'Directo');
  return `${v.etiqueta}  ${b(esc(v.canal))}\n\n🔴 ${b('¡Ya empezó el directo!')}\n${titulo}\n\nhttps://www.youtube.com/watch?v=${v.videoId}`;
}
