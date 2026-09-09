// Como va el clan en su grupo de CWL, y que tiene que pasar para subir o
// no bajar.
//
// Modulo PURO a proposito: sin imports, sin red, sin base. Lo usan los dos
// lados -el panel en el navegador y el job que manda los mensajes de
// Telegram- y si cada uno hiciera su propia cuenta acabarian diciendo
// numeros distintos del mismo dia, que es peor que no decir nada.
//
// Las reglas de la liga, confirmadas contra la documentacion del juego:
//
//   - estrellas del clan = las de sus ataques + 10 por cada guerra GANADA.
//     El bono de 10 es lo que hace que ganar pese mas que hacer estrellas:
//     x300 lleva 283 de ataque, mas que Dragon Blade y UAE, y va por detras
//     de los dos porque ellos ganaron cuatro guerras y x300 dos.
//   - Empate a estrellas en una guerra: gana quien tenga mas destruccion.
//     Si tambien empatan, no gana nadie y nadie cobra el bono.
//   - Desempate de la tabla general: destruccion total acumulada.
//   - Cuantos suben y cuantos bajan lo dice la tabla cwl_ligas, que se
//     puede corregir con un UPDATE. Ver sql/015_cwl_grupo.sql.

/** Maximo que un clan puede sacar en una ronda: 3 por rival + el bono. */
export const topeRonda = (tamano = 15) => tamano * 3 + 10;

const numero = (x) => Number(x ?? 0);

/**
 * Reconstruye la tabla del grupo desde las filas crudas de cwl_grupo.
 *
 * La vista SQL cwl_tabla hace esto mismo y es la que manda para lo que se
 * pinta. Esta version existe porque la simulacion necesita el detalle ronda
 * a ronda, que la vista ya agrego, y no tiene sentido bajar los datos dos
 * veces.
 */
export function tablaDesdeGrupo(filas) {
  const clanes = new Map();

  const lado = (tag, nombre, mias, midestr, suyas, sudestr, estado, ronda) => {
    if (!tag) return;
    if (!clanes.has(tag)) {
      clanes.set(tag, {
        clan_tag: tag,
        nombre,
        estrellas_ataque: 0,
        estrellas: 0,
        destruccion: 0,
        ganadas: 0,
        rondas_cerradas: 0,
        // Estrellas de ataque de cada ronda cerrada. Es la muestra con la
        // que se simulan las rondas que faltan.
        porRonda: [],
        pendientes: [],
      });
    }
    const c = clanes.get(tag);
    if (nombre) c.nombre = nombre;

    if (estado === 'warEnded') {
      const gano =
        numero(mias) > numero(suyas) ||
        (numero(mias) === numero(suyas) && numero(midestr) > numero(sudestr));
      c.estrellas_ataque += numero(mias);
      c.destruccion += numero(midestr);
      c.ganadas += gano ? 1 : 0;
      c.estrellas += numero(mias) + (gano ? 10 : 0);
      c.rondas_cerradas += 1;
      c.porRonda.push(numero(mias));
    } else {
      c.pendientes.push(ronda);
    }
  };

  for (const f of filas) {
    lado(f.clan_a_tag, f.clan_a_nombre, f.estrellas_a, f.destruccion_a, f.estrellas_b, f.destruccion_b, f.estado, f.ronda);
    lado(f.clan_b_tag, f.clan_b_nombre, f.estrellas_b, f.destruccion_b, f.estrellas_a, f.destruccion_a, f.estado, f.ronda);
  }

  return [...clanes.values()]
    .sort((a, b) => b.estrellas - a.estrellas || b.destruccion - a.destruccion)
    .map((c, i) => ({ ...c, puesto: i + 1 }));
}

/**
 * Los enfrentamientos que todavia no han cerrado, por ronda.
 *
 * Se lleva tambien lo que cada lado lleva hecho: una guerra en curso no
 * empieza de cero. La ronda 7 de x300 iba 30-28 cuando esto se escribio, y
 * simularla como si no hubiera pasado nada tira justo el dato que mas pesa.
 */
export function rondasPendientes(filas) {
  return filas
    .filter((f) => f.estado !== 'warEnded')
    .map((f) => ({
      ronda: f.ronda,
      a: f.clan_a_tag,
      b: f.clan_b_tag,
      estado: f.estado,
      hechoA: numero(f.estrellas_a),
      hechoB: numero(f.estrellas_b),
    }))
    .sort((x, y) => x.ronda - y.ronda);
}

/**
 * Reparte una ronda simulada y devuelve la tabla final.
 *
 * Las estrellas de cada clan se sacan a suertes de SU PROPIO historial de
 * esta liga (remuestreo): no se asume ninguna campana de Gauss ni una media
 * inventada, se usa lo que ese clan ha hecho de verdad en las rondas ya
 * cerradas. Con seis rondas jugadas la muestra es corta pero es real.
 */
function unaSimulacion(base, pendientes, azar) {
  const acumulado = new Map(base.map((c) => [c.clan_tag, { e: c.estrellas, d: c.destruccion }]));

  for (const p of pendientes) {
    const ca = base.find((c) => c.clan_tag === p.a);
    const cb = base.find((c) => c.clan_tag === p.b);
    if (!ca || !cb) continue;

    // Lo ya hecho es el suelo: nadie pierde estrellas que ya tiene. En una
    // guerra en curso eso es la mitad de la informacion.
    const tirar = (c, hecho) =>
      Math.max(hecho, c.porRonda.length ? c.porRonda[Math.floor(azar() * c.porRonda.length)] : 0);
    const ea = tirar(ca, p.hechoA);
    const eb = tirar(cb, p.hechoB);

    const ga = acumulado.get(p.a);
    const gb = acumulado.get(p.b);
    ga.e += ea;
    gb.e += eb;
    // La destruccion se aproxima por la media del clan: solo se usa para
    // desempatar y no cambia el resultado salvo en empates exactos.
    const medio = (c) => (c.rondas_cerradas ? c.destruccion / c.rondas_cerradas : 0);
    ga.d += medio(ca);
    gb.d += medio(cb);

    if (ea > eb) ga.e += 10;
    else if (eb > ea) gb.e += 10;
    // Empate exacto de estrellas: decide la destruccion de esa ronda, que
    // aqui no se simula, asi que no se da el bono a nadie. Pasa poco.
  }

  return [...acumulado.entries()]
    .map(([tag, v]) => ({ tag, ...v }))
    .sort((x, y) => y.e - x.e || y.d - x.d);
}

/** Generador reproducible: dos corridas con la misma semilla dan lo mismo. */
function generador(semilla = 20260909) {
  let s = semilla >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * Analiza como va un clan y que puede pasarle.
 *
 * `probabilidades` sale de simular las rondas que faltan muchas veces. NO
 * es una corazonada: cada clan tira estrellas de su propio historial de
 * esta liga. Cuando ya no queda nada por jugar no hay simulacion, hay
 * resultado, y las probabilidades son 0 o 1.
 */
export function analizar({ filas, clanTag, promueven = 2, descienden = 2, iteraciones = 4000 }) {
  const tabla = tablaDesdeGrupo(filas);
  const yo = tabla.find((c) => c.clan_tag === clanTag);
  if (!yo) return null;

  const pendientes = rondasPendientes(filas);
  const total = tabla.length;
  // Puesto a partir del cual se baja. Con 8 clanes y 2 que bajan, es el 7.
  const cortePierde = total - descienden + 1;

  const enAscenso = yo.puesto <= promueven;
  const enDescenso = descienden > 0 && yo.puesto >= cortePierde;

  // Margen: cuantas estrellas hay entre nosotros y la linea, en la
  // direccion que importa.
  const enPuesto = (n) => tabla.find((c) => c.puesto === n) ?? null;
  const ultimoQueSube = enPuesto(promueven);
  const primeroQueBaja = enPuesto(cortePierde);

  const faltanParaSubir =
    promueven > 0 && !enAscenso && ultimoQueSube ? ultimoQueSube.estrellas - yo.estrellas : 0;
  const margenSobreDescenso =
    descienden > 0 && !enDescenso && primeroQueBaja ? yo.estrellas - primeroQueBaja.estrellas : 0;

  // ---- Simulacion ----
  let sube = 0;
  let baja = 0;
  const puestos = new Array(total + 1).fill(0);

  if (!pendientes.length) {
    sube = enAscenso ? iteraciones : 0;
    baja = enDescenso ? iteraciones : 0;
    puestos[yo.puesto] = iteraciones;
  } else {
    const azar = generador();
    for (let i = 0; i < iteraciones; i++) {
      const fin = unaSimulacion(tabla, pendientes, azar);
      const p = fin.findIndex((c) => c.tag === clanTag) + 1;
      puestos[p] += 1;
      if (p <= promueven) sube += 1;
      if (descienden > 0 && p >= cortePierde) baja += 1;
    }
  }

  // Nuestra guerra de la ronda que viene, que es de lo que habla la gente.
  const miPendiente = pendientes.find((p) => p.a === clanTag || p.b === clanTag);
  const rivalTag = miPendiente ? (miPendiente.a === clanTag ? miPendiente.b : miPendiente.a) : null;
  const rival = rivalTag ? tabla.find((c) => c.clan_tag === rivalTag) : null;

  return {
    yo,
    tabla,
    promueven,
    descienden,
    cortePierde,
    enAscenso,
    enDescenso,
    faltanParaSubir,
    margenSobreDescenso,
    ultimoQueSube,
    primeroQueBaja,
    rondasJugadas: yo.rondas_cerradas,
    rondasPendientes: pendientes.filter((p) => p.a === clanTag || p.b === clanTag).length,
    rondaActual: miPendiente?.ronda ?? null,
    estadoRonda: miPendiente?.estado ?? null,
    rival,
    probSubir: sube / iteraciones,
    probBajar: baja / iteraciones,
    // Reparto completo de puestos: el panel lo usa para el detalle.
    puestos: puestos.map((n) => n / iteraciones),
    simulado: pendientes.length > 0,
  };
}
