// Mirar de verdad a quien pide entrar.
//
// Una solicitud donde el aspirante escribe lo bueno que es no sirve para
// nada: todo el mundo dice que ataca siempre y que dona mucho. Pero si da
// su TAG, la API de Supercell cuenta la verdad y no se puede maquillar.
//
// La pieza que lo cambia todo son los LOGROS, que son totales de por vida
// y no se resetean cada temporada como donations:
//
//   Friend in Need      capacidad de tropas donada en toda su vida
//   War Hero            estrellas de guerra de toda su vida
//   War League Legend   estrellas de CWL de toda su vida
//   Games Champion      puntos de Juegos del Clan
//
// Alguien con "Friend in Need" en 500 no es que este flojo este mes: es
// que no ha donado nunca. Eso es justo lo que la pestaña Salud descubre
// cuando ya es tarde, y aqui se ve ANTES de invitarlo.
//
// Los umbrales no son inventados: salen de medir a los 59 jugadores de la
// alianza el 10 de septiembre de 2026.
//
//   donado de por vida    p10 34.905   mediana 371.871   max 5.301.117
//   estrellas de guerra   p10    825   mediana   3.388   max     6.480
//   estrellas de CWL      p10     55   mediana   1.081   max     1.551
//
// Por eso "casi no ha donado nunca" corta en 25.000 y no en un numero
// bonito: por debajo de ahi esta por debajo del mas flojo de los nuestros
// que si juega.
//
// Y por eso NO se marca a quien tenga pocas estrellas de CWL aunque el
// numero asuste: nuestro propio p10 es 55, o sea que un tercio de la casa
// tampoco las tiene. Un filtro que suspende a los de dentro no es filtro.

// Los tags de Clash solo usan estas catorce letras y numeros. Comprobado
// contra los 68 tags de la alianza: ni uno se sale.
const ALFABETO = '0289PYLQGRJCUV';
// Con almohadilla: es como lo copia el juego, y no hay forma de confundirlo.
const CON_ALMOHADILLA = new RegExp(`#\\s*([${ALFABETO}O]{3,12})\\b`, 'i');
// Sin ella hay que apretar mucho mas: palabra suelta, entera del alfabeto y
// de cinco letras para arriba. Si no, "CULO" -que despues de cambiar la O
// por un cero queda CUL0- se colaria como tag.
const SUELTO = new RegExp(`(?:^|\\s)([${ALFABETO}O]{5,12})(?=$|\\s|[.,!?])`, 'i');

const DONADO_MINIMO = 25000;
const GUERRA_MINIMA = 500;
const NIVEL_CUENTA_NUEVA = 60;

/**
 * Saca el tag de una frase suelta: la gente escribe "mi tag es #ABC123",
 * o lo pega con el # ya puesto, o sin el.
 */
export function leerTag(texto) {
  const t = String(texto ?? '').toUpperCase();
  const m = CON_ALMOHADILLA.exec(t) || SUELTO.exec(t);
  // La O y el cero se confunden al copiarlos a mano, y en los tags de Clash
  // no existe la letra O: si hay una, es un cero.
  return m ? `#${m[1].replace(/O/g, '0')}` : null;
}

/** Valor de un logro, o 0. La API los devuelve como lista, no como objeto. */
export const logro = (p, nombre) =>
  (p?.achievements ?? []).find((a) => a.name === nombre)?.value ?? 0;

/**
 * Lo que hay que mirar de un aspirante, ya masticado.
 *
 * Se queda con poco a proposito: el perfil crudo trae tropas, heroes,
 * hechizos y hasta la casa del jugador, y guardar eso entero en cada
 * solicitud es llenar la tabla de ruido.
 */
export function resumir(p) {
  return {
    tag: p.tag,
    nombre: p.name,
    th: p.townHallLevel,
    nivel: p.expLevel,
    trofeos: p.trophies,
    mejorTrofeos: p.bestTrophies,
    guerraEncendida: p.warPreference === 'in',
    donadoVida: logro(p, 'Friend in Need'),
    guerraVida: logro(p, 'War Hero'),
    cwlVida: logro(p, 'War League Legend'),
    juegosVida: logro(p, 'Games Champion'),
    capital: p.clanCapitalContributions ?? 0,
    etiquetas: (p.labels ?? []).map((l) => l.name),
    clan: p.clan ? { tag: p.clan.tag, nombre: p.clan.name, nivel: p.clan.clanLevel } : null,
    rol: p.role ?? null,
  };
}

/**
 * Lo que un lider tiene que saber antes de decidir. Pocas banderas y que
 * signifiquen algo: una lista de doce avisos no la lee nadie y acaba
 * aceptandose todo a ciegas, que es como estabamos.
 */
export function banderas(r) {
  const b = [];

  // Para un clan de guerra esta es LA pregunta, y ademas se arregla en
  // dos toques dentro del juego: no es motivo para decir que no, es una
  // cosa que decirle antes de invitarlo.
  if (!r.guerraEncendida) b.push({ txt: 'tiene la guerra apagada', grave: true });

  if (r.donadoVida < DONADO_MINIMO) b.push({ txt: 'casi no ha donado nunca', grave: true });
  if (r.guerraVida < GUERRA_MINIMA) b.push({ txt: 'poca guerra jugada', grave: false });
  if (r.nivel < NIVEL_CUENTA_NUEVA) b.push({ txt: 'cuenta nueva', grave: false });
  if (r.clan) b.push({ txt: `está en ${r.clan.nombre}`, grave: false });

  return b;
}

const miles = (n) => Number(n ?? 0).toLocaleString('es-ES');

/** La ficha tal como la ve el lider en Telegram. HTML de Telegram. */
export function ficha(r, esc = (s) => s) {
  const b = banderas(r);
  return (
    `<b>${esc(r.nombre)}</b> · <code>${esc(r.tag)}</code>\n` +
    `TH${r.th} · nivel ${r.nivel} · mejor ${miles(r.mejorTrofeos)} 🏆\n\n` +
    `⚔️ Guerra: <b>${miles(r.guerraVida)}</b> estrellas de por vida\n` +
    `🏅 CWL: <b>${miles(r.cwlVida)}</b> estrellas\n` +
    `🎁 Donado: <b>${miles(r.donadoVida)}</b> de por vida\n` +
    `🎮 Juegos del clan: <b>${miles(r.juegosVida)}</b>\n` +
    `🏛 Capital: <b>${miles(r.capital)}</b>\n` +
    (r.etiquetas.length ? `🏷 ${esc(r.etiquetas.join(', '))}\n` : '') +
    (b.length ? `\n${b.map((x) => `${x.grave ? '🔴' : '🟡'} ${esc(x.txt)}`).join('\n')}` : '\n✅ Sin banderas')
  );
}
