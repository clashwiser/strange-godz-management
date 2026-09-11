// "¿Quién falta por atacar?" en palabras, a partir de lo que devuelve
// /api/guerras: clan por clan, en que fase esta y quien tiene ataques sin
// usar. Lo usan la burbuja del cerebro y la terminal del laboratorio, para
// que contesten igual. `t` es el traductor del panel.

/** El patron que reconoce la pregunta (sobre el texto ya normalizado). */
export const PREGUNTA_FALTAN = /(falta|sin atacar|no\s+(ha\s+|han\s+)?atac|quien debe|pendiente.*(ata[cq]|guerra)|(ata[cq]|guerra).*pendiente)/;

/** "5 h" o, si falta menos de una hora, "40 min". */
function enCuanto(iso) {
  const min = Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 60_000));
  return min >= 60 ? `${Math.round(min / 60)} h` : `${min} min`;
}

export function textoDeGuerras(guerras, t) {
  const activas = guerras.filter((g) => g.estado === 'preparation' || g.estado === 'inWar');
  // Clanes con el registro de guerra privado: la API no enseña su guerra
  // normal, y eso se dice en vez de darlos por "sin guerra".
  const privados = guerras.filter((g) => g.estado === 'privado').map((g) => g.clan);
  const nota = privados.length
    ? `\n\n${t('No puedo ver la guerra normal de')} ${privados.join(', ')}: ${t('registro de guerra privado. Si lo ponen público, la miro.')}`
    : '';
  if (!activas.length) {
    const visibles = guerras.filter((g) => g.estado !== 'privado').map((g) => g.clan);
    return (
      `${t('Ahora mismo ningún clan está en guerra')} (${visibles.join(', ')}). ` +
      t('Cuando empiece el día de batalla, pregúntame y te digo quién falta.') +
      nota
    );
  }
  const bloques = activas.map((g) => {
    const que = g.liga ? t('liga') : t('guerra');
    if (g.estado === 'preparation') {
      return `${g.clan} · ${que} ${t('contra')} ${g.rival}: ${t('día de preparación')}, ${t('la batalla empieza en {x}').replace('{x}', enCuanto(g.empieza))}. ${t('Todavía nadie tiene que atacar.')}`;
    }
    const cab = `${g.clan} · ${que} ${t('contra')} ${g.rival} (${g.estrellas.nosotros ?? 0}⭐ – ${g.estrellas.ellos ?? 0}⭐, ${t('quedan {x}').replace('{x}', enCuanto(g.termina))})`;
    const sig = g.siguiente ? `\n${t('Siguiente ronda')}: ${t('contra')} ${g.siguiente.rival}, ${t('la batalla empieza en {x}').replace('{x}', enCuanto(g.siguiente.empieza))}.` : '';
    if (!g.faltan.length) return `${cab}: ${t('todos atacaron')} ✅${sig}`;
    return `${cab}\n${t('Faltan por atacar')}:\n` + g.faltan.map((m) => `• ${m.nombre}${m.restantes > 1 ? ` — ${m.restantes}` : ''}`).join('\n') + sig;
  });
  return bloques.join('\n\n') + nota;
}
