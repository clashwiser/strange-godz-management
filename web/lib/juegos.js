// Los Juegos del Clan: puntos del mes por lo que cada uno aporta.
//
// Lo pidio Cris el 24 sep 2026, viendo que Pepe habia hecho 10.000 y no
// tenia premio ninguno: "lo normal es completar 4000, pero esos jugadores
// que se esmeran y completan 10 mil deben ser bien rewarded". Asi que hay
// dos escalones, no uno:
//
//   4.000 puntos de juegos  -> +20 puntos del mes
//  10.000 puntos de juegos  -> +50 puntos del mes
//
// Quien manda la captura con 4.000 y luego llega a 10.000 no cobra dos
// veces: se le sube el premio y se le abona la diferencia.
//
// La captura es la ventana de Juegos del Clan con la lista de miembros y
// lo que lleva cada uno. Se cruza el nombre del que la manda (su /soy,
// con los adornos traducidos) contra esa lista: la fila con su nombre es
// la suya. Los juegos son una vez al mes, asi que se cobra una vez por
// temporada y por cuenta.

import { leerImagen } from './vision.js';
import { pedirPerfil } from './coc-perfil.js';
import { fotoDe, bajarFoto, parecidos } from './castillo-foto.js';

export const JUEGOS_BASE = 4000; //  puntos de juegos para el premio normal
export const JUEGOS_MAX = 10000; //  puntos de juegos para el premio gordo
export const PUNTOS_JUEGOS_BASE = 20;
export const PUNTOS_JUEGOS_MAX = 50;

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const diaCuba = (d = new Date()) => d.toLocaleDateString('en-CA', { timeZone: 'America/Havana' });
const temporadaDe = (d = new Date()) => diaCuba(d).slice(0, 7);

const numero = (v) => {
  if (v == null || v === '') return null;
  // "10.000", "10,000", "10 000", "4k": todas son el mismo numero.
  const t = String(v).trim().toLowerCase();
  const k = /^(\d+([.,]\d+)?)\s*k$/.exec(t);
  if (k) return Math.round(Number(k[1].replace(',', '.')) * 1000);
  const n = Number(t.replace(/[^\d]/g, ''));
  return Number.isFinite(n) ? n : null;
};

/** Los puntos del mes que dan N puntos de juegos: 0, 20 o 50. */
export function premioPorJuegos(puntos) {
  const n = numero(puntos);
  if (n == null) return 0;
  if (n >= JUEGOS_MAX) return PUNTOS_JUEGOS_MAX;
  if (n >= JUEGOS_BASE) return PUNTOS_JUEGOS_BASE;
  return 0;
}

/**
 * El pie de una foto que son los juegos del clan, como lo dice la gente:
 * "juegos", "juegos del clan", "clan games", "cg", "games".
 */
export function esFotoDeJuegos(pie) {
  const q = String(pie ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
  return /\b(juegos?(\s*(de|del)\s*clan)?|clan\s*games?|games|cg)\b/.test(q);
}

export const INSTRUCCIONES_JUEGOS = `Esta imagen debería ser una captura de pantalla de Clash of Clans con la ventana de los Juegos del Clan ("Juegos del Clan" o "Clan Games") abierta.

Cómo se ve: arriba, el título y el tiempo que queda; una barra con los puntos del clan y las recompensas; y una lista de los miembros del clan, cada uno en una fila con su nombre y, a la derecha, los puntos que ha conseguido él (por ejemplo "4000" o "10000"). A veces la fila del propio jugador va la primera o destacada.

Devuelve SOLO un objeto JSON con esta forma, compacto (en una sola línea, sin espacios ni saltos de línea), sin comentarios:
{
  "es_juegos_del_clan": true o false,
  "clan": "nombre del clan si se lee, o null",
  "puntos_clan": número total del clan si se lee, o null,
  "jugadores": [ { "nombre": "nombre del jugador tal como se lee", "puntos": número } ]
}

Reglas:
- Una entrada por cada fila de la lista que tenga nombre y puntos legibles, en el orden en que aparecen.
- "puntos" es el número de la derecha de la fila, el de ese jugador; NO el total del clan ni el de la barra de recompensas. Quita los puntos y las comas de los miles: "10.000" es 10000.
- Copia los nombres letra a letra, con sus símbolos. No traduzcas nada.
- Si un dato no se lee con claridad, pon null. No adivines.
- Si la imagen no es del juego o no es la ventana de los Juegos del Clan, devuelve {"es_juegos_del_clan": false, "clan": null, "puntos_clan": null, "jugadores": []}.`;

/** La fila de la lista que es de este jugador, con los adornos traducidos. */
export function filaDe(lectura, nombre) {
  const j = lectura?.json ?? {};
  const filas = (Array.isArray(j.jugadores) ? j.jugadores : [])
    .map((f) => ({ nombre: f?.nombre == null ? null : String(f.nombre), puntos: numero(f?.puntos) }))
    .filter((f) => f.nombre && f.puntos != null);
  const mias = filas.filter((f) => parecidos(f.nombre, nombre));
  if (!mias.length) return null;
  // Si sale dos veces (la fila destacada y la de la lista), la de más puntos.
  return mias.sort((a, b) => b.puntos - a.puntos)[0];
}

/** La huella de la captura: quién y con cuántos puntos, para no repetirla. */
export function firmaJuegos(tag, puntos) {
  return `juegos|${temporadaDe()}|${tag}|${puntos}`;
}

/**
 * Lee la captura de los Juegos del Clan y anota los puntos del mes.
 * Devuelve { texto, verificado, id }. Nunca tira.
 *
 * @param {object} admin
 * @param {{ token:string, msg:object, tgId:number, quien:string }} p  quien: nombre ya escapado
 */
export async function verificarJuegosConFoto(admin, { token, msg, tgId, quien }) {
  const temporada = temporadaDe();

  // Quien es en el juego: sin /soy no hay con que cruzar la lista.
  const { data: vinculos } = await admin
    .from('tg_vinculos')
    .select('player_tag')
    .eq('tg_user_id', tgId)
    .order('principal', { ascending: false });
  const tags = (vinculos ?? []).map((x) => x.player_tag).filter(Boolean);
  if (!tags.length) {
    return { texto: `📷 Recibí la captura, ${quien}, pero no sé quién eres en el juego. Preséntate con <code>/soy TuNombre</code> y vuelve a mandarla.`, verificado: false, id: null };
  }
  const perfiles = (await Promise.all(tags.map((tag) => pedirPerfil(tag))))
    .map((p, i) => (p?.name ? { tag: tags[i], name: p.name } : null))
    .filter(Boolean);
  if (!perfiles.length) {
    return { texto: `📷 Ahora mismo no puedo consultar tu perfil en el juego, ${quien}. Prueba en un rato.`, verificado: false, id: null };
  }

  const foto = fotoDe(msg);
  const imagen = foto ? await bajarFoto(token, foto) : null;
  if (!imagen) return { texto: '📷 No pude bajar la captura (¿muy grande?). Mándala como foto normal, no como archivo.', verificado: false, id: null };

  const lectura = await leerImagen(admin, { base64: imagen.base64, mime: imagen.mime, instrucciones: INSTRUCCIONES_JUEGOS, max_tokens: 450 });
  const j = lectura?.json;
  if (!j) return { texto: `📷 Ahora mismo no puedo leer la captura, ${quien}. Prueba en un rato.`, verificado: false, id: null };
  if (j.es_juegos_del_clan === false) {
    return {
      texto: `📷 Eso no parece la ventana de los Juegos del Clan, ${quien}. Ábrela donde sale la lista con lo que lleva cada uno y mándala con <code>/juegos</code>.`,
      verificado: false,
      id: null,
    };
  }

  // La cuenta que aparece en la lista con más puntos (Cris tiene cuatro).
  const candidatas = perfiles.map((p) => ({ perfil: p, fila: filaDe(lectura, p.name) })).filter((x) => x.fila);
  if (!candidatas.length) {
    const vistos = (Array.isArray(j.jugadores) ? j.jugadores : []).map((f) => f?.nombre).filter(Boolean).slice(0, 6).join(', ');
    return {
      texto:
        `📷 En esa captura no encuentro tu nombre (<b>${esc(perfiles[0].name)}</b>) en la lista${vistos ? `: leo ${esc(vistos)}…` : ''}. ` +
        'Manda la captura donde se vea tu fila con tus puntos.',
      verificado: false,
      id: null,
    };
  }
  const { perfil, fila: suya } = candidatas.sort((a, b) => b.fila.puntos - a.fila.puntos)[0];
  const puntosJuegos = suya.puntos;
  const premio = premioPorJuegos(puntosJuegos);

  if (!premio) {
    return {
      texto:
        `🎮 Llevas <b>${puntosJuegos}</b> puntos de los juegos, ${quien}. A partir de <b>${JUEGOS_BASE}</b> son +${PUNTOS_JUEGOS_BASE} puntos del mes, ` +
        `y con <b>${JUEGOS_MAX}</b> son +${PUNTOS_JUEGOS_MAX}. Te faltan ${JUEGOS_BASE - puntosJuegos}: cuando los tengas, manda otra captura.`,
      verificado: false,
      id: null,
    };
  }

  // Los juegos son una vez al mes: una cobranza por cuenta y temporada,
  // con subida si ya cobró el escalón pequeño y ahora llega al grande.
  const { data: previo } = await admin
    .from('retos')
    .select('id, puntos, nota')
    .eq('temporada', temporada)
    .eq('tipo', 'juegos')
    .eq('player_tag', perfil.tag)
    .maybeSingle();

  const nota = `foto: ${perfil.name} ${puntosJuegos} puntos de juegos`;
  if (previo) {
    if (premio <= (previo.puntos ?? 0)) {
      return {
        texto: `🎮 Los juegos de este mes ya te los conté, ${quien} (+${previo.puntos} puntos). El mes que viene otra vez.`,
        verificado: false,
        id: null,
      };
    }
    const sube = premio - previo.puntos;
    const { error } = await admin
      .from('retos')
      .update({ puntos: premio, nota, firma: firmaJuegos(perfil.tag, puntosJuegos), verificado_por: 'Heraldo (foto)' })
      .eq('id', previo.id);
    if (error) {
      console.error(`[juegos] ${error.message}`);
      return { texto: `No pude anotarlo, ${quien}. Díselo a un líder.`, verificado: false, id: null };
    }
    return {
      texto: `🎮 ¡Ahí está! <b>${puntosJuegos}</b> puntos en los juegos del clan, ${quien}: subes al premio grande, +${sube} puntos más (${premio} en total este mes). 📜`,
      verificado: true,
      id: previo.id,
    };
  }

  const { data: filaNueva, error } = await admin
    .from('retos')
    .insert({
      temporada,
      tg_user_id: tgId,
      player_tag: perfil.tag,
      nombre: quien,
      tipo: 'juegos',
      puntos: premio,
      verificado: true,
      verificado_por: 'Heraldo (foto)',
      nota,
      firma: firmaJuegos(perfil.tag, puntosJuegos),
    })
    .select('id')
    .single();
  if (error) {
    console.error(`[juegos] ${error.message}`);
    return { texto: `No pude anotarlo, ${quien}. Díselo a un líder.`, verificado: false, id: null };
  }
  return {
    texto:
      premio === PUNTOS_JUEGOS_MAX
        ? `🎮 <b>${puntosJuegos}</b> puntos en los juegos del clan, ${quien}: eso es el máximo, y se premia como tal. +${premio} puntos este mes. 📜`
        : `🎮 Juegos del clan completados, ${quien}: <b>${puntosJuegos}</b> puntos. +${premio} puntos este mes. Si llegas a ${JUEGOS_MAX}, manda otra captura y suben a ${PUNTOS_JUEGOS_MAX}. 📜`,
    verificado: true,
    id: filaNueva.id,
  };
}

/** Modo prueba, para administradores: qué ve el modelo, sin anotar nada. */
export async function leerJuegosDePrueba(admin, { token, msg }) {
  const foto = fotoDe(msg);
  const imagen = foto ? await bajarFoto(token, foto) : null;
  if (!imagen) return '🔍 No pude bajar la captura.';
  const lectura = await leerImagen(admin, { base64: imagen.base64, mime: imagen.mime, instrucciones: INSTRUCCIONES_JUEGOS, max_tokens: 450 });
  const j = lectura?.json;
  if (!j) return `🔍 No pude leerla (${lectura ? 'no devolvió JSON' : 'la IA no contestó'}).`;
  const filas = (Array.isArray(j.jugadores) ? j.jugadores : []).map((f) => `${esc(f?.nombre ?? '?')} ${f?.puntos ?? '?'}`).join(' · ');
  return (
    `🔍 <b>Lo que leo en los juegos del clan</b>\n` +
    `¿Es la ventana? ${j.es_juegos_del_clan ? 'sí' : 'no'} · clan: ${esc(j.clan ?? '—')} · total: ${j.puntos_clan ?? '—'}\n` +
    (filas ? `Jugadores: ${filas}` : 'No leo ninguna fila.')
  );
}
