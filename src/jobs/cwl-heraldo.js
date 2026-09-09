// Heraldo: el parte diario de CWL al grupo.
//
//   npm run cwl:heraldo
//
// Un mensaje por clan y por dia de liga. No lo escribe nadie a mano: sale
// de la tabla del grupo, que ya baja cwl-sync, y dice en que puesto vamos,
// contra quien jugamos hoy y si estamos en riesgo de bajar.
//
// Por que hace falta: hoy, para saber si x300 va a descender, hay que
// entrar clan por clan en el juego y sumar estrellas a mano. Nadie lo hace,
// asi que el clan se entera de que baja el ultimo dia.
//
// Cuando sale cada mensaje:
//
//   dia 1        preparacion: "donen los castillos"
//   dias 2 al 8  un parte por ronda, al empezar el dia de guerra
//   al cerrar    felicitacion si subimos, animo si no, y si bajamos se
//                dice claro sin reprimir a nadie
//
// El cron corre cada 2 horas; la clave de deduplicacion (clan + temporada +
// fase + ronda) hace que solo salga UNO por dia aunque el job corra doce
// veces. Va al outbox como todo lo demas, asi que si Telegram falla el
// mensaje sigue estando en el panel para copiarlo a WhatsApp.

import { db, chk, correrJob } from '../lib/db.js';
import { encolar } from '../lib/outbox.js';
import { clanes } from '../lib/config.js';
import { analizar } from '../lib/cwl-analisis.js';
import { faseDe, mensajeDelDia } from '../lib/cwl-mensajes.js';

const CUPO_POR_DEFECTO = { promueven: 2, descienden: 2 };

// `npm run cwl:heraldo -- --seco` imprime lo que mandaria y no manda nada.
// Sirve para leer el parte antes de soltarlo al grupo, y para probar el job
// sin escribirle a nadie.
const SECO = process.argv.includes('--seco') || process.env.HERALDO_SECO === '1';

await correrJob('cwl_heraldo', async () => {
  const temporada = new Date().toISOString().slice(0, 7);

  const seasons = chk(
    await db.from('cwl_seasons').select('id, clan_tag, liga, temporada').eq('temporada', temporada),
    'leer cwl_seasons'
  );
  if (!seasons.length) {
    console.log(`  sin CWL en ${temporada}`);
    return { filas: 0, detalle: { temporada, clanes: 0 } };
  }

  const ligas = chk(await db.from('cwl_ligas').select('*'), 'leer cwl_ligas');
  const cupoDe = Object.fromEntries(ligas.map((l) => [l.liga, l]));

  const nuestros = await clanes();
  const nombreDe = Object.fromEntries(nuestros.map((c) => [c.clan_tag, c.nombre ?? c.clan_tag]));
  // `clanes()` no siempre trae el nombre; la tabla clans si.
  const filasClan = chk(await db.from('clans').select('clan_tag, nombre'), 'leer clans');
  for (const c of filasClan) nombreDe[c.clan_tag] = c.nombre ?? c.clan_tag;

  let enviados = 0;
  const detalle = {};

  for (const s of seasons) {
    const grupo = chk(
      await db.from('cwl_grupo').select('*').eq('season_id', s.id),
      `leer cwl_grupo ${s.clan_tag}`
    );
    if (!grupo.length) {
      console.log(`  ${s.clan_tag}: sin tabla de grupo todavia (corre cwl:sync)`);
      detalle[s.clan_tag] = { sin_grupo: true };
      continue;
    }

    const cupo = cupoDe[s.liga] ?? CUPO_POR_DEFECTO;
    const a = analizar({
      filas: grupo,
      clanTag: s.clan_tag,
      promueven: cupo.promueven,
      descienden: cupo.descienden,
    });
    if (!a) {
      console.log(`  ${s.clan_tag}: no aparece en su propio grupo`);
      detalle[s.clan_tag] = { fuera_del_grupo: true };
      continue;
    }

    const fase = faseDe(a);
    const clan = nombreDe[s.clan_tag] ?? s.clan_tag;
    const cuerpo = mensajeDelDia({
      clan,
      liga: s.liga,
      analisis: a,
      promueven: cupo.promueven,
      descienden: cupo.descienden,
    });
    if (!cuerpo) continue;

    // La ronda entra en la clave para que cada dia sea un mensaje distinto y
    // el mismo dia no se repita aunque el cron corra cada dos horas.
    const clave = `heraldo:${s.clan_tag}:${temporada}:${fase}:${a.rondaActual ?? 'fin'}`;
    if (SECO) {
      console.log(`
----- ${clave} -----
${cuerpo}
`);
      detalle[s.clan_tag] = { fase, ronda: a.rondaActual, puesto: a.yo.puesto, seco: true };
      continue;
    }
    const nuevo = await encolar({ tipo: 'cwl_heraldo', cuerpo, clave });

    if (nuevo) enviados += 1;
    detalle[s.clan_tag] = {
      fase,
      ronda: a.rondaActual,
      puesto: a.yo.puesto,
      estrellas: a.yo.estrellas,
      prob_bajar: Number(a.probBajar.toFixed(3)),
      prob_subir: Number(a.probSubir.toFixed(3)),
      nuevo,
    };
    console.log(
      `  ${clan}: ${fase}${a.rondaActual ? ' ronda ' + a.rondaActual : ''} · ` +
        `puesto ${a.yo.puesto}/${a.tabla.length} · bajar ${(a.probBajar * 100).toFixed(0)}%` +
        (nuevo ? ' · ENCOLADO' : ' · ya estaba')
    );

    // Al cerrar la liga se deja escrito como acabo. La API deja de devolver
    // el grupo cuando pasa la temporada, asi que si no se guarda ahora se
    // pierde para siempre.
    if (fase === 'final') {
      chk(
        await db
          .from('cwl_seasons')
          .update({
            posicion_final: a.yo.puesto,
            ascendio: a.enAscenso,
            descendio: a.enDescenso,
          })
          .eq('id', s.id),
        `cerrar temporada ${s.clan_tag}`
      );
    }
  }

  return { filas: enviados, detalle: { temporada, ...detalle } };
});

process.exit(0);
