// Comparar nombres de jugadores tal como los escribe la gente y tal como
// los lee un OCR.
//
// Los nombres del juego van llenos de adorno: «ΛVΞNTUS», ﹏⪻ΛＶΞＮΤＵՏ⪼﹏,
// ﹏⪨ΛՏՏΛՏՏI͏N͏Տ⪩﹏. Letras griegas y armenias que imitan latinas, letras de
// ancho completo, marcas invisibles, simbolos alrededor. Y luego alguien
// escribe "/soy Aventus" o el modelo lee "AVENTUS" en una captura: tienen
// que casar. Aqui se reducen todos a lo mismo: minusculas ASCII y digitos.

// Letras de adorno y la latina que imitan. Se aplica DESPUES de pasar a
// minusculas (Λ baja a λ) y de NFKD (Ｖ de ancho completo baja a v).
const ADORNOS = {
  'λ': 'a', 'δ': 'a', 'ʌ': 'a', '∆': 'a', '∧': 'a', '⋀': 'a', '🔺': 'a', '▲': 'a', 'ᗩ': 'a', 'α': 'a',
  'ξ': 'e', 'σ': 'e', 'є': 'e', 'ε': 'e', '∑': 'e', 'ᗴ': 'e',
  'ø': 'o', 'θ': 'o', 'φ': 'o', 'ω': 'o', '⚫': 'o', '⚪': 'o', '●': 'o', '○': 'o', '◯': 'o', '⭕': 'o', '◉': 'o', '🔴': 'o', '🔵': 'o', 'ᗝ': 'o', 'о': 'o',
  'ð': 'd', 'ß': 'b', 'ᗪ': 'd', 'ᗷ': 'b',
  'π': 'n', 'и': 'n', 'ᑎ': 'n', 'η': 'n',
  'я': 'r', 'ш': 'w', 'ψ': 'y', 'ч': 'y', 'ᖇ': 'r', 'г': 'r',
  'ѕ': 's', 'ս': 's', 'տ': 's', '$': 's',
  'ι': 'i', 'ν': 'v', 'τ': 't', 'κ': 'k', 'ρ': 'p', 'μ': 'u', 'υ': 'u', 'ᛕ': 'k', 'ᒪ': 'l', 'ᗰ': 'm', 'ᑭ': 'p', 'ᑌ': 'u', 'ᐯ': 'v', '᙭': 'x', 'ᑕ': 'c', 'ᕼ': 'h', 'ᖴ': 'f', 'ᘜ': 'g', 'ᒍ': 'j', 'ᑫ': 'q', 'т': 't', 'к': 'k', 'м': 'm', 'н': 'h', 'в': 'b', 'у': 'y', 'х': 'x', 'с': 'c', 'а': 'a', 'е': 'e', 'р': 'p',
};

// Digitos que la gente usa como letras: "LIO D10S" es "LIO DIOS", "x300" se
// queda como esta (se aplica a los dos lados de la comparacion, asi que da
// igual). Solo para la busqueda laxa, no para el nombre reducido normal.
const DIGITOS_LETRA = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't' };

/** El nombre reducido a minusculas ASCII y digitos: "«ΛVΞNTUS»" -> "aventus". */
export const plano = (s) =>
  String(s ?? '')
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^\x00-\x7f]/g, (c) => ADORNOS[c] ?? c)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '');

/** Como plano, pero con los digitos que hacen de letra: "LIO D10S" -> "liodios". */
export const planoLaxo = (s) => plano(s).replace(/[013457]/g, (d) => DIGITOS_LETRA[d]);

/**
 * Dos nombres "se parecen" si, reducidos, son iguales, uno contiene al otro
 * (con al menos tres letras) o difieren en un par de letras: "Assasins"
 * leido por el OCR es "Assassins".
 */
export function parecidos(a, b) {
  const x = plano(a);
  const y = plano(b);
  if (!x || !y) return false;
  if (x === y) return true;
  if (x.length >= 3 && y.length >= 3 && (x.includes(y) || y.includes(x))) return true;
  if (Math.abs(x.length - y.length) > 2) return false;
  const m = x.length;
  const n = y.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n] <= (Math.max(m, n) >= 6 ? 2 : 1);
}
