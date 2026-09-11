// Las lecciones que los lideres les dan a los bots desde la pestaña Bots:
// "cuando digan X, responde Y". Van ANTES que el cerebro de frases y que
// la IA, porque son la unica forma que tienen Carlos y Deibis de corregir
// a un bot sin tocar codigo.
//
// Puro: sin red, sin base. La misma funcion la usa el panel para el
// probador ("escribe algo y mira que contestaria") y los webhooks para
// contestar de verdad, asi que lo que el lider ve al probar es lo que
// pasa despues. Se prueba en test/lecciones.test.js.

const plano = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/@\w+/g, ' ')
    .replace(/[^a-z0-9ñ#\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

// Palabras que no dicen nada por si solas: si una leccion es "como entro
// al clan", lo que tiene que aparecer es "entro" y "clan", no "como" y "al".
const VACIAS = new Set(
  'a al ante bajo con contra de del desde en entre hacia hasta para por segun sin sobre tras y o u e ni que quien quienes cual cuales como cuando cuanto cuanta cuantos cuantas donde el la los las un una unos unas lo le les me te se nos os mi mis tu tus su sus este esta estos estas ese esa esos esas aquel aquella es son soy eres esta estan estoy hay ya no si mas muy tan todo toda todos todas otro otra pero porque pues bueno oye oe hola heraldo valquiria valqui bot'.split(
    ' '
  )
);

const palabras = (s) => plano(s).split(' ').filter((p) => p.length >= 3 && !VACIAS.has(p));

/**
 * La leccion que aplica a un texto, o null. Vale si el texto contiene
 * la leccion tal cual, o si contiene todas sus palabras con sustancia
 * (en cualquier orden). Con varias, gana la mas larga: es la mas
 * especifica.
 *
 * @param {Array<{bot:string, cuando:string, respuesta:string, activa?:boolean}>} lecciones
 * @param {string} texto   lo que escribio la persona
 * @param {'heraldo'|'valquiria'} bot  quien esta contestando
 */
export function elegirLeccion(lecciones, texto, bot) {
  const q = plano(texto);
  if (!q) return null;
  const qPalabras = new Set(q.split(' '));

  let mejor = null;
  for (const l of lecciones ?? []) {
    if (l.activa === false) continue;
    if (l.bot && l.bot !== 'ambos' && l.bot !== bot) continue;
    const c = plano(l.cuando);
    if (!c) continue;
    const entera = q.includes(c);
    const claves = palabras(l.cuando);
    const porPalabras = claves.length > 0 && claves.every((p) => qPalabras.has(p));
    if (!entera && !porPalabras) continue;
    if (!mejor || c.length > plano(mejor.cuando).length) mejor = l;
  }
  return mejor;
}

/** La respuesta de una leccion con {nombre} puesto. */
export function aplicarLeccion(leccion, nombre = null) {
  return String(leccion?.respuesta ?? '').replace(/\{nombre\}/g, nombre || 'socio');
}
