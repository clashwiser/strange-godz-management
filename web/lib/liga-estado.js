// En que va la liga (CWL) del mes, para el titulo de /estrellas: "Liga de
// septiembre (pasada)", "(en curso)" o "(pendiente)". Puro. Lo pidio Cris
// el 13 sep 2026: la tabla decia "2026-09" y la liga ya habia terminado.

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** "2026-09" -> "septiembre". */
export function mesDe(temporada) {
  const n = Number(String(temporada).slice(5, 7));
  return MESES[n - 1] ?? temporada;
}

/** "2026-09" -> "2026-08". */
export function temporadaAnterior(temporada) {
  const [a, m] = String(temporada).split('-').map(Number);
  const d = new Date(Date.UTC(a, m - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * 'en curso' | 'pasada' a partir de las rondas guardadas (cwl_wars:
 * { ronda, estado }). Pasada cuando la septima ronda ya termino; si no
 * hay rondas, null (no ha empezado: pendiente).
 */
export function estadoDeLiga(wars) {
  const rondas = (wars ?? []).filter((w) => w && w.ronda != null);
  if (!rondas.length) return null;
  const abierta = rondas.some((w) => w.estado === 'preparation' || w.estado === 'inWar');
  if (abierta) return 'en curso';
  const ultima = Math.max(...rondas.map((w) => Number(w.ronda)));
  return ultima >= 7 ? 'pasada' : 'en curso';
}

/** El titulo: "⭐ Estrellas · Liga de septiembre (pasada) · por clan". */
export function tituloEstrellas(temporada, estado, b = (s) => `<b>${s}</b>`) {
  return `⭐ ${b(`Estrellas · Liga de ${mesDe(temporada)} (${estado})`)} · por clan`;
}
