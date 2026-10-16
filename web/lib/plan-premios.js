// El plan de premios de un mes, heredado del anterior si nadie lo cargo.
//
// Los premios son los mismos casi todos los meses, pero cada mes empieza
// sin plan: hasta que un lider lo cargaba en la pestaña Bonos, /premios
// sacaba el cartel vacio ("los premios de este mes están por publicar").
// Paso el 16 oct 2026: octubre sin plan y el cartel en blanco a mitad de
// mes. Ahora el mes que no tiene plan se queda con el del mes anterior,
// guardado de verdad, asi que en Bonos se ve y se puede cambiar.

/** '2026-10' -> '2026-09'; '2026-01' -> '2025-12'. */
export function mesAnterior(mes) {
  const [a, m] = String(mes).split('-').map(Number);
  return m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, '0')}`;
}

const COLUMNAS = 'titulo, criterio, clan_tag, monto_usd, tipo, orden, activo';

/** Las filas del plan de un mes que se copian al siguiente: las mismas, con el mes nuevo. */
export function filasHeredadas(plan, mes) {
  return (plan ?? []).map((p) => ({
    mes,
    orden: p.orden ?? 0,
    titulo: p.titulo,
    criterio: p.criterio ?? null,
    clan_tag: p.clan_tag ?? null,
    monto_usd: p.monto_usd ?? 0,
    tipo: p.tipo,
    activo: p.activo !== false,
  }));
}

/**
 * Los premios activos de `mes`. Si el mes no tiene ninguno, los del mes
 * anterior: con `guardar`, copiados al mes nuevo (asi el cartel y la lista
 * dicen lo mismo y en Bonos aparecen para editarlos); sin el, solo leidos,
 * para quien dibuja y no debe escribir (el cartel es un GET).
 *
 * Solo se hereda si el mes no tiene NINGUNA fila, ni siquiera apagada: un
 * mes donde los lideres apagaron todo es una decision, no un olvido.
 *
 * @returns {Promise<{ premios: object[], heredado: boolean }>}
 */
export async function planDelMes(admin, mes, { guardar = false } = {}) {
  const { data: todas } = await admin.from('premios_plan').select(COLUMNAS).eq('mes', mes).order('orden');
  if (todas?.length) return { premios: todas.filter((p) => p.activo), heredado: false };

  const { data: previo } = await admin.from('premios_plan').select(COLUMNAS).eq('mes', mesAnterior(mes)).order('orden');
  if (!previo?.length) return { premios: [], heredado: false };

  const nuevas = filasHeredadas(previo, mes);
  if (guardar) {
    // Dos /premios a la vez el dia 1: el segundo choca con (mes, titulo) y
    // se ignora, sin error ni filas repetidas.
    const { error } = await admin.from('premios_plan').upsert(nuevas, { onConflict: 'mes,titulo', ignoreDuplicates: true });
    if (error) console.error(`[premios] no pude heredar el plan de ${mesAnterior(mes)} a ${mes}: ${error.message}`);
  }
  return { premios: nuevas.filter((p) => p.activo), heredado: true };
}
