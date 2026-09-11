// La foto del castillo: leerla y dar los puntos sin molestar a un lider.
//
// El aviso "ya doné mi castillo" lo confirmaba un lider mirando el juego.
// Con una captura del mapa de guerra la IA lee que castillo esta a cuanto,
// y la API de Clash dice quien esta debajo de quien: si el castillo del de
// abajo del que avisa esta lleno, los puntos se dan solos. Si no se ve, no
// cuadra, o la foto es de otra guerra, queda como antes: un lider con ✅.
//
// Lo que se cruza con la API y NO con la foto: la posicion del que avisa
// en el mapa, el nombre del de abajo, el rival de esta guerra. La foto solo
// aporta lo que la API no enseña: cuantas tropas hay en ese castillo. Asi
// una captura vieja, de otra guerra o de otro castillo no cuela, y el
// modelo no tiene que adivinar nada que ya sepamos.
//
// Lo que sigue sin poder comprobarse: QUIEN lleno el castillo. El juego no
// enseña el nombre del donante en el castillo de guerra (es una peticion
// de la comunidad desde 2014). Si el de abajo esta lleno, se da por hecho
// que fue el de arriba, que es su deber; si otro lo lleno por el, los
// puntos se los lleva igual, y eso lo arregla un ❌ de un lider.

import { leerImagen } from './vision.js';
import { pedirPerfil } from './coc-perfil.js';
import { PUNTOS_CASTILLO } from './castillos.js';
import { plano, parecidos } from './nombres.js';

const BASE = process.env.COC_BASE_URL || 'https://cocproxy.royaleapi.dev/v1';
const COC = process.env.COC_TOKEN;

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Groq acepta imagenes en base64 hasta 4 MB; en bytes crudos, unos 3 MB.
const MAX_BYTES = 3 * 1024 * 1024;

/**
 * La imagen que trae un mensaje de Telegram, si trae: la foto (el tamaño
 * mayor de los que manda Telegram) o un archivo de imagen mandado sin
 * comprimir. { fileId, mime } o null.
 */
export function fotoDe(msg) {
  if (!msg) return null;
  if (Array.isArray(msg.photo) && msg.photo.length) {
    const mayor = msg.photo.reduce((a, b) => ((b.width ?? 0) * (b.height ?? 0) > (a.width ?? 0) * (a.height ?? 0) ? b : a));
    return { fileId: mayor.file_id, mime: 'image/jpeg', bytes: mayor.file_size ?? null };
  }
  const d = msg.document;
  if (d?.file_id && /^image\/(jpeg|png|webp)$/i.test(d.mime_type ?? '')) {
    return { fileId: d.file_id, mime: d.mime_type.toLowerCase(), bytes: d.file_size ?? null };
  }
  return null;
}

/** Descarga la imagen de Telegram y la devuelve en base64, o null. */
export async function bajarFoto(token, { fileId, mime, bytes }) {
  if (!token || !fileId) return null;
  if (bytes && bytes > MAX_BYTES) return null;
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${encodeURIComponent(fileId)}`, {
      signal: AbortSignal.timeout(6000),
    });
    const j = await r.json();
    const ruta = j?.result?.file_path;
    if (!ruta) return null;
    const f = await fetch(`https://api.telegram.org/file/bot${token}/${ruta}`, { signal: AbortSignal.timeout(10000) });
    if (!f.ok) return null;
    const buf = Buffer.from(await f.arrayBuffer());
    if (buf.length > MAX_BYTES) return null;
    return { base64: buf.toString('base64'), mime };
  } catch (e) {
    console.error(`[castillo-foto] no pude bajar la foto: ${e?.message ?? e}`);
    return null;
  }
}

// ---------- La guerra, por la API ----------

async function coc(ruta, { crudo = false } = {}) {
  if (!COC) return crudo ? { status: 0, data: null } : null;
  try {
    const r = await fetch(`${BASE}${ruta}`, {
      headers: { Authorization: `Bearer ${COC}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    const data = r.ok ? await r.json() : null;
    // crudo: tambien el status, para distinguir "no esta en guerra" de
    // "no me dejan verlo" (403: registro de guerra privado).
    return crudo ? { status: r.status, data } : data;
  } catch {
    return crudo ? { status: 0, data: null } : null;
  }
}

const tagUrl = (t) => encodeURIComponent(String(t ?? '').trim().toUpperCase().replace(/^#?/, '#'));

/**
 * La guerra en curso del clan, con NUESTRO clan siempre en `clan`. Primero
 * la guerra normal; si el clan esta en liga, la guerra de la ronda en
 * curso (en CWL /currentwar dice notInWar y hay que ir por el grupo de
 * liga). Null si no hay ninguna en preparacion o batalla.
 */
export async function guerraDe(clanTag) {
  const normal = await coc(`/clans/${tagUrl(clanTag)}/currentwar`);
  if (normal && ['preparation', 'inWar'].includes(normal.state)) return normal;
  return (await rondasAbiertas(clanTag))[0] ?? null;
}

/**
 * TODAS las guerras abiertas del clan, la normal y las rondas de liga, con
 * nuestro clan siempre en `clan`. En CWL coexisten un dia la ronda en
 * batalla y la siguiente en preparacion: guerraDe() se queda con la de
 * preparacion (es donde se dona el castillo); para "¿quien falta por
 * atacar?" hace falta la que esta en batalla, o sea, las dos.
 */
export async function guerrasAbiertas(clanTag) {
  const { status, data: normal } = await coc(`/clans/${tagUrl(clanTag)}/currentwar`, { crudo: true });
  const lista = normal && ['preparation', 'inWar'].includes(normal.state) ? [normal] : [];
  const abiertas = lista.concat(await rondasAbiertas(clanTag));
  // 403: el clan tiene el registro de guerra privado y la API no enseña su
  // guerra normal (las rondas de liga si se ven). Se avisa, no se calla.
  return { abiertas, privado: status === 403 };
}

/** Las rondas de liga en preparacion o batalla, la ultima primero: 0, 1 o 2. */
async function rondasAbiertas(clanTag) {
  const grupo = await coc(`/clans/${tagUrl(clanTag)}/currentwar/leaguegroup`);
  if (!grupo?.rounds?.length) return [];
  const rondas = grupo.rounds.filter((r) => (r.warTags ?? []).some((t) => t && t !== '#0'));
  const mio = tagUrl(clanTag);
  const abiertas = [];
  // De la ultima ronda con guerras hacia atras, como mucho dos: la que
  // esta en batalla y la que esta en preparacion coexisten un dia.
  for (const ronda of rondas.slice(-2).reverse()) {
    for (const tag of ronda.warTags) {
      if (!tag || tag === '#0') continue;
      const g = await coc(`/clanwarleagues/wars/${tagUrl(tag)}`);
      if (!g || !['preparation', 'inWar'].includes(g.state)) continue;
      if (tagUrl(g.clan?.tag) === mio) {
        abiertas.push(g);
        break;
      }
      if (tagUrl(g.opponent?.tag) === mio) {
        abiertas.push({ ...g, clan: g.opponent, opponent: g.clan });
        break;
      }
    }
  }
  return abiertas;
}

/**
 * Quien esta debajo de quien en el mapa. Devuelve { mia, abajo } con
 * { posicion, nombre, tag, th } cada uno, o null si el jugador no esta en
 * esta guerra. El ultimo del mapa dona al primero: la rueda cierra.
 */
export function castilloDeAbajo(guerra, playerTag) {
  const gente = [...(guerra?.clan?.members ?? [])].sort((a, b) => (a.mapPosition ?? 0) - (b.mapPosition ?? 0));
  if (!gente.length) return null;
  const mio = tagUrl(playerTag);
  const i = gente.findIndex((m) => tagUrl(m.tag) === mio);
  if (i < 0) return null;
  const ficha = (m) => ({ posicion: m.mapPosition, nombre: m.name, tag: m.tag, th: m.townhallLevel });
  return { mia: ficha(gente[i]), abajo: ficha(gente[(i + 1) % gente.length]) };
}

// ---------- Lo que se le pide al modelo ----------

export const INSTRUCCIONES_MAPA = `Esta imagen debería ser una captura de pantalla de Clash of Clans con el mapa de una guerra de clanes, en el lado de las bases aliadas.

Cómo se ve ese mapa: arriba, una cabecera con los dos clanes ("CLAN A vs CLAN B"), el tiempo que queda y la fase ("Preparation Day" / "Día de preparación" o "Battle Day"). Cada base aliada tiene encima una etiqueta pequeña con "N/M" (tropas donadas al castillo del clan / capacidad, por ejemplo "0/55" o "55/55") y debajo su número de posición y el nombre del jugador ("22. Axe"). Si se tocó una base, abajo se abre una ventana con su número y nombre ("23. davinder"), una barra con "N/M" junto al botón "Donate", un botón "Scout" y las tropas donadas con su cantidad ("x1") y su nivel.

Devuelve SOLO un objeto JSON con esta forma, compacto (en una sola línea, sin espacios ni saltos de línea), sin comentarios:
{
  "es_mapa_de_guerra": true o false,
  "fase": "preparacion" | "batalla" | "desconocida",
  "clan_enemigo": "el clan de la derecha de la cabecera, tal como se lee, o null",
  "bases": [
    { "posicion": número de la base o null, "nombre": "nombre del jugador tal como se lee", "tropas": número o null, "capacidad": número o null, "ventana": true si es la base de la ventana de abajo, false si es una etiqueta del mapa }
  ],
  "tropas_donadas": [ { "tropa": "nombre si lo reconoces, o null", "cantidad": número o null, "nivel": número o null } ]
}

Reglas:
- Una entrada por cada etiqueta "N/M" que se lea en el mapa (con el nombre de la base que tiene debajo) y otra para la ventana de abajo si la hay.
- "tropas" es el número de la izquierda de la barra "N/M"; "capacidad", el de la derecha. Si solo se lee uno, pon el otro en null.
- Copia los nombres letra a letra, con sus símbolos. No traduzcas nada.
- Si algo no se lee con claridad, pon null. No adivines ni completes con lo que sería normal.
- Si la imagen no es del juego o no es el mapa de guerra, devuelve {"es_mapa_de_guerra": false, "fase": "desconocida", "clan_enemigo": null, "bases": [], "tropas_donadas": []}.`;

// ---------- El juicio ----------

// Los nombres, con sus adornos («ΛVΞNTUS» es AVENTUS), se comparan con lo
// de nombres.js, en los dos lados: lo que leyo el modelo y lo que dice la API.
export { plano, parecidos };

const numero = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

/**
 * Cruza lo que leyo el modelo con lo que dice la API y decide.
 *
 * @returns {{ veredicto: 'lleno'|'incompleto'|'no_se_ve'|'otra_guerra'|'no_es_mapa'|'ilegible', tropas?:number, capacidad?:number, leido?:string }}
 */
export function juzgar({ lectura, abajo, oponente, propio = null }) {
  const j = lectura?.json;
  if (!j || typeof j !== 'object') return { veredicto: 'ilegible' };
  if (j.es_mapa_de_guerra === false) return { veredicto: 'no_es_mapa' };

  // El rival no pinta nada en la donacion -el castillo es el del aliado de
  // abajo-; su nombre solo sirve de sello de QUE guerra es la captura. Si
  // se lee y no es el de esta guerra, la captura es de otra. Si el modelo
  // leyo el nombre de nuestro propio clan (la cabecera dice "x300 vs
  // Rival" y puede coger el lado equivocado), no se le hace caso.
  if (j.clan_enemigo && oponente && !parecidos(j.clan_enemigo, oponente) && !(propio && parecidos(j.clan_enemigo, propio))) {
    return { veredicto: 'otra_guerra', leido: String(j.clan_enemigo) };
  }

  // La base de abajo, entre lo leido: por posicion (si el nombre no lo
  // contradice) o por nombre. Puede salir dos veces -la etiqueta del mapa
  // y la ventana de abajo-; la ventana es la que esta al dia, y si no hay
  // ventana, la etiqueta con mas tropas (la otra sera una lectura peor).
  const bases = Array.isArray(j.bases) ? j.bases : [];
  const esElla = (b) =>
    (numero(b?.posicion) === abajo.posicion && (b?.nombre == null || parecidos(b.nombre, abajo.nombre) || bases.length === 1)) ||
    parecidos(b?.nombre, abajo.nombre);
  const candidatas = bases.filter(esElla);
  if (!candidatas.length) return { veredicto: 'no_se_ve' };
  const base =
    candidatas.find((b) => b?.ventana === true && numero(b.tropas) != null) ??
    [...candidatas].sort((x, y) => (numero(y?.tropas) ?? -1) - (numero(x?.tropas) ?? -1))[0];

  const tropas = numero(base.tropas);
  const capacidad = numero(base.capacidad);
  if (tropas == null || capacidad == null || capacidad === 0) return { veredicto: 'no_se_ve', leido: base.nombre };
  const donado = (Array.isArray(j.tropas_donadas) ? j.tropas_donadas : [])
    .filter((t) => t && (t.tropa || t.cantidad))
    .map((t) => `${numero(t.cantidad) ?? '?'}× ${t.tropa ?? '?'}${numero(t.nivel) != null ? ` n${numero(t.nivel)}` : ''}`)
    .join(', ');
  if (tropas >= capacidad) return { veredicto: 'lleno', tropas, capacidad, leido: base.nombre, donado };
  return { veredicto: 'incompleto', tropas, capacidad, leido: base.nombre, donado };
}

// ---------- Todo junto ----------

/**
 * La fila de castillos a la que va una foto: la del aviso al que
 * responde (por el id del mensaje del bot), o la de hoy del que la manda.
 */
export async function filaParaFoto(admin, { tgId, mensajeBotId = null }) {
  if (mensajeBotId) {
    const { data } = await admin
      .from('castillos')
      .select('id, tg_user_id, player_tag, nombre, verificado, puntos, mensaje_bot_id')
      .eq('mensaje_bot_id', mensajeBotId)
      .maybeSingle();
    return data && data.tg_user_id === tgId ? data : null;
  }
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Havana' });
  const { data } = await admin
    .from('castillos')
    .select('id, tg_user_id, player_tag, nombre, verificado, puntos, mensaje_bot_id')
    .eq('tg_user_id', tgId)
    .gte('creado_en', `${hoy}T00:00:00-04:00`)
    .order('creado_en', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

const MANUAL = 'Mientras, un líder puede confirmarlo contestando ✅ a este mensaje.';

/**
 * Lee la foto de un aviso y, si cuadra, lo confirma. Devuelve { texto,
 * verificado } para el grupo. Nunca tira: cualquier tropiezo acaba en el
 * camino manual de siempre.
 *
 * @param {object} admin
 * @param {{ token:string, msg:object, fila:object, quien:string }} p  fila: la de castillos; quien: nombre ya escapado
 */
export async function verificarCastilloConFoto(admin, { token, msg, fila, quien }) {
  if (fila.verificado) return { texto: `Ese castillo ya estaba confirmado, ${quien} (+${fila.puntos}). 📜`, verificado: true };

  const anota = async (nota) => {
    await admin.from('castillos').update({ nota: String(nota).slice(0, 200) }).eq('id', fila.id);
  };

  // Quien es en el juego: sin /soy no hay con que cruzar la foto.
  let tag = fila.player_tag;
  if (!tag) {
    const { data: v } = await admin.from('tg_vinculos').select('player_tag').eq('tg_user_id', fila.tg_user_id).maybeSingle();
    tag = v?.player_tag ?? null;
  }
  if (!tag) {
    return {
      texto: `📷 Recibí la foto, ${quien}, pero no sé quién eres en el juego. Preséntate con <code>/soy TuNombre</code> y vuelve a mandarla. ${MANUAL}`,
      verificado: false,
    };
  }

  const perfil = await pedirPerfil(tag);
  const clanTag = perfil?.clan?.tag;
  const guerra = clanTag ? await guerraDe(clanTag) : null;
  if (!guerra) {
    await anota('foto: sin guerra en curso en la API');
    return { texto: `📷 No encuentro una guerra en curso para tu clan, ${quien}, así que no puedo cruzar la foto. ${MANUAL}`, verificado: false };
  }
  const sitio = castilloDeAbajo(guerra, tag);
  if (!sitio) {
    await anota('foto: no esta en el mapa de esta guerra');
    return { texto: `📷 No te veo en el mapa de esta guerra, ${quien}. Si estás fuera de la alineación, no hay castillo que donar. ${MANUAL}`, verificado: false };
  }
  const { abajo } = sitio;
  const quienAbajo = `<b>${esc(abajo.nombre)}</b> (#${abajo.posicion})`;

  const foto = fotoDe(msg);
  const imagen = foto ? await bajarFoto(token, foto) : null;
  if (!imagen) {
    return { texto: `📷 No pude bajar la foto (¿muy grande?). Mándala como foto normal, no como archivo. ${MANUAL}`, verificado: false };
  }

  const lectura = await leerImagen(admin, { base64: imagen.base64, mime: imagen.mime, instrucciones: INSTRUCCIONES_MAPA });
  const fallo = juzgar({ lectura, abajo, oponente: guerra.opponent?.name, propio: guerra.clan?.name });

  switch (fallo.veredicto) {
    case 'lleno': {
      // Los puntos primero y la nota aparte: la nota es una columna de la
      // migracion 028 y, si faltara, no puede tumbar la confirmacion.
      await admin
        .from('castillos')
        .update({ verificado: true, puntos: PUNTOS_CASTILLO, verificado_por: 'Heraldo (foto)' })
        .eq('id', fila.id);
      await anota(`foto: ${abajo.nombre} ${fallo.tropas}/${fallo.capacidad}`);
      return {
        texto:
          `✅ Foto verificada: el castillo de ${quienAbajo}, el de abajo de ${quien}, está ${fallo.tropas}/${fallo.capacidad}` +
          (fallo.donado ? ` (${esc(fallo.donado)})` : '') +
          `. +${PUNTOS_CASTILLO} puntos este mes. 📜`,
        verificado: true,
      };
    }
    case 'incompleto':
      await anota(`foto: ${abajo.nombre} ${fallo.tropas}/${fallo.capacidad}, incompleto`);
      return {
        texto: `📷 En la foto el castillo de ${quienAbajo} va ${fallo.tropas}/${fallo.capacidad}: todavía no está lleno. Cuando lo esté, manda otra captura. ${MANUAL}`,
        verificado: false,
      };
    case 'otra_guerra':
      await anota(`foto: parece de otra guerra (rival leido: ${fallo.leido})`);
      return {
        texto: `📷 Esa captura parece de otra guerra: leo "${esc(fallo.leido)}" y el rival de ahora es <b>${esc(guerra.opponent?.name ?? '?')}</b>. Manda una de esta guerra. ${MANUAL}`,
        verificado: false,
      };
    case 'no_es_mapa':
      await anota('foto: no es el mapa de guerra');
      return {
        texto: `📷 Eso no parece el mapa de guerra. Abre la guerra, toca la base de ${quienAbajo}, que es la tuya de abajo, y manda la captura donde se vea su castillo. ${MANUAL}`,
        verificado: false,
      };
    case 'no_se_ve':
      await anota(`foto: no se distingue el castillo de ${abajo.nombre}`);
      return {
        texto: `📷 En la foto no distingo el castillo de ${quienAbajo}, que es el de abajo de ${quien}. Manda una captura del mapa de guerra donde se lea su nombre y el castillo (N/M). ${MANUAL}`,
        verificado: false,
      };
    default:
      return { texto: `📷 Ahora mismo no puedo leer la foto, ${quien}. ${MANUAL}`, verificado: false };
  }
}


/**
 * Modo prueba, para administradores: que ve el modelo en una captura del
 * mapa de guerra, sin cruzarlo con nada ni anotar nada. Sirve para afinar
 * las instrucciones con pantallas reales.
 */
export async function leerMapaDePrueba(admin, { token, msg }) {
  const foto = fotoDe(msg);
  const imagen = foto ? await bajarFoto(token, foto) : null;
  if (!imagen) return '🔍 No pude bajar la captura.';
  const lectura = await leerImagen(admin, { base64: imagen.base64, mime: imagen.mime, instrucciones: INSTRUCCIONES_MAPA });
  const j = lectura?.json;
  if (!j) return `🔍 No pude leerla (${lectura ? 'no devolvió JSON' : 'la IA no contestó'}).`;
  const bases = (Array.isArray(j.bases) ? j.bases : [])
    .map((b) => `${b.posicion ?? '?'} ${esc(b.nombre ?? '?')} ${b.tropas ?? '?'}/${b.capacidad ?? '?'}${b.ventana ? ' (ventana)' : ''}`)
    .join(' · ');
  const donado = (Array.isArray(j.tropas_donadas) ? j.tropas_donadas : []).map((t) => `${t.cantidad ?? '?'}× ${esc(t.tropa ?? '?')} n${t.nivel ?? '?'}`).join(', ');
  return (
    `🔍 <b>Prueba de lectura (mapa de guerra)</b> · ${esc(lectura.modelo)}\n` +
    `¿Mapa de guerra? ${j.es_mapa_de_guerra ? 'sí' : 'no'} · fase: ${esc(j.fase ?? '?')} · rival leído: ${esc(j.clan_enemigo ?? '—')}\n` +
    `Bases: ${bases || '—'}\n` +
    `Tropas donadas: ${donado || '—'}`
  );
}
