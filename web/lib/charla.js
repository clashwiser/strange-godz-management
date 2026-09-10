// Lo que Heraldo contesta cuando le hablan y no le estan pidiendo un dato.
//
// Por que NO hay un modelo de lenguaje detras, que es lo primero que uno
// piensa:
//
//   - Cuesta dinero todos los meses y la regla del proyecto es cero.
//   - Un modelo suelto contestandole a sesenta personas en nombre del clan
//     puede decir cualquier cosa, y el que queda mal es el clan.
//   - Y lo que de verdad se le pregunta a Heraldo son datos: bases, quien
//     no ataco, como va la liga. Eso ya lo responde, y de la base, sin
//     inventarse nada.
//
// Esto cubre lo otro: que cuando le tiren un cabo o lo insulten en broma,
// conteste como uno del grupo y no como una maquina. Varias respuestas por
// categoria y se elige al azar, porque un bot que contesta SIEMPRE lo mismo
// deja de tener gracia a la tercera vez.
//
// Espanol de Cuba y tuteo, como todo lo demas del panel.

const AL_AZAR = (lista) => lista[Math.floor(Math.random() * lista.length)];

const CHARLA = [
  {
    // Le tiran un cabo o lo insultan en broma. Es el caso que pidio Cris.
    nombre: 'protesta',
    patron: /\b(de pinga|pinga|comemierda|come mierda|mierda|singao|puñetero|punetero|eres malo|no sirves|que clase de bot|bot de|inutil|basura|odio)\b/,
    respuestas: [
      'Lo sé, mi hermano. Pero estas son las reglas, mi socio. 🛡',
      'Tranquilo, asere. Yo no pongo las reglas, yo solo las canto. 📜',
      'Me lo dicen mucho. Y aquí sigo, con el mismo pergamino. 😌',
      'Con calma, mi socio. Yo no me molesto, yo solo anuncio.',
    ],
  },
  {
    // Piden mas de la cuenta.
    nombre: 'pide mas',
    patron: /\b(otra|otro|una mas|uno mas|dame mas|solo una|nada mas una|tacaño|tacano|avaro|porfa|por favor dame)\b/,
    respuestas: [
      'Una por cabeza al día, mi hermano. Mañana hay otra. 📜',
      'Esa es la regla y a mí no me la cambian. Mañana temprano.',
      'Ya te di la tuya, socio. El pack se paga y se cuida.',
    ],
  },
  {
    nombre: 'saludo',
    patron: /\b(hola|buenas|que bola|que vola|que hubo|saludos|buenos dias|buenas noches|buenas tardes|klk)\b/,
    respuestas: [
      '¡Qué bola, mi hermano! ¿Buscas base o quieres saber cómo va la liga?',
      '¡Aquí andamos! Dime: base, estrellas, o quién no ha atacado.',
      'Dime, socio. Para eso estoy. 🎺',
    ],
  },
  {
    nombre: 'gracias',
    patron: /\b(gracias|graciass|thank|te pasaste|eres grande|el mejor|tremendo|bueno el bot|que bueno)\b/,
    respuestas: [
      'Para eso estoy, mi hermano. 🎺',
      'Nada, socio. A romper esa base.',
      'De nada. Y ataca temprano, que después no hay quien te salve. 😄',
    ],
  },
  {
    nombre: 'quien eres',
    patron: /\b(quien eres|que eres|eres un bot|eres humano|quien te hizo|como funcionas)\b/,
    respuestas: [
      'El heraldo de Strange Godz. Traigo el parte de la CWL, reparto las bases y canto a quién le falta atacar. 📜',
      'Soy el que anuncia. Lo que digo sale de los datos del clan, no me lo invento.',
    ],
  },
  {
    nombre: 'chiste',
    patron: /\b(jaja|jeje|jajaja|lol|xd|😂|🤣)\b/,
    respuestas: [
      '😄 Pero no te rías tanto, que todavía te faltan ataques.',
      'Jaja. Ahora en serio: ¿ya atacaste?',
    ],
  },
];

/**
 * Devuelve una respuesta de charla, o null si no es charla.
 * El texto llega ya en minusculas y sin tildes.
 */
export function charlar(q) {
  for (const c of CHARLA) {
    if (c.patron.test(q)) return AL_AZAR(c.respuestas);
  }
  return null;
}
