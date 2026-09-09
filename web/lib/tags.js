// Normalizacion de tags de Clash of Clans.
//
// Vive aqui, en web/, y no en src/lib/ con el resto de utilidades, por dos
// motivos: Vercel compila con la raiz en web/ y no alcanza a ../src, y los
// jobs no lo necesitan -leen tags ya normalizados de la base. La correccion
// pasa una sola vez, cuando una persona los escribe.

/**
 * Convierte lo que una persona pegue en un tag valido, o devuelve null.
 *
 * Acepta el tag suelto con o sin almohadilla, y el enlace de invitacion que
 * comparte el propio juego:
 *   https://link.clashofclans.com/es?action=OpenClanProfile&tag=2GC
 *   https://link.clashofclans.com/en?action=OpenClanProfile&tag=%232GC
 *
 * El alfabeto de tags de Supercell es 0289PYLQGRJCUV. No tiene la letra O:
 * lo que parece una O siempre es un cero, y copiando a mano desde una
 * captura eso se confunde constantemente, asi que en vez de rechazarlo se
 * convierte.
 *
 * Con la I no se hace lo mismo, aunque tiente: el alfabeto tampoco tiene el
 * 1, asi que convertir I en 1 daria un caracter igualmente invalido. Una I
 * en un tag es un error de lectura sin arreglo posible y se rechaza.
 */
export function normalizarTag(entrada) {
  if (!entrada) return null;
  let s = String(entrada).trim();

  // Si es un enlace, quedarse con el parametro tag.
  const m = /[?&]tag=([^&\s]+)/i.exec(s);
  if (m) {
    try {
      s = decodeURIComponent(m[1]);
    } catch {
      s = m[1]; // un % suelto rompe decodeURIComponent; se usa tal cual
    }
  }

  s = s.replace(/^#/, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  s = s.replace(/O/g, '0');

  if (!/^[0289PYLQGRJCUV]{3,12}$/.test(s)) return null;
  return `#${s}`;
}
