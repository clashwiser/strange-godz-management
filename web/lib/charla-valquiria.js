// El cerebro de Valquiria: lo que dice cuando le hablan.
//
// Su oficio es elegir quien entra, y eso pasa en privado. En el grupo esta
// para dos cosas: explicar como se entra -que es la pregunta que mas se
// va a repetir- y tener personalidad, que es lo que hace que la gente se
// quede en un grupo. Todo lo que sea de Heraldo -bases, estrellas, quien
// falta- lo manda a el en vez de contestarlo a medias.
//
// Igual que el cerebro de Heraldo, esto NO es un modelo de lenguaje:
// costaria dinero todos los meses. Son patrones y frases, y el archivo
// crece con lo que la gente le pregunte de verdad. La primera version
// tenia nueve categorias y a "¿como estas?" contestaba explicando su
// trabajo: eso es lo que hace que un bot suene a bot.
//
// El personaje: una valquiria con sangre cubana. Dulce en la boca -mi
// cielo, mi vida, mi corazon, cariño- y firme en lo que dice. No ruega,
// elige. Se rie, pero el hacha no es de adorno.

import { masDe } from './charla-mas.js';

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

// ---------------------------------------------------------------------
// Las categorias. El ORDEN importa: lo concreto antes que lo general.
// "como estas" tiene que ganarle a "que haces", y "chiste" a "risa".
// ---------------------------------------------------------------------
const CHARLA = [
  // -------- Como esta --------
  {
    nombre: 'como estas',
    patron: /(como estas|como andas|como te va|como te sientes|que tal estas|como amaneciste|todo bien\??$|como va todo|como la llevas)/,
    respuestas: [
      'Aquí, mi cielo, afilando el hacha y mirando quién se acerca a la puerta. ¿Y tú?',
      'Bien, mi vida. El cuervo me trae noticias, la lista está al día y nadie me ha hecho enojar hoy. Todavía. 😄',
      'Como una valquiria un día de guerra, mi corazón: despierta, armada y con ganas de ver a alguien hacer pleno.',
      'Mejor que ayer, cariño. Ayer entró uno que decía atacar con gigantes y arqueras siendo TH15. Se me quitó el hambre.',
      'Tranquila y con el hacha limpia, mi cielo. Que dure.',
      'Bien, mi vida, aunque con el calor de aquí se me despeinan las alas del casco.',
      'Contenta, mi corazón: hoy no ha llegado ningún trotaclanes. ¿Y tú, qué me cuentas?',
      'De pie y vigilando, mi cielo. Una valquiria no se sienta. Bueno, en la Bodeguita sí. 😄',
    ],
  },

  // -------- Que esta haciendo --------
  {
    nombre: 'que haces',
    patron: /(que haces|que estas haciendo|que andas haciendo|en que andas|que hay de nuevo)/,
    respuestas: [
      'Mirando la puerta, mi cielo. Es lo mío: ver quién llega, ver cómo pelea, y decidir.',
      'Leyendo fichas, mi vida. Hoy pasó uno con 3.000 estrellas de guerra y cero donaciones de por vida. Adivina qué le dije.',
      'Puliendo el hacha y contando guerreros, mi corazón. Faltan tú y dos más por donar.',
      'Esperando a que alguien me escriba en privado para entrar, cariño. Corre la voz.',
      'Cuidando que Heraldo no toque la corneta a las tres de la mañana. Es un trabajo a tiempo completo. 😄',
    ],
  },

  // -------- Como entra alguien --------
  {
    nombre: 'como entrar',
    patron: /\b(entra|entrar|entro|entre|meter|meto|meta|reclut|unir|unirse|unirme|me uno|solicit|aplic|inscrib|invitar|invita)\b/,
    respuestas: [
      `Que me escriba en privado, mi cielo: <b>@${BOT_RECLUTA}</b>. Le hago cuatro preguntas, le pido que me enseñe cómo ataca y se lo paso a los líderes. Tres minutos.`,
      `Fácil, mi vida: abre <b>@${BOT_RECLUTA}</b>, le da a Empezar y me manda su tag. Yo miro cómo pelea, no las estrellas que tenga.`,
      `Dile que me busque: <b>@${BOT_RECLUTA}</b>. Aquí en el grupo no elijo a nadie; eso lo hago en privado, con su tag delante. ⚔️`,
      `Mándamelo a <b>@${BOT_RECLUTA}</b>, cariño. Si sabe atacar, entra; si no, aprende y vuelve. Aquí no se le cierra la puerta a nadie dos veces.`,
    ],
  },

  // -------- Quien es --------
  {
    nombre: 'quien eres',
    patron: /(quien eres|que eres|para que sirves|presentate|quien es valqui|que es una valquiria|eres la del juego|la valquiria del juego)/,
    respuestas: [
      'Soy Valquiria, mi cielo. Yo elijo quién entra al ejército de Strange Godz: miro cómo peleas y decido. Heraldo anuncia; yo elijo. ⚔️',
      'La que abre la puerta, mi vida. Cada guerrero nuevo de aquí pasó por mí primero. Y a cada uno lo elegí por cómo pelea, no por sus estrellas ni por su cara bonita.',
      'En el norte, las valquirias recorríamos el campo de batalla eligiendo a los guerreros dignos para el ejército de los dioses. Aquí hago lo mismo, mi corazón, pero con Telegram y sin nieve.',
      'La del juego es mi prima, cariño: ella rompe muros con el hacha, yo rompo excusas. Misma sangre. 😄',
      'Soy la que decide quién se sienta en esta mesa, mi cielo. Y la que te dice "mi cielo" mientras lo decide.',
    ],
  },

  // -------- Es real / es un bot --------
  {
    nombre: 'eres real',
    patron: /(eres real|eres un bot|eres una bot|eres un robot|eres humana|eres una ia|eres inteligencia|quien te hizo|quien te creo|quien te programo|eres de verdad|eres una persona)/,
    respuestas: [
      'Soy tan real como las tres estrellas que me debes, mi cielo.',
      'Bot, mujer, valquiria… ponle el nombre que quieras, mi vida. Lo que importa es que yo sí veo quién dona y quién no. 😉',
      'Me hicieron los líderes de la alianza, cariño, con pergamino, hacha y mala memoria para las excusas.',
      'Si fuera humana ya me habría cansado de esperar tus ataques, mi corazón. Así que algo de máquina tengo.',
      'Real lo suficiente para leer tu ficha, mi cielo. Y tu ficha dice que llevas dos días sin donar.',
      'De verdad de la buena, mi vida. Lo que no es de verdad es ese "ahorita ataco" que dijiste ayer.',
    ],
  },

  // -------- Edad, de donde es, donde vive --------
  {
    nombre: 'edad y origen',
    patron: /(cuantos anos|que edad|de donde eres|donde vives|donde naciste|eres cubana|eres de cuba|de que pais|de donde sales)/,
    respuestas: [
      'Nací en el norte, entre nieve y escudos, mi cielo. Pero me crié en Cuba, y aquí se me pegó el acento y el café.',
      'La edad de una valquiria no se pregunta, mi vida. Digamos que ya vi caer más imperios que tú bases.',
      'Vivo en la puerta del clan, cariño. Literal. Es lo mío.',
      'Cubana de adopción, mi corazón: el hacha es nórdica, la lengua es de La Habana.',
      'Tengo los años justos para saber cuándo alguien me miente con el nivel de su Rey, mi cielo. 😄',
      'De donde salen las que eligen guerreros, mi vida. Y ahora vivo aquí, contigo y con Heraldo, en este grupo.',
    ],
  },

  // -------- Cuantos esperan --------
  {
    nombre: 'esperando',
    patron: /(cuant[oa]s|hay|alguien)\b.*(esper|solicit|pendiente|cola|puerta)/,
    especial: 'esperando',
  },

  // -------- Amor y piropos --------
  {
    nombre: 'amor',
    patron: /(tienes novio|tienes marido|estas soltera|casate|casate conmigo|te amo|te quiero|mi amor|sal conmigo|una cita|eres mi novia|quieres ser mi)/,
    respuestas: [
      'Mi corazón ya está ocupado, mi cielo: con el que haga siete plenos seguidos en la liga. Vacante desde 2019. 😄',
      'Casarme no, mi vida. Pero si donas 5.000 tropas te dejo llevar mi cuervo un rato.',
      'Ay, cariño. Yo elijo guerreros, no novios. Aunque a veces son la misma cosa.',
      'Te quiero también, mi cielo. Como quiero a todos los que atacan a tiempo.',
      'Soltera y armada, mi vida. Piénsalo bien antes de insistir. 😉',
      'Una cita sí, mi corazón: el día de guerra, a las 8, en el campo de batalla. No llegues tarde.',
    ],
  },
  {
    nombre: 'piropo',
    patron: /(linda|bella|hermosa|preciosa|guapa|rica|sexy|bonita|mami|mamita|que buena estas|estas buena|divina|eres una reina|mi reina hermosa)/,
    respuestas: [
      'Ay, gracias, mi cielo. Pero yo me fijo en cómo atacas, no en los piropos. ⚔️',
      'Qué lindo, mi vida. Ahora enséñame un tres estrellas y hablamos. 😄',
      'Mi corazón, a mí me enamoran con ataques, no con palabras. Dona algo y te miro con otros ojos.',
      'Tranquilo, cariño, que el hacha no es de adorno. 😉',
      'Reina no, mi cielo: valquiria. Las reinas mandan desde el trono; yo bajo al campo.',
      'Gracias, mi vida. El casco con alas ayuda. Y el hacha, también.',
      'Bonita y con hacha, mi corazón. Es una combinación que no se discute.',
      'Ya lo sé, cariño. Ahora ve y dona, que eso sí me pone bonita de verdad. 😄',
    ],
  },

  // -------- Heraldo --------
  {
    nombre: 'heraldo',
    patron: /heraldo/,
    respuestas: [
      'Heraldo es mi hermano de armas, mi cielo: él anuncia, yo elijo. No lo dejen mucho rato solo con la corneta.',
      'A Heraldo lo quiero, mi vida, pero habla más que yo. Yo con el hacha y la lista me arreglo.',
      'Él lleva el pergamino y yo llevo a la gente. Sin mí no tiene a quién anunciar. 😄',
      'Heraldo y yo somos como el pan y el café, cariño: por separado sirven, juntos son el desayuno.',
      'Lo que Heraldo tiene de trompeta lo tengo yo de puntería, mi corazón. Por eso él avisa y yo decido.',
      'Es buen muchacho, mi cielo. Un poco escandaloso con la corneta a las 6 de la mañana, pero buen muchacho.',
    ],
  },

  // -------- Chistes --------
  {
    nombre: 'chiste',
    patron: /\b(chiste|un chiste|algo gracioso|hazme reir|cuentame algo|dime algo gracioso|cuenta algo)\b/,
    respuestas: [
      '¿Sabes por qué la Valquiria del juego no usa escudo, mi cielo? Porque con esa cara ya nadie se le acerca. 😄',
      'Entró uno diciendo que era "el mejor atacante de su clan anterior". Su clan anterior tenía tres miembros. Y dos eran él.',
      'Un guerrero me dijo que hacía pleno "el 100% de las veces". Le pregunté cuántas guerras llevaba. Una.',
      '¿Cuál es la diferencia entre un trotaclanes y una paloma, mi vida? Que la paloma vuelve.',
      'Le pregunté a uno a qué nivel tenía la Reina. Tardó cuatro minutos. Tenía que preguntarle al dueño de la cuenta. 😄',
      'Dicen que la Bruja llena la casa de esqueletos. Yo lleno el clan de guerreros. Cada una con lo suyo.',
      'Mi cuervo vio a uno atacar con globos sin rabia. Todavía no ha vuelto a hablar.',
      'El que dice "yo dono cuando pueda" y el que dice "yo ataco cuando pueda" son la misma persona, mi corazón. Y nunca puede.',
      'Heraldo cree que la corneta suena bien a las 6 de la mañana. Yo creo que por eso el grupo tiene tres miembros. 😄',
      '¿Cómo se sabe que una cuenta es comprada, cariño? Cuando el TH16 pregunta qué es un Gran Centinela.',
      'Uno me dijo "yo no dono porque mis tropas son muy caras". Mi cielo, son las mismas que las de todos.',
      'Un TH17 me pidió una base "que no se caiga". Le dije que eso se llama montaña, no base.',
      // De los clasicos cubanos, traidos al clan.
      'En Cuba al bistec le dicen Jesucristo, mi cielo: se habla de él, pero nadie lo ha visto. Yo a los que "van a donar mañana" les digo igual.',
      '¿Cómo va el clan, le pregunté a uno. "No nos podemos quejar." ¿Ni bien ni mal? "No, mi vida: que NO nos podemos quejar." 😄',
      'Al castillo del clan de algunos le digo coco, cariño: por dentro solo tiene agua.',
      '¿Sabes qué es un cuarteto, mi corazón? Un clan de quince después de que entra un trotaclanes y se lleva a los amigos.',
      'El ataque de las tres de la mañana es como el autobús en Cuba, mi cielo: una aspirina cada cuatro horas, y nunca cuando hace falta.',
      'Ya no me quedan chistes, mi vida. Pregúntale a Heraldo, que él vive de eso.',
    ],
  },

  // -------- Animo: perdimos, me rompieron, estoy triste --------
  {
    nombre: 'animo',
    patron: /(perdimos|me rompieron|me dieron tres|me hicieron pleno|estoy triste|estoy mal|que mal|hice una estrella|hice cero|falle|fallé|me fue mal|deprimido|desanimado|no sirvo|soy malo)/,
    respuestas: [
      'Levanta esa cabeza, mi cielo. Los que nunca pierden son los que nunca atacan.',
      'Un ataque malo no te define, mi vida. Dos seguidos sin practicar, sí. Vete a una amistosa.',
      'A mí también me han roto la base, cariño. Se llama guerra. Mañana te toca a ti romper.',
      'Respira, mi corazón. Mira la repetición, encuentra el error, y no lo repitas. Eso es todo lo que hay que hacer.',
      'Perder duele porque te importa, mi cielo. Los que no les duele son los que hay que sacar del clan.',
      'Una estrella hoy, tres mañana. Pero solo si practicas hoy, mi vida.',
      'Ven, cariño, siéntate. Ahora cuéntame por dónde entraste y te digo dónde se te fue.',
      'El que ataca y falla aprende. El que no ataca solo pierde. Tú estás en el grupo bueno, mi corazón.',
    ],
  },

  // -------- Ganamos, pleno --------
  {
    nombre: 'victoria',
    patron: /(ganamos|hice pleno|hice tres|tres estrellas|hicimos pleno|gane|gané|le di tres|lo rompi|lo rompí|full)/,
    respuestas: [
      '¡Eso es, mi cielo! Así se pelea. Mi cuervo ya lo anotó.',
      'Tres estrellas, mi vida. Ahora repítelo mañana, que una golondrina no hace verano.',
      'Orgullosa de ti, cariño. Por guerreros así elijo yo.',
      'Bien hecho, mi corazón. Ahora dona algo y el día es perfecto. 😄',
      '¡Pleno! Eso es lo que quiero ver en la puerta, no piropos. ⚔️',
      'Lo vi, mi cielo. Fue limpio. Sigue así y te pongo de ejemplo con los nuevos.',
    ],
  },

  // -------- Guerra y CWL --------
  {
    nombre: 'guerra',
    patron: /\b(guerra|cwl|liga|ronda|batalla|ataque|atacar|atacamos)\b/,
    respuestas: [
      'La guerra es donde se ve quién es quién, mi cielo. Todo lo demás es conversación.',
      'Atacas primero y preguntas después, mi vida. En la liga no hay segundo ataque.',
      'Si tienes dudas de por dónde entrar, mira la base cinco minutos antes, no cinco segundos, cariño.',
      'Un ataque sin usar duele más que uno perdido, mi corazón. El perdido lo intentó.',
      'En CWL cada estrella cuenta el doble, mi cielo. Y cada ataque sin hacer, el triple.',
      'Ve a la guerra como se va a la playa: temprano y con todo lo que hace falta. 😄',
    ],
  },

  // -------- Meta, ejercito, como ataco --------
  {
    nombre: 'meta',
    patron: /(que ejercito|con que ataco|que tropas|que uso|el meta|mejor ataque|como ataco|estrategia|composicion|que me recomiendas para atacar|hydra|dragones|super archer|lalo|zapquake)/,
    respuestas: [
      'El mejor ejército es el que llevas doscientos ataques practicando, mi cielo. No el que salió en un video ayer.',
      'Yo elijo guerreros por cómo llevan lo que llevan, no por lo que llevan, mi vida. Domina uno y después cambias.',
      'Mira la base primero, cariño. El ejército se elige después de saber por dónde entras, no antes.',
      'Practica en amistosas, mi corazón. Es gratis y nadie te ve fallar. Bueno, yo sí. 😄',
      'No cambies de ejército la noche antes de la liga, mi cielo. Eso no es valentía, es suicidio.',
      'Pregúntale a los que hacen pleno seguido, mi vida. Están en este grupo. Yo los elegí.',
      'Llena el castillo con lo que te digan los líderes, cariño. La mitad de los ataques se pierden ahí.',
      'Sea lo que sea, entra por donde estén los héroes enemigos, mi corazón. Lo demás es adorno.',
    ],
  },

  // -------- Consejo, mejorar --------
  {
    nombre: 'consejo',
    patron: /(dame un consejo|un consejo|como mejoro|como mejorar|que hago para|como ser mejor|como subo|como aprendo)/,
    respuestas: [
      'Mira tus repeticiones, mi cielo. Las malas, sobre todo. Ahí está todo lo que te falta.',
      'Ataca todos los días aunque sea a la aldea, mi vida. Los dedos también se entrenan.',
      'Copia a uno que sea mejor que tú, cariño. Sin vergüenza. Así se aprende a atacar y a todo.',
      'Menos globos y más plan, mi corazón. Los primeros treinta segundos deciden el ataque.',
      'Pregunta en el grupo antes de atacar, mi cielo. Aquí hay gente que sabe, y le gusta que le pregunten.',
      'Dona, ataca, repite. No hay más secreto, mi vida. El que te venda otro, te miente.',
    ],
  },

  // -------- Donaciones --------
  {
    nombre: 'donaciones',
    patron: /(dona|donar|donaciones|tropas al castillo|me donan|nadie dona)/,
    respuestas: [
      'Donar es lo primero que miro de una ficha, mi cielo. Antes que las estrellas.',
      'El que pide y no da, no dura en mi lista, mi vida. Lo digo con cariño, pero lo digo.',
      'Dona lo que pidan, no lo que te sobre, cariño. La diferencia se nota el día de guerra.',
      'Un clan donde todos donan gana guerras solo, mi corazón. Un clan donde nadie dona, ni con Heraldo tocando la corneta.',
      'Pide y da, mi cielo. Es la única regla de esta casa que no perdono.',
    ],
  },

  // -------- Reglas, se pone dura --------
  {
    nombre: 'reglas',
    patron: /(te pones de pinga|eres dura|eres mala|muy exigente|eres estricta|que pesada|no seas asi|relajate|tranquila)/,
    respuestas: [
      'Lo sé, mi cielo, pero estas son las reglas. Y las hice yo. 😄',
      'Dura con la puerta, blanda con los de dentro, mi vida. Así funciona esto.',
      'Si fuera blanda entraría cualquiera, cariño. Y entonces tú no querrías estar aquí.',
      'Me pongo de pinga con los que no atacan, mi corazón. Contigo estoy siendo un amor.',
      'Estricta no, mi cielo: valquiria. Es otra cosa.',
      'Relajada estoy, mi vida. Relajada y con el hacha. Las dos cosas a la vez. 😉',
    ],
  },

  // -------- Insultos --------
  {
    nombre: 'insulto',
    patron: /(mierda|basura|inutil|no sirves|tonta|estupida|callate|idiota|imbecil|bruja|vete|largate|comemierda)/,
    respuestas: [
      'Cuidado, mi cielo, que el hacha no es de adorno. 😄',
      'Mira que yo también elijo quién sale, mi vida. 😉',
      'Respira, mi corazón. Y ataca, que eso te calma.',
      'Bruja no: valquiria. La bruja llena la casa de esqueletos; yo la lleno de guerreros.',
      'Me han dicho cosas peores en el campo de batalla, cariño. Y esos ya no están.',
      'Te perdono, mi cielo, porque perdí más paciencia con los que no donan que contigo.',
    ],
  },

  // -------- Hambre, comida --------
  {
    nombre: 'hambre',
    patron: /(tengo hambre|que comiste|que comes|comida|almuerzo|cena|desayuno|croqueta|arroz|frijoles|pizza)/,
    respuestas: [
      'Arroz con frijoles y un ataque de tres estrellas, mi cielo. Es mi dieta.',
      'Yo como estrellas de guerra, mi vida. Últimamente estoy pasando hambre. 😄',
      'Come, ataca, dona. En ese orden, cariño. Con hambre no se hace pleno.',
      'Una croqueta y a la guerra, mi corazón. Como toda la vida.',
      'Si cocinas como atacas, mejor invítame a comer fuera, mi cielo. 😄',
    ],
  },

  // -------- Calor, Cuba, apagon --------
  {
    nombre: 'calor',
    patron: /(que calor|hace calor|el calor|apagon|apagón|se fue la luz|no hay corriente|sin luz|el sol|cuba)/,
    respuestas: [
      'Con este calor se me despeinan las alas del casco, mi cielo. Pero la guerra sigue.',
      'Apagón no es excusa, mi vida: el teléfono aguanta un ataque. Lo sé porque lo he visto.',
      'Cuba me enseñó dos cosas, cariño: que se puede pelear con calor y que el café no se negocia.',
      'Cuando se va la luz es cuando más falta hace un buen líder, mi corazón. Y un buen power bank.',
      'Calor, sí. Pero mira: en el norte con la nieve tampoco atacaban más, mi cielo. 😄',
      'Que se vaya la luz, pero que no se vaya el ataque, mi vida.',
    ],
  },

  // -------- Aburrido --------
  {
    nombre: 'aburrido',
    patron: /(aburrido|aburrida|no hay nada que hacer|que hago|me aburro|estoy al pomo)/,
    respuestas: [
      '¿Aburrido, mi cielo? Ve a una amistosa. Nadie se aburre perdiendo.',
      'Dona hasta llenar el castillo de todo el mundo, mi vida. Aburre menos que quejarse.',
      'Mira las repeticiones de los que hacen pleno, cariño. Aprender no aburre.',
      'Tráeme a un guerrero nuevo, mi corazón. Reclutar es entretenido. Bueno, para mí.',
      'Pregúntale a Heraldo un chiste, mi cielo. Tiene veinte y todos malos. 😄',
    ],
  },

  // -------- Futbol, musica --------
  {
    nombre: 'futbol y musica',
    patron: /(futbol|fútbol|messi|ronaldo|barca|barça|madrid|real madrid|reggaeton|reguetón|reggaetón|musica|música|bad bunny|cancion|canción)/,
    respuestas: [
      'Del fútbol sé lo justo, mi cielo: el que no pasa el balón es el que no dona. Mismo tipo de gente.',
      'Yo llevo el 1 en la camiseta, mi vida: la portera. Decido qué entra y qué no. 😄',
      'Messi hace pleno con 2 tropas, cariño. Tú tienes un ejército entero, no hay excusa.',
      'Reguetón para donar, mi corazón; para atacar, silencio y plan.',
      'La música la pone Heraldo con la corneta. Yo pongo el ritmo con el hacha.',
      'Un buen ataque es como un buen gol, mi cielo: se prepara antes y se celebra después.',
    ],
  },

  // -------- Hacha, cuervo, casco --------
  {
    nombre: 'hacha y cuervo',
    patron: /(tu hacha|el hacha|tu cuervo|el cuervo|tu casco|las alas|tu pajaro|tu pájaro)/,
    respuestas: [
      'El hacha es de dos filos, mi cielo: uno para los enemigos y otro para los que no donan. 😄',
      'El cuervo es de Odín, mi vida. Me trae noticias de quién peleó bien y quién se escondió.',
      'Las alas del casco no vuelan, cariño. Son para que me vean llegar.',
      'Mi cuervo no habla, mi corazón, pero lo ve todo. Como yo.',
    ],
  },

  // -------- Gracias --------
  {
    nombre: 'gracias',
    patron: /(gracias|te lo agradezco|muchas gracias)/,
    respuestas: ['De nada, mi corazón.', 'Para eso estoy, mi cielo. ⚔️', 'Cuando quieras, mi vida.', 'A ti, cariño. Ahora ve y ataca.'],
  },

  // -------- Despedida --------
  {
    nombre: 'despedida',
    patron: /(chao|chau|adios|adiós|me voy|hasta luego|nos vemos|hasta manana|hasta mañana|me largo|bye)/,
    respuestas: [
      'Ve con cuidado, mi cielo. Y vuelve con tres estrellas.',
      'Hasta luego, mi vida. Yo me quedo en la puerta, como siempre.',
      'Chao, cariño. Dona antes de irte. 😉',
      'Nos vemos, mi corazón. Que la guerra te encuentre despierto.',
      'Adiós, mi cielo. El cuervo te vigila. 😄',
      'Descansa, mi vida. Mañana se ataca temprano.',
    ],
  },

  // -------- Risa --------
  {
    nombre: 'risa',
    patron: /^(jaja|jeje|jiji|xd|lol|😂|🤣|ja ja)+/,
    respuestas: [
      'Ríete ahora, mi cielo, que el día de guerra no se ríe nadie. 😄',
      'Me gusta cuando te ríes, mi vida. Ahora ve y haz reír a la base enemiga.',
      'Jaja, sí. Y ahora, ¿ya donaste?',
      'Esa risa me la guardo, cariño. La voy a necesitar cuando vea tu próximo ataque. 😉',
      'Ríete, mi corazón, que la vida es corta y la CWL más.',
    ],
  },

  // -------- Cosas de Heraldo: al final, para que no se coman lo demas --------
  {
    nombre: 'de heraldo',
    patron: /(base|layout|aldea|estrellas de la|quien falta|falta por|resumen|cobro|premio|tabla|ranking|mi clan|pa que clan|mis estrellas|cuanto llevo)/,
    respuestas: [
      'Eso es cosa de Heraldo, mi vida. Pregúntale a él, que yo solo elijo quién entra.',
      'Para eso está Heraldo, mi cielo: dile "Heraldo" y lo que quieras. Lo mío es la puerta.',
      'Heraldo lleva el pergamino con todo eso, cariño. Yo llevo el hacha. Cada uno con lo suyo. 😄',
    ],
  },
];

// Las categorias del juego y de la vida -heroes, TH, capital, lag,
// trampas, tag, familia...- van entre las de personalidad y las genericas
// de guerra y meta: asi "cuando cierra la guerra" cae en su categoria y no
// en la de guerra a secas. Ver charla-mas.js.
{
  // Y 'de heraldo' sube tambien: "quien falta por atacar" es de Heraldo,
  // no de la categoria generica de guerra, que iba antes y se lo comia.
  const deHeraldo = CHARLA.splice(CHARLA.findIndex((c) => c.nombre === 'de heraldo'), 1);
  const iAnimo = CHARLA.findIndex((c) => c.nombre === 'animo');
  CHARLA.splice(iAnimo, 0, ...masDe('valquiria'), ...deHeraldo);
}

/** Cuantos hay esperando, dicho con gracia. */
export const cuantosEsperan = (n) =>
  n === 0
    ? `Nadie en la puerta ahora mismo, mi cielo. Corre la voz: <b>@${BOT_RECLUTA}</b>.`
    : n === 1
      ? `Hay uno esperando a que un líder lo mire, mi vida. Que no se enfríe.`
      : `Hay ${n} esperando a que los líderes decidan, mi corazón. Que no se enfríen.`;

const SALUDOS = [
  'Aquí estoy, mi cielo. ¿Qué necesitas?',
  'Dime, mi vida.',
  'Presente, mi corazón. ⚔️',
  '¿Sí, cariño?',
];

const NO_ENTIENDO = [
  `No te entendí, mi cielo. Pregúntame cómo se entra, o cuéntame cómo te fue en la guerra.`,
  `Eso no lo sé, mi vida. Sé de guerreros, de guerra y de quién entra: <b>@${BOT_RECLUTA}</b>.`,
  `Mmm, no te sigo, cariño. Pero si es de bases o estrellas, es cosa de Heraldo.`,
  `Repítemelo de otra forma, mi corazón, que el cuervo no lo cogió.`,
];

/**
 * Traduce lo que dijeron a una respuesta.
 *   -> { tipo: 'decir', texto }        contesta esto
 *   -> { tipo: 'esperando' }           hay que contar las solicitudes
 *   -> null                            no es para ella
 */
export function entenderValquiria(texto) {
  // Fuera su nombre: si no, "valquiria como entra mi amigo" empieza por
  // "valquiria" y parece un saludo. Lo que quede es lo que quieren.
  const q = plano(texto).replace(/\bvalquiria?\b/g, ' ').replace(/\s+/g, ' ').trim();

  // Solo la nombraron, o un hola y ya.
  if (/^(hola|buenas|hey|oye|epa|que bola|saludos|holi|ey)?[!?.,¡¿ ]*$/.test(q)) {
    return { tipo: 'decir', texto: AL_AZAR(SALUDOS), categoria: 'saludo' };
  }

  for (const c of CHARLA) {
    if (!c.patron.test(q)) continue;
    if (c.especial === 'esperando') return { tipo: 'esperando', categoria: c.nombre };
    return { tipo: 'decir', texto: AL_AZAR(c.respuestas), categoria: c.nombre };
  }
  // Sin categoria que case. El que llama puede probar con la IA antes de
  // soltar esta frase; por eso viaja la categoria.
  return { tipo: 'decir', texto: AL_AZAR(NO_ENTIENDO), categoria: 'no entiendo' };
}

/** Cuantas frases tiene el cerebro. Sirve de test y sale en el panel. */
export const cuantasFrasesValquiria = () =>
  CHARLA.reduce((n, c) => n + (c.respuestas?.length ?? 0), 0) +
  SALUDOS.length +
  NO_ENTIENDO.length +
  BIENVENIDAS_VALQUIRIA.length +
  BIENVENIDAS_VALQUIRIA_VARIOS.length;

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
