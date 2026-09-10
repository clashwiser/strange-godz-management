// El cerebro de Heraldo: lo que contesta cuando le hablan y no le estan
// pidiendo un dato.
//
// Por que NO hay un modelo de lenguaje detras:
//
//   - Cuesta dinero todos los meses y la regla del proyecto es cero.
//   - Un modelo suelto contestandole a sesenta personas EN NOMBRE DEL CLAN
//     puede decir cualquier cosa, y el que queda mal es el clan.
//   - Lo que de verdad se le pregunta son datos -bases, quien no ataco, como
//     va la liga- y eso ya lo responde de la base, sin inventarse nada.
//
// Lo que si hace falta es que tenga boca. Heraldo no esta solo para
// informar: esta para que el grupo tenga vida. Mas actividad, mas gente
// pendiente, mas gente que se queda.
//
// COMO ESTA HECHO
//
// Una lista de categorias. Cada una tiene un patron y VARIAS respuestas, y
// se elige al azar: un bot que contesta siempre lo mismo pierde la gracia a
// la tercera vez. Orden de arriba a abajo — la primera que casa, gana.
//
// PARA AÑADIR MAS
//
// Se mete una frase mas en el array que toque y ya. No hay que tocar nada
// mas ni desplegar nada raro. Es el archivo que va a crecer solo con el
// tiempo, segun lo que la gente pregunte de verdad.
//
// El personaje: un heraldo medieval con sangre cubana. Habla en cubano,
// tutea, y no se toma nada a pecho.

import { masDe } from './charla-mas.js';

const AL_AZAR = (lista) => lista[Math.floor(Math.random() * lista.length)];

// ---------------------------------------------------------------------
// Cierres para cuando manda una base. Van aparte porque no son respuestas
// a nada: son la despedida del mensaje, y repetir la misma catorce veces
// es justo lo que hace que un bot se sienta bot.
// ---------------------------------------------------------------------
export const CIERRES_BASE = [
  'Aquí tienes tu base. Coméntame si te funcionó.',
  'Ahí va esa. Dime después cómo te fue.',
  'Tremenda base, mi hermano. A ver quién se atreve.',
  'Esta aguanta. Pero el castillo llénalo bien.',
  'Móntala y avísame si te la rompieron.',
  'Con esa no te dan tres estrellas fácil. Suerte.',
  'Ahí está. Ahora te toca a ti no dormirte en el ataque.',
  'Esa te la recomiendo. Ponla y no la toques más.',
  'Copia el layout completo, que después me dicen que no sirve.',
  'Esa viene del pack de este mes, está fresquita.',
  'Ponla derecha y no me la muevas después, asere.',
  'Ahí la tienes. Si te la rompen, no fue la base. 😄',
  'Buena elección la mía. Dale, móntala.',
  'Esa la piden mucho. Aprovéchala.',
  'Listo. Ahora a defender como los machos.',
];

export const cierreBase = () => AL_AZAR(CIERRES_BASE);

// ---------------------------------------------------------------------
// Bienvenida a quien entra al grupo.
//
// Los dos primeros minutos deciden si alguien se queda o mira y se va. Un
// grupo donde entras y nadie dice nada parece muerto aunque tenga sesenta
// personas dentro.
//
// El {quien} se cambia por una mencion de verdad -tg://user?id=N-, que le
// hace vibrar el telefono aunque no tenga @usuario puesto.
//
// NO hay @everyone: Telegram no lo tiene, ni para bots ni para nadie. Eso
// es de Discord. Lo unico que se puede tocar de verdad es al que acaba de
// entrar, y es justo al que interesa enganchar.
//
// Se le pide el nombre del juego con /soy porque es la barra la que
// siempre llega: sin barra, el bot solo escucha si lo nombran o si le
// responden al mensaje, y nadie se sabe esa regla el primer dia.
// ---------------------------------------------------------------------
export const BIENVENIDAS = [
  '📯 ¡Escuchen todos! Acaba de entrar {quien}.\n\nSoy Heraldo, el que da los partes por aquí. Bienvenido, mi hermano. Dime cómo te llamas en el juego y te anoto en mi pergamino:\n<code>/soy TuNombre</code>',
  '📯 Toque de corneta: llegó {quien}.\n\nDenle la bienvenida, que uno más somos. Yo soy Heraldo y llevo la lista. Pásame tu nombre del juego con <code>/soy TuNombre</code> y ya te tengo fichado.',
  '📯 Abran paso, que entró {quien}.\n\nBienvenido a la comunidad, asere. Soy Heraldo, el mensajero de esta gente. Escríbeme <code>/soy TuNombre</code> con tu nombre del juego para guardarte en mis contactos.',
  '📯 Nuevo en el castillo: {quien}.\n\nBienvenido, mi hermano. Soy Heraldo y me encargo de los avisos. Dime cómo te llamas en Clash —<code>/soy TuNombre</code>— y así te aviso cuando te toque atacar.',
  '📯 ¡Miren quién llegó! {quien} está con nosotros.\n\nSaludos de parte de Heraldo. Pon <code>/soy TuNombre</code> con tu nombre del juego, que si no te tengo apuntado no te puedo avisar de nada.',
  '📯 Se anuncia la llegada de {quien}.\n\nBienvenido a Strange Godz. Soy Heraldo, pregúntame lo que quieras. Primero lo primero: <code>/soy TuNombre</code>, tu nombre del juego, para el pergamino.',
  '📯 Uno más para la guerra: bienvenido {quien}.\n\nAquí Heraldo, a la orden. Dame tu nombre de Clash con <code>/soy TuNombre</code> y te empiezo a mandar tus estrellas, tu clan de CWL y hasta bases.',
  '📯 {quien} acaba de cruzar la puerta.\n\nBienvenido, socio. Soy Heraldo y esto es la comunidad de Strange Godz. Escribe <code>/soy TuNombre</code> con tu nombre del juego y quedas registrado.',
  '📯 Atención la tropa: entró {quien}.\n\nBienvenido. Yo soy Heraldo, el que avisa cuando falta poco para que cierre la guerra. Ponme <code>/soy TuNombre</code> para saber quién eres en el juego.',
  '📯 Recibimos a {quien}. ¡Bienvenido!\n\nSoy Heraldo, el heraldo de la alianza. Con <code>/soy TuNombre</code> me dices tu nombre del juego y ya te reconozco para siempre.',
];

// Cuando entran varios de golpe -pasa cada vez que se comparte el enlace-
// las frases de arriba cojean: "Pepe, Juan esta con nosotros". Son tres
// lineas y no diez porque el caso es raro; lo que no puede es sonar mal.
export const BIENVENIDAS_VARIOS = [
  '📯 ¡Escuchen todos! Acaban de entrar {quien}.\n\nBienvenidos, mis hermanos. Soy Heraldo, el que da los partes por aquí. Cada uno dígame su nombre del juego con <code>/soy TuNombre</code> y los anoto en el pergamino.',
  '📯 Toque de corneta: llegaron {quien}.\n\nDenles la bienvenida, que somos más. Yo soy Heraldo y llevo la lista: pásenme su nombre de Clash con <code>/soy TuNombre</code>.',
  '📯 Abran paso, que entraron {quien}.\n\nBienvenidos a Strange Godz. Soy Heraldo, el mensajero de esta gente. Escríbanme <code>/soy TuNombre</code> para tenerlos fichados.',
];

export const bienvenida = (varios = false) =>
  AL_AZAR(varios ? BIENVENIDAS_VARIOS : BIENVENIDAS);

// ---------------------------------------------------------------------
// Las categorias de charla.
// ---------------------------------------------------------------------
const CHARLA = [
  // -------- Se queja de la base que le mandaron --------
  {
    nombre: 'base mala',
    // Dos condiciones en vez de un patron: "la base QUE ME ENVIASTE es una
    // mierda" mete cinco palabras entre una cosa y la otra, y pidiendolas
    // pegadas no casaba nunca.
    prueba: (q) =>
      /\b(base|layout|dise[nñ]o|aldea)\b/.test(q) &&
      /\b(mierda|mala|malisima|basura|porqueria|floja|no sirve|no aguanta|rompieron|me dieron tres|me metieron tres|cayo|cayó)\b/.test(q),
    respuestas: [
      'Mala mía, hermano. Pero acuérdate: todas caen, el meta está roto.',
      'Asere, con el meta de ahora no hay base que aguante. Se hace lo que se puede.',
      'Contra un buen ataque cae cualquiera. Lo que importa es cuánto le cuesta al otro.',
      'Esa aguanta contra los flojos. Contra un TH máximo no hay milagro.',
      'Revisa el castillo, que ahí se pierde la mitad de las defensas.',
      'No es la base, es que el que te atacó sabía. Pide otra mañana.',
      'El que hizo esa base cobra por hacerlas, así que algo sabe. Pero sí, todas caen.',
      'Defender en este juego es aguantar el segundo ataque, no el primero.',
    ],
  },

  // -------- Le tiran un cabo o lo insultan en broma --------
  {
    nombre: 'protesta',
    patron:
      /\b(de pinga|pinga|comemierda|come mierda|mierda|singao|puñetero|punetero|eres malo|no sirves|inutil|basura|te odio|odio a|que clase de bot|bot malo|bobo|comebola)\b/,
    respuestas: [
      'Lo sé, mi hermano. Pero estas son las reglas, mi socio. 🛡',
      'Tranquilo, asere. Yo no pongo las reglas, yo solo las canto. 📜',
      'Me lo dicen mucho. Y aquí sigo, con el mismo pergamino. 😌',
      'Con calma, mi socio. Yo no me molesto, yo solo anuncio.',
      'Oye, que yo soy un mensajero, no el que te tumbó la guerra. 😄',
      'Dale, saca la rabia. Después atacas, que es lo que hace falta.',
      'Yo aguanto de todo, menos que dejes ataques sin usar.',
      'Mira, con ese ánimo mejor te doy una base y hacemos las paces.',
      'Asere, que yo solo traigo el recado. Al mensajero no se le pega.',
      'Anotado en el pergamino. Junto a tus ataques sin usar. 📜😄',
    ],
  },

  // -------- Pide mas de la cuenta --------
  {
    nombre: 'pide mas',
    patron:
      /\b(otra|otro|una mas|uno mas|dame mas|solo una|nada mas una|tacaño|tacano|avaro|rata|porfa|por favor dame|ando pobre)\b/,
    respuestas: [
      'Una por cabeza al día, mi hermano, como el pan de la bodega. Mañana hay otra.',
      'Esa es la regla y a mí no me la cambian. Mañana temprano.',
      'Ya te di la tuya, socio. El pack se paga y se cuida.',
      'Con una alcanza. Móntala bien y no hace falta más.',
      'Mañana a primera hora estoy aquí con otra. Palabra de heraldo. 📜',
      'Ni que fuera pan con croqueta, asere. Una al día.',
    ],
  },

  // -------- Saludos --------
  {
    nombre: 'saludo',
    patron:
      /\b(hola|buenas|que bola|que vola|que hubo|saludos|buenos dias|buenas noches|buenas tardes|klk|dime|oye|asere|acere)\b/,
    respuestas: [
      '¡Qué bola, mi hermano! ¿Buscas base o quieres saber cómo va la liga?',
      '¡Aquí andamos! Dime: base, estrellas, o quién no ha atacado.',
      'Dime, socio. Para eso estoy. 🎺',
      '¿Qué vuelta, asere? Pide lo que necesites.',
      'Aquí, tocando la corneta. ¿En qué te ayudo?',
      '¡Qué pasa, mi gente! Dale, pregunta.',
      'Presente. ¿Base, estrellas o chisme de la liga?',
      'Dime a ver, que estoy con el pergamino en la mano.',
    ],
  },

  // -------- Gracias y halagos --------
  {
    nombre: 'gracias',
    patron:
      /\b(gracias|graciass|thank|te pasaste|eres grande|el mejor|tremendo|bueno el bot|que bueno|genial|crack|maquina|eres una fiera)\b/,
    respuestas: [
      'Para eso estoy, mi hermano. 🎺',
      'Nada, socio. A romper esa base.',
      'De nada. Y ataca temprano, que después no hay quien te salve. 😄',
      'Tremendo tú también, asere. Dale duro.',
      'Con gusto. Yo lo que quiero es que subamos de liga.',
      'Un placer. Ahora ve y hazme quedar bien en la guerra.',
      'Eso me gusta. Ahora los tres estrellas, que es lo que cuenta.',
      'Gracias a ti por atacar. El que ataca es el que manda.',
    ],
  },

  // -------- Quien eres / por que hablas asi --------
  {
    nombre: 'quien eres',
    patron:
      /\b(quien eres|que eres|eres un bot|eres humano|eres real|eres ia|inteligencia artificial|quien te hizo|como funcionas|por que hablas|de donde eres|eres cubano)\b/,
    respuestas: [
      'Asere, yo soy un mensajero medieval pero con sangre cubana. ¿Qué vuelta? 🇨🇺',
      'Heraldo de Strange Godz. Traje la corneta de Europa y el acento de aquí.',
      'Soy el que anuncia. Lo que digo sale de los datos del clan, no me lo invento.',
      'Mensajero de profesión, cubano de nacimiento. Mala combinación para el que no ataca. 😄',
      'Mira el sombrero: medieval. Óyeme hablar: de Centro Habana. Las dos cosas.',
      'Un heraldo. Antes anunciaba guerras de reyes, ahora anuncio quién no atacó.',
      'Bot, sí. Pero bot con pergamino, corneta y camiseta con el 10.',
      'Yo soy de aquí, asere. Lo que pasa es que me vestí para la ocasión.',
    ],
  },

  // -------- Chistes --------
  {
    nombre: 'chiste',
    patron: /\b(chiste|un chiste|algo gracioso|hazme reir|cuenta algo|dime algo)\b/,
    respuestas: [
      '¿Sabes por qué el Rey Bárbaro no usa despertador? Porque siempre está durmiendo en el altar. 😄',
      'Mi socio dejó dos ataques sin usar y le dijo al líder que se le fue la luz. Le creímos... hasta que lo vimos donando.',
      'El que dice "yo ataco ahorita" es el mismo que aparece cuando quedan 10 minutos.',
      '¿Cuál es la tropa más cubana? El Duende: entra, coge lo que hay y sale corriendo.',
      'Un TH17 me dijo que no atacaba porque no tenía tropas. Hermano, tú tienes DOS campamentos llenos.',
      'La Bruja es como la suegra: la invitas una vez y te llena la casa de esqueletos.',
      '¿Sabes qué tienen en común un apagón y un ataque de un estrella? Que los dos te dejan a oscuras.',
      'El Sanador cura a todo el mundo menos al que hizo el ataque sin plan.',
      'Le pregunté a un socio qué ejército usaba. Me dijo "el que salga". Y así mismo le fue.',
      'Mi compadre puso 40 muros nuevos y lo atacaron por el techo. La vida es así.',
      '¿Por qué el Minero no va a fiestas? Porque siempre anda por debajo. 😄',
      'El que ataca a las 3 de la mañana no es dedicado, es que no lo dejan dormir las tres estrellas que le deben.',
      'Un tipo me dijo que su base era invencible. Le mandé la mía. Ya no habla.',
      'La Máquina de Batalla nunca falla. Falla el que la manda para el lado equivocado.',
      'Dos estrellas es como llegar segundo en una carrera de dos. Técnicamente no perdiste.',
      '¿Cuál es el colmo de un Gigante? Que le tengan miedo... a los Arqueros.',
      'Yo tenía un amigo que solo atacaba con Globos. Ahora solo tiene recuerdos.',
      'El Castillo del Clan es como el refrigerador de la casa: todo el mundo pide y nadie repone.',
      // De los clasicos cubanos, traidos al clan.
      'Le pregunté a un socio cómo iba el clan. "No nos podemos quejar." ¿Ni bien ni mal? "No, no: que NO nos podemos quejar." 😄',
      'En este clan, al ataque de madrugada le dicen aspirina: uno cada cuatro horas. Al pleno de algunos le dicen Jesucristo: se habla de él, pero nadie lo ha visto. Y al castillo del clan le dicen coco: por dentro solo tiene agua.',
      'Mi compadre dice que su Reina es como el bistec en Cuba: todo el mundo habla de ella y nadie la ha visto atacar.',
      '¿Sabes qué es un cuarteto? Una alineación de quince después de una CWL sin avisar. 😄',
      'Se me acabó el repertorio, asere. Pídeme una base mejor. 😄',
      'Un socio me dijo que iba a maxear el TH antes de la CWL. Eso fue en marzo.',
    ],
  },

  // -------- Que ejercito uso / el meta --------
  {
    nombre: 'meta',
    patron:
      /\b(que ejercito|con que ataco|que tropas|que uso|meta|mejor ataque|como ataco|estrategia|composicion)\b/,
    respuestas: [
      'Lo que domines, asere. El mejor ejército es el que llevas 200 ataques practicando.',
      'Yo no doy recetas: mira la base primero y después decide. El que ataca en piloto automático saca una estrella.',
      'Practica en amistosas antes del día de guerra. Ahí es donde se gana, no en el ataque.',
      'Sea cual sea, llénalo bien el castillo. La mitad de los ataques se pierden ahí.',
      'El meta está roto, hermano. Todo cae si lo llevas bien.',
      'No cambies de ejército la noche antes de la guerra. Eso es suicidio.',
      'Menos pensar y más practicar. El plan se ve en los primeros 30 segundos del ataque.',
      'Pídele consejo a los que hacen tres estrellas seguidas, no a mí que soy el que anuncia. 😄',
      'Lo importante no es la tropa, es por dónde entras. Ahí se decide todo.',
      'Si te funciona, no lo cambies. Si no te funciona, cámbialo YA, no en la ronda 6.',
    ],
  },

  // -------- Animo / motivacion --------
  {
    nombre: 'animo',
    patron:
      /\b(no puedo|no doy|soy malo|no se atacar|me rindo|estoy frustrado|siempre pierdo|que hago|ayuda)\b/,
    respuestas: [
      'Nadie nació sabiendo, asere. El que hoy hace tres estrellas ayer hacía una.',
      'Tranquilo. Practica en amistosas y pide base con tiempo. Eso solo ya te sube el nivel.',
      'Todos empezamos dando pena. Lo que no se perdona es no atacar.',
      'Dale, que esto es cuestión de repetir. Veinte ataques más y no me reconoces.',
      'Mira los ataques de los que van primeros en la tabla. Copia lo que hacen.',
      'No te rindas. Aquí lo que se castiga es el ataque sin usar, no el ataque malo.',
      'Pídele a alguien del clan que te vea atacar. En diez minutos te arreglan la mano.',
      'Un estrella es mejor que cero. Y cero es lo único que sí duele.',
    ],
  },

  // -------- Guerra, ataque, donaciones --------
  {
    nombre: 'guerra',
    patron: /\b(guerra|atacar|ataque|cwl|liga|cuando ataco|ya ataque)\b/,
    respuestas: [
      'Ataca temprano, mi hermano. El que deja para el final es el que no ataca.',
      'Si ya atacaste, tremendo. Si no, ¿qué haces leyendo esto? 😄',
      'Pregúntame "quién falta" y te digo quiénes están durmiendo.',
      'La guerra se gana con los ataques usados, no con los buenos deseos.',
      'Acuérdate de pedir el castillo antes de atacar. Cambia el ataque completo.',
    ],
  },
  {
    nombre: 'donaciones',
    patron: /\b(dona|donacion|donaciones|castillo|cc|tropas de guerra|pidan|donen)\b/,
    respuestas: [
      'Donar es lo más barato que puedes hacer por el clan. Y lo que más se agradece.',
      'El que dona siempre tiene quien le done. Eso es ley.',
      'Pide el castillo ANTES de entrar al ataque, no cuando ya estás dentro.',
      'Donen bien en guerra, mi gente. Un castillo malo tumba un ataque bueno.',
    ],
  },

  // -------- Vida real, cubaneo --------
  {
    nombre: 'hambre',
    patron: /\b(hambre|comida|comer|almuerzo|desayuno|arroz|croqueta|pan|pizza)\b/,
    respuestas: [
      'Come primero, ataca después. Nadie hace tres estrellas con hambre.',
      'Yo llevo 800 años con este pergamino en la mano y todavía nadie me ha ofrecido café.',
      'Un pan con croqueta y un ataque bien planeado. No se necesita más.',
      'Asere, aquí lo único que reparto son bases. La comida búscala tú. 😄',
    ],
  },
  {
    nombre: 'calor',
    patron: /\b(calor|apagon|apagón|se fue la luz|no hay corriente|el clima|llueve|frio)\b/,
    respuestas: [
      'Cuando vuelva la corriente, ataca. Y no me digas que se te pasó. 😄',
      'El apagón es la excusa número uno de este clan. La número dos es "estaba trabajando".',
      'Yo con este sombrero y esta cota de malla, imagínate el calor que paso.',
      'Aprovecha que hay corriente y ataca ahora. Después no se sabe.',
    ],
  },
  {
    nombre: 'aburrido',
    patron: /\b(aburrido|aburrida|que hago|no hay nada|tedio|estoy muerto)\b/,
    respuestas: [
      'Pídeme una base y móntala. Eso mata media hora.',
      'Ataca en amistosa. Aburrido y sin practicar es la peor combinación.',
      'Pregúntame por las estrellas de la temporada y te entretengo un rato.',
      'Aburrido está el que no tiene guerra. Y nosotros siempre tenemos.',
    ],
  },
  {
    nombre: 'despedida',
    patron: /\b(chao|adios|hasta luego|nos vemos|me voy|bye|buenas noches me voy)\b/,
    respuestas: [
      'Dale, asere. Y ataca antes de acostarte.',
      'Nos vemos. Aquí estaré con el pergamino.',
      'Cuídate, mi hermano. No dejes ataques sin usar.',
      'Hasta luego. Yo no duermo, así que cuando vuelvas aquí estoy. 🎺',
    ],
  },

  // -------- Risas --------
  {
    nombre: 'risa',
    patron: /(jaja|jeje|jiji|jajaja|lol|xd|😂|🤣)/,
    respuestas: [
      '😄 Pero no te rías tanto, que todavía te faltan ataques.',
      'Jaja. Ahora en serio: ¿ya atacaste?',
      'Me alegra. Ahora móntame esa base derecha.',
      'Ríete ahora, que en la guerra no se ríe nadie. 😄',
    ],
  },
];

// Las categorias del juego y de la vida -heroes, TH, capital, lag,
// trampas, tag, familia...- van antes de 'saludo', 'meta' y 'guerra', que
// son las genericas: asi "cuando cierra la guerra" cae en su sitio. Ver
// charla-mas.js, que las comparte con Valquiria cambiando la voz.
{
  // Antes de 'saludo': si no, "buenas noches" cae en el saludo generico
  // ("Presente. ¿Base, estrellas o chisme?") en vez de en el suyo.
  const iSaludo = CHARLA.findIndex((c) => c.nombre === 'saludo');
  CHARLA.splice(iSaludo, 0, ...masDe('heraldo'));
}

/**
 * Devuelve una respuesta de charla, o null si no es charla.
 * El texto llega ya en minusculas y sin tildes.
 */
export function charlar(q) {
  for (const c of CHARLA) {
    const casa = c.prueba ? c.prueba(q) : c.patron.test(q);
    if (casa) return AL_AZAR(c.respuestas);
  }
  return null;
}

/** Cuantas frases tiene el cerebro. Sale en /ayuda, y sirve de test. */
export const cuantasFrases = () =>
  CHARLA.reduce((n, c) => n + c.respuestas.length, 0) + CIERRES_BASE.length;
