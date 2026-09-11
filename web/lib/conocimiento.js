// Que preguntas son "de conocimiento del juego": las que se contestan
// buscando en la web, no con una frase del cerebro ni con la base de
// datos del clan.
//
// Existe porque Cris le pregunto a Valquiria cual era el mejor ejercito
// del momento y ella contesto que eso lo sabia Heraldo con /faltan. El
// meta de Clash cambia con cada actualizacion: ni las frases ni un modelo
// con fecha de corte lo saben. Hay que buscarlo.
//
// Puro: sin red, sin base. Se prueba en test/conocimiento.test.js.

const plano = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/@\w+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

// Tiene que PREGUNTAR: signo de interrogacion, o empezar como pregunta o
// como peticion ("dime", "recomiendame").
const PREGUNTA =
  /\?|^(que|cual|cuales|como|cuando|cuanto|cuanta|cuantos|donde|hay|existe|sirve|vale|conviene|merece|recomienda|recomiendame|me recomiendas|dime|dame|explica|explicame|ensename|sabes|conoces)\b/;

// Y tiene que ser DEL JUEGO: tropas, hechizos, heroes, niveles, meta,
// actualizaciones. Sin "valquiria": es una tropa, pero tambien es ella, y
// "Valquiria, ¿sabes bailar?" no es una pregunta de Clash.
const JUEGO =
  /\b(ejercito|ejercitos|tropa|tropas|hechizo|hechizos|estrategia|estrategias|meta|ataque|ataques|atacar|th ?\d{1,2}|ayuntamiento|heroe|heroes|equipamiento|equipamientos|mascota|mascotas|evento|eventos|actualizacion|update|parche|pase de|temporada|liga de leyendas|capital|raid|raids|super ?[a-z]+|lalo|hydra|zapquake|dragon|dragones|edrag|electro|gemas|constructor|laboratorio|mejorar|mejora|subir|nivel|niveles|estadisticas|stats|cambios|nerf|buff|balance|defensa|defensas|muro|muros|torre|torres|asedio|maquina|maquinas|castillo|arquera|arqueras|gigante|gigantes|globo|globos|sabueso|sabuesos|lavahound|yeti|yetis|minero|mineros|bruja|brujas|golem|golems|pekka|curandera|curanderas|mago|magos|barbaro|barbaros|duende|duendes|esbirro|esbirros|montapuercos|puercos|hog|titan|titanes|reina|rey|guardian|centinela|campeona|principe|clash of clans|coc|supercell)\b/;

// Lo que NO se busca en la web: los datos de ESTE clan, que los saben los
// comandos de Heraldo, y lo de "nosotros", que es del grupo.
const DEL_CLAN =
  /\b(base|bases|layout|falta|faltan|sin atacar|estrellas de|tabla|ranking|premio|premios|bono|bonos|cobro|cobrar|alineacion|alineado|mi clan|que clan|quien es|ficha|jugador|vamos|estamos|nuestro|nuestra|nosotros)\b/;

/** True si conviene buscar en la web para contestar bien. */
export function esPreguntaDelJuego(texto) {
  const q = plano(texto);
  if (!q || DEL_CLAN.test(q)) return false;
  return PREGUNTA.test(q) && JUEGO.test(q);
}
