// Lo que dice Valquiria cuando le hablan en el grupo.
//
// Su oficio es elegir quien entra, y eso pasa en privado. En el grupo esta
// para dos cosas: explicar como se entra -que es la pregunta que mas se
// va a repetir- y tener personalidad, que es lo que hace que la gente se
// quede en un grupo. Todo lo demas -bases, estrellas, quien falta- es de
// Heraldo, y ella lo manda a el en vez de contestarlo a medias.
//
// Igual que el cerebro de Heraldo, esto NO es un modelo de lenguaje: son
// patrones y frases. Hablan como una cubana: dulce en la boca -mi cielo,
// mi vida, mi corazon- y firme en lo que dice.

const AL_AZAR = (l) => l[Math.floor(Math.random() * l.length)];

export const BOT_RECLUTA = 'Valqui_bot';

/** Minusculas y sin tildes, y fuera las menciones @. */
export const plano = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/@\w+/g, ' ')
    .trim();

const COMO_ENTRAR = [
  `Que me escriba en privado, mi cielo: <b>@${BOT_RECLUTA}</b>. Le hago cuatro preguntas, le pido que me enseñe cómo ataca y se lo paso a los líderes. Tres minutos.`,
  `Fácil, mi vida: abre <b>@${BOT_RECLUTA}</b>, le da a Empezar y me manda su tag. Yo miro cómo pelea, no las estrellas que tenga.`,
  `Dile que me busque: <b>@${BOT_RECLUTA}</b>. Aquí en el grupo no elijo a nadie; eso lo hago en privado, con su tag delante. ⚔️`,
];

const QUIEN_SOY = [
  `Soy Valquiria, mi cielo. Yo elijo quién entra al ejército de Strange Godz: miro cómo peleas y decido. Heraldo anuncia; yo elijo. ⚔️`,
  `La que abre la puerta, mi vida. Cada guerrero nuevo de aquí pasó por mí primero. Y a cada uno lo elegí por cómo pelea, no por sus estrellas ni por su cara bonita.`,
];

const PIROPOS = [
  `Ay, gracias, mi cielo. Pero yo me fijo en cómo atacas, no en los piropos. ⚔️`,
  `Qué lindo, mi vida. Ahora enséñame un tres estrellas y hablamos. 😄`,
  `Mi corazón, a mí me enamoran con ataques, no con palabras. Dona algo y te miro con otros ojos.`,
  `Tranquilo, cariño, que el hacha no es de adorno. 😉`,
];

const HERALDO = [
  `Heraldo es mi hermano de armas, mi cielo: él anuncia, yo elijo. No lo dejen mucho rato solo con la corneta.`,
  `A Heraldo lo quiero, mi vida, pero habla más que yo. Yo con el hacha y la lista me arreglo.`,
  `Él lleva el pergamino y yo llevo a la gente. Sin mí no tiene a quién anunciar. 😄`,
];

const SALUDOS = [
  `Aquí estoy, mi cielo. ¿Qué necesitas?`,
  `Dime, mi vida.`,
  `Presente, mi corazón. ⚔️`,
];

const GRACIAS = [`De nada, mi corazón.`, `Para eso estoy, mi cielo. ⚔️`, `Cuando quieras, mi vida.`];

const INSULTOS = [
  `Cuidado, mi cielo, que el hacha no es de adorno. 😄`,
  `Mira que yo también elijo quién sale, mi vida. 😉`,
  `Respira, mi corazón. Y ataca, que eso te calma.`,
];

const DE_HERALDO = [
  `Eso es cosa de Heraldo, mi vida. Pregúntale a él, que yo solo elijo quién entra.`,
  `Para eso está Heraldo, mi cielo: dile "Heraldo" y lo que quieras. Lo mío es la puerta.`,
];

const NO_ENTIENDO = [
  `Dime, mi cielo. Yo elijo quién entra: si alguien quiere unirse, que me escriba en privado a <b>@${BOT_RECLUTA}</b>.`,
  `No te entendí, mi vida. Lo mío es reclutar: si tienes a alguien para el clan, mándamelo a <b>@${BOT_RECLUTA}</b>.`,
];

/** Cuantos hay esperando, dicho con gracia. */
export const cuantosEsperan = (n) =>
  n === 0
    ? `Nadie en la puerta ahora mismo, mi cielo. Corre la voz: <b>@${BOT_RECLUTA}</b>.`
    : n === 1
      ? `Hay uno esperando a que un líder lo mire, mi vida. Que no se enfríe.`
      : `Hay ${n} esperando a que los líderes decidan, mi corazón. Que no se enfríen.`;

/**
 * Traduce lo que dijeron a una intencion.
 *   -> { tipo: 'decir', texto }        contesta esto
 *   -> { tipo: 'esperando' }           hay que contar las solicitudes
 *   -> null                            no es para ella
 */
export function entenderValquiria(texto) {
  // Fuera su nombre: si no, "valquiria como entra mi amigo" empieza por
  // "valquiria" y parece un saludo. Lo que quede es lo que quieren.
  const q = plano(texto).replace(/\bvalquiria?\b/g, ' ').replace(/\s+/g, ' ').trim();

  // Solo la nombraron, o un hola y ya.
  if (/^(hola|buenas|hey|oye|epa|que bola|saludos)?[!?.,¡¿ ]*$/.test(q)) {
    return { tipo: 'decir', texto: AL_AZAR(SALUDOS) };
  }

  // Lo que mas se va a preguntar: como entra alguien.
  if (/\b(entra|entrar|entro|entre|meter|meto|meta|reclut|unir|unirse|unirme|me uno|solicit|aplic|inscrib)\b/.test(q)) {
    return { tipo: 'decir', texto: AL_AZAR(COMO_ENTRAR) };
  }
  if (/(cuant[oa]s|hay|alguien)\b.*(esper|solicit|pendiente|cola|puerta)/.test(q)) {
    return { tipo: 'esperando' };
  }
  if (/(quien eres|que eres|que haces|para que sirves|presentate|quien es valqui)/.test(q)) {
    return { tipo: 'decir', texto: AL_AZAR(QUIEN_SOY) };
  }
  if (/(linda|bella|hermosa|preciosa|guapa|rica|sexy|bonita|mami|te amo|casate|novia|mi amor)/.test(q)) {
    return { tipo: 'decir', texto: AL_AZAR(PIROPOS) };
  }
  if (/heraldo/.test(q)) return { tipo: 'decir', texto: AL_AZAR(HERALDO) };
  if (/(mierda|basura|inutil|no sirves|tonta|estupida|callate)/.test(q)) {
    return { tipo: 'decir', texto: AL_AZAR(INSULTOS) };
  }
  if (/gracias/.test(q)) return { tipo: 'decir', texto: AL_AZAR(GRACIAS) };
  // Lo que es de Heraldo se manda a Heraldo, no se contesta a medias.
  if (/(base|layout|aldea|estrella|falta|resumen|cobro|premio|tabla|ranking)/.test(q)) {
    return { tipo: 'decir', texto: AL_AZAR(DE_HERALDO) };
  }
  return { tipo: 'decir', texto: AL_AZAR(NO_ENTIENDO) };
}

/** Cuando entra al grupo alguien que ella eligio. */
export const presentaElegido = (nombre, th) =>
  AL_AZAR([
    `⚔️ A este lo elegí yo: <b>${nombre}</b>, TH${th}. Trátenlo bien, que viene a probarse.`,
    `⚔️ Miren quién llegó: <b>${nombre}</b>, TH${th}. Pasó por mi puerta. Ahora que pase por la amistosa.`,
    `⚔️ <b>${nombre}</b>, TH${th}. Lo vi pelear y me gustó. Denle la bienvenida, mi gente.`,
  ]);

// ---------------------------------------------------------------------
// La bienvenida a quien entra al grupo. La da ella y no Heraldo: es la
// que elige quien entra, asi que es la que recibe. El {quien} se cambia
// por una mencion de verdad (tg://user?id=N), que le hace vibrar el
// telefono aunque no tenga @usuario.
//
// Le pide el nombre del juego con /soy, que es de Heraldo: ella no
// atiende comandos, pero el si, y asi los dos quedan presentados.
// ---------------------------------------------------------------------
export const BIENVENIDAS_VALQUIRIA = [
  `⚔️ Miren quién cruzó la puerta: {quien}.\n\nBienvenido, mi cielo. Soy Valquiria, la que elige quién entra aquí. Dile a Heraldo tu nombre del juego con <code>/soy TuNombre</code> y quedas en la lista.`,
  `⚔️ Llegó {quien}. Denle la bienvenida, mi gente.\n\nYo soy Valquiria, mi vida, y aquí se entra por mi puerta. Preséntate con <code>/soy TuNombre</code> para que Heraldo te tenga fichado.`,
  `⚔️ {quien} está con nosotros desde hoy.\n\nBienvenido, mi corazón. Soy Valquiria: yo recibo y Heraldo anuncia. Escribe <code>/soy TuNombre</code> con tu nombre de Clash y ya estás dentro de verdad.`,
  `⚔️ Se abre la puerta para {quien}.\n\nBienvenido a Strange Godz, cariño. Soy Valquiria y llevo la cuenta de los guerreros. Pon <code>/soy TuNombre</code> y te apunto.`,
  `⚔️ Uno más para la guerra: {quien}.\n\nBienvenido, mi cielo. Aquí Valquiria. Dime tu nombre del juego con <code>/soy TuNombre</code>, que sin eso no te puedo avisar cuando te toque atacar.`,
  `⚔️ {quien}, bienvenido.\n\nSoy Valquiria, mi vida: la que elige quién entra al ejército de los Godz. Preséntate con <code>/soy TuNombre</code> y Heraldo te anota en el pergamino.`,
];

// Cuando entran varios de golpe. Tres y no seis porque el caso es raro;
// lo que no puede es sonar mal.
export const BIENVENIDAS_VALQUIRIA_VARIOS = [
  `⚔️ Miren quiénes cruzaron la puerta: {quien}.\n\nBienvenidos, mis cielos. Soy Valquiria, la que elige quién entra aquí. Cada uno dígale a Heraldo su nombre del juego con <code>/soy TuNombre</code>.`,
  `⚔️ Llegaron {quien}. Denles la bienvenida, mi gente.\n\nYo soy Valquiria, y aquí se entra por mi puerta. Preséntense con <code>/soy TuNombre</code> para quedar en la lista.`,
  `⚔️ Se abre la puerta para {quien}.\n\nBienvenidos a Strange Godz. Soy Valquiria y llevo la cuenta de los guerreros. Pongan <code>/soy TuNombre</code> y los apunto.`,
];

export const bienvenidaValquiria = (varios = false) =>
  AL_AZAR(varios ? BIENVENIDAS_VALQUIRIA_VARIOS : BIENVENIDAS_VALQUIRIA);
