// FASE 2 - Alerta de ataques de CWL sin usar. Lo mas valioso del sistema:
// avisa ANTES de perder la guerra, no despues.
//
// Lee en vivo de la API, no de la base, para no depender de que el sync haya
// corrido. En CWL cada jugador tiene 1 ataque por ronda.
//
// El mensaje se ESCRIBE en el outbox; mandarlo es otro job. Asi un fallo de
// WhatsApp no borra el aviso: queda en el website para copiar y pegar.

import { getClan, getLeagueGroup, getLeagueWar, parseCocDate, mapLimit, opcional } from '../lib/coc.js';
import { clanes, horasHasta } from '../lib/config.js';
import { encolar, negrita, mono } from '../lib/outbox.js';
import { correrJob } from '../lib/db.js';
import { mencionesDe } from '../lib/menciones.js';

// Avisos escalonados. El cron corre cada 2h, pero solo se encola un mensaje
// nuevo al cruzar cada umbral: sin esto el grupo recibe el mismo aviso 3 veces.
// Ascendente a proposito: hay que devolver el umbral MAS CHICO que todavia
// contiene a `horas`. Ordenado al reves, todo lo menor a 6h devolvia 6 y las
// alertas de 3h y 1h no se mandaban nunca porque la clave no cambiaba.
const UMBRALES = (process.env.ALERTA_UMBRALES || '6,3,1')
  .split(',')
  .map(Number)
  .filter((n) => n > 0)
  .sort((a, b) => a - b);

/** Devuelve el umbral cruzado, o null si todavia falta mucho. */
function umbralCruzado(horas) {
  return UMBRALES.find((u) => horas <= u) ?? null;
}

await correrJob('alerta_cwl', async () => {
  const bloques = [];
  const claves = [];
  let pendientesTotal = 0;
  let masUrgente = Infinity;
  const tagsSinAtacar = [];

  for (const { clan_tag, escuadra } of await clanes()) {
    const grupo = await opcional(getLeagueGroup(clan_tag));
    if (!grupo) continue;

    const tags = grupo.rounds.flatMap((r) => r.warTags).filter((t) => t && t !== '#0');

    const guerras = await mapLimit(tags, 4, async (wt) => {
      const w = await opcional(getLeagueWar(wt));
      if (!w || w.state !== 'inWar') return null;
      const nosotros = [w.clan, w.opponent].find((x) => x?.tag === clan_tag);
      return nosotros ? { w, wt, nosotros } : null;
    });

    for (const g of guerras.filter(Boolean)) {
      const restan = horasHasta(parseCocDate(g.w.endTime));
      const umbral = umbralCruzado(restan);

      if (restan <= 0) continue;
      if (umbral === null) {
        console.log(`  ${clan_tag}: faltan ${restan.toFixed(1)}h, aun no cruza ningun umbral`);
        continue;
      }

      const sinAtacar = (g.nosotros.members || [])
        .filter((m) => !m.attacks?.length)
        .sort((a, b) => (a.mapPosition ?? 99) - (b.mapPosition ?? 99));

      if (!sinAtacar.length) {
        console.log(`  ${clan_tag}: todos atacaron`);
        continue;
      }

      pendientesTotal += sinAtacar.length;
      tagsSinAtacar.push(...sinAtacar.map((m) => m.tag));
      masUrgente = Math.min(masUrgente, restan);
      claves.push(`${g.wt}:${umbral}`);

      const clan = await opcional(getClan(clan_tag));
      const lista = sinAtacar
        .map((m) => `#${String(m.mapPosition).padStart(2)} ${m.name}`)
        .join('\n');

      bloques.push(
        `${negrita(clan?.name || clan_tag)}  (escuadra ${escuadra})\n` +
          `Cierra en ${negrita(restan.toFixed(1) + 'h')} - faltan ${sinAtacar.length}:\n` +
          mono(lista)
      );
    }
  }

  if (!bloques.length) {
    console.log('Nada que alertar.');
    return { filas: 0 };
  }

  const cuerpo =
    `⚔️ ${negrita('ATAQUES DE CWL SIN USAR')}\n\n` +
    bloques.join('\n\n') +
    // En CWL no hay excusa que valga y decir lo contrario hace daño: a la
    // liga solo se lleva a quien VA a atacar, la alineacion se arma a mano
    // y cada ataque que falta es una guerra que se pierde. La linea de "si
    // avisaste no cuenta como fallo" es de la guerra normal, donde si tiene
    // sentido; aqui estaba dandole a la gente una salida que no existe.
    `\n\n${negrita('¡ATACA!')}`;

  const nuevo = await encolar({
    tipo: 'alerta_cwl',
    cuerpo,
    clave: `cwl:${claves.sort().join('|')}`,
    // Heraldo dando la alarma, en video: un aviso que parece una alarma se
    // lee; uno que parece otra notificacion mas, no.
    pose: 'alarma',
    // Los que no atacaron, mencionados: asi les suena el telefono en vez de
    // salir en una lista que no van a leer.
    menciones: await mencionesDe(tagsSinAtacar),
  });

  return {
    filas: nuevo ? pendientesTotal : 0,
    detalle: { clanes: bloques.length, sin_atacar: pendientesTotal, horas: masUrgente },
  };
});
