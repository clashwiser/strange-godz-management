// FASE 2 - Sincronizacion de CWL.
//
// Los endpoints de CWL funcionan aunque el registro de guerra este privado,
// asi que de aca sale el dato exacto: cada ataque, cada estrella, cada
// porcentaje y - por diferencia contra el roster - cada ataque NO usado.
//
// Guarda el roster ademas de los ataques: sin saber quien estaba alineado
// no se puede distinguir "no atacó" de "no jugaba esta ronda".

import { getClan, getLeagueGroup, getLeagueWar, parseCocDate, mapLimit, opcional } from '../lib/coc.js';
import { db, chk, asegurarJugadores, correrJob } from '../lib/db.js';
import { clanes } from '../lib/config.js';

await correrJob('sync_cwl', async () => {
  let filas = 0;
  const detalle = {};

  for (const { clan_tag } of await clanes()) {
    const grupo = await opcional(getLeagueGroup(clan_tag));
    if (!grupo) {
      console.log(`  ${clan_tag}: sin CWL activa`);
      detalle[clan_tag] = { cwl: false };
      continue;
    }

    // La API devuelve `season` en formato variable: a veces 'YYYY-MM' y a
    // veces 'YYYY-MM-DD' con el dia en que arranco la temporada. Todo lo
    // demas del sistema -alineaciones, premios_plan, monthly_stats, bonos y
    // el propio panel- usa 'YYYY-MM'. Guardar el valor crudo dejaba la CWL
    // bajo una clave que ninguna otra tabla encontraba: 286 ataques
    // guardados y la pestana CWL en blanco.
    const temporada = String(grupo.season).slice(0, 7);
    const clan = await opcional(getClan(clan_tag));

    const season = chk(
      await db
        .from('cwl_seasons')
        .upsert(
          { temporada, clan_tag, liga: clan?.warLeague?.name ?? null },
          { onConflict: 'temporada,clan_tag' }
        )
        .select('id')
        .single(),
      `upsert cwl_season ${clan_tag} ${temporada}`
    );

    // Tags de guerra con la ronda a la que pertenecen. '#0' = aun sin revelar.
    const pendientes = [];
    grupo.rounds.forEach((r, i) => {
      for (const wt of r.warTags) {
        if (wt && wt !== '#0') pendientes.push({ war_tag: wt, ronda: i + 1 });
      }
    });

    let guardadas = 0;
    let ataquesTotal = 0;

    await mapLimit(pendientes, 4, async ({ war_tag, ronda }) => {
      const w = await opcional(getLeagueWar(war_tag));
      if (!w) return;

      // Cada tag de ronda cubre TODOS los enfrentamientos de la liga.
      // Solo nos interesan aquellos donde jugamos nosotros.
      const nosotros = [w.clan, w.opponent].find((x) => x?.tag === clan_tag);
      if (!nosotros) return;
      const rival = nosotros === w.clan ? w.opponent : w.clan;

      const war = chk(
        await db
          .from('cwl_wars')
          .upsert(
            {
              season_id: season.id,
              ronda,
              war_tag,
              clan_rival_tag: rival?.tag ?? null,
              clan_rival_nombre: rival?.name ?? null,
              estrellas_nuestras: nosotros.stars ?? null,
              estrellas_rival: rival?.stars ?? null,
              destruccion_nuestra: nosotros.destructionPercentage ?? null,
              destruccion_rival: rival?.destructionPercentage ?? null,
              estado: w.state,
              end_time: parseCocDate(w.endTime)?.toISOString() ?? null,
              team_size: w.teamSize ?? null,
              actualizado_en: new Date().toISOString(),
            },
            { onConflict: 'war_tag' }
          )
          .select('id')
          .single(),
        `upsert cwl_war ${war_tag}`
      );

      const miembros = nosotros.members || [];
      // Ojo: en objetos de guerra el campo es townhallLevel (h minuscula),
      // distinto de townHallLevel en el perfil del jugador.
      await asegurarJugadores(miembros.map((m) => ({ tag: m.tag, nombre: m.name })));

      if (miembros.length) {
        chk(
          await db.from('cwl_roster').upsert(
            miembros.map((m) => ({
              war_id: war.id,
              player_tag: m.tag,
              posicion_mapa: m.mapPosition ?? null,
              th_level: m.townhallLevel ?? m.townHallLevel ?? null,
            })),
            { onConflict: 'war_id,player_tag' }
          ),
          `upsert cwl_roster ${war_tag}`
        );
      }

      const thPorTag = new Map(miembros.map((m) => [m.tag, m.townhallLevel ?? m.townHallLevel ?? null]));
      const thRival = new Map((rival?.members || []).map((m) => [m.tag, m.townhallLevel ?? m.townHallLevel ?? null]));

      const ataques = miembros.flatMap((m) =>
        (m.attacks || []).map((a) => ({
          war_id: war.id,
          player_tag: m.tag,
          defender_tag: a.defenderTag ?? null,
          estrellas: a.stars ?? 0,
          destruccion_pct: a.destructionPercentage ?? null,
          // Nunca null: en un unique, null no colisiona con null y el upsert
          // duplicaria la fila en cada corrida. En CWL es 1 ataque por ronda.
          //
          // `order` es el puesto del ataque dentro de la guerra contando los
          // de los DOS clanes intercalados, o sea orden cronologico: la API
          // no expone ninguna hora. Es lo unico con lo que se puede
          // desempatar por quien ataco primero.
          orden: a.order ?? 1,
          // Segundos que duro el ataque. No se usa todavia; se guarda
          // porque la API solo da el presente y cuando la temporada pase
          // deja de devolverlo. Sirve como desempate alternativo: entre dos
          // que hicieron 3 estrellas, el que tardo 108 segundos jugo
          // distinto que el que tardo 180.
          duracion_seg: a.duration ?? null,
          th_atacante: thPorTag.get(m.tag) ?? null,
          th_defensor: thRival.get(a.defenderTag) ?? null,
        }))
      );

      if (ataques.length) {
        chk(
          await db.from('cwl_attacks').upsert(ataques, { onConflict: 'war_id,player_tag,orden' }),
          `upsert cwl_attacks ${war_tag}`
        );
      }

      guardadas++;
      ataquesTotal += ataques.length;
    });

    filas += ataquesTotal;
    detalle[clan_tag] = { temporada, rondas: guardadas, ataques: ataquesTotal };
    console.log(`  ${clan_tag} ${temporada}: ${guardadas} rondas, ${ataquesTotal} ataques`);
  }

  return { filas, detalle };
});
