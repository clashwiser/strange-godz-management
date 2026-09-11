// Los retos: puntos por una captura. Por ahora, los desafios amistosos.
//
// El reto de los desafios amistosos (FC): cinco desafios con dos estrellas
// o mas, en UNA captura del chat del clan, una vez al dia. Lo decidio
// Cris mirando pantallas reales: en un telefono normal, apaisado, caben
// cinco tarjetas de resultado; en un plegable, ocho. Con cinco por
// captura no hay que pegar capturas ni contar tarjetas repetidas entre
// una y otra.
//
// Lo que se lee de la captura (web/lib/vision.js): las tarjetas del chat
// -atacante ➡ defensor, estrellas, porcentaje- y, si sale, la cabecera
// con el nombre del clan y los contadores de recursos de la aldea. Lo que
// se cruza con la API: el nombre del atacante contra el /soy del que la
// manda, y el clan de la cabecera contra el suyo. Y contra la trampa de
// mandar la misma captura otro dia: la firma (secuencia de tarjetas mas
// contadores de recursos, que cambian a cada rato) y el id unico del
// archivo en Telegram.
//
// Las estrellas se leen mal con facilidad (una vacia y una llena se
// parecen); el porcentaje no. Asi que manda el porcentaje: 100% son tres
// estrellas siempre, 0% ninguna, y entre medias se cree lo leido.

import { leerImagen } from './vision.js';
import { pedirPerfil } from './coc-perfil.js';
import { fotoDe, bajarFoto, parecidos } from './castillo-foto.js';

export const PUNTOS_FC = 5; // por captura valida
export const FC_MINIMO = 5; // desafios por captura
export const FC_ESTRELLAS = 2; // estrellas minimas para que cuente
export const FC_CAPTURAS_DIA = 1; // capturas validas al dia por persona

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const diaCuba = (d = new Date()) => d.toLocaleDateString('en-CA', { timeZone: 'America/Havana' });
const temporadaDe = (d = new Date()) => diaCuba(d).slice(0, 7);

/**
 * El pie de una foto que es el reto de FC, como lo dice la gente: "fc",
 * "mis fcs", "desafíos amistosos", "estuve entrenando", "practicando",
 * "reto", "friendly challenges".
 */
export function esFotoDeFC(pie) {
  const q = String(pie ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
  return /\b(fc|fcs|amistos[oa]s?|desafios?|retos?|entren(ar|ando|e|o|amos|aste)|practic(ar|ando|a|o|ue|amos|aste)|friendly|challenges?)\b/.test(q);
}

export const INSTRUCCIONES_FC = `Esta imagen debería ser una captura de pantalla de Clash of Clans con el chat del clan abierto (normalmente a la izquierda, con la aldea a la derecha).

En el chat, cada desafío amistoso terminado aparece como una tarjeta con: el nombre del atacante, una flecha roja, el nombre del defensor; debajo, tres estrellas (llenas o vacías) y el porcentaje de destrucción; y a la derecha un botón "Replay". Encima del chat hay una cabecera con el nombre del clan y "Online: N/M". En la parte de la aldea, arriba a la derecha, salen los contadores de oro, elixir, elixir oscuro y gemas.

Devuelve SOLO un objeto JSON con esta forma, compacto (en una sola línea, sin espacios ni saltos de línea), sin comentarios:
{
  "es_chat_del_clan": true o false,
  "clan": "nombre del clan de la cabecera tal como se lee, o null",
  "tarjetas": [
    { "atacante": "nombre tal como se lee", "defensor": "nombre tal como se lee", "estrellas": 0 a 3, "porcentaje": 0 a 100 }
  ],
  "contadores": { "oro": número o null, "elixir": número o null, "elixir_oscuro": número o null, "gemas": número o null }
}

Reglas:
- Las tarjetas van en el orden en que aparecen, de arriba abajo. Incluye solo las que tengan estrellas y porcentaje legibles; una tarjeta cortada por el borde sin esos datos no se incluye.
- "estrellas" es cuántas de las tres están llenas (doradas). "porcentaje" es el número que va junto a ellas.
- Copia los nombres letra a letra, con sus símbolos. No traduzcas nada.
- Si un dato no se lee con claridad, pon null. No adivines.
- Si la imagen no es del juego o no se ve el chat del clan, devuelve {"es_chat_del_clan": false, "clan": null, "tarjetas": [], "contadores": {}}.`;

const numero = (v) => {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : null;
};

/** Una tarjeta tal como la leyo el modelo, con las estrellas mandadas por el porcentaje. */
export function normalizarTarjeta(t) {
  const porcentaje = numero(t?.porcentaje);
  let estrellas = numero(t?.estrellas);
  if (porcentaje === 100) estrellas = 3;
  else if (porcentaje === 0) estrellas = 0;
  else if (porcentaje != null && porcentaje < 50 && estrellas != null) estrellas = Math.min(estrellas, 1);
  else if (porcentaje != null && estrellas != null) estrellas = Math.min(estrellas, 2);
  if (estrellas != null) estrellas = Math.max(0, Math.min(3, Math.round(estrellas)));
  return { atacante: t?.atacante ?? null, defensor: t?.defensor ?? null, estrellas, porcentaje };
}

/**
 * Cuenta lo que vale de la captura: tarjetas donde el atacante es quien
 * la manda, y de esas, las que llegan a las estrellas minimas.
 */
export function contarFC(lectura, nombreJugador, { minimo = FC_ESTRELLAS } = {}) {
  const j = lectura?.json;
  const crudas = Array.isArray(j?.tarjetas) ? j.tarjetas : [];
  const tarjetas = crudas.map(normalizarTarjeta);
  const mias = tarjetas.filter((t) => t.atacante && parecidos(t.atacante, nombreJugador));
  const buenas = mias.filter((t) => t.estrellas != null && t.estrellas >= minimo);
  return { total: tarjetas.length, mias: mias.length, buenas: buenas.length, tarjetas };
}

/**
 * La huella de la captura: la secuencia de tarjetas y los contadores de
 * recursos. Dos capturas distintas del mismo dia rara vez coinciden en
 * todo; la misma captura mandada dos veces, siempre.
 */
export function firmaFC(lectura) {
  const j = lectura?.json ?? {};
  const tarjetas = (Array.isArray(j.tarjetas) ? j.tarjetas : []).map(normalizarTarjeta).map((t) => `${t.estrellas ?? '?'}-${t.porcentaje ?? '?'}`);
  const c = j.contadores ?? {};
  const contadores = ['oro', 'elixir', 'elixir_oscuro', 'gemas'].map((k) => numero(c[k]) ?? '?');
  return `fc|${tarjetas.join(',')}|${contadores.join('/')}`;
}

/**
 * Lee la captura del reto de FC y, si cuadra, anota los puntos. Devuelve
 * { texto, verificado, id } para el grupo. Nunca tira.
 *
 * @param {object} admin
 * @param {{ token:string, msg:object, tgId:number, quien:string }} p  quien: nombre ya escapado
 */
export async function verificarFCConFoto(admin, { token, msg, tgId, quien }) {
  const hoy = diaCuba();

  // Ya tiene el de hoy.
  const { data: deHoy } = await admin
    .from('retos')
    .select('id, puntos')
    .eq('tg_user_id', tgId)
    .eq('tipo', 'fc')
    .gte('creado_en', `${hoy}T00:00:00-04:00`);
  if ((deHoy?.length ?? 0) >= FC_CAPTURAS_DIA) {
    return { texto: `Ya tienes el reto de desafíos amistosos de hoy, ${quien} (+${deHoy[0].puntos}). Mañana otro. 🏹`, verificado: false, id: null };
  }

  // Quien es en el juego: el nombre del atacante tiene que ser el suyo.
  const { data: v } = await admin.from('tg_vinculos').select('player_tag').eq('tg_user_id', tgId).maybeSingle();
  if (!v?.player_tag) {
    return { texto: `📷 Recibí la captura, ${quien}, pero no sé quién eres en el juego. Preséntate con <code>/soy TuNombre</code> y vuelve a mandarla.`, verificado: false, id: null };
  }
  const perfil = await pedirPerfil(v.player_tag);
  if (!perfil?.name) {
    return { texto: `📷 Ahora mismo no puedo consultar tu perfil en el juego, ${quien}. Prueba en un rato.`, verificado: false, id: null };
  }

  const foto = fotoDe(msg);
  const imagen = foto ? await bajarFoto(token, foto) : null;
  if (!imagen) return { texto: `📷 No pude bajar la captura (¿muy grande?). Mándala como foto normal, no como archivo.`, verificado: false, id: null };

  const lectura = await leerImagen(admin, { base64: imagen.base64, mime: imagen.mime, instrucciones: INSTRUCCIONES_FC, max_tokens: 450 });
  const j = lectura?.json;
  if (!j) return { texto: `📷 Ahora mismo no puedo leer la captura, ${quien}. Prueba en un rato.`, verificado: false, id: null };
  if (j.es_chat_del_clan === false) {
    return { texto: `📷 Eso no parece el chat del clan. Abre el chat donde salen los resultados de los desafíos amistosos y manda la captura con ${FC_MINIMO} seguidos.`, verificado: false, id: null };
  }
  // El clan de la cabecera NO se comprueba: el modelo lo confunde con el
  // nombre de la primera tarjeta (leyo «AVENTUS» donde decia x300), y no
  // hace falta: un desafio amistoso solo se ataca dentro del propio clan,
  // asi que unas tarjetas con tu nombre de atacante son de tu chat.

  const cuenta = contarFC(lectura, perfil.name);
  if (cuenta.buenas < FC_MINIMO) {
    const detalle = cuenta.total === 0
      ? 'no distingo ninguna tarjeta de desafío'
      : `veo ${cuenta.total} ${cuenta.total === 1 ? 'tarjeta' : 'tarjetas'}, ${cuenta.mias} con tu nombre (<b>${esc(perfil.name)}</b>) y ${cuenta.buenas} con ${FC_ESTRELLAS}⭐ o más`;
    return {
      texto: `📷 En la captura ${detalle}. El reto son ${FC_MINIMO} desafíos amistosos tuyos con ${FC_ESTRELLAS}⭐ o más en una sola captura; cuando los tengas, mándala.`,
      verificado: false,
      id: null,
    };
  }

  // La misma captura otro dia no vale.
  const firma = firmaFC(lectura);
  const { data: repetida } = await admin.from('retos').select('id, nombre, creado_en').eq('firma', firma).limit(1).maybeSingle();
  if (repetida) {
    return { texto: `📷 Esa captura ya se usó (${esc(repetida.nombre)}, ${String(repetida.creado_en).slice(0, 10)}). Manda una de hoy.`, verificado: false, id: null };
  }

  const nota = `foto: ${cuenta.buenas}/${cuenta.total} tarjetas con ${FC_ESTRELLAS}⭐+ de ${perfil.name}`;
  const { data: fila, error } = await admin
    .from('retos')
    .insert({
      temporada: temporadaDe(),
      tg_user_id: tgId,
      player_tag: v.player_tag,
      nombre: quien,
      tipo: 'fc',
      puntos: PUNTOS_FC,
      verificado: true,
      verificado_por: 'Heraldo (foto)',
      nota,
      firma,
    })
    .select('id')
    .single();
  if (error) {
    console.error(`[retos] ${error.message}`);
    return { texto: `No pude anotarlo, ${quien}. Díselo a un líder.`, verificado: false, id: null };
  }
  return {
    texto: `🏹 Reto cumplido, ${quien}: ${cuenta.buenas} desafíos amistosos con ${FC_ESTRELLAS}⭐ o más (${cuenta.tarjetas.filter((t) => t.atacante && parecidos(t.atacante, perfil.name)).map((t) => `${t.estrellas}⭐ ${t.porcentaje}%`).join(', ')}). +${PUNTOS_FC} puntos este mes.`,
    verificado: true,
    id: fila.id,
  };
}

/** Guarda con que mensaje contesto el bot, para poder quitarlo contestando ❌. */
export async function recordarMensajeReto(admin, id, mensajeBotId) {
  if (!id || !mensajeBotId) return;
  await admin.from('retos').update({ mensaje_bot_id: mensajeBotId }).eq('id', id);
}

/**
 * Un lider contesto ✅ o ❌ al mensaje de un reto. ❌ lo quita; ✅ no hace
 * falta (ya estaba verificado). Null si el mensaje no era de un reto.
 */
export async function decidirReto(admin, { mensajeBotId, confirmar, lider }) {
  const { data: fila } = await admin.from('retos').select('id, nombre, puntos, tipo').eq('mensaje_bot_id', mensajeBotId).maybeSingle();
  if (!fila) return null;
  if (confirmar) return `Ese reto ya estaba verificado (+${fila.puntos} para ${fila.nombre}).`;
  await admin.from('retos').delete().eq('id', fila.id);
  return `❌ ${lider} no da por bueno el reto de ${fila.nombre}. Se quitan esos ${fila.puntos} puntos.`;
}

/** Modo prueba, para administradores: que ve el modelo en una captura del chat, sin anotar nada. */
export async function leerChatDePrueba(admin, { token, msg }) {
  const foto = fotoDe(msg);
  const imagen = foto ? await bajarFoto(token, foto) : null;
  if (!imagen) return '🔍 No pude bajar la captura.';
  const lectura = await leerImagen(admin, { base64: imagen.base64, mime: imagen.mime, instrucciones: INSTRUCCIONES_FC, max_tokens: 450 });
  const j = lectura?.json;
  if (!j) return `🔍 No pude leerla (${lectura ? 'no devolvió JSON' : 'la IA no contestó'}).`;
  const tarjetas = (Array.isArray(j.tarjetas) ? j.tarjetas : []).map(normalizarTarjeta);
  const c = j.contadores ?? {};
  return (
    `🔍 <b>Prueba de lectura (chat del clan)</b> · ${esc(lectura.modelo)}\n` +
    `¿Chat del clan? ${j.es_chat_del_clan ? 'sí' : 'no'} · clan: ${esc(j.clan ?? '—')} · contadores: ${[c.oro, c.elixir, c.elixir_oscuro, c.gemas].map((x) => x ?? '?').join(' / ')}\n` +
    `Tarjetas (${tarjetas.length}): ` +
    (tarjetas.map((t) => `${esc(t.atacante ?? '?')} ➡ ${esc(t.defensor ?? '?')} ${t.estrellas ?? '?'}⭐ ${t.porcentaje ?? '?'}%`).join(' · ') || '—') +
    `\nFirma: <code>${esc(firmaFC(lectura))}</code>`
  );
}
