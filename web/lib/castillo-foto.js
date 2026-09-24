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

import { leerImagen, MODELOS_VISION } from './vision.js';
import { pedirPerfil } from './coc-perfil.js';
import { PUNTOS_CASTILLO, temporadaDe } from './castillos.js';
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

/** El clan tal cual lo da la API (/clans/{tag}), o null. */
export async function clanDe(clanTag) {
  return coc(`/clans/${tagUrl(clanTag)}`);
}

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

/** Los nombres de la lista, sin la seña entre parentesis, en minusculas. */
const NOMBRE_LISTA = (s) => String(s).replace(/\s*\(.*\)\s*$/, '').trim();
const nombresValidos = () => new Set([...TROPAS_CASTILLO.tropas, ...TROPAS_CASTILLO.hechizos, ...TROPAS_CASTILLO.asedio].map((s) => NOMBRE_LISTA(s).toLowerCase()));

/** El nombre tal como va en la lista, o null si el modelo dijo algo que no existe aqui. */
export function tropaValida(nombre) {
  const q = String(nombre ?? '').replace(/\s*\(.*\)\s*$/, '').trim().toLowerCase();
  if (!q) return null;
  for (const s of [...TROPAS_CASTILLO.tropas, ...TROPAS_CASTILLO.hechizos, ...TROPAS_CASTILLO.asedio]) {
    if (NOMBRE_LISTA(s).toLowerCase() === q) return NOMBRE_LISTA(s);
  }
  return null;
}

// Lo que se puede donar a un castillo del clan. El modelo NO sabe los
// nombres de las tropas de Clash of Clans: sin esta lista leyo "Dark
// Wizard" y "Royal Giant" (de Clash Royale) donde habia Headhunters y un
// Furnace (15 sep 2026). Con la lista cerrada delante, y una seña de las que
// se confunden, acierta mas y, si no encaja, deja null en vez de inventar.
export const TROPAS_CASTILLO = {
  tropas: [
    'Barbarian (hombre rubio con espada)', 'Archer (mujer de pelo rosa con arco)', 'Giant (gigante barbudo naranja)', 'Goblin (verde con saco)', 'Wall Breaker (esqueleto con bomba)',
    'Balloon (globo con esqueleto)', 'Wizard (túnica azul, bola de fuego)', 'Healer (ángel con alas)', 'Dragon', 'P.E.K.K.A (robot con armadura y espada)', 'Baby Dragon',
    'Miner (con pala y casco)', 'Electro Dragon', 'Yeti (blanco peludo)', 'Dragon Rider', 'Electro Titan', 'Root Rider (sobre una raíz)', 'Thrower (gigante que lanza lanzas)',
    'Minion (murciélago azul)', 'Hog Rider (sobre un jabalí)', 'Valkyrie (pelirroja con hacha)', 'Golem (de piedra)', 'Witch (túnica morada, invoca esqueletos)', 'Lava Hound',
    'Bowler (lanza una bola de piedra)', 'Ice Golem', 'Headhunter (mujer de pelo morado, cerbatana/lanza, fondo morado)', 'Apprentice Warden', 'Druid (anciano de verde con cuernos)',
    'Furnace (un horno de piedra oscuro y achaparrado con la boca llena de fuego naranja, sin cara ni cuerpo: no es una persona)', 'Ruin Witch',
    'Super Barbarian', 'Super Archer', 'Super Giant', 'Sneaky Goblin', 'Super Wall Breaker', 'Rocket Balloon', 'Super Wizard', 'Super Dragon', 'Inferno Dragon', 'Super Minion',
    'Super Hog Rider', 'Super Valkyrie', 'Super Witch (bruja grande de morado con sombrero enorme; sí es una persona)', 'Ice Hound', 'Super Bowler', 'Super Miner', 'Super Yeti',
  ],
  hechizos: ['Lightning Spell', 'Healing Spell', 'Rage Spell', 'Jump Spell', 'Freeze Spell', 'Clone Spell', 'Invisibility Spell', 'Recall Spell', 'Revive Spell', 'Overgrowth Spell', 'Ice Block Spell', 'Totem Spell', 'Poison Spell', 'Earthquake Spell', 'Haste Spell', 'Skeleton Spell', 'Bat Spell'],
  asedio: ['Wall Wrecker', 'Battle Blimp', 'Stone Slammer', 'Siege Barracks', 'Log Launcher', 'Flame Flinger', 'Battle Drill', 'Troop Launcher', 'Sky Wagon'],
};

const LISTA_TROPAS =
  `Tropas: ${TROPAS_CASTILLO.tropas.join(', ')}.\n` +
  `Hechizos: ${TROPAS_CASTILLO.hechizos.join(', ')}.\n` +
  `Máquinas de asedio: ${TROPAS_CASTILLO.asedio.join(', ')}.`;

export const INSTRUCCIONES_MAPA = `Esta imagen debería ser una captura de pantalla de Clash of Clans con el mapa de una guerra de clanes, en el lado de las bases aliadas.

Cómo se ve ese mapa: arriba, una cabecera con los dos clanes ("CLAN A vs CLAN B"), el tiempo que queda y la fase ("Preparation Day" / "Día de preparación" o "Battle Day"). Cada base aliada tiene encima una etiqueta pequeña con "N/M" (tropas donadas al castillo del clan / capacidad, por ejemplo "0/55" o "55/55") y debajo su número de posición y el nombre del jugador ("22. Axe"). Si se tocó una base, abajo se abre una ventana con su número y nombre ("23. davinder"), el mensaje del jugador pidiendo tropas ("¡Necesito refuerzos!"), una barra con "N/M" junto al botón "Donate" / "Donar", un botón "Scout" / "Explorar" y las tropas donadas con su cantidad ("x1") y su nivel.

MUY IMPORTANTE: en esa ventana de abajo suele haber DOS números con la forma "N/M". Uno va arriba, a la derecha del mensaje del jugador, y NO es lo que tiene el castillo. El que cuenta es el que está PEGADO al botón "Donate"/"Donar", en la misma línea. Si ves "0/55" arriba y "55/55" junto a "Donar", el castillo está en 55/55, lleno.

Devuelve SOLO un objeto JSON con esta forma, compacto (en una sola línea, sin espacios ni saltos de línea), sin comentarios:
{
  "es_mapa_de_guerra": true o false,
  "fase": "preparacion" | "batalla" | "desconocida",
  "clan_enemigo": "el clan de la derecha de la cabecera, tal como se lee, o null",
  "bases": [
    { "posicion": número de la base o null, "nombre": "nombre del jugador tal como se lee", "tropas": número o null, "capacidad": número o null, "ventana": true si es la base de la ventana de abajo, false si es una etiqueta del mapa }
  ],
  "tropas_donadas": [ { "tropa": "nombre si lo reconoces, o null", "cantidad": número o null, "nivel": número o null } ],
  "pedido": "el mensaje que el jugador escribió debajo de su nombre en la ventana de abajo pidiendo tropas, tal cual, o null"
}

Reglas:
- Una entrada por cada etiqueta "N/M" que se lea en el mapa (con el nombre de la base que tiene debajo) y otra para la ventana de abajo si la hay.
- "tropas" es el número de la izquierda de la barra "N/M"; "capacidad", el de la derecha. Si solo se lee uno, pon el otro en null.
- La barra de la VENTANA de abajo es la que vale y hay que leerla con cuidado: si no distingues el número de la izquierda con seguridad, pon null, NO pongas 0. Un 0 solo se pone si el castillo se ve claramente vacío, sin ningún icono de tropa dentro.
- Copia los nombres letra a letra, con sus símbolos. No traduzcas nada.
- Si algo no se lee con claridad, pon null. No adivines ni completes con lo que sería normal.
- Si la imagen no es del juego o no es el mapa de guerra, devuelve {"es_mapa_de_guerra": false, "fase": "desconocida", "clan_enemigo": null, "bases": [], "tropas_donadas": []}.

Las tropas donadas (los iconos de la ventana de abajo, con "xN" encima y el nivel en un número pequeño en la esquina) SOLO pueden ser de esta lista de Clash of Clans; escribe el nombre en inglés tal como está aquí, sin lo que va entre paréntesis (eso es una seña para reconocer el dibujo). Si un icono no encaja claramente con ninguno, pon "tropa": null. Este juego NO tiene Royal Giant, Dark Prince, Mini P.E.K.K.A, Musketeer, Knight ni Mega Knight (eso es Clash Royale): nunca uses esos nombres.
Las versiones "Super" son raras en un castillo: solo di "Super X" si el icono es claramente el súper (más grande, con brillo dorado); si dudas entre Archer y Super Archer, es Archer. Un nivel alto (12 o más) es señal de tropa normal, no súper.
Pista importante: debajo del nombre del jugador, en la ventana de abajo, suele haber un mensaje escrito por él pidiendo tropas (por ejemplo "2 Furnace 1 HH", "solo brujas y arqueras", "I need reinforcements"). Léelo y devuélvelo en "pedido". Lo donado casi siempre es lo que pidió: si un icono te deja dudas, usa ese texto para decidir ("HH" es Headhunter; "brujas" es Witch; "arqueras" es Archer; "furnace" u "horno" es Furnace; "edrag" es Electro Dragon; "valks" es Valkyrie).
${LISTA_TROPAS}`;

/**
 * Segunda pasada, solo para las tropas: la mitad de abajo de la captura
 * (donde esta la ventana de donacion) recortada y ampliada al doble. En la
 * captura entera los iconos quedan de 40 px y el modelo confunde
 * Headhunter con Witch y Furnace con Super Witch (16 sep 2026); ampliados
 * los distingue. Cuesta otra llamada, asi que solo se hace cuando la foto
 * ya valio (lleno) o en la prueba de lectura.
 */
export const INSTRUCCIONES_TROPAS = `Esta imagen es la parte de abajo de una captura del mapa de guerra de Clash of Clans, ampliada: la ventana de donación de una base aliada. En ella se ve el número y el nombre de la base, debajo un mensaje escrito por el jugador pidiendo tropas, una barra "N/M" junto al botón "Donate", y los iconos de las tropas donadas, cada uno con "xN" (la cantidad) encima y el nivel en un número pequeño en la esquina.

Devuelve SOLO un objeto JSON compacto, sin comentarios:
{"posicion": número de la base de la ventana o null, "nombre": "el nombre de la base de la ventana tal como se lee, o null", "pedido": "el mensaje del jugador tal cual, o null", "tropas": número o null, "capacidad": número o null, "numeros": [ { "texto": "N/M tal como se lee", "junto_a_donar": true o false } ], "barra_llena": true o false o null, "boton_donar": "activo" o "apagado" o "no_se_ve", "tropas_donadas": [ { "tropa": "nombre de la lista, o null", "cantidad": número o null, "nivel": número o null } ]}

En esta ventana hay normalmente DOS números con la forma "N/M": uno arriba, junto al mensaje del jugador ("¡Necesito refuerzos!"), que NO es lo que tiene el castillo, y otro PEGADO al botón "Donate"/"Donar", que es el que cuenta. Apúntalos TODOS en "numeros" diciendo cuál está junto al botón.
- "tropas" es el número de la IZQUIERDA del que está junto a "Donate"/"Donar" (lo que ya tiene el castillo) y "capacidad" el de la derecha. Si ves "0/55" arriba y "55/55" junto a "Donar", entonces tropas=55 y capacidad=55. Si no distingues los dos números con seguridad, pon null en los dos: es mejor null que un número inventado.
- "barra_llena": true si la barra de color llega hasta el final (el castillo está lleno), false si queda hueco, null si no la ves.
- "boton_donar": "apagado" si el botón "Donate" está gris, apagado o no está (el castillo no admite más), "activo" si se puede pulsar, "no_se_ve" si no aparece en la imagen.
- Los iconos de las tropas donadas son la prueba de que hay algo dentro: si ves iconos de tropas, "tropas" NO puede ser 0 ni "barra_llena" false por descuido. Cuéntalos.

Identifica cada icono SOLO con esta lista de Clash of Clans (nombre en inglés tal como está, sin lo que va entre paréntesis, que es una seña del dibujo). Si un icono no encaja claramente con ninguno, pon "tropa": null. No existen aquí Royal Giant, Dark Prince, Mini P.E.K.K.A, Musketeer ni Mega Knight (eso es Clash Royale).
Las versiones "Super" son raras en un castillo: solo si el icono es claramente el súper (más grande, con brillo dorado); entre Archer y Super Archer, es Archer. Nivel 12 o más es tropa normal.
El pedido del jugador es una pista fuerte: "HH" es Headhunter, "brujas" es Witch, "arqueras" es Archer, "furnace" u "horno" es Furnace, "IG" es Ice Golem, "edrag" es Electro Dragon, "valks" es Valkyrie. Fíjate bien: Headhunter es una mujer joven de pelo morado con una lanza corta, sobre fondo morado; Witch es una hechicera encapuchada de morado oscuro con bastón y calaveras verdes; Furnace es un horno de piedra con fuego, sin cara.
${LISTA_TROPAS}`;

async function recortarVentana(base64) {
  try {
    // webpackIgnore: este modulo lo importa tambien el panel (por retos.js,
    // por unas constantes) y webpack intentaria meter sharp en el bundle
    // del navegador. En el servidor se carga de node_modules tal cual.
    const sharp = (await import(/* webpackIgnore: true */ 'sharp')).default;
    const img = sharp(Buffer.from(base64, 'base64'));
    const { width, height } = await img.metadata();
    if (!width || !height) return null;
    const top = Math.round(height * 0.5);
    const out = await img
      .extract({ left: 0, top, width, height: height - top })
      .resize({ width: Math.min(width * 2, 2400), kernel: 'lanczos3' })
      .jpeg({ quality: 88 })
      .toBuffer();
    return { base64: out.toString('base64'), mime: 'image/jpeg' };
  } catch (e) {
    console.error(`[castillo] no pude recortar la ventana: ${e?.message ?? e}`);
    return null;
  }
}

/** Las tropas de la segunda pasada; si no se pudo, { error: 'recorte' | 'lectura' }. */
export async function leerTropasAmpliadas(admin, imagen) {
  const recorte = await recortarVentana(imagen.base64);
  if (!recorte) return { error: 'recorte' };
  const lectura = await leerImagen(admin, { base64: recorte.base64, mime: recorte.mime, instrucciones: INSTRUCCIONES_TROPAS, max_tokens: 350 });
  const j = lectura?.json;
  if (!j || !Array.isArray(j.tropas_donadas) || !j.tropas_donadas.length) return { error: 'lectura' };
  return j;
}

/**
 * De los números "N/M" que hay en la ventana, el del castillo: el que está
 * pegado al botón "Donar". Si el modelo no dijo cuál, el de la izquierda
 * más alta: el otro número de esa ventana (el de arriba, al lado de
 * "¡Necesito refuerzos!") va siempre en 0 y no es el del castillo. Esto es
 * lo que le pasó a Deibis el 24 sep 2026: la foto tenía "0/55" arriba y
 * "55/55" junto a "Donar", y Heraldo cogió el de arriba.
 */
export function barraDelCastillo(j) {
  const pares = (Array.isArray(j?.numeros) ? j.numeros : [])
    .map((n) => {
      const m = /(\d+)\s*\/\s*(\d+)/.exec(String(n?.texto ?? ''));
      return m ? { tropas: Number(m[1]), capacidad: Number(m[2]), donar: n?.junto_a_donar === true } : null;
    })
    .filter((p) => p && p.capacidad > 0);
  const juntoADonar = pares.find((p) => p.donar);
  if (juntoADonar) return { tropas: juntoADonar.tropas, capacidad: juntoADonar.capacidad };
  const mejor = [...pares].sort((a, b) => b.tropas - a.tropas)[0];
  const directo = { tropas: numero(j?.tropas), capacidad: numero(j?.capacidad) };
  if (!mejor) return directo;
  // Entre lo que dijo suelto y lo que sale en la lista, el que más tropas
  // ve: leer de menos es el fallo de siempre, nunca al revés.
  if (directo.tropas != null && directo.tropas > mejor.tropas) return directo;
  return { tropas: mejor.tropas, capacidad: mejor.capacidad };
}

/**
 * La segunda lectura, la de Valquiria: la misma ventana ampliada pero con
 * el OTRO modelo de vision, cuando la primera no dio por bueno el castillo.
 * Lo pidio Cris el 24 sep 2026: "los lideres estamos casi sin tiempo" -una
 * foto buena se quedo sin puntos desde las 8 de la mañana hasta las 5 de
 * la tarde-, asi que en vez de esperar a un lider se mira otra vez sola.
 *
 * Devuelve { tropas, capacidad, donado, nombre, posicion } o null.
 */
export async function segundaOpinion(admin, imagen) {
  const recorte = await recortarVentana(imagen.base64);
  if (!recorte) return null;
  const otro = [...MODELOS_VISION].reverse();
  const lectura = await leerImagen(admin, {
    base64: recorte.base64,
    mime: recorte.mime,
    instrucciones: INSTRUCCIONES_TROPAS,
    max_tokens: 350,
    modelos: otro,
  });
  const j = lectura?.json;
  if (!j || typeof j !== 'object') return null;
  const barra = barraDelCastillo(j);
  return {
    tropas: barra.tropas,
    capacidad: barra.capacidad,
    barraLlena: j.barra_llena === true ? true : j.barra_llena === false ? false : null,
    botonDonar: typeof j.boton_donar === 'string' ? j.boton_donar : null,
    donado: textoDonado(j),
    nombre: j.nombre != null ? String(j.nombre) : null,
    posicion: numero(j.posicion),
    tropasDonadas: Array.isArray(j.tropas_donadas) ? j.tropas_donadas.filter((t) => t && tropaValida(t.tropa)).length : 0,
  };
}

/**
 * Si la segunda lectura da el castillo por lleno Y es la base que toca.
 * Sin lo segundo, la foto del castillo de otro valdria: la ventana
 * ampliada no sabe de quien es el mapa, solo lo que dice la ventana.
 */
export function confirmaSegunda(segunda, abajo) {
  if (!segunda) return false;
  const { nombre, posicion } = segunda;
  // De quien es la ventana: hace falta leer la posicion o el nombre, y que
  // sean los de la base de abajo. Sin ninguno de los dos no se confirma:
  // una captura de la aldea propia con el castillo lleno no puede colar.
  const esSuya = posicion != null ? posicion === abajo.posicion : nombre ? parecidos(nombre, abajo.nombre) : false;
  return esSuya && estaLleno(segunda);
}

/**
 * Si la ventana dice que el castillo esta lleno. Los numeros de la barra
 * se leen mal a menudo (el 24 sep 2026 Heraldo le dijo "0/55" a Deibis con
 * el castillo lleno), asi que vale cualquiera de las tres señas: los
 * numeros, la barra de color entera, o el boton "Donate" apagado (el juego
 * lo apaga cuando ya no cabe nada). Un 0 con iconos de tropas dentro es
 * una lectura rota y no cuenta como "vacio".
 */
export function estaLleno(v) {
  if (!v) return false;
  if (v.tropas != null && v.capacidad) return v.tropas >= v.capacidad;
  if (v.barraLlena === true) return true;
  if (v.botonDonar === 'apagado' && (v.tropasDonadas ?? 0) > 0) return true;
  return false;
}

/** Una lectura que se contradice: dice 0 (o nada) pero hay tropas dentro. */
export function lecturaDudosa(v) {
  if (!v) return true;
  const conTropas = (v.tropasDonadas ?? 0) > 0;
  if (conTropas && (v.tropas === 0 || v.tropas == null)) return true;
  if (v.tropas == null || v.capacidad == null) return true;
  return false;
}

/** "7× Archer n14, 5× Headhunter n4": solo las que reconocio y existen. */
export function textoDonado(j) {
  return (Array.isArray(j?.tropas_donadas) ? j.tropas_donadas : [])
    .map((t) => (t ? { ...t, tropa: tropaValida(t.tropa) } : null))
    .filter((t) => t && t.tropa)
    .map((t) => `${numero(t.cantidad) ?? '?'}× ${t.tropa}${numero(t.nivel) != null ? ` n${numero(t.nivel)}` : ''}`)
    .join(', ');
}

// ---------- El juicio ----------

// Los nombres, con sus adornos («ΛVΞNTUS» es AVENTUS), se comparan con lo
// de nombres.js, en los dos lados: lo que leyo el modelo y lo que dice la API.
export { plano, parecidos };

const numero = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

/**
 * Si lo que el modelo dio por "clan enemigo" puede serlo. En la cabecera
 * del mapa, al lado de los dos clanes, van el reloj ("21M", "2D 4H") y el
 * marcador; el modelo los coge a veces. Un nombre de clan tiene letras y
 * no es un puro numero con una letra de unidad detras.
 */
export function pareceNombreDeClan(s) {
  const t = String(s ?? '').trim();
  if (!t) return false;
  if (/^\d+\s*[dhms]$/i.test(t)) return false;         // 21M, 2D, 45S: el reloj
  if (/^\d+\s*[dhms]\s*\d+\s*[dhms]$/i.test(t)) return false; // "2D 4H"
  if (/^[\d\s:/.%-]+$/.test(t)) return false;           // 0/55, 12:30, 45%
  // Tres letras: «龙之城» es un clan de verdad y «21M» o «x300» (una letra
  // y numeros) son el reloj o nuestro propio nombre mal cogido.
  return (t.match(/\p{L}/gu) ?? []).length >= 3;
}

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
  // se lee un nombre de clan de verdad y no es el de esta guerra, la
  // captura es de otra. Si el modelo leyo el nombre de nuestro propio clan
  // (la cabecera dice "x300 vs Rival" y puede coger el lado equivocado),
  // no se le hace caso. Y si lo que leyo no parece un nombre -"21M", que
  // es el reloj de la guerra (24 sep 2026: rechazo una captura buena de
  // Pepe)- tampoco: se sigue con las bases, que es la prueba de verdad.
  if (j.clan_enemigo && oponente && pareceNombreDeClan(j.clan_enemigo) && !parecidos(j.clan_enemigo, oponente) && !(propio && parecidos(j.clan_enemigo, propio))) {
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
  // Solo las tropas que reconocio: un "?" en el mensaje del grupo no
  // aporta nada, y si no reconocio ninguna, no se lista nada.
  const donado = textoDonado(j);
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

// Un lider lo confirma con 👍: sirve la reaccion (Telegram gratis no
// tiene ✅ entre las reacciones, 👍 si) y sirve contestar al mensaje.
const MANUAL = 'Mientras, un líder puede confirmarlo con un 👍 a este mensaje.';

/**
 * Lee la foto de un aviso y, si cuadra, lo confirma. Devuelve { texto,
 * verificado } para el grupo. Nunca tira: cualquier tropiezo acaba en el
 * camino manual de siempre.
 *
 * @param {object} admin
 * @param {{ token:string, msg:object, fila:object, quien:string }} p  fila: la de castillos; quien: nombre ya escapado
 */
export async function verificarCastilloConFoto(admin, { token, msg, fila, quien }) {
  const anota = async (nota) => {
    await admin.from('castillos').update({ nota: String(nota).slice(0, 200) }).eq('id', fila.id);
  };

  // Las cuentas que YA tienen el castillo de hoy confirmado no cuentan
  // otra vez: cada cuenta suma una vez al dia.
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Havana' });
  const { data: confirmadosHoy } = await admin
    .from('castillos')
    .select('id, player_tag, puntos')
    .eq('tg_user_id', fila.tg_user_id)
    .eq('verificado', true)
    .gte('creado_en', `${hoy}T00:00:00-04:00`);
  const yaConfirmadas = new Set((confirmadosHoy ?? []).map((c) => c.player_tag).filter(Boolean));

  // Quien es en el juego: sin /soy no hay con que cruzar la foto. Con
  // varias cuentas se prueba cada una: la que este en el mapa de una
  // guerra en curso es la que dono.
  const { data: vinculos } = await admin
    .from('tg_vinculos')
    .select('player_tag')
    .eq('tg_user_id', fila.tg_user_id)
    .order('principal', { ascending: false });
  const todas = [...new Set([fila.player_tag, ...(vinculos ?? []).map((v) => v.player_tag)].filter(Boolean))];
  const tags = todas.filter((t) => !yaConfirmadas.has(t));
  if (todas.length && !tags.length) {
    const puntos = (confirmadosHoy ?? []).reduce((s, c) => s + (c.puntos ?? 0), 0);
    return {
      texto:
        todas.length > 1
          ? `Ya tienes confirmado el castillo de hoy de tus ${todas.length} cuentas, ${quien} (+${puntos}). Mañana otra vez. 📜`
          : `Ese castillo ya estaba confirmado, ${quien} (+${puntos}). 📜`,
      verificado: true,
    };
  }
  if (!tags.length) {
    return {
      texto: `📷 Recibí la foto, ${quien}, pero no sé quién eres en el juego. Preséntate con <code>/soy TuNombre</code> y vuelve a mandarla. ${MANUAL}`,
      verificado: false,
    };
  }

  // TODAS las cuentas que estan en el mapa de una guerra: con varias
  // cuentas en la misma guerra (Cris tiene dos en x300) la foto puede ser
  // del castillo de abajo de cualquiera. Antes se cogia la primera y la
  // foto de la segunda cuenta salia como "no distingo el castillo de X".
  const sitios = [];
  let hayGuerra = false;
  const guerrasPorClan = new Map();
  for (const candidato of tags) {
    const perfil = await pedirPerfil(candidato);
    const clanTag = perfil?.clan?.tag;
    if (!clanTag) continue;
    if (!guerrasPorClan.has(clanTag)) guerrasPorClan.set(clanTag, await guerraDe(clanTag));
    const g = guerrasPorClan.get(clanTag);
    if (!g) continue;
    hayGuerra = true;
    const s = castilloDeAbajo(g, candidato);
    if (s) sitios.push({ tag: candidato, guerra: g, sitio: s });
  }
  if (!hayGuerra) {
    await anota('foto: sin guerra en curso en la API');
    return { texto: `📷 No encuentro una guerra en curso para tu clan, ${quien}, así que no puedo cruzar la foto. ${MANUAL}`, verificado: false };
  }
  if (!sitios.length) {
    await anota('foto: no esta en el mapa de esta guerra');
    return { texto: `📷 No te veo en el mapa de esta guerra, ${quien}. Si estás fuera de la alineación, no hay castillo que donar. ${MANUAL}`, verificado: false };
  }

  const foto = fotoDe(msg);
  const imagen = foto ? await bajarFoto(token, foto) : null;
  if (!imagen) {
    return { texto: `📷 No pude bajar la foto (¿muy grande?). Mándala como foto normal, no como archivo. ${MANUAL}`, verificado: false };
  }

  const lectura = await leerImagen(admin, { base64: imagen.base64, mime: imagen.mime, instrucciones: INSTRUCCIONES_MAPA });
  // Se juzga contra el castillo de abajo de cada cuenta y se queda el mejor
  // veredicto: lleno, si no incompleto, si no lo que sea de la principal.
  const RANGO = { lleno: 3, incompleto: 2 };
  let mejor = null;
  for (const c of sitios) {
    const f = juzgar({ lectura, abajo: c.sitio.abajo, oponente: c.guerra.opponent?.name, propio: c.guerra.clan?.name });
    const rango = RANGO[f.veredicto] ?? 1;
    if (!mejor || rango > mejor.rango) mejor = { ...c, fallo: f, rango };
  }
  const { tag, guerra, sitio } = mejor;
  let { fallo } = mejor;
  // La fila que se confirma: la del aviso si esta libre. Si esa ya es de
  // otra cuenta confirmada hoy, para esta cuenta se abre una nueva, pero
  // solo si la foto vale (lleno): un intento fallido no deja filas sueltas.
  if (fila.verificado && fallo.veredicto === 'lleno') {
    const { data: nueva } = await admin
      .from('castillos')
      .insert({ temporada: temporadaDe(), tg_user_id: fila.tg_user_id, player_tag: tag, nombre: fila.nombre ?? quien, mensaje: 'foto (otra cuenta)' })
      .select('id')
      .single();
    if (!nueva) return { texto: `📷 No pude anotar el castillo de tu otra cuenta, ${quien}. Díselo a un líder.`, verificado: false };
    fila = { ...fila, id: nueva.id, player_tag: tag, verificado: false, puntos: 0 };
  } else if (!fila.verificado && fila.player_tag !== tag) {
    // La cuenta que dono, por si la fila se anoto con la principal.
    await admin.from('castillos').update({ player_tag: tag }).eq('id', fila.id);
  }
  const { abajo } = sitio;
  const quienAbajo = `<b>${esc(abajo.nombre)}</b> (#${abajo.posicion})`;
  // Para el "no lo veo": todos los castillos que valdrian, no solo uno.
  const losDeAbajo = sitios.map((c) => `<b>${esc(c.sitio.abajo.nombre)}</b> (#${c.sitio.abajo.posicion})`).join(' o ');

  // Heraldo no lo dio por bueno: antes de mandar a nadie a esperar a un
  // lider, Valquiria mira la ventana ampliada con el otro modelo. Si ella
  // lo ve lleno y es la base de abajo que toca, vale igual.
  // (En 'otra_guerra' no: ahi la captura es de otra guerra y da igual lo
  // llena que salga la ventana.)
  if (fallo.veredicto !== 'lleno' && fallo.veredicto !== 'otra_guerra') {
    const segunda = await segundaOpinion(admin, imagen);
    if (confirmaSegunda(segunda, abajo)) {
      await admin
        .from('castillos')
        .update({ verificado: true, puntos: PUNTOS_CASTILLO, verificado_por: 'Valquiria (2ª lectura)' })
        .eq('id', fila.id);
      await anota(`2ª lectura: ${abajo.nombre} ${segunda.tropas}/${segunda.capacidad} (Heraldo dijo ${fallo.veredicto})`);
      return {
        texto:
          `✅ Lo miré otra vez y sí está: el castillo de ${quienAbajo}, el de abajo de ${quien}, va ${segunda.tropas}/${segunda.capacidad}` +
          (segunda.donado ? ` (${esc(segunda.donado)})` : '') +
          `. +${PUNTOS_CASTILLO} puntos este mes. 📜`,
        verificado: true,
      };
    }
    // Lo que leyeron las dos, en la nota: sin esto no hay forma de saber
    // cual de las dos pasadas falló cuando alguien se queja.
    const dosLecturas =
      `1ª ${fallo.veredicto} ${fallo.tropas ?? '?'}/${fallo.capacidad ?? '?'} · ` +
      `2ª ${segunda ? `${segunda.tropas ?? '?'}/${segunda.capacidad ?? '?'} barra:${segunda.barraLlena ?? '?'} donar:${segunda.botonDonar ?? '?'} iconos:${segunda.tropasDonadas ?? 0}` : 'no leyó'}`;
    if (segunda && !lecturaDudosa(segunda)) {
      // La segunda lectura vio la ventana clara y tampoco esta llena: eso
      // ya es una respuesta, y mas fiable que "no distingo nada".
      fallo = { ...fallo, veredicto: 'incompleto', tropas: segunda.tropas, capacidad: segunda.capacidad, donado: segunda.donado, dosLecturas };
    } else if (fallo.veredicto === 'incompleto' && (lecturaDudosa(segunda) || segunda?.tropasDonadas)) {
      // Ninguna de las dos se aclara: NO se le dice a nadie que su castillo
      // está vacío cuando puede no estarlo (el 24 sep le pasó a Deibis y a
      // Pepe). Se pide un 👍 y se queda dicho en la nota.
      fallo = { ...fallo, veredicto: 'dudoso', dosLecturas };
    } else {
      fallo = { ...fallo, dosLecturas };
    }
  }

  switch (fallo.veredicto) {
    case 'lleno': {
      // Los puntos primero y la nota aparte: la nota es una columna de la
      // migracion 028 y, si faltara, no puede tumbar la confirmacion.
      await admin
        .from('castillos')
        .update({ verificado: true, puntos: PUNTOS_CASTILLO, verificado_por: 'Heraldo (foto)' })
        .eq('id', fila.id);
      await anota(`foto: ${abajo.nombre} ${fallo.tropas}/${fallo.capacidad}`);
      // Las tropas, con la ventana ampliada: si la segunda pasada falla,
      // se quedan las de la primera.
      const ampliadas = await leerTropasAmpliadas(admin, imagen);
      const donado = ampliadas && !ampliadas.error ? textoDonado(ampliadas) : fallo.donado;
      return {
        texto:
          `✅ Foto verificada: el castillo de ${quienAbajo}, el de abajo de ${quien}, está ${fallo.tropas}/${fallo.capacidad}` +
          (donado ? ` (${esc(donado)})` : '') +
          `. +${PUNTOS_CASTILLO} puntos este mes. 📜`,
        verificado: true,
      };
    }
    case 'incompleto':
      await anota(`foto: ${abajo.nombre} ${fallo.tropas}/${fallo.capacidad}, incompleto${fallo.dosLecturas ? ` [${fallo.dosLecturas}]` : ''}`);
      return {
        texto: `📷 En la foto el castillo de ${quienAbajo} va ${fallo.tropas}/${fallo.capacidad}: todavía no está lleno. Cuando lo esté, manda otra captura. ${MANUAL}`,
        verificado: false,
      };

    // Las dos lecturas se contradicen: antes de esto el bot soltaba un
    // "va 0/55" que era mentira. Mejor decir que no se ve y pedir el 👍.
    case 'dudoso':
      await anota(`foto: no se lee la barra de ${abajo.nombre}${fallo.dosLecturas ? ` [${fallo.dosLecturas}]` : ''}`);
      return {
        texto:
          `📷 Veo el castillo de ${quienAbajo} con tropas dentro, pero no consigo leer la barra para saber si está lleno del todo. ` +
          `No te voy a decir que no donaste cuando puede que sí. ${MANUAL}`,
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
      await anota(`foto: no se distingue el castillo de ${sitios.map((c) => c.sitio.abajo.nombre).join(' / ')}${fallo.dosLecturas ? ` [${fallo.dosLecturas}]` : ''}`);
      return {
        texto: `📷 En la foto no distingo el castillo de ${losDeAbajo}, que es el de abajo de ${quien}. Manda una captura del mapa de guerra donde se lea su nombre y el castillo (N/M). ${MANUAL}`,
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
  const listar = (x) =>
    (Array.isArray(x?.tropas_donadas) ? x.tropas_donadas : [])
      .map((t) => `${t.cantidad ?? '?'}× ${esc(tropaValida(t.tropa) ?? (t.tropa ? `${t.tropa} (no existe, se descarta)` : '?'))} n${t.nivel ?? '?'}`)
      .join(', ');
  const ampliadas = await leerTropasAmpliadas(admin, imagen);
  return (
    `🔍 <b>Prueba de lectura (mapa de guerra)</b> · ${esc(lectura.modelo)}\n` +
    `¿Mapa de guerra? ${j.es_mapa_de_guerra ? 'sí' : 'no'} · fase: ${esc(j.fase ?? '?')} · rival leído: ${esc(j.clan_enemigo ?? '—')}\n` +
    `Bases: ${bases || '—'}\n` +
    `Pedido leído: ${esc((!ampliadas?.error && ampliadas?.pedido) || j.pedido || '—')}\n` +
    `Tropas (captura entera): ${listar(j) || '—'}\n` +
    `Tropas (ventana ampliada): ${ampliadas?.error ? `no se pudo (${ampliadas.error})` : listar(ampliadas) || '—'}`
  );
}
