// Los tipos de mensaje de la bandeja de salida, en un solo sitio.
//
// Son dos bandejas distintas y confundirlas da sustos: lo que genera un
// líder desde el panel (la lista de CWL, los premios, una felicitación,
// las normas) se queda esperando a que alguien lo apruebe y lo mande, y
// eso es lo normal, no una avería. Lo que generan los robots (avisos de
// guerra y CWL, el parte, los videos) sale solo por Heraldo: si eso se
// queda pendiente, ahí sí hay algo roto.
//
// El 2 oct 2026 el Cerebro daba "Bandeja de salida: FALLA · 17
// pendientes" y 12 de esos 17 eran listas de CWL que Cris había generado
// y no había mandado todavía.

/** Lo que espera a que un líder lo apruebe y lo mande desde el panel. */
export const POR_APROBAR = new Set(['alineacion_cwl', 'premios_del_mes', 'felicitacion', 'reglas']);

/** El nombre bonito de cada tipo, para el panel. */
export const NOMBRE_TIPO = {
  alineacion_cwl: 'Lista CWL',
  premios_del_mes: 'Premios del mes',
  felicitacion: 'Felicitación',
  reglas: 'Normas',
  alerta_cwl: 'Aviso de CWL',
  alerta_guerra: 'Aviso de guerra',
  cwl_heraldo: 'Parte de CWL',
  youtube: 'Video de YouTube',
  medallas_cwl: 'Medallas de CWL',
};

/**
 * Reparte lo pendiente del outbox en lo que espera a un líder y lo que
 * se atascó solo.
 *
 * @param {{tipo:string, estado:string}[]} filas
 */
export function repartirOutbox(filas) {
  const pendientes = (filas ?? []).filter((m) => m?.estado === 'pendiente');
  const porAprobar = pendientes.filter((m) => POR_APROBAR.has(m.tipo)).length;
  return { porAprobar, atascados: pendientes.length - porAprobar, total: pendientes.length };
}
