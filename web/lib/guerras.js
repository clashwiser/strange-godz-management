// Lo que el cerebro necesita de una guerra abierta: fase, rival, tiempos y
// quien tiene ataques sin usar. Puro (sin red), para poder probarlo.

/** "20260911T183000.000Z" -> ISO. La API de Clash trae las fechas asi. */
export const fechaClash = (s) =>
  s ? s.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})\.(\d{3})Z$/, '$1-$2-$3T$4:$5:$6.$7Z') : null;

/** Resumen de una guerra de la API (nuestro clan en `clan`). */
export function resumirGuerra(g) {
  // La guerra normal trae attacksPerMember (2); la de liga no lo trae: 1.
  const porMiembro = g.attacksPerMember ?? 1;
  const faltan = (g.clan?.members ?? [])
    .map((m) => ({ nombre: m.name, restantes: porMiembro - (m.attacks?.length ?? 0) }))
    .filter((m) => m.restantes > 0)
    .sort((a, b) => b.restantes - a.restantes || a.nombre.localeCompare(b.nombre));
  return {
    estado: g.state,
    liga: g.attacksPerMember == null,
    rival: g.opponent?.name ?? null,
    tamano: g.teamSize ?? null,
    porMiembro,
    empieza: fechaClash(g.startTime),
    termina: fechaClash(g.endTime),
    estrellas: { nosotros: g.clan?.stars ?? null, ellos: g.opponent?.stars ?? null },
    faltan,
  };
}

/**
 * El estado de un clan a partir de sus guerras abiertas (0, 1 o 2): la que
 * esta en batalla manda; si ademas hay una en preparacion (en CWL
 * coexisten un dia), va en `siguiente`. Sin ninguna: notInWar, o
 * `privado` si la API no deja ver la guerra normal (registro privado).
 */
export function estadoDelClan(clan, abiertas, { privado = false } = {}) {
  const resumenes = abiertas.map(resumirGuerra);
  if (!resumenes.length) return { clan: clan.nombre, tag: clan.clan_tag, estado: privado ? 'privado' : 'notInWar' };
  const batalla = resumenes.find((g) => g.estado === 'inWar');
  const preparacion = resumenes.find((g) => g.estado === 'preparation');
  const principal = batalla ?? preparacion;
  return { clan: clan.nombre, tag: clan.clan_tag, ...principal, siguiente: batalla && preparacion ? preparacion : null };
}
