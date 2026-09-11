// Heraldo trae los videos nuevos de Clash al grupo.
//
//   npm run youtube            manda lo que haya nuevo
//   npm run youtube -- --seco  imprime lo que mandaria y no manda nada
//
// Por que con la API y no con RSS: el feed de YouTube
// (youtube.com/feeds/videos.xml) devuelve 404 desde hace un tiempo — se
// probo con y sin User-Agent, en las dos rutas. La API oficial da 10.000
// unidades al dia gratis y esto gasta 1 por canal y corrida: tres canales,
// dos veces al dia, son 6 de 10.000.
//
// Solo se anuncia lo PUBLICADO DESDE LA ULTIMA VEZ. Sin esa marca, cada
// corrida repetiria el mismo video y el grupo silenciaria el bot en dos
// dias, que es exactamente lo contrario de lo que se busca.

import { db, chk, correrJob } from '../lib/db.js';
import { encolar } from '../lib/outbox.js';
import { miniaturasYoutube } from '../lib/telegram.js';

const LLAVE = process.env.YOUTUBE_API_KEY;
const SECO = process.argv.includes('--seco') || process.env.YOUTUBE_SECO === '1';

// Verificados uno a uno contra la pagina de cada canal, no de memoria.
const CANALES = [
  { id: 'UCD1Em4q90ZUK2R5HKesszJg', nombre: 'Clash of Clans', etiqueta: '📢 Oficial' },
  { id: 'UC3TsnHL_rW3ig7_oCFS-Ohw', nombre: 'Gonca Clash', etiqueta: '🇪🇸 En español' },
  { id: 'UC85aYbNSFjsJdxfpxgQr8tA', nombre: 'Judo Sloth Gaming', etiqueta: '🧠 Estrategia' },
];

// Cuantos videos mirar por canal. Con 3 sobra: entre corrida y corrida
// pasan 12 horas y ningun canal de estos sube tres videos en ese rato.
const CUANTOS = 3;

const api = async (ruta) => {
  const r = await fetch(`https://www.googleapis.com/youtube/v3/${ruta}&key=${LLAVE}`, {
    signal: AbortSignal.timeout(20000),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`YouTube ${r.status}: ${j?.error?.message ?? ''}`);
  return j;
};

/**
 * Los ultimos videos de un canal.
 *
 * Se pide por la playlist de subidas y NO por search.list: search cuesta 100
 * unidades por llamada y esta cuesta 1. Con search, tres canales dos veces
 * al dia serian 600 unidades diarias; asi son 6.
 *
 * El id de la playlist de subidas es el del canal con la segunda letra
 * cambiada de C a U. Es una regla vieja de YouTube y se cumple siempre.
 */
async function ultimosDe(canal) {
  const playlist = 'UU' + canal.id.slice(2);
  const j = await api(
    `playlistItems?part=snippet&maxResults=${CUANTOS}&playlistId=${playlist}`
  );
  return (j.items ?? []).map((it) => ({
    videoId: it.snippet?.resourceId?.videoId,
    titulo: it.snippet?.title ?? '',
    publicado: it.snippet?.publishedAt ?? null,
    canal: canal.nombre,
    etiqueta: canal.etiqueta,
  }));
}

await correrJob('youtube', async () => {
  if (!LLAVE) {
    console.log('  falta YOUTUBE_API_KEY; no hago nada');
    return { filas: 0, detalle: { sin_llave: true } };
  }

  // Marca de agua: hasta donde se anuncio la vez pasada, por canal.
  const guardado = chk(
    await db.from('config').select('clave, valor').like('clave', 'youtube_visto_%'),
    'leer marcas'
  );
  const visto = Object.fromEntries(guardado.map((c) => [c.clave, c.valor]));

  let mandados = 0;
  const detalle = {};

  for (const canal of CANALES) {
    const clave = `youtube_visto_${canal.id}`;
    const desde = visto[clave] ? new Date(visto[clave]) : null;

    let videos;
    try {
      videos = await ultimosDe(canal);
    } catch (e) {
      // Un canal caido no puede tumbar a los otros dos.
      console.log(`  ${canal.nombre}: ${e.message}`);
      detalle[canal.nombre] = { error: e.message };
      continue;
    }
    if (!videos.length) continue;

    // La primera vez NO se vuelca el historico: se marca por donde va y se
    // empieza a anunciar desde el proximo. Estrenar el bot con nueve videos
    // de golpe es la mejor forma de que lo silencien.
    const masNuevo = videos[0].publicado;
    if (!desde) {
      chk(
        await db.from('config').upsert({ clave, valor: masNuevo }, { onConflict: 'clave' }),
        'marcar primera vez'
      );
      console.log(`  ${canal.nombre}: primera vez, marcado en ${masNuevo}`);
      detalle[canal.nombre] = { primera_vez: true };
      continue;
    }

    const nuevos = videos
      .filter((v) => v.publicado && new Date(v.publicado) > desde)
      .sort((a, b) => new Date(a.publicado) - new Date(b.publicado));

    if (!nuevos.length) {
      console.log(`  ${canal.nombre}: nada nuevo`);
      detalle[canal.nombre] = { nuevos: 0 };
      continue;
    }

    for (const v of nuevos) {
      const cuerpo =
        `${v.etiqueta}  *${v.canal}*\n\n` +
        `${v.titulo}\n\n` +
        `https://www.youtube.com/watch?v=${v.videoId}`;

      if (SECO) {
        console.log(`\n----- ${v.canal} -----\n${cuerpo}\n`);
        continue;
      }
      // Con la miniatura del video delante; si YouTube no la tiene, la
      // cara de la corneta: es un anuncio, no una alerta.
      const nuevo = await encolar({
        tipo: 'youtube',
        cuerpo,
        clave: `yt:${v.videoId}`,
        pose: 'corneta',
        fotos: miniaturasYoutube(v.videoId),
      });
      if (nuevo) mandados += 1;
    }

    if (!SECO) {
      chk(
        await db
          .from('config')
          .upsert({ clave, valor: nuevos[nuevos.length - 1].publicado }, { onConflict: 'clave' }),
        'guardar marca'
      );
    }
    console.log(`  ${canal.nombre}: ${nuevos.length} nuevo(s)`);
    detalle[canal.nombre] = { nuevos: nuevos.length };
  }

  return { filas: mandados, detalle };
});

process.exit(0);
