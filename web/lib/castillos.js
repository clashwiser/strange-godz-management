// Los puntos de disciplina por el castillo de guerra.
//
// La norma: cada uno llena el castillo del jugador de abajo antes del dia
// de batalla y lo dice en Telegram ("@Heraldo ya doné mi castillo"). Cada
// aviso confirmado vale puntos, y al final del mes el que mas tiene se
// lleva el premio de los puntos (lo publican los lideres; aqui no hay
// cantidades).
//
// Lo que NO se puede comprobar solo: la API de Clash no enseña que hay en
// un castillo de guerra -ni ClashPerk ni ClashKing lo ven-, y las
// donaciones al castillo de guerra NO suben el contador de tropas donadas
// del jugador (lo dijo Cris; en Reddit lleva anos pidiendose que cuenten).
// La primera version de esto miraba ese contador y era una comprobacion
// falsa. Asi que confirma un lider, que es el que puede mirar el castillo
// en el juego: contestando ✅ al aviso en Telegram, o en la pestaña Bonos.
// Con puntos de un premio mensual el incentivo a mentir es pequeño, y el
// que lo haga se lo encuentra un colider mirando el castillo.

export const PUNTOS_CASTILLO = 5;

const plano = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/** "ya doné mi castillo", "castillo donado", "listo el castillo de guerra". */
export function avisaCastillo(texto) {
  const q = plano(texto);
  if (!/\bcastillo/.test(q)) return false;
  return /\b(done|dono|donado|donada|lleno|llene|llenado|listo|lista|puesto|puse|completo|complete|cargado|cargue)\b/.test(q);
}

/** Lo que dice un lider al confirmar contestando al aviso: ✅, ok, confirmado... */
export function confirmaCastillo(texto) {
  const q = plano(texto).trim();
  return /^(✅|👍|ok|okey|confirmado|confirmo|verificado|visto|listo|si|sí|dale|correcto)\b/.test(q) || /^[✅👍]+$/.test(q);
}

/** Y al rechazarlo: ❌, no, falso, no donó... */
export function rechazaCastillo(texto) {
  const q = plano(texto).trim();
  return /^(❌|👎|no|falso|mentira|no dono|no lo dono|vacio|vacío)\b/.test(q) || /^[❌👎]+$/.test(q);
}

/** El mes del premio: el de Cuba, igual que los bonos. */
export const temporadaDe = (d = new Date()) => d.toLocaleDateString('en-CA', { timeZone: 'America/Havana' }).slice(0, 7);
const diaCuba = (d = new Date()) => d.toLocaleDateString('en-CA', { timeZone: 'America/Havana' });

/**
 * Anota el aviso de castillo de quien lo dice. Devuelve { texto, id, fila,
 * existente }: el texto para el grupo, la fila (para cruzarla con una
 * foto), y el id para guardar despues el del mensaje con que el bot
 * contesto (asi un lider confirma respondiendo a ese mensaje). Una vez al
 * dia por persona: el castillo se llena una vez por guerra; si ya habia
 * aviso de hoy, `existente` viene a true y se devuelve esa fila.
 *
 * @param {object} admin  Supabase con service_role
 * @param {{ tgId:number, nombre:string, texto:string }} quien
 */
export async function anotarCastillo(admin, { tgId, nombre, texto }) {
  const temporada = temporadaDe();
  const hoy = diaCuba();

  const { data: deHoy } = await admin
    .from('castillos')
    .select('id, verificado, puntos, player_tag, mensaje_bot_id')
    .eq('tg_user_id', tgId)
    .gte('creado_en', `${hoy}T00:00:00-04:00`)
    .limit(1)
    .maybeSingle();
  if (deHoy) {
    return {
      id: deHoy.id,
      existente: true,
      fila: { ...deHoy, tg_user_id: tgId, nombre },
      texto: deHoy.verificado
        ? `Ya tengo tu castillo de hoy anotado y confirmado, ${nombre} (+${deHoy.puntos}). Mañana otro. 📜`
        : `Ya tengo tu castillo de hoy anotado, ${nombre}; en cuanto un líder lo confirme suman los puntos. 📜`,
    };
  }

  // Quien es en el juego, si se presento con /soy: para que el lider sepa
  // que castillo mirar.
  const { data: vinculo } = await admin.from('tg_vinculos').select('player_tag').eq('tg_user_id', tgId).maybeSingle();

  const { data: fila, error } = await admin
    .from('castillos')
    .insert({
      temporada,
      tg_user_id: tgId,
      player_tag: vinculo?.player_tag ?? null,
      nombre,
      mensaje: String(texto ?? '').slice(0, 200),
    })
    .select('id')
    .single();
  if (error) {
    console.error(`[castillos] ${error.message}`);
    return { id: null, texto: `No pude anotarlo, ${nombre}. Díselo a un líder.` };
  }
  return {
    id: fila.id,
    existente: false,
    fila: { id: fila.id, tg_user_id: tgId, player_tag: vinculo?.player_tag ?? null, nombre, verificado: false, puntos: 0, mensaje_bot_id: null },
    texto:
      `📜 Anotado, ${nombre}: castillo de guerra donado. ` +
      `Manda una captura del mapa de guerra donde se vea el castillo de abajo lleno y lo verifico yo; si no, un líder lo confirma contestando ✅ a este mensaje (o desde el panel). Suman +${PUNTOS_CASTILLO} puntos este mes.` +
      (vinculo?.player_tag ? '' : ` Preséntate con <code>/soy TuNombre</code> para que sepan qué castillo mirar.`),
  };
}

/**
 * Un lider contesto al aviso del bot. Busca la fila por el id de ese
 * mensaje y la confirma (o la quita). Devuelve el texto para el grupo, o
 * null si el mensaje no era un aviso de castillo.
 */
export async function decidirCastillo(admin, { mensajeBotId, confirmar, lider }) {
  const { data: fila } = await admin
    .from('castillos')
    .select('id, nombre, verificado, puntos')
    .eq('mensaje_bot_id', mensajeBotId)
    .maybeSingle();
  if (!fila) return null;
  if (confirmar) {
    if (fila.verificado) return `Ese ya estaba confirmado (+${fila.puntos} para ${fila.nombre}).`;
    await admin
      .from('castillos')
      .update({ verificado: true, puntos: PUNTOS_CASTILLO, verificado_por: lider })
      .eq('id', fila.id);
    return `✅ Confirmado por ${lider}: +${PUNTOS_CASTILLO} puntos para ${fila.nombre}. 📜`;
  }
  await admin.from('castillos').delete().eq('id', fila.id);
  return `❌ ${lider} no da por bueno el castillo de ${fila.nombre}. Sin puntos esta vez.`;
}

/** Guarda con que mensaje contesto el bot, para poder confirmarlo por respuesta. */
export async function recordarMensaje(admin, id, mensajeBotId) {
  if (!id || !mensajeBotId) return;
  await admin.from('castillos').update({ mensaje_bot_id: mensajeBotId }).eq('id', id);
}

/** La tabla del mes: puntos por persona, confirmados, para el grupo o el panel. */
export function tablaPuntos(filas) {
  const por = new Map();
  for (const f of filas ?? []) {
    if (!f.verificado) continue;
    const k = f.tg_user_id;
    const p = por.get(k) ?? { nombre: f.nombre, puntos: 0, veces: 0 };
    p.puntos += f.puntos ?? 0;
    p.veces += 1;
    p.nombre = f.nombre || p.nombre;
    por.set(k, p);
  }
  return [...por.values()].sort((a, b) => b.puntos - a.puntos || b.veces - a.veces);
}
