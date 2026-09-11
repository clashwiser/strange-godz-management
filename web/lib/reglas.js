// Las normas del clan: como se detecta que alguien pregunta por ellas, y
// como se convierten de Markdown a HTML (para la pagina publica /reglas)
// y a texto de Telegram (el resumen).
//
// El texto vive en config.reglas (Markdown) y config.reglas_resumen, que
// los lideres editan en la pestaña Reglas. Ver sql/026_reglas.sql. Puro.

const plano = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

// "las reglas", "cuales son las normas", "hay que donar el castillo?",
// "que pasa si no ataco", "se puede tener dos cuentas"...
const REGLAS = /\b(reglas?|normas?|normativa|requisitos?|obligatorio|obligatoria|permitido|permiten|se puede|puedo|prohibido|sancion|sanciones|sancionan|expulsan|expulsar|expulsion|castigo|castigan|botan|minimo de|que pasa si)\b/;

/** True si el texto pregunta por las normas o por lo que se puede o no. */
export function esPreguntaDeReglas(texto) {
  const q = plano(texto);
  return REGLAS.test(q);
}

/** Pide LAS normas enteras (no una duda concreta): "/reglas", "las normas", "manda las reglas". */
export function pideLasReglas(texto) {
  const q = plano(texto).trim();
  return /^\/?(reglas|normas)\b/.test(q) || /\b(las|tus|sus|nuestras|esas) (reglas|normas)\b/.test(q) || /\b(reglas|normas) del clan\b/.test(q);
}

/** El mensaje de Telegram con el resumen y el enlace a las normas completas. */
export function mensajeReglas({ resumen, url, fecha, esc = (s) => s }) {
  const cuerpo = esc(String(resumen ?? '').trim());
  return `${cuerpo}\n\n📖 Completas: ${url}${fecha ? ` (actualizadas el ${fecha})` : ''}`;
}

const escHtml = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Markdown pequeño a HTML: titulos (#, ##), listas (-, 1.), negrita
 * (**), cursiva (*), codigo (`) y parrafos. Es lo que usan las normas;
 * no hace falta mas, y asi no entra una dependencia por esto.
 */
export function markdownAHtml(md) {
  const enLinea = (t) =>
    escHtml(t)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
      .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<i>$2</i>');
  const salida = [];
  let lista = null; // 'ul' | 'ol'
  const cerrarLista = () => {
    if (lista) salida.push(`</${lista}>`);
    lista = null;
  };
  for (const cruda of String(md ?? '').split('\n')) {
    const linea = cruda.trimEnd();
    if (!linea.trim()) {
      cerrarLista();
      continue;
    }
    const h = /^(#{1,3})\s+(.*)$/.exec(linea);
    if (h) {
      cerrarLista();
      salida.push(`<h${h[1].length}>${enLinea(h[2])}</h${h[1].length}>`);
      continue;
    }
    const ul = /^\s*[-*]\s+(.*)$/.exec(linea);
    const ol = /^\s*\d+[.)]\s+(.*)$/.exec(linea);
    if (ul || ol) {
      const tipo = ul ? 'ul' : 'ol';
      if (lista !== tipo) {
        cerrarLista();
        lista = tipo;
        salida.push(`<${tipo}>`);
      }
      salida.push(`<li>${enLinea((ul ?? ol)[1])}</li>`);
      continue;
    }
    cerrarLista();
    salida.push(`<p>${enLinea(linea)}</p>`);
  }
  cerrarLista();
  return salida.join('\n');
}
