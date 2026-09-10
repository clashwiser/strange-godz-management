// Aviso de ataques SIN USAR en guerra normal.
//
//   npm run guerra:alerta
//
// El equivalente de cwl-alerta.js para la guerra de todos los dias, que era
// el hueco mas caro que quedaba: el sondeo de los cinco meses anteriores dio
// 14,7% de ataques desperdiciados en guerra normal contra 0,8% en CWL. 456
// ataques tirados. La CWL ya avisaba; la guerra normal no, y es justo donde
// la gente se olvida — porque hay una cada dos dias y no se siente especial.
//
// Lee de la API en vivo y no de la base, igual que la alerta de CWL: un
// fallo del sync no puede costar una guerra.
//
// Diferencias con la CWL que importan:
//
//   - Son DOS ataques por cabeza, no uno. El numero sale de
//     `attacksPerMember` de la propia guerra y no escrito a fuego, porque
//     Supercell ya lo ha cambiado en eventos.
//   - Se avisa de quien no ha usado TODOS los suyos, no solo del que no
//     ataco: el que hizo uno y se durmio cuenta igual.
//   - Si el registro de guerra del clan esta en privado, la API responde 403
//     y ese clan se salta sin tumbar el job. Le pasa a Cuba ahora mismo.

import { getClan, getCurrentWar, parseCocDate, opcional } from '../lib/coc.js';
import { clanes, horasHasta } from '../lib/config.js';
import { encolar, negrita, mono } from '../lib/outbox.js';
import { correrJob } from '../lib/db.js';
import { mencionesDe } from '../lib/menciones.js';

// Mismos umbrales que la CWL. Ascendente: hay que devolver el MAS CHICO que
// todavia contiene a `horas`; al reves, todo lo menor a 6h daba 6 y los
// avisos de 3h y 1h no salian nunca porque la clave no cambiaba.
const UMBRALES = (process.env.ALERTA_UMBRALES || '6,3,1')
  .split(',')
  .map(Number)
  .filter((n) => n > 0)
  .sort((a, b) => a - b);

const umbralCruzado = (horas) => UMBRALES.find((u) => horas <= u) ?? null;

await correrJob('alerta_guerra', async () => {
  const bloques = [];
  const claves = [];
  let pendientesTotal = 0;
  let masUrgente = Infinity;
  const tagsFlojos = [];

  for (const { clan_tag, escuadra } of await clanes()) {
    const w = await opcional(getCurrentWar(clan_tag));
    if (!w) {
      console.log(`  ${clan_tag}: sin guerra visible (registro privado o sin datos)`);
      continue;
    }
    if (w.state !== 'inWar') {
      console.log(`  ${clan_tag}: ${w.state ?? 'sin guerra'}`);
      continue;
    }

    const restan = horasHasta(parseCocDate(w.endTime));
    if (restan <= 0) continue;

    const umbral = umbralCruzado(restan);
    if (umbral === null) {
      console.log(`  ${clan_tag}: faltan ${restan.toFixed(1)}h, aun no cruza ningun umbral`);
      continue;
    }

    const porCabeza = w.attacksPerMember ?? 2;
    const flojos = (w.clan?.members || [])
      .map((m) => ({ ...m, hechos: m.attacks?.length ?? 0 }))
      .filter((m) => m.hechos < porCabeza)
      .sort((a, b) => (a.mapPosition ?? 99) - (b.mapPosition ?? 99));

    if (!flojos.length) {
      console.log(`  ${clan_tag}: todos completaron sus ${porCabeza}`);
      continue;
    }

    const sinUsar = flojos.reduce((n, m) => n + (porCabeza - m.hechos), 0);
    tagsFlojos.push(...flojos.map((m) => m.tag));
    pendientesTotal += sinUsar;
    masUrgente = Math.min(masUrgente, restan);
    // La clave lleva el fin de la guerra y el umbral: asi cada guerra avisa
    // una vez por umbral y el cron de cada 2h no repite el mismo aviso.
    claves.push(`${clan_tag}:${w.endTime}:${umbral}`);

    const clan = await opcional(getClan(clan_tag));
    const lista = flojos
      .map((m) => `#${String(m.mapPosition ?? 0).padStart(2)} ${m.name} — ${porCabeza - m.hechos}`)
      .join('\n');

    bloques.push(
      `${negrita(clan?.name || clan_tag)}  (escuadra ${escuadra})\n` +
        `Contra ${w.opponent?.name ?? '—'} · cierra en ${negrita(restan.toFixed(1) + 'h')}\n` +
        `Van ${w.clan?.stars ?? 0}★ contra ${w.opponent?.stars ?? 0}★ · ` +
        `faltan ${negrita(sinUsar)} ataques:\n` +
        mono(lista)
    );
  }

  if (!bloques.length) {
    console.log('Nada que alertar.');
    return { filas: 0 };
  }

  const cuerpo =
    `⚔️ ${negrita('ATAQUES DE GUERRA SIN USAR')}\n\n` +
    bloques.join('\n\n') +
    `\n\nEl numero de al lado es cuantos le faltan a cada uno.` +
    // Aqui SI aplica, al reves que en CWL. En guerra normal, cuando hay 39
    // en verde y la guerra es de 40, se mete a alguien solo para completar
    // el numero; a ese se le dijo que no hacia falta que atacara. Y una
    // guerra de 40 se suele limpiar con 50-55 ataques de los 80, asi que
    // tampoco hace falta que ataquen todos.
    `\n_Si te dijeron que entrabas solo para completar, tranquilo. Si no, ataca._`;

  const nuevo = await encolar({
    tipo: 'alerta_guerra',
    cuerpo,
    clave: `guerra:${claves.sort().join('|')}`,
    pose: 'alarma',
    menciones: await mencionesDe(tagsFlojos),
  });

  return {
    filas: nuevo ? pendientesTotal : 0,
    detalle: { clanes: bloques.length, sin_usar: pendientesTotal, horas: masUrgente },
  };
});

process.exit(0);
