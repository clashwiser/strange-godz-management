// Guerra normal: guarda quien estaba alineado y que hizo cada uno.
//
//   npm run wars:sync
//
// POR QUE IMPORTA MAS DE LO QUE PARECE
//
// El probe midio que en guerra normal se desperdicia el 14,7% de los
// ataques -456 de 3.100 en cinco meses- contra el 0,8% de la CWL. El
// agujero real de la alianza esta aqui, y hasta ahora nadie lo medía.
//
// DOS LIMITES QUE HAY QUE TENER PRESENTES
//
// 1. Solo se puede capturar una guerra MIENTRAS existe. /currentwar
//    devuelve el detalle por jugador de la guerra en curso y de la ultima
//    terminada, hasta que empieza la siguiente. El /warlog historico solo
//    trae totales del clan: no dice quien ataco. Por eso este job corre
//    seguido; una guerra que pase entera entre dos corridas se pierde y no
//    se recupera.
//
// 2. Necesita el registro de guerra en PUBLICO. Con el privado la API
//    responde 403 y no hay vuelta. Hoy solo x300 y las dos publicas lo
//    tienen; Cuba y Cuban Pirates siguen cerrados y quedan fuera.

import { getCurrentWar, opcional, parseCocDate } from '../lib/coc.js';
import { db, chk, asegurarJugadores, correrJob } from '../lib/db.js';
import { clanes } from '../lib/config.js';

/**
 * Estrellas NUEVAS de cada ataque.
 *
 * En guerra normal una base se puede atacar varias veces, y solo cuentan
 * las estrellas que superan el mejor resultado anterior sobre ESA base: un
 * segundo ataque de 3 estrellas sobre una base ya destruida al 100% no
 * aporta nada al marcador. Medir por estrellas brutas premiaria rematar
 * bases faciles.
 *
 * Se recorre en el orden real de los ataques (`order`) llevando el mejor
 * resultado por defensor.
 */
function conEstrellasNuevas(ataques) {
  const mejor = new Map();
  return [...ataques]
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((a) => {
      const previo = mejor.get(a.defenderTag) ?? 0;
      const nuevas = Math.max(0, (a.stars ?? 0) - previo);
      if ((a.stars ?? 0) > previo) mejor.set(a.defenderTag, a.stars ?? 0);
      return { ...a, nuevas };
    });
}

await correrJob('wars_sync', async () => {
  const detalle = {};
  let filasTotal = 0;

  for (const { clan_tag } of await clanes()) {
    const guerra = await opcional(getCurrentWar(clan_tag));

    // 403 = registro de guerra privado. No es un fallo del job.
    if (!guerra) {
      detalle[clan_tag] = { estado: 'registro privado' };
      console.log(`  ${clan_tag}: registro de guerra privado, se omite`);
      continue;
    }
    if (guerra.state === 'notInWar') {
      detalle[clan_tag] = { estado: 'notInWar' };
      console.log(`  ${clan_tag}: sin guerra ahora`);
      continue;
    }

    // En preparacion todavia no hay ataques, pero SI hay alineacion: se
    // guarda igual para saber a quien se le pidio jugar.
    const nosotros = [guerra.clan, guerra.opponent].find((c) => c?.tag === clan_tag);
    const rival = [guerra.clan, guerra.opponent].find((c) => c?.tag !== clan_tag);
    if (!nosotros) {
      console.log(`  ${clan_tag}: la API no nos devuelve en esta guerra, se omite`);
      continue;
    }

    const miembros = nosotros.members ?? [];
    await asegurarJugadores(miembros.map((m) => ({ tag: m.tag, nombre: m.name })));

    const inicio = parseCocDate(guerra.startTime ?? guerra.preparationStartTime);
    const war = chk(
      await db
        .from('wars')
        .upsert(
          {
            clan_tag,
            fecha_inicio: inicio.toISOString(),
            end_time: guerra.endTime ? parseCocDate(guerra.endTime).toISOString() : null,
            tamano: guerra.teamSize ?? null,
            clan_rival_tag: rival?.tag ?? null,
            clan_rival_nombre: rival?.name ?? null,
            estrellas_nuestras: nosotros.stars ?? null,
            estrellas_rival: rival?.stars ?? null,
            estado: guerra.state,
            resultado:
              guerra.state !== 'warEnded'
                ? null
                : (nosotros.stars ?? 0) > (rival?.stars ?? 0)
                  ? 'win'
                  : (nosotros.stars ?? 0) < (rival?.stars ?? 0)
                    ? 'lose'
                    : (nosotros.destructionPercentage ?? 0) > (rival?.destructionPercentage ?? 0)
                      ? 'win'
                      : (nosotros.destructionPercentage ?? 0) < (rival?.destructionPercentage ?? 0)
                        ? 'lose'
                        : 'tie',
          },
          { onConflict: 'clan_tag,fecha_inicio' }
        )
        .select('id')
        .single(),
      `upsert war ${clan_tag}`
    );

    // ---- Quien estaba alineado ----
    const porCabeza = guerra.attacksPerMember ?? 2;
    chk(
      await db.from('war_roster').upsert(
        miembros.map((m) => ({
          war_id: war.id,
          player_tag: m.tag,
          posicion_mapa: m.mapPosition ?? null,
          th_level: m.townhallLevel ?? m.townHallLevel ?? null,
          ataques_disponibles: porCabeza,
        })),
        { onConflict: 'war_id,player_tag' }
      ),
      `roster ${clan_tag}`
    );

    // ---- Ataques ----
    const crudos = miembros.flatMap((m) => (m.attacks ?? []).map((a) => ({ ...a, attackerTag: m.tag })));
    const ataques = conEstrellasNuevas(crudos).map((a) => ({
      war_id: war.id,
      player_tag: a.attackerTag,
      defender_tag: a.defenderTag ?? null,
      estrellas: a.stars ?? 0,
      estrellas_nuevas: a.nuevas,
      destruccion_pct: a.destructionPercentage ?? null,
      // Nunca null: en un indice unico los null no colisionan entre si y el
      // upsert duplicaria la fila en cada corrida.
      orden: a.order ?? 1,
    }));

    if (ataques.length) {
      chk(
        await db.from('war_attacks').upsert(ataques, { onConflict: 'war_id,player_tag,orden' }),
        `ataques ${clan_tag}`
      );
    }

    const disponibles = miembros.length * porCabeza;
    const sinUsar = disponibles - ataques.length;
    detalle[clan_tag] = {
      estado: guerra.state,
      rival: rival?.name ?? null,
      alineados: miembros.length,
      ataques: ataques.length,
      sin_usar: sinUsar,
    };
    filasTotal += ataques.length + miembros.length;

    console.log(
      `  ${clan_tag} vs ${rival?.name ?? '?'}: ${guerra.state}, ` +
        `${ataques.length}/${disponibles} ataques usados, ${sinUsar} sin usar`
    );
  }

  return { filas: filasTotal, detalle };
});

process.exit(0);
