// Los textos de reclutamiento de x300 para los grupos de Facebook: uno por
// grupo y por dia de la semana, con los numeros del clan puestos el dia
// del post (nivel, guerras ganadas, racha, TH18) desde la API. Puro: sin
// red. Lo pidio Cris el 21 sep 2026; sus reglas:
//
//   - Sin rayas largas (—): "lo primero que da a ver es que es AI".
//   - Sin la palabra "bots" (modera Facebook): "automatizacion", "avisos".
//   - Primero el enlace de Telegram (filtra), debajo el del clan.
//   - Adultos y responsables; no es clan de farming.
//   - Los premios son varios, por tareas: subir a Leyenda I, primero en la
//     liga, mejor atacante de guerra...
//   - Gente de Cuba, Latinoamerica e internacionales.
//   - "Se busca jugador", no "guerrero".

export const TELEGRAM = 'https://t.me/Valqui_bot';
export const CLAN = 'https://link.clashofclans.com/en?action=OpenClanProfile&tag=2GC';
export const TAG = '#2GC';

/** Los grupos, por dia de la semana (0 = domingo). Empieza el lunes 21 sep 2026. */
export const GRUPOS = [
  { dia: 1, nombre: 'Clash of Clans Recruitment', url: 'https://www.facebook.com/groups/683495443353463/', idioma: 'en', texto: 1 },
  { dia: 2, nombre: 'Comunidad Latina de Clash of Clans', url: 'https://www.facebook.com/groups/425293234783579/', idioma: 'es', texto: 2 },
  { dia: 3, nombre: 'Clash of Clans Latinoamerica', url: 'https://www.facebook.com/groups/1393253767633429/', idioma: 'es', texto: 3 },
  { dia: 4, nombre: 'Reclutamiento de Clash of Clans', url: 'https://www.facebook.com/groups/967283530338171/', idioma: 'es', texto: 4 },
  { dia: 5, nombre: 'Reclutamiento de clanes', url: 'https://www.facebook.com/groups/2749108748644005/', idioma: 'es', texto: 5 },
  { dia: 6, nombre: 'Clash Of Clans - En Español', url: 'https://www.facebook.com/groups/436752439771326/', idioma: 'es', texto: 6 },
  { dia: 0, nombre: 'Clash of Clans Recruiting Worldwide', url: 'https://www.facebook.com/groups/262980115707653/', idioma: 'en', texto: 7 },
];

/** Las dos imagenes se alternan: un dia la vertical, otro la ancha. */
export const IMAGENES = ['web/public/reclutamiento-x300.jpg', 'web/public/reclutamiento-x300-ancho.jpg'];

/**
 * Lo que dice la API del clan, reducido a lo que usan los textos.
 * @param {object} clan  /clans/{tag} de la API
 */
export function datosDe(clan) {
  const miembros = clan?.memberList ?? [];
  return {
    nivel: clan?.clanLevel ?? null,
    victorias: clan?.warWins ?? null,
    racha: clan?.warWinStreak ?? 0,
    miembros: clan?.members ?? miembros.length,
    th18: miembros.filter((m) => (m.townHallLevel ?? 0) >= 18).length,
    liga: clan?.warLeague?.name ?? null,
  };
}

const ligaES = (l) => (l ? l.replace('Champion League', 'Champion').replace('Master League', 'Master').replace('Crystal League', 'Crystal') : 'Champion I');
const ligaEN = (l) => l ?? 'Champion League I';

// La racha solo se presume si es racha; con menos de 5, otra frase.
const rachaES = (r) => (r >= 5 ? `racha de ${r} guerras ganadas seguidas` : 'guerra tras guerra');
const rachaEN = (r) => (r >= 5 ? `a ${r}-war winning streak` : 'wars back to back');

const pie = (idioma) =>
  idioma === 'en'
    ? `📲 Join us on Telegram: ${TELEGRAM}\n🏰 Clan: ${CLAN}`
    : `📲 Entra por Telegram: ${TELEGRAM}\n🏰 Clan: ${CLAN}`;

/**
 * El texto numero `n` (1..7) con los datos puestos.
 * @param {number} n
 * @param {ReturnType<typeof datosDe>} d
 */
export function textoDe(n, d) {
  const nivel = d.nivel ?? 25;
  const victorias = d.victorias ?? 437;
  const liga = ligaES(d.liga);
  const ligaEn = ligaEN(d.liga);
  const textos = {
    1:
      `⚔️ x300 is recruiting · Strange Godz Alliance\n\n` +
      `One of the first clans in Clash history: est. 2012, clan tag ${TAG} (three characters, that's how old we are). Level ${nivel}, CWL ${ligaEn}, ${victorias} war wins and ${rachaEN(d.racha)}. Wars always on.\n\n` +
      `Looking for: TH18, Legend League III or higher, adults, responsible, active every day, both war attacks used. War and push clan, not a farming clan.\n\n` +
      `What you get: $80 in prizes every month, split into several awards: reaching Legend I, finishing first in the league, best war attacker and more. Plus a Telegram community with automatic war alerts, rankings and free top base layouts, and leaders who've been here since 2012.\n\n` +
      pie('en'),
    2:
      `🏰 x300 recluta · Strange Godz Alliance\n\n` +
      `Somos uno de los primeros clanes de la historia de Clash: fundados en 2012, tag ${TAG}. Nivel ${nivel}, Liga de Guerra ${liga}, ${victorias} guerras ganadas y ${rachaES(d.racha)}. Guerra siempre.\n\n` +
      `Buscamos TH18 en Liga Leyenda III o más: adultos, responsables, activos, que usen los dos ataques y quieran subir. No somos clan de farming.\n\n` +
      `Damos $80 en premios cada mes repartidos en varias tareas: subir a Leyenda I, terminar primero en la liga, ser el mejor atacante de guerra y más. Comunidad en Telegram con avisos automáticos de guerra, ranking de premios y bases top gratis (layouts), y líderes de la vieja escuela.\n\n` +
      pie('es'),
    3:
      `⚡ ¿TH18 en Leyenda III o más y sin un clan a tu altura? x300 te busca.\n\n` +
      `Clan OG de 2012 (tag ${TAG}, de los primeros que existieron), nivel ${nivel}, ${liga} en liga de guerra, ${victorias} guerras ganadas y ${rachaES(d.racha)}. Aquí se ataca en serio: los dos ataques, siempre. Adultos y responsables; esto no es farming.\n\n` +
      `Lo que hay dentro: $80 al mes en varios premios (subir a Leyenda I, primero en la liga, mejor atacante de guerra y más), avisos automáticos por Telegram para que no se te pase ningún ataque, bases top gratis (layouts), y una alianza de cinco clanes con gente de Cuba, de toda Latinoamérica e internacionales.\n\n` +
      pie('es'),
    4:
      `🎖 Se busca jugador TH18 · Liga Leyenda III o más\n\n` +
      `x300 · Strange Godz Alliance. Fundado en 2012 (tag ${TAG}), nivel ${nivel}, CWL ${liga}, ${victorias} victorias en guerra y ${rachaES(d.racha)}. Guerra tras guerra, sin descanso.\n\n` +
      `Pedimos: adultos responsables, actividad diaria, los dos ataques en cada guerra, ganas de subir. No es clan de farming.\n` +
      `Damos: $80 al mes en premios por tareas (Leyenda I, primero en la liga, mejor atacante de guerra y más), comunidad en Telegram con avisos y rankings automáticos y bases top gratis (layouts), y respeto de clan viejo.\n\n` +
      pie('es'),
    5:
      `🏆 $80 en premios cada mes, repartidos por tareas: subir a Leyenda I, terminar primero en la liga, ser el mejor atacante de guerra y más.\n\n` +
      `Eso es x300 (Strange Godz Alliance), uno de los primeros clanes de Clash of Clans: desde 2012, tag ${TAG}. Nivel ${nivel}, ${liga} en liga de guerra, ${victorias} guerras ganadas, ${rachaES(d.racha)}.\n\n` +
      `Solo TH18 en Liga Leyenda III o superior, adultos y responsables, de guerra y push. Nada de farming ni de turistas. Comunidad en Telegram con avisos automáticos, ranking de premios y bases top gratis (layouts).\n\n` +
      pie('es'),
    6:
      `📜 Un clan con 14 años de historia busca jugadores TH18.\n\n` +
      `x300, tag ${TAG}, fundado en 2012: de los primeros clanes que hubo en el juego. Hoy: nivel ${nivel}, CWL ${liga}, ${victorias} guerras ganadas, ${rachaES(d.racha)}, guerra siempre. Formamos parte de Strange Godz Alliance, cinco clanes con líderes de la vieja escuela y gente de Cuba, Latinoamérica e internacionales.\n\n` +
      `Buscamos TH18 en Leyenda III o más, adultos, responsables y competitivos: dos ataques por guerra, sin excusas. No es clan de farming.\n` +
      `Ofrecemos $80 al mes en varios premios (Leyenda I, primero en la liga, mejor atacante de guerra y más) y una comunidad en Telegram con avisos y rankings automáticos y bases top gratis (layouts).\n\n` +
      pie('es'),
    7:
      `🔥 TH18 · Legend III+ · x300 wants you\n\n` +
      `Strange Godz Alliance, clan x300: est. 2012, tag ${TAG}, level ${nivel}, CWL ${ligaEn}, ${victorias} war wins, ${rachaEN(d.racha)}. Wars 24/7. Players from Cuba, Latin America and around the world (yes, Australia too).\n\n` +
      `We want adult, responsible TH18s who use both attacks and want to climb. Not a farming clan. We give $80 in monthly prizes split across several awards (Legend I, first in the league, best war attacker and more), plus a Telegram community with automatic war alerts, rankings and free top base layouts, run by leaders who've done this for 14 years.\n\n` +
      pie('en'),
  };
  return textos[n];
}

/** El grupo que toca en una fecha, o null si no hay (nunca: son siete). */
export function grupoDelDia(fecha = new Date()) {
  const dia = new Date(fecha).getDay();
  return GRUPOS.find((g) => g.dia === dia) ?? null;
}

/**
 * El grupo donde publicar hoy respetando "cada grupo una vez por semana":
 * el que toca por dia de la semana, salvo que ya tenga un post en los
 * ultimos seis dias (`recientes`: nombres de grupos con post reciente,
 * pendientes incluidos; los fallos no cuentan). Entonces sigue la rotacion
 * desde mañana y toma el primer grupo sin post reciente. Si los siete
 * tienen post reciente, no hay grupo y `motivo` lo dice.
 *
 * Asi la rotacion se recompone sola cuando un dia se publica fuera de
 * turno (el 21 sep 2026, lunes, el post fue al grupo del martes porque el
 * del lunes no deja publicar a la Pagina).
 */
export function elegirGrupo(fecha = new Date(), recientes = []) {
  const usados = new Set(recientes);
  const dia = new Date(fecha).getDay();
  const delDia = grupoDelDia(fecha);
  if (delDia && !usados.has(delDia.nombre)) return { grupo: delDia, motivo: null };
  for (let k = 1; k < 7; k += 1) {
    const g = GRUPOS.find((x) => x.dia === (dia + k) % 7);
    if (g && !usados.has(g.nombre)) {
      return { grupo: g, motivo: `${delDia?.nombre ?? 'el grupo de hoy'} ya tuvo post esta semana; toca ${g.nombre}` };
    }
  }
  return { grupo: null, motivo: 'los siete grupos ya tuvieron post en los últimos seis días' };
}

/** La imagen que toca: alterna por dia del año, para no repetir dos seguidas. */
export function imagenDelDia(fecha = new Date()) {
  const d = new Date(fecha);
  const inicio = new Date(d.getFullYear(), 0, 0);
  const diaDelAno = Math.floor((d - inicio) / 86400000);
  return IMAGENES[diaDelAno % IMAGENES.length];
}
