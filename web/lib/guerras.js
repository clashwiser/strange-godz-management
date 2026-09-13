// Lo que el cerebro y Heraldo necesitan de una guerra abierta: fase,
// rival, tiempos y quien tiene ataques sin usar. Lo puro (sin red) va
// primero, para poder probarlo; al final, la consulta a la API con cache.

/** "20260911T183000.000Z" -> ISO. La API de Clash trae las fechas asi. */
export const fechaClash = (s) =>
  s ? s.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})\.(\d{3})Z$/, '$1-$2-$3T$4:$5:$6.$7Z') : null;

/** Resumen de una guerra de la API (nuestro clan en `clan`). */
export function resumirGuerra(g) {
  // La guerra normal trae attacksPerMember (2); la de liga no lo trae: 1.
  const porMiembro = g.attacksPerMember ?? 1;
  const faltan = (g.clan?.members ?? [])
    .map((m) => ({ nombre: m.name, tag: m.tag, restantes: porMiembro - (m.attacks?.length ?? 0) }))
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
    // Los tags de los nuestros en el mapa: para saber si quien pregunta esta en esta guerra.
    miembros: (g.clan?.members ?? []).map((m) => m.tag),
  };
}

/** "5 h" o, si falta menos de una hora, "40 min". */
export function enCuanto(iso, ahora = Date.now()) {
  const min = Math.max(0, Math.round((new Date(iso).getTime() - ahora) / 60_000));
  return min >= 60 ? `${Math.round(min / 60)} h` : `${min} min`;
}

/**
 * "¿Estamos en guerra?" en la voz de Heraldo (HTML de Telegram): clan por
 * clan, la fase y cuanto falta. `mio` son los tags de quien pregunta, para
 * decirle lo suyo; `castilloHoy` si ya tiene el castillo de hoy anotado.
 */
export function textoGuerrasHeraldo(guerras, { esc = (s) => s, mio = [], castilloHoy = false, ahora = Date.now() } = {}) {
  const activas = guerras.filter((g) => g.estado === 'preparation' || g.estado === 'inWar');
  const privados = guerras.filter((g) => g.estado === 'privado').map((g) => esc(g.clan));
  const l = [];
  if (!activas.length) {
    l.push(`⚔️ Ahora mismo <b>ningún clan está en guerra</b> (${guerras.filter((g) => g.estado !== 'privado').map((g) => esc(g.clan)).join(', ')}).`);
  } else {
    l.push('⚔️ <b>Guerras ahora</b>');
    l.push('');
    for (const g of activas) {
      const que = g.liga ? 'liga' : 'guerra';
      if (g.estado === 'preparation') {
        l.push(`🛡 <b>${esc(g.clan)}</b> · ${que} contra <b>${esc(g.rival)}</b>: <b>día de preparación</b>, la batalla empieza en <b>${enCuanto(g.empieza, ahora)}</b>.`);
      } else {
        const quedan = g.faltan.length;
        l.push(
          `🔥 <b>${esc(g.clan)}</b> · ${que} contra <b>${esc(g.rival)}</b>: <b>día de batalla</b>, quedan <b>${enCuanto(g.termina, ahora)}</b> · ${g.estrellas.nosotros ?? 0}⭐ – ${g.estrellas.ellos ?? 0}⭐ · ` +
            (quedan ? `faltan <b>${quedan}</b> por atacar (/faltan).` : 'todos atacaron ✅')
        );
      }
      if (g.siguiente) l.push(`   Siguiente ronda contra <b>${esc(g.siguiente.rival)}</b>, empieza en ${enCuanto(g.siguiente.empieza, ahora)}.`);
    }
    const quietos = guerras.filter((g) => g.estado === 'notInWar' || g.estado === 'warEnded').map((g) => esc(g.clan));
    if (quietos.length) l.push(`💤 Sin guerra: ${quietos.join(', ')}.`);
  }
  if (privados.length) l.push(`🔒 ${privados.join(' y ')}: registro de guerra privado, no lo veo.`);

  // El pie. El castillo se dona solo en el dia de preparacion (en CWL, el de
  // la ronda siguiente corre mientras se pelea la de hoy: `siguiente`); en
  // el dia de batalla ya esta cerrado y lo que cuenta son los ataques. A
  // quien esta en una guerra abierta se le dice lo suyo; al resto, en general.
  const estaYo = (g) => g?.miembros?.some((t) => mio.includes(t));
  const preparando = [
    ...activas.filter((g) => g.estado === 'preparation'),
    ...activas.filter((g) => g.siguiente?.estado === 'preparation').map((g) => ({ ...g.siguiente, clan: g.clan })),
  ];
  const peleando = activas.filter((g) => g.estado === 'inWar');
  const pie = [];
  if (preparando.some(estaYo)) {
    pie.push(
      castilloHoy
        ? '🏰 Tu castillo de hoy ya está anotado. 📜'
        : `🏰 <b>¿Ya donaste tu castillo?</b> Llénale el del que está debajo de ti antes del día de batalla y mándame la captura del mapa con <code>/castillo</code>: ganas <b>10 puntos</b>.`
    );
  }
  const misBatallas = peleando.filter(estaYo);
  if (misBatallas.length) {
    const cuentas = new Set(misBatallas.flatMap((g) => g.miembros.filter((t) => mio.includes(t)))).size;
    const quedan = misBatallas.flatMap((g) => g.faltan.filter((m) => mio.includes(m.tag))).reduce((n, m) => n + m.restantes, 0);
    const tuyos = cuentas > 1 ? `entre tus ${cuentas} cuentas te` : 'te';
    pie.push(
      quedan
        ? `⚔️ El castillo ya cerró; ahora lo que cuenta es atacar, y ${tuyos} ${quedan === 1 ? 'queda <b>1</b> ataque' : `quedan <b>${quedan}</b> ataques`}. No lo dejes para el final.`
        : '⚔️ El castillo ya cerró, y tú ya atacaste con todo ✅.'
    );
  }
  if (!pie.length && activas.length) {
    pie.push(
      preparando.length
        ? `🏰 Los de ${preparando.map((g) => esc(g.clan)).join(' y ')}: donen el castillo del de abajo y manden la captura con <code>/castillo</code>, que son <b>10 puntos</b>.`
        : `⚔️ Ya es día de batalla: el castillo cerró, ahora lo que cuenta es que nadie se quede sin atacar (/faltan).`
    );
  }
  if (pie.length) l.push('', ...pie);
  return l.join('\n');
}

// ---------- Con red: las guerras de toda la alianza, con cache corta ----------

let cache = { hasta: 0, guerras: null };
const CACHE_MS = 90_000;

/**
 * El estado de guerra de cada clan de la alianza, preguntado al juego. Con
 * cache de minuto y medio: en el grupo pregunta mucha gente a la vez y
 * son diez llamadas por consulta.
 */
export async function guerrasDeLaAlianza(admin, guerrasAbiertas) {
  if (cache.guerras && Date.now() < cache.hasta) return cache.guerras;
  const { data: clans } = await admin.from('clans').select('clan_tag, nombre, escuadra').order('escuadra');
  const guerras = await Promise.all(
    (clans ?? []).map(async (c) => {
      const { abiertas, privado } = await guerrasAbiertas(c.clan_tag);
      return estadoDelClan(c, abiertas, { privado });
    })
  );
  cache = { hasta: Date.now() + CACHE_MS, guerras };
  return guerras;
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
