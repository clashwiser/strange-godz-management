// De donde sale el meta de verdad.
//
// Cris lo dijo claro: el meta de Clash esta en Leyenda 1 y en esports, y
// se entera por YouTube -Applesauce, ShocK, Habibi, Ace, TK, Blueprint,
// iTzu-. Las webs que salen primero en una busqueda (TopUplist, LootBar,
// cocmap) son granjas SEO con ejercitos de hace meses: la IA contesto con
// Golems de Meteorito cuando llevaban tiempo enterrados por los nerfs.
//
// Asi que la IA se alimenta de DOS cosas, y en este orden:
//
//   1. Los ultimos videos de los canales de confianza, por la API de
//      YouTube: titulo, fecha y el enlace de copiar ejercito que casi todos
//      ponen en la descripcion (link.clashofclans.com/...CopyArmy...).
//      Es lo mas fresco que existe: los titulos de esta semana dicen
//      literalmente "Super Bowler Spam, best TH18 attack".
//   2. Los articulos del blog de Blueprint (equipo pro), por sus feeds
//      Atom, con las composiciones completas.
//
// Todo eso se junta en un "digesto" de texto plano que se guarda en
// config.meta_digest y entra en la IA cuando preguntan por ejercitos.
// Los canales y los feeds los editan los lideres desde la pestaña Bots.
//
// Este archivo es puro: convierte lo que devuelven la API y los feeds en
// texto. Quien llama a la red es web/app/api/meta/route.js.

// Los canales, verificados con la API el 10 sep 2026 (id, nombre, subs).
export const CANALES_DEFECTO = [
  { nombre: 'Blueprint CoC', id: 'UCQJJGSWnPUCb8uKV_MoJeOA' },
  { nombre: 'iTzu', id: 'UCLKKvlo0yK8OgWvjCiZQ3sA' },
  { nombre: 'ShocK', id: 'UCIMKOmtCOZv86cSPImRX7Mg' },
  { nombre: 'Applesauce', id: 'UC1Vvz_7lccJF9bUzB810BTA' },
  { nombre: 'Clash With HABIBI', id: 'UCwMPczpFS_-KUA9GkrqsNPA' },
  { nombre: 'Ace', id: 'UCFi3w8g5RTXtfhvR1TNrGaw' },
  { nombre: 'Ace Esports', id: 'UC9hAjXHELPN-cM7DCU4J0NQ' },
  { nombre: 'TK-Gamez', id: 'UCuADBWs8AQbi9yK3brMElAg' },
];

// Feeds Atom con articulos completos. Blueprint es una tienda Shopify, y
// Shopify publica cada blog en /blogs/<nombre>.atom.
export const FEEDS_DEFECTO = [
  'https://blueprintcoc.com/blogs/town-hall-18.atom',
  'https://blueprintcoc.com/blogs/coc-legend-league.atom',
  'https://blueprintcoc.com/blogs/town-hall-17.atom',
];

// A que dominios se limita la busqueda web cuando la pregunta es de meta.
// AllClash y ClashChamps no estan: bloquean las lecturas automaticas.
export const WEBS_DEFECTO = ['blueprintcoc.com', 'clashofclans.com', 'youtube.com', 'reddit.com'];

const ENLACE_EJERCITO = /https?:\/\/link\.clashofclans\.com\/[^\s)\]]*CopyArmy[^\s)\]]*/i;

/** El enlace de copiar ejercito de una descripcion, o null. */
export function enlaceEjercito(descripcion) {
  return ENLACE_EJERCITO.exec(String(descripcion ?? ''))?.[0] ?? null;
}

/**
 * Un video de la API de YouTube (playlistItems.snippet) a lo que importa.
 * Limpia la descripcion de enlaces, hashtags y relleno de "suscribete".
 */
export function resumirVideo(snippet, canal) {
  const desc = String(snippet?.description ?? '');
  const texto = desc
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/#\S+/g, ' ')
    .replace(/[\u{1F300}-\u{1FAFF}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 220);
  return {
    canal,
    fecha: String(snippet?.publishedAt ?? '').slice(0, 10),
    titulo: String(snippet?.title ?? '').trim(),
    ejercito: enlaceEjercito(desc),
    texto,
  };
}

/** Las entradas de un feed Atom: titulo, fecha, enlace y texto plano. */
export function parsearAtom(xml, { maxEntradas = 3, maxTexto = 1800 } = {}) {
  const entradas = [];
  const partes = String(xml ?? '').split('<entry>').slice(1);
  for (const e of partes.slice(0, maxEntradas)) {
    const campo = (n) => (new RegExp(`<${n}[^>]*>([\\s\\S]*?)</${n}>`).exec(e) || [])[1] ?? '';
    const enlace = /<link[^>]*rel="alternate"[^>]*href="([^"]+)"/.exec(e)?.[1] ?? '';
    const cuerpo = (/<content[^>]*>\s*<!\[CDATA\[([\s\S]*?)\]\]>/.exec(e) || /<summary[^>]*>\s*<!\[CDATA\[([\s\S]*?)\]\]>/.exec(e) || [])[1] ?? '';
    entradas.push({
      titulo: aTexto(campo('title')),
      fecha: campo('updated').slice(0, 10) || campo('published').slice(0, 10),
      enlace,
      texto: aTexto(cuerpo).slice(0, maxTexto),
    });
  }
  return entradas;
}

function aTexto(html) {
  return String(html ?? '')
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&rsquo;|&lsquo;/g, "'")
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * El digesto: texto plano para meter en la IA. Videos primero (lo mas
 * fresco), luego los articulos. Cabe en unos 7.000 caracteres.
 *
 * @param {Array<ReturnType<typeof resumirVideo>>} videos
 * @param {Array<{fuente:string, entradas:ReturnType<typeof parsearAtom>}>} feeds
 */
export function digerir(videos, feeds, { tope = 7500, conEnlace = 6, porFeed = 2, textoArticulo = 700 } = {}) {
  const lineas = [];
  const ordenados = [...videos].filter((v) => v.titulo).sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
  // Los enlaces de ejercito miden 250 caracteres: solo los llevan los mas
  // recientes, que son los que se van a pedir.
  let enlaces = 0;
  if (ordenados.length) {
    lineas.push('ÚLTIMOS VIDEOS DE LOS CREADORES DE CONFIANZA (los títulos dicen qué ejército está pegando):');
    for (const v of ordenados) {
      const conLink = v.ejercito && enlaces < conEnlace;
      if (conLink) enlaces += 1;
      lineas.push(`- [${v.fecha}] ${v.canal}: ${v.titulo}${conLink ? ` · ejército: ${v.ejercito}` : ''}`);
    }
  }
  for (const f of feeds) {
    for (const e of f.entradas.slice(0, porFeed)) {
      if (!e.titulo) continue;
      lineas.push('');
      lineas.push(`ARTÍCULO (${f.fuente}, ${e.fecha}): ${e.titulo}`);
      lineas.push(e.texto.slice(0, textoArticulo));
    }
  }
  return lineas.join('\n').slice(0, tope);
}

/**
 * Construye el digesto: pide a la API de YouTube los ultimos videos de
 * cada canal y a cada feed sus articulos, y lo junta. Lo usan el endpoint
 * /api/meta (boton del panel) y el job src/jobs/meta.js (cada seis horas
 * en GitHub Actions), que es por lo que vive aqui y no en la ruta.
 *
 * Nunca revienta por una fuente: lo que falle va en `errores`.
 */
export async function construirDigesto({ llave, canales, feeds, porCanal = 4, fetchFn = globalThis.fetch }) {
  const t0 = Date.now();
  const errores = [];
  const videos = [];
  if (!llave) errores.push('falta YOUTUBE_API_KEY');
  for (const c of llave ? canales : []) {
    if (!c?.id) continue;
    try {
      const ch = await fetchFn(
        `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${encodeURIComponent(c.id)}&key=${llave}`,
        { signal: AbortSignal.timeout(8000) }
      ).then((r) => r.json());
      const uploads = ch.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
      if (!uploads) {
        errores.push(`${c.nombre}: canal no encontrado`);
        continue;
      }
      const pl = await fetchFn(
        `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=${porCanal}&playlistId=${uploads}&key=${llave}`,
        { signal: AbortSignal.timeout(8000) }
      ).then((r) => r.json());
      for (const it of pl.items ?? []) videos.push(resumirVideo(it.snippet, c.nombre));
    } catch (e) {
      errores.push(`${c.nombre}: ${e.message}`);
    }
  }

  const articulos = [];
  for (const url of feeds ?? []) {
    try {
      const xml = await fetchFn(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (StrangeGodz bot)' },
        signal: AbortSignal.timeout(8000),
      }).then((r) => r.text());
      const fuente = new URL(url).hostname.replace(/^www\./, '');
      articulos.push({ fuente, entradas: parsearAtom(xml) });
    } catch (e) {
      errores.push(`${url}: ${e.message}`);
    }
  }

  const texto = digerir(videos, articulos);
  return {
    actualizado: new Date().toISOString(),
    videos: videos.length,
    articulos: articulos.reduce((n, f) => n + f.entradas.length, 0),
    errores,
    texto,
    ms: Date.now() - t0,
  };
}
