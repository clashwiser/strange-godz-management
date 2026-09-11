// La wiki de Clash of Clans (clashofclans.fandom.com), por su API de
// MediaWiki: la fuente de MECANICAS. Que hace una tropa, cuanto dura, que
// le cambiaron y cuando.
//
// Existe porque la IA, preguntada por Throwers con Ruin Witches, se
// invento que la Ruin Witch "hace que los edificios pierdan vida" y metio
// un Mini P.E.K.K.A que es de Clash Royale. El modelo no conoce las
// tropas de 2026; la wiki si, y con fecha: su pagina de la Ruin Witch
// dice "August 31, 2026: Increased the number of Ruin Knights summoned at
// all levels from 8 to 10", que es exactamente lo que Cris sabia de jugar.
//
// Dos usos:
//   glosarioDesdeWiki()   la lista de entidades del juego (tropas,
//                         hechizos, heroes, equipamiento, asedios,
//                         mascotas, defensas) con sus nombres en ingles y,
//                         cuando la wiki lo tiene, en español. La guarda
//                         el job del meta en config.glosario_juego.
//   investigar(texto)     las paginas de las entidades que nombra un
//                         texto, en texto plano, para la IA.
//
// Se identifica con un User-Agent propio, que es lo que Fandom pide a los
// bots. Sin llave, sin coste.

const API = 'https://clashofclans.fandom.com/api.php';
const UA = 'StrangeGodzBot/1.0 (gestion de clan; contacto: cris13c15@outlook.com)';

const CATEGORIAS = [
  ['Elixir Troops', 'tropa'],
  ['Dark Elixir Troops', 'tropa'],
  ['Super Troops', 'tropa'],
  ['Spells', 'hechizo'],
  ['Heroes', 'heroe'],
  ['Hero Equipment', 'equipamiento'],
  ['Siege Machines', 'asedio'],
  ['Pets', 'mascota'],
  ['Defenses', 'defensa'],
  ['Traps', 'trampa'],
];

// Paginas de las categorias que no son una entidad: listas, altares,
// aspectos, y las variantes de Base del Constructor y Capital.
const NO_ENTIDAD = /\/|\bAltar\b|\bSkins?\b|^(Army|Troops|Spells|Heroes|Pets|Siege Machines|Defenses|Traps|Buildings|Elixir Troops|Dark Elixir Troops|Super Troops|Elixir Spells|Dark Spells|Clan Capital Spells|Hero Equipment)$/;

// Nombres en español que la wiki no tiene (tropas nuevas) o que la gente
// usa de otra forma. Sin tildes: se comparan sin ellas.
const ALIAS = {
  'Thrower': ['lancero', 'lanceros', 'throwers'],
  'Ruin Witch': ['ruin witches', 'bruja de ruina', 'bruja de la ruina', 'brujas de ruina', 'brujas de la ruina', 'bruja ruina'],
  'Meteor Golem': ['meteor golems', 'golem de meteorito', 'golems de meteorito', 'golem meteorito'],
  'Root Rider': ['root riders', 'jinete de raiz', 'jinetes de raiz', 'jinete raiz'],
  'Druid': ['druids', 'druida', 'druidas'],
  'Furnace': ['furnaces', 'horno'],
  'Apprentice Warden': ['aprendiz de guardian', 'aprendiz guardian'],
  'Totem Spell': ['totem', 'hechizo de totem'],
  'Super Bowler': ['super bowlers', 'superlanzarrocas', 'super lanzarrocas'],
  'Bowler': ['bowlers', 'lanzarrocas'],
  'Dragon Rider': ['dragon riders', 'montadragones'],
  'Electro Dragon': ['electro dragons', 'edrag', 'edrags', 'dragon electrico', 'dragones electricos', 'electrodragon', 'electrodragones'],
  'Lava Hound': ['lava hounds', 'lavahound', 'sabueso de lava', 'sabuesos de lava'],
  'Yeti': ['yetis'],
  'Super Yeti': ['super yetis', 'superyeti', 'superyetis'],
  'Super Witch': ['super witches', 'superbruja', 'superbrujas', 'super bruja', 'super brujas'],
  'Super Archer': ['super archers', 'superarquera', 'superarqueras', 'super arquera', 'super arqueras'],
  'Super Minion': ['super minions', 'superesbirro', 'superesbirros', 'super esbirro', 'super esbirros'],
  'Inferno Dragon': ['inferno dragons', 'dragon infernal', 'dragones infernales'],
  'Fireball': ['bola de fuego'],
  'Giant Arrow': ['flecha gigante'],
  'Ice Golem': ['ice golems', 'golem de hielo', 'golems de hielo'],
  'Electro Titan': ['electro titans', 'electrotitan', 'electrotitanes', 'titan electrico'],
  'Headhunter': ['headhunters', 'cazacabezas'],
};

async function api(params) {
  const u = new URL(API);
  for (const [k, v] of Object.entries({ format: 'json', redirects: 1, ...params })) u.searchParams.set(k, String(v));
  const r = await fetch(u, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new Error(`wiki ${r.status}`);
  return r.json();
}

const plano = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[.’']/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Las entidades del juego segun la wiki: [{ pagina, tipo, nombres }], con
 * `nombres` sin tildes ni mayusculas (ingles, español si la wiki lo tiene,
 * alias). Unas diez llamadas; se guarda en config y se renueva con el
 * job del meta.
 */
export async function glosarioDesdeWiki() {
  const porPagina = new Map();
  for (const [categoria, tipo] of CATEGORIAS) {
    const d = await api({ action: 'query', list: 'categorymembers', cmtitle: `Category:${categoria}`, cmlimit: 500, cmnamespace: 0 });
    for (const m of d.query?.categorymembers ?? []) {
      if (NO_ENTIDAD.test(m.title)) continue;
      if (!porPagina.has(m.title)) porPagina.set(m.title, { pagina: m.title, tipo, nombres: new Set([plano(m.title)]) });
    }
  }
  // Los nombres en español, de 50 en 50 (el tope de la API).
  const titulos = [...porPagina.keys()];
  for (let i = 0; i < titulos.length; i += 50) {
    const d = await api({ action: 'query', prop: 'langlinks', lllang: 'es', titles: titulos.slice(i, i + 50).join('|') });
    for (const p of Object.values(d.query?.pages ?? {})) {
      const e = porPagina.get(p.title);
      for (const l of p.langlinks ?? []) e?.nombres.add(plano(l['*']));
    }
  }
  for (const [pagina, alias] of Object.entries(ALIAS)) {
    const e = porPagina.get(pagina);
    if (e) for (const a of alias) e.nombres.add(plano(a));
  }
  return [...porPagina.values()].map((e) => ({ ...e, nombres: [...e.nombres].filter((n) => n.length >= 3) }));
}

/**
 * Que entidades del glosario nombra un texto, las mas largas primero (si
 * dice "super bowler" no cuenta tambien "bowler"). Puro.
 */
export function entidadesEn(texto, glosario, { max = 2 } = {}) {
  const q = ` ${plano(texto).replace(/[^a-z0-9ñ ]/g, ' ').replace(/\s+/g, ' ')} `;
  const halladas = [];
  const candidatos = (glosario ?? [])
    .flatMap((e) => e.nombres.map((n) => ({ n, e })))
    .filter(({ n }) => n.length >= 3)
    .sort((a, b) => b.n.length - a.n.length);
  let libre = q;
  for (const { n, e } of candidatos) {
    const patron = ` ${n} `;
    if (!libre.includes(patron)) continue;
    if (!halladas.includes(e)) halladas.push(e);
    libre = libre.split(patron).join(' ');
    if (halladas.length >= max) break;
  }
  return halladas;
}

// Las paginas ya leidas, seis horas: la de la Ruin Witch no cambia entre
// dos preguntas seguidas.
const cache = new Map();
const CACHE_MS = 6 * 3_600_000;

/** Una pagina de la wiki en texto plano: resumen, estrategia e historial. */
export async function paginaWiki(titulo, { maxTexto = 2200 } = {}) {
  const c = cache.get(titulo);
  if (c && Date.now() - c.en < CACHE_MS) return c.valor;
  const d = await api({ action: 'parse', page: titulo, prop: 'text|revid', disabletoc: 1 });
  const html = d.parse?.text?.['*'] ?? '';
  const texto = aTexto(html);
  // Lo que importa: del resumen hasta las estadisticas, y el historial de
  // cambios (fechas y que cambio), que es lo que el modelo no sabe.
  const cuerpo = recortar(texto, /\bSummary\b/, /\b(Upgrade Differences|Statistics)\b/, maxTexto);
  const historia = recortar(texto, /\bHistory\b/, /\b(Audio|Trivia|Comparisons|Gallery)\b/, 700);
  let actualizado = null;
  try {
    const r = await api({ action: 'query', prop: 'revisions', rvprop: 'timestamp', titles: titulo });
    actualizado = Object.values(r.query?.pages ?? {})[0]?.revisions?.[0]?.timestamp?.slice(0, 10) ?? null;
  } catch {
    /* sin fecha */
  }
  const valor = { titulo: d.parse?.title ?? titulo, actualizado, texto: `${cuerpo}${historia ? `\nCambios (History): ${historia}` : ''}`.trim() };
  cache.set(titulo, { en: Date.now(), valor });
  return valor;
}

export function recortar(texto, desde, hasta, tope) {
  const i = texto.search(desde);
  if (i < 0) return '';
  const resto = texto.slice(i);
  const j = resto.slice(12).search(hasta);
  return (j < 0 ? resto : resto.slice(0, j + 12)).slice(0, tope).trim();
}

export function aTexto(html) {
  return String(html ?? '')
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    // Los "[ edit ]" de cada seccion y las cajas de navegacion.
    .replace(/<span class="mw-editsection[\s\S]*?<\/span>\s*<\/span>|<span class="mw-editsection[\s\S]*?<\/span>/gi, ' ')
    .replace(/<table class="[^"]*(navbox|infobox)[^"]*"[\s\S]*?<\/table>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#8217;/g, "'")
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/\[\s*\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Lo que la wiki dice de las entidades que nombra un texto, listo para
 * la IA. Null si no nombra ninguna o la wiki no contesta.
 */
export async function investigar(texto, glosario) {
  const entidades = entidadesEn(texto, glosario);
  if (!entidades.length) return null;
  const partes = [];
  for (const e of entidades) {
    try {
      const p = await paginaWiki(e.pagina);
      if (p.texto) partes.push(`${p.titulo} (wiki de Clash of Clans, página actualizada el ${p.actualizado ?? '?'}):\n${p.texto}`);
    } catch (err) {
      console.error(`[wiki] ${e.pagina}: ${err.message}`);
    }
  }
  return partes.length ? partes.join('\n\n') : null;
}
