// Los directos PROGRAMADOS de YouTube que Heraldo ya anuncio y de los que
// falta el segundo aviso, el de "ya empezó". Viven en config.youtube_directos
// (jsonb: { <videoId>: { canal, etiqueta, titulo, empieza, anotado } }).
//
// Los apuntan los dos caminos que anuncian videos (web/app/api/youtube y
// src/jobs/youtube.js) y los vigila el pulso cada cinco minutos
// (src/jobs/pulso.js): cuando la API dice que ya esta en vivo, sale el
// segundo aviso con la clave yt:<id>:live y se olvida el directo. Lo pidio
// Cris el 13 sep 2026.

const CLAVE = 'youtube_directos';

/** Cuanto se espera a un directo programado que no arranca: se olvida. */
export const PACIENCIA_H = 12;

/** Los pendientes, por id. `cliente` es supabase-js con permiso de escritura. */
export async function directosProgramados(cliente) {
  const { data } = await cliente.from('config').select('valor').eq('clave', CLAVE).maybeSingle();
  const v = data?.valor;
  return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
}

async function guardar(cliente, pendientes) {
  const { error } = await cliente
    .from('config')
    .upsert({ clave: CLAVE, valor: pendientes, descripcion: 'Directos de YouTube anunciados como programados; el pulso avisa cuando empiezan' }, { onConflict: 'clave' });
  if (error) throw new Error(`${CLAVE}: ${error.message}`);
}

/** Apunta un directo anunciado como programado. */
export async function anotarDirectoProgramado(cliente, v) {
  const pendientes = await directosProgramados(cliente);
  pendientes[v.videoId] = { canal: v.canal, etiqueta: v.etiqueta, titulo: v.titulo, empieza: v.empieza ?? null, anotado: new Date().toISOString() };
  await guardar(cliente, pendientes);
}

/** Quita los que ya no hay que vigilar. */
export async function olvidarDirectos(cliente, ids) {
  if (!ids.length) return;
  const pendientes = await directosProgramados(cliente);
  for (const id of ids) delete pendientes[id];
  await guardar(cliente, pendientes);
}

/**
 * Que hacer con cada pendiente a la vista de lo que dice videos.list.
 * Puro, para probarlo. Devuelve { avisar: [videoId...], olvidar: [videoId...] }.
 *
 * - live: avisar y olvidar.
 * - none (termino, o se subio como video) o no esta (borrado, privado):
 *   olvidar sin avisar; el aviso de "ya empezó" ya no tiene sentido.
 * - upcoming: seguir esperando, salvo que la hora programada pasara hace
 *   mas de PACIENCIA_H horas: se olvida, que no va a arrancar.
 */
export function decidirDirectos(pendientes, items, ahora = Date.now()) {
  const porId = new Map((items ?? []).map((it) => [it.id, it]));
  const avisar = [];
  const olvidar = [];
  for (const [id, p] of Object.entries(pendientes)) {
    const it = porId.get(id);
    const estado = it?.snippet?.liveBroadcastContent ?? null;
    if (estado === 'live') {
      avisar.push(id);
      olvidar.push(id);
    } else if (estado === 'upcoming') {
      const empieza = it?.liveStreamingDetails?.scheduledStartTime ?? p.empieza ?? p.anotado;
      if (empieza && ahora - new Date(empieza).getTime() > PACIENCIA_H * 3600000) olvidar.push(id);
    } else {
      olvidar.push(id);
    }
  }
  return { avisar, olvidar };
}
