// FASE 1 - Snapshot diario del perfil de todos los miembros de los 3 clanes.
//
// Es el job mas importante del sistema: la API solo da el presente, asi que
// todo lo que no se guarde hoy se pierde para siempre. Ademas es la unica
// fuente para estrellas de guerra normal si /currentwar viene bloqueado.
//
// Idempotente: unique(player_tag, fecha) + upsert. Correrlo dos veces el
// mismo dia sobreescribe, no duplica.

import { getClan, getPlayer, mapLimit, logro } from '../lib/coc.js';
import { db, chk, asegurarJugadores, correrJob } from '../lib/db.js';
import { clanes, hoyUTC } from '../lib/config.js';

const fecha = hoyUTC();

await correrJob('snapshot_diario', async () => {
  let filas = 0;
  const detalle = {};

  for (const { clan_tag, escuadra } of await clanes()) {
    const clan = await getClan(clan_tag);

    chk(
      await db.from('clans').upsert(
        { clan_tag, nombre: clan.name, escuadra, activo: true },
        { onConflict: 'clan_tag' }
      ),
      `upsert clan ${clan_tag}`
    );

    const miembros = clan.memberList || [];
    await asegurarJugadores(miembros.map((m) => ({ tag: m.tag, nombre: m.name })));
    await reconciliarMembresias(clan_tag, miembros);

    // Concurrencia baja a proposito: el rate limit de la API no esta
    // publicado y un 429 en el snapshot cuesta un dia de historia.
    const perfiles = await mapLimit(miembros, 5, (m) =>
      getPlayer(m.tag).catch((err) => {
        console.error(`  no se pudo leer ${m.tag} (${m.name}):`, err.message);
        return null;
      })
    );

    const snaps = perfiles.filter(Boolean).map((p) => ({
      player_tag: p.tag,
      fecha,
      clan_tag,
      war_stars: p.warStars ?? null,
      logro_war_hero: logro(p, 'War Hero'),
      logro_war_league_legend: logro(p, 'War League Legend'),
      trofeos: p.trophies ?? null,
      liga: p.league?.name ?? null,
      th_level: p.townHallLevel ?? null,
      donaciones: p.donations ?? null,
      donaciones_recibidas: p.donationsReceived ?? null,
      raw: p,
    }));

    if (snaps.length) {
      chk(
        await db.from('snapshots').upsert(snaps, { onConflict: 'player_tag,fecha' }),
        `upsert snapshots ${clan_tag}`
      );
    }

    filas += snaps.length;
    detalle[clan_tag] = { miembros: miembros.length, guardados: snaps.length };
    console.log(`  ${clan.name} (${clan_tag}): ${snaps.length}/${miembros.length} perfiles`);
  }

  return { filas, detalle };
});

/**
 * Mantiene el historial de quien esta en que clan. Importante porque el
 * premio se paga a quien este el dia 5, no a quien jugo la CWL.
 */
async function reconciliarMembresias(clan_tag, miembros) {
  const abiertas = chk(
    await db.from('memberships').select('id, player_tag').eq('clan_tag', clan_tag).is('hasta', null),
    `leer membresias ${clan_tag}`
  );

  const actuales = new Set(miembros.map((m) => m.tag));
  const yaAbiertas = new Set(abiertas.map((m) => m.player_tag));

  // Se fueron: cerrar la membresia con la fecha de hoy.
  const salieron = abiertas.filter((m) => !actuales.has(m.player_tag)).map((m) => m.id);
  if (salieron.length) {
    chk(
      await db.from('memberships').update({ hasta: fecha }).in('id', salieron),
      `cerrar membresias ${clan_tag}`
    );
    console.log(`  ${clan_tag}: ${salieron.length} salieron`);
  }

  // Entraron: abrir membresia nueva.
  const entraron = miembros
    .filter((m) => !yaAbiertas.has(m.tag))
    .map((m) => ({ player_tag: m.tag, clan_tag, desde: fecha, rol: m.role ?? null }));
  if (entraron.length) {
    chk(
      await db.from('memberships').upsert(entraron, { onConflict: 'player_tag,clan_tag,desde' }),
      `abrir membresias ${clan_tag}`
    );
    console.log(`  ${clan_tag}: ${entraron.length} entraron`);
  }
}
