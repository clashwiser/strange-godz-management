// Raid Weekends (Clan Capital).
//
// A diferencia del snapshot diario, esta historia NO se pierde: el endpoint
// devuelve los ultimos fines de semana. La primera corrida recupera meses
// de golpe.
//
// Por que importa: un jugador hace ~7 ataques de CWL al mes contra ~22-26
// de raids. Hoy el sistema de premios reparte $61 de $91 mirando solo la
// CWL, es decir el 12% de lo que la gente realmente juega.

import { getCapitalRaids, parseCocDate, opcional } from '../lib/coc.js';
import { db, chk, asegurarJugadores, correrJob } from '../lib/db.js';
import { clanes, ajuste, apagado } from '../lib/config.js';

const LIMITE = Number(process.env.RAIDS_LIMITE || 10);

await correrJob('raids_sync', async () => {
  if (!(await ajuste('alerta_raids', true))) return apagado('alerta_raids');
  let filas = 0;
  const detalle = {};

  for (const { clan_tag } of await clanes()) {
    const res = await opcional(getCapitalRaids(clan_tag, LIMITE));
    if (!res) {
      console.log(`  ${clan_tag}: sin datos de raids`);
      detalle[clan_tag] = { raids: 0 };
      continue;
    }

    const temporadas = res.items || [];
    let miembrosGuardados = 0;

    for (const t of temporadas) {
      const inicio = parseCocDate(t.startTime);
      if (!inicio) continue;

      const season = chk(
        await db
          .from('raid_seasons')
          .upsert(
            {
              clan_tag,
              inicio: inicio.toISOString(),
              fin: parseCocDate(t.endTime)?.toISOString() ?? null,
              estado: t.state ?? null,
              loot_total: t.capitalTotalLoot ?? null,
              raids_completados: t.raidsCompleted ?? null,
              ataques_totales: t.totalAttacks ?? null,
              distritos_destruidos: t.enemyDistrictsDestroyed ?? null,
              recompensa_ofensiva: t.offensiveReward ?? null,
              recompensa_defensiva: t.defensiveReward ?? null,
              actualizado: new Date().toISOString(),
            },
            { onConflict: 'clan_tag,inicio' }
          )
          .select('id')
          .single(),
        `upsert raid_season ${clan_tag} ${t.startTime}`
      );

      // `members` no siempre viene: en fines de semana muy viejos la API
      // devuelve solo los totales del clan.
      const miembros = t.members || [];
      if (!miembros.length) continue;

      await asegurarJugadores(miembros.map((m) => ({ tag: m.tag, nombre: m.name })));

      chk(
        await db.from('raid_members').upsert(
          miembros.map((m) => ({
            raid_id: season.id,
            player_tag: m.tag,
            ataques: m.attacks ?? 0,
            limite: m.attackLimit ?? null,
            limite_bonus: m.bonusAttackLimit ?? null,
            botin: m.capitalResourcesLooted ?? null,
          })),
          { onConflict: 'raid_id,player_tag' }
        ),
        `upsert raid_members ${t.startTime}`
      );

      miembrosGuardados += miembros.length;
    }

    filas += miembrosGuardados;
    detalle[clan_tag] = { raids: temporadas.length, participaciones: miembrosGuardados };
    console.log(`  ${clan_tag}: ${temporadas.length} fines de semana, ${miembrosGuardados} participaciones`);
  }

  return { filas, detalle };
});
