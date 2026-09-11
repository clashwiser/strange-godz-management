// Los puntos de disciplina por el castillo de guerra.
//
// La norma: cada uno llena el castillo del jugador de abajo antes del dia
// de batalla y lo dice en Telegram ("@Heraldo ya doné mi castillo"). Cada
// aviso vale puntos, y al final del mes el que mas tiene se lleva el
// premio de los puntos (lo publican los lideres; aqui no hay cantidades).
//
// Lo que se puede comprobar y lo que no: la API de Clash NO enseña que
// hay en un castillo de guerra -ni ClashPerk ni ClashKing lo ven-. Lo que
// si da es el contador de tropas donadas del jugador. Si subio desde el
// ultimo snapshot, dono ALGO desde entonces: se da por verificado y suman
// los puntos. Si no subio, o no se pudo mirar, queda pendiente y lo
// confirma un lider desde la pestaña Bonos. Con puntos de un premio
// mensual el incentivo a mentir es pequeño, y el que lo haga se lo
// encuentra un colider mirando el castillo.

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

/** El mes del premio: el de Cuba, igual que los bonos. */
export const temporadaDe = (d = new Date()) => d.toLocaleDateString('en-CA', { timeZone: 'America/Havana' }).slice(0, 7);
const diaCuba = (d = new Date()) => d.toLocaleDateString('en-CA', { timeZone: 'America/Havana' });

/**
 * Anota el aviso de castillo de quien lo dice. Devuelve el texto de la
 * respuesta para el grupo. Una vez al dia por persona: el castillo se
 * llena una vez por guerra.
 *
 * @param {object} admin  Supabase con service_role
 * @param {{ tgId:number, nombre:string, texto:string }} quien
 */
export async function anotarCastillo(admin, { tgId, nombre, texto }) {
  const temporada = temporadaDe();
  const hoy = diaCuba();

  const { data: deHoy } = await admin
    .from('castillos')
    .select('id, verificado, puntos')
    .eq('tg_user_id', tgId)
    .gte('creado_en', `${hoy}T00:00:00-04:00`)
    .limit(1)
    .maybeSingle();
  if (deHoy) {
    return deHoy.verificado
      ? `Ya tengo tu castillo de hoy anotado y verificado, ${nombre} (+${deHoy.puntos}). Mañana otro. 📜`
      : `Ya tengo tu castillo de hoy anotado, ${nombre}; lo confirma un líder y suman los puntos. 📜`;
  }

  // Quien es en el juego, si se presento con /soy.
  const { data: vinculo } = await admin.from('tg_vinculos').select('player_tag').eq('tg_user_id', tgId).maybeSingle();
  const tag = vinculo?.player_tag ?? null;

  let antes = null;
  let ahora = null;
  let verificado = false;
  if (tag) {
    const { data: snap } = await admin
      .from('snapshots')
      .select('donaciones, fecha')
      .eq('player_tag', tag)
      .order('fecha', { ascending: false })
      .limit(1)
      .maybeSingle();
    antes = snap?.donaciones ?? null;
    // Import dinamico: este modulo tambien lo usa el panel (la tabla de
    // puntos), y coc-perfil es solo del servidor.
    const { pedirPerfil } = await import('./coc-perfil');
    const perfil = await pedirPerfil(tag);
    ahora = perfil?.donations ?? null;
    // Subio desde el snapshot: dono algo. La temporada del juego reinicia
    // el contador el primer lunes del mes; ese dia "ahora" puede ser menor
    // que "antes" y no se puede afirmar nada.
    verificado = antes !== null && ahora !== null && ahora > antes;
  }

  const puntos = verificado ? PUNTOS_CASTILLO : 0;
  const { error } = await admin.from('castillos').insert({
    temporada,
    tg_user_id: tgId,
    player_tag: tag,
    nombre,
    mensaje: String(texto ?? '').slice(0, 200),
    donaciones_antes: antes,
    donaciones_ahora: ahora,
    verificado,
    verificado_por: verificado ? 'api' : null,
    puntos,
  });
  if (error) {
    console.error(`[castillos] ${error.message}`);
    return `No pude anotarlo, ${nombre}. Díselo a un líder.`;
  }

  if (verificado) {
    return `✅ Anotado, ${nombre}: castillo donado y verificado (la API te ve ${ahora - antes} tropas donadas desde el último parte). +${puntos} puntos este mes. 📜`;
  }
  if (!tag) {
    return `📜 Anotado, ${nombre}. No sé cuál es tu cuenta: preséntate con <code>/soy TuNombre</code> y la próxima te lo verifico solo. Por ahora lo confirma un líder.`;
  }
  return `📜 Anotado, ${nombre}. No veo donaciones nuevas en tu cuenta todavía; lo confirma un líder y suman los puntos.`;
}

/** La tabla del mes: puntos por persona, verificados, para el grupo o el panel. */
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
