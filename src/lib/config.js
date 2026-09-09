// Configuracion de los clanes. Los tags viven en el entorno para no
// commitearlos al repo publico de codigo.
//
// CLAN_TAGS = "#AAAA:A,#BBBB:B,#CCCC:C"   (tag:escuadra, separados por coma)

const crudo = process.env.CLAN_TAGS || '';

export const CLANES = crudo
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
  .map((par) => {
    const [tag, escuadra] = par.split(':').map((x) => x.trim());
    if (!tag || !escuadra) {
      throw new Error(`CLAN_TAGS mal formado en "${par}". Formato: #TAG:A`);
    }
    return { clan_tag: tag.toUpperCase(), escuadra: escuadra.toUpperCase() };
  });

if (CLANES.length === 0) {
  throw new Error('CLAN_TAGS vacio. Formato: "#AAAA:A,#BBBB:B,#CCCC:C"');
}

/** Temporada de CWL en formato YYYY-MM segun la fecha UTC de hoy. */
export function temporadaActual(d = new Date()) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Fecha UTC de hoy en YYYY-MM-DD. */
export function hoyUTC(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

/** Cuantas horas faltan para un instante dado. */
export function horasHasta(fecha, ahora = new Date()) {
  return (fecha.getTime() - ahora.getTime()) / 3_600_000;
}
