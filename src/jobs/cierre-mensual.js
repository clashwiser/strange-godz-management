// Cierre del mes: convierte lo guardado en una tabla de rendimiento por
// jugador, y de ahi salen los ganadores.
//
//   npm run cierre                 el mes en curso
//   npm run cierre -- 2026-09      un mes concreto
//   npm run cierre -- 2026-09 --guardar-premios
//
// Es la razon por la que existe todo lo demas. Sin esto hay 286 ataques
// guardados y nadie que diga quien cobra.
//
// TRES DECISIONES QUE NO SON OBVIAS
//
// 1. Se agrupa por PERSONA, no por cuenta. Cris tiene tres cuentas: sin
//    agrupar podria llevarse los tres primeros premios de x300 el solo. La
//    tabla `owners` dice que cuentas son de quien, y para el reparto cada
//    persona entra con su MEJOR cuenta, no con la suma: sumar premiaria
//    tener muchas cuentas, no jugar bien.
//
// 2. Los tres lideres no compiten. Estan marcados elegible_premios=false.
//    Deibis cobra 10 fijos por coordinar, que sale del presupuesto pero no
//    del reparto por resultados.
//
// 3. Los ataques disponibles de CWL se cuentan desde el ROSTER, no desde el
//    numero de rondas. Un jugador alineado en 5 de 7 rondas tenia 5
//    ataques, no 7: medirle sobre 7 lo castigaria por decisiones de los
//    lideres, no suyas.

import { db, chk, correrJob } from '../lib/db.js';
import { temporadaActual } from '../lib/config.js';

const args = process.argv.slice(2);
const MES = args.find((a) => /^\d{4}-\d{2}$/.test(a)) || temporadaActual();
const GUARDAR_PREMIOS = args.includes('--guardar-premios');

/**
 * Dos jugadores que los datos no pueden separar.
 *
 * El ultimo criterio es quien ataco primero, que es la regla que pusieron
 * los lideres. Se calcula con el campo `order` de la API: el puesto del
 * ataque dentro de la guerra, contando los de los dos clanes intercalados.
 * Es orden cronologico real, pero RELATIVO a cada ronda: la API no expone
 * ninguna hora, asi que se compara el promedio a lo largo del mes. Un
 * jugador que ataca de los primeros todas las rondas tiene promedio bajo.
 *
 * No se sabe que usa el juego para ordenar SU tabla cuando hay empate, y
 * no se intenta imitar: con lo que la API entrega no es reproducible.
 */
const mismoNivel = (a, b) =>
  a.cwl_estrellas === b.cwl_estrellas &&
  a.cwl_ataques_usados === b.cwl_ataques_usados &&
  Number(a.cwl_destruccion_prom ?? 0) === Number(b.cwl_destruccion_prom ?? 0) &&
  Number(a.orden_prom ?? 0) === Number(b.orden_prom ?? 0);

/**
 * Raiz de un nombre para detectar la misma persona con varias cuentas.
 *
 * Quita adornos -emoji, simbolos, variantes de ancho- y sufijos tipo "Jr",
 * "2.0" o "II". No agrupa nada por su cuenta: solo avisa, porque acertar
 * aqui a ciegas puede costarle un premio a alguien.
 */
const raizNombre = (t) =>
  String(t)
    .normalize('NFKD')
    .replace(/[̀-ͯ︀-️​-‍]/g, '')
    .replace(/[^\p{Letter}\p{Number}]/gu, '')
    .toLowerCase()
    .replace(/(jr|ii|20|2)$/, '');

await correrJob('cierre_mensual', async () => {
  // ---- Lo que hay guardado del mes ----
  const seasons = chk(
    await db.from('cwl_seasons').select('id, clan_tag, liga').eq('temporada', MES),
    'temporadas de CWL'
  );

  if (!seasons.length) {
    console.log(`No hay CWL registrada para ${MES}. Corre cwl:sync primero.`);
    return { filas: 0 };
  }

  const clanDe = Object.fromEntries(seasons.map((s) => [s.id, s.clan_tag]));

  // Solo rondas CERRADAS: una en curso todavia puede cambiar, y calcular
  // ganadores sobre datos que aun se mueven es como contar votos a mitad.
  const wars = chk(
    await db
      .from('cwl_wars')
      .select('id, season_id, ronda, estado')
      .in('season_id', seasons.map((s) => s.id))
      .eq('estado', 'warEnded'),
    'guerras de CWL'
  );

  if (!wars.length) {
    console.log(`Ninguna ronda cerrada en ${MES} todavia.`);
    return { filas: 0 };
  }

  const warIds = wars.map((w) => w.id);
  const clanDeWar = Object.fromEntries(wars.map((w) => [w.id, clanDe[w.season_id]]));

  const [roster, ataques, players, owners, clans] = await Promise.all([
    db.from('cwl_roster').select('war_id, player_tag').in('war_id', warIds),
    db.from('cwl_attacks').select('war_id, player_tag, estrellas, destruccion_pct, orden').in('war_id', warIds),
    db.from('players').select('player_tag, nombre_actual, owner_id, elegible_premios'),
    db.from('owners').select('id, nombre, cobra_premios, pago_fijo_usd'),
    db.from('clans').select('clan_tag, nombre, escuadra'),
  ]).then((rs) => rs.map((r, i) => chk(r, ['roster', 'ataques', 'jugadores', 'personas', 'clanes'][i])));

  const nombre = Object.fromEntries(players.map((p) => [p.player_tag, p.nombre_actual]));
  const duenoDe = Object.fromEntries(players.map((p) => [p.player_tag, p.owner_id]));
  const elegible = Object.fromEntries(players.map((p) => [p.player_tag, p.elegible_premios !== false]));
  const persona = Object.fromEntries(owners.map((o) => [o.id, o]));
  const clanNombre = Object.fromEntries(clans.map((c) => [c.clan_tag, c.nombre]));
  const escuadraDe = Object.fromEntries(clans.map((c) => [c.clan_tag, c.escuadra]));

  // ---- Trofeos: primero y ultimo snapshot del mes ----
  // Desde el dia 1 hasta ANTES del dia 1 del mes siguiente. Nada de
  // `${MES}-31`: septiembre no tiene 31 y Postgres rechaza la fecha.
  const [anio, mes] = MES.split('-').map(Number);
  const desde = `${MES}-01`;
  const siguiente = new Date(Date.UTC(anio, mes, 1)).toISOString().slice(0, 10);

  const snaps = chk(
    await db
      .from('snapshots')
      .select('player_tag, fecha, trofeos, liga')
      .gte('fecha', desde)
      .lt('fecha', siguiente)
      .order('fecha'),
    'snapshots del mes'
  );

  const primero = {};
  const ultimo = {};
  for (const s of snaps) {
    if (!primero[s.player_tag]) primero[s.player_tag] = s;
    ultimo[s.player_tag] = s;
  }

  // ---- Acumular por CUENTA ----
  const stat = {};
  const tocar = (tag, clan) => {
    if (!stat[tag]) {
      stat[tag] = {
        mes: MES,
        player_tag: tag,
        escuadra: escuadraDe[clan] ?? null,
        clan_tag: clan,
        cwl_estrellas: 0,
        cwl_ataques_usados: 0,
        cwl_ataques_totales: 0,
        destruccion: [],
        ordenes: [],
      };
    }
    return stat[tag];
  };

  // Los ataques DISPONIBLES salen del roster: una alineacion = un ataque.
  for (const r of roster) tocar(r.player_tag, clanDeWar[r.war_id]).cwl_ataques_totales += 1;

  for (const a of ataques) {
    const s = tocar(a.player_tag, clanDeWar[a.war_id]);
    s.cwl_estrellas += a.estrellas ?? 0;
    s.cwl_ataques_usados += 1;
    if (a.destruccion_pct != null) s.destruccion.push(Number(a.destruccion_pct));
    if (a.orden != null) s.ordenes.push(Number(a.orden));
  }

  const filas = Object.values(stat).map((s) => {
    const p = primero[s.player_tag];
    const u = ultimo[s.player_tag];
    return {
      mes: s.mes,
      player_tag: s.player_tag,
      escuadra: s.escuadra,
      cwl_estrellas: s.cwl_estrellas,
      cwl_ataques_usados: s.cwl_ataques_usados,
      cwl_ataques_totales: s.cwl_ataques_totales,
      cwl_destruccion_prom: s.destruccion.length
        ? Number((s.destruccion.reduce((a, b) => a + b, 0) / s.destruccion.length).toFixed(2))
        : null,
      // Promedio del puesto de ataque a lo largo del mes. Cuanto MENOR,
      // antes ataca. Es el desempate acordado y no se guarda en
      // monthly_stats: la tabla no tiene esa columna y anadirla obligaria a
      // otra migracion para un dato que solo se usa aqui.
      orden_prom: s.ordenes.length
        ? Number((s.ordenes.reduce((a, b) => a + b, 0) / s.ordenes.length).toFixed(2))
        : null,
      trofeos_inicio: p?.trofeos ?? null,
      trofeos_fin: u?.trofeos ?? null,
      delta_trofeos: p && u ? u.trofeos - p.trofeos : null,
      liga_fin: u?.liga ?? null,
      elegible: elegible[s.player_tag],
    };
  });

  // orden_prom se usa solo para desempatar; monthly_stats no tiene esa
  // columna y no vale otra migracion por un dato de calculo.
  const paraGuardar = filas.map(({ orden_prom, ...resto }) => resto);
  chk(await db.from('monthly_stats').upsert(paraGuardar, { onConflict: 'mes,player_tag' }), 'guardar stats');

  // ---- Ganadores, por PERSONA y por clan ----
  // Sin dueno asignado, cada cuenta es su propia persona. Es lo correcto
  // mientras no se sepa lo contrario: agrupar a ciegas seria peor.
  const clave = (tag) => (duenoDe[tag] ? `o${duenoDe[tag]}` : `t${tag}`);
  const comoSeLlama = (tag) => (duenoDe[tag] ? persona[duenoDe[tag]].nombre : nombre[tag] ?? tag);

  const porClan = {};
  for (const f of filas) {
    if (!f.elegible) continue;
    if (!f.cwl_ataques_totales) continue; // no jugo CWL este mes
    const clan = stat[f.player_tag].clan_tag;
    (porClan[clan] ??= {});
    const k = clave(f.player_tag);
    const previo = porClan[clan][k];
    // Cada persona entra con su MEJOR cuenta, no con la suma.
    if (!previo || f.cwl_estrellas > previo.cwl_estrellas) {
      porClan[clan][k] = { ...f, quien: comoSeLlama(f.player_tag), cuenta: nombre[f.player_tag] };
    }
  }

  console.log(`\n=== ${MES} · ${wars.length} rondas cerradas ===\n`);

  const ganadores = [];
  for (const [clan, gente] of Object.entries(porClan)) {
    const tabla = Object.values(gente).sort(
      (a, b) =>
        b.cwl_estrellas - a.cwl_estrellas ||
        b.cwl_ataques_usados - a.cwl_ataques_usados ||
        (b.cwl_destruccion_prom ?? 0) - (a.cwl_destruccion_prom ?? 0) ||
        // Ascendente: puesto de ataque mas bajo = ataco antes.
        (a.orden_prom ?? 99) - (b.orden_prom ?? 99)
    );
    console.log(`${clanNombre[clan] ?? clan}  (${clan})`);
    tabla.slice(0, 5).forEach((x, i) => {
      const usados = `${x.cwl_ataques_usados}/${x.cwl_ataques_totales}`;
      console.log(
        `  ${String(i + 1).padStart(2)}. ${String(x.quien).padEnd(22)}` +
          `${String(x.cwl_estrellas).padStart(3)}★  ${usados.padEnd(7)}` +
          `${x.cwl_destruccion_prom ?? '—'}%`.padEnd(9) +
          `atacó #${x.orden_prom ?? '—'}` +
          (x.quien !== x.cuenta ? `   (${x.cuenta})` : '')
      );
    });
    console.log('');
    ganadores.push({ clan, tabla });
  }

  // ---- Quien se lleva que ----
  const plan = chk(
    await db.from('premios_plan').select('*').eq('mes', MES).eq('activo', true).order('orden'),
    'plan de premios'
  );

  if (!plan.length) {
    console.log(`Sin plan de premios para ${MES}. Cargalo en la pestana Bonos.`);
  } else {
    console.log('--- Reparto ---');
    const pagos = [];
    for (const pr of plan) {
      // Solo se resuelven solos los premios de puesto en un clan concreto.
      // Los de guerra normal y el de Leyenda necesitan datos que todavia no
      // se recogen; se listan como pendientes en vez de inventarlos.
      const m = /(\d)\w*\s*(?:lugar|º)/i.exec(pr.titulo) || /·\s*(\d)/.exec(pr.titulo);
      const puesto = m ? Number(m[1]) : null;
      const tabla = pr.clan_tag ? porClan[pr.clan_tag] && ganadores.find((g) => g.clan === pr.clan_tag)?.tabla : null;

      if (!puesto || !tabla) {
        console.log(`  ${pr.titulo.padEnd(32)} $${String(pr.monto_usd).padStart(5)}   PENDIENTE (a mano)`);
        continue;
      }
      const g = tabla[puesto - 1];
      if (!g) {
        console.log(`  ${pr.titulo.padEnd(32)} $${String(pr.monto_usd).padStart(5)}   sin candidato`);
        continue;
      }

      // Un empate NO se resuelve solo. Con 6 personas a 18 estrellas y 100%
      // de destruccion no hay nada en los datos que las separe, y elegir por
      // el orden en que salieron de la base es repartir dinero al azar. Se
      // listan los empatados y deciden los lideres.
      const empatados = tabla.filter((x) => mismoNivel(x, g));
      if (empatados.length > 1) {
        console.log(
          `  ${pr.titulo.padEnd(32)} $${String(pr.monto_usd).padStart(5)}   ` +
            `EMPATE entre ${empatados.length} — decidan ustedes`
        );
        for (const e of empatados) {
          console.log(`        ${e.quien}  ${e.cwl_estrellas}★  ${e.cwl_destruccion_prom}%`);
        }
        continue;
      }

      console.log(
        `  ${pr.titulo.padEnd(32)} $${String(pr.monto_usd).padStart(5)}   ${g.quien}  (${g.cwl_estrellas}★)`
      );
      pagos.push({
        mes: MES,
        player_tag: g.player_tag,
        premio: pr.titulo,
        monto_usd: pr.monto_usd,
        tipo: pr.tipo === 'pase_oro' ? 'pase_oro' : 'efectivo',
        nota: `${g.cwl_estrellas} estrellas en ${g.cwl_ataques_usados}/${g.cwl_ataques_totales} ataques`,
      });
    }

    // Dos premios a la misma persona con cuentas distintas. Se comprueba
    // AQUI y no fuera porque aqui ya esta resuelto que cuenta gano cada
    // puesto; calcularlo por separado obliga a repetir el ranking y es
    // facil equivocarse al derivar el clan de cada jugador.
    const porRaiz = {};
    for (const g of pagos) (porRaiz[raizNombre(nombre[g.player_tag] ?? '')] ??= []).push(g);
    const dobles = Object.values(porRaiz).filter((v) => v.length > 1);
    if (dobles.length) {
      console.log('');
      console.log('  !! Dos premios a cuentas con el mismo nombre de base:');
      for (const v of dobles) {
        for (const g of v) console.log(`       ${g.premio}  ->  ${nombre[g.player_tag]}  (${g.player_tag})`);
      }
      console.log('     Si son la misma persona, agrupalas en `owners` y vuelve a correr.');
    }
    console.log('');

    for (const o of owners.filter((x) => x.pago_fijo_usd)) {
      console.log(`  ${('Fijo · ' + o.nombre).padEnd(32)} $${String(o.pago_fijo_usd).padStart(5)}   por coordinar`);
    }

    if (GUARDAR_PREMIOS && pagos.length) {
      chk(await db.from('payouts').upsert(pagos, { onConflict: 'mes,player_tag,premio' }), 'guardar payouts');
      console.log(`\n${pagos.length} premios guardados en payouts.`);
    } else if (pagos.length) {
      console.log(`\n(no se guardo nada; anade --guardar-premios para escribir en payouts)`);
    }
  }

  // ---- Aviso: cuentas que parecen de la misma persona ----
  // Cada cuenta suelta compite por separado. Si tres son del mismo jugador,
  // esa persona puede quedarse con varios premios del mismo clan. Solo se
  // avisa: agrupar por parecido de nombre y equivocarse le costaria un
  // premio a alguien, asi que la decision es de los lideres y se carga en
  // la tabla `owners`.
  const grupos = {};
  for (const p of players) {
    if (p.owner_id) continue;
    const k = raizNombre(p.nombre_actual);
    if (k.length < 2) continue;
    (grupos[k] ??= []).push(p.nombre_actual);
  }
  const sospechosas = Object.values(grupos).filter((v) => v.length > 1);
  if (sospechosas.length) {
    console.log('--- Cuentas que parecen de la misma persona ---');
    console.log('    (compiten por separado hasta que se agrupen en `owners`)');
    for (const v of sospechosas) console.log(`  ${v.join('  =  ')}`);
    console.log('');
  }

  return {
    filas: filas.length,
    detalle: {
      mes: MES,
      rondas: wars.length,
      clanes: Object.keys(porClan).length,
      grupos_sin_agrupar: sospechosas.length,
    },
  };
});

process.exit(0);
