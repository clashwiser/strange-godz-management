// PASO 0 - Verificacion empirica. Corre esto ANTES que nada.
//
// No toca la base de datos: solo necesita COC_TOKEN y CLAN_TAGS. Sirve para
// confirmar, sin adivinar, que:
//   1. La llave y el proxy funcionan.
//   2. Que endpoints responden con el registro de guerra en PRIVADO.
//   3. Si hay CWL en curso y cuantas rondas se pueden leer ahora mismo.
//
//   node src/jobs/probe.js

import { getClan, getCurrentWar, getWarLog, getLeagueGroup, getLeagueWar,
         getCapitalRaids, getPlayer, logro, CocError } from '../lib/coc.js';
import { clanes } from '../lib/config.js';

const marca = (ok) => (ok ? 'SI' : 'NO');

async function probar(fn) {
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    return { ok: false, status: err instanceof CocError ? err.status : null, err };
  }
}

console.log(`Base URL: ${process.env.COC_BASE_URL || 'https://cocproxy.royaleapi.dev/v1'}`);
const LISTA = await clanes();
console.log(`Clanes configurados: ${LISTA.map((c) => `${c.clan_tag} (${c.escuadra})`).join(', ')}\n`);

let fatal = false;
let muestra = null; // un tag cualquiera, para inspeccionar el perfil

for (const { clan_tag, escuadra } of LISTA) {
  console.log(`=== ${clan_tag}  escuadra ${escuadra} ===`);

  const clan = await probar(() => getClan(clan_tag));
  if (!clan.ok) {
    fatal = true;
    if (clan.status === 403) {
      console.log('  /clans          403  -> la llave no vale para esta IP.');
      console.log('                       Revisa que whitelisteaste 45.79.218.79');
      console.log('                       y que COC_BASE_URL apunta al proxy.');
    } else if (clan.status === 404) {
      console.log('  /clans          404  -> el tag del clan esta mal escrito.');
    } else {
      console.log(`  /clans          FALLO -> ${clan.err.message}`);
    }
    console.log('');
    continue;
  }

  const c = clan.data;
  if (!muestra) muestra = c.memberList?.[0]?.tag ?? null;
  console.log(`  Nombre: ${c.name}   Miembros: ${c.members}   Nivel: ${c.clanLevel}`);
  console.log(`  Registro de guerra: ${c.isWarLogPublic ? 'PUBLICO' : 'PRIVADO'}`);

  // La pregunta clave del brief: /currentwar responde con registro privado?
  const cw = await probar(() => getCurrentWar(clan_tag));
  console.log(`  /currentwar     ${marca(cw.ok)}${cw.ok ? `  estado=${cw.data.state}  tam=${cw.data.teamSize ?? '-'}` : `  (${cw.status ?? 'error'})`}`);
  if (cw.ok && cw.data.state !== 'notInWar') {
    const atacaron = (cw.data.clan?.members || []).filter((m) => m.attacks?.length).length;
    console.log(`                  -> detalle por ataque DISPONIBLE (${atacaron} miembros con ataques)`);
  }

  const wl = await probar(() => getWarLog(clan_tag));
  console.log(`  /warlog         ${marca(wl.ok)}${wl.ok ? `  ${wl.data.items?.length ?? 0} guerras` : `  (${wl.status ?? 'error'})`}`);

  // Raid Weekends: el volumen de ataques que hoy no se mide.
  const raids = await probar(() => getCapitalRaids(clan_tag, 8));
  if (!raids.ok) {
    console.log(`  /capitalraids   NO  (${raids.status ?? 'error'})`);
  } else {
    const temporadas = raids.data.items || [];
    let usados = 0;
    let disponibles = 0;
    let participantes = 0;
    for (const t of temporadas) {
      for (const m of t.members || []) {
        usados += m.attacks ?? 0;
        disponibles += (m.attackLimit ?? 0) + (m.bonusAttackLimit ?? 0);
        participantes++;
      }
    }
    const fallados = disponibles - usados;
    console.log(`  /capitalraids   SI  ${temporadas.length} fines de semana guardados`);
    console.log(`                  ataques: ${usados}/${disponibles} usados  -> ${fallados} FALLADOS`);
    if (disponibles > 0) {
      console.log(`                  desperdicio: ${((fallados / disponibles) * 100).toFixed(1)}%  (${participantes} participaciones)`);
    }
  }

  // CWL: se espera que funcione aunque el registro este privado.
  const lg = await probar(() => getLeagueGroup(clan_tag));
  if (!lg.ok) {
    console.log(`  /leaguegroup    NO  (${lg.status ?? 'error'})${lg.status === 404 ? '  -> no hay CWL activa para este clan' : ''}`);
    console.log('');
    continue;
  }

  const g = lg.data;
  const tags = g.rounds.flatMap((r) => r.warTags).filter((t) => t && t !== '#0');
  console.log(`  /leaguegroup    SI  temporada=${g.season}  liga=${g.clans?.length} clanes  estado=${g.state}`);
  console.log(`                  rondas reveladas: ${tags.length} de ${g.rounds.length * (g.clans.length / 2)}`);

  // Cuantas de esas rondas son NUESTRAS y en que estado estan.
  let nuestras = 0;
  let cerradas = 0;
  let ataquesLeidos = 0;
  for (const wt of tags) {
    const w = await probar(() => getLeagueWar(wt));
    if (!w.ok) continue;
    const lado = [w.data.clan, w.data.opponent].find((x) => x?.tag === clan_tag);
    if (!lado) continue;
    nuestras++;
    if (w.data.state === 'warEnded') cerradas++;
    ataquesLeidos += (lado.members || []).reduce((n, m) => n + (m.attacks?.length || 0), 0);
  }
  console.log(`                  guerras nuestras legibles: ${nuestras} (cerradas: ${cerradas})`);
  console.log(`                  ataques de CWL recuperables AHORA: ${ataquesLeidos}`);
  console.log('');
}

// Confirma los nombres EXACTOS de los logros que vamos a usar como metrica.
// El brief pide medirlos, no asumirlos: si Supercell renombra uno, el delta
// mensual se rompe en silencio y nadie se entera hasta el dia del pago.
if (muestra) {
  console.log('=== Logros del perfil (nombres exactos) ===');
  const p = await probar(() => getPlayer(muestra));
  if (!p.ok) {
    console.log(`  no se pudo leer el perfil de ${muestra}`);
  } else {
    console.log(`  Muestra: ${p.data.name} (${p.data.tag})   warStars=${p.data.warStars}`);
    for (const nombre of ['War Hero', 'War League Legend', 'Games Champion', 'Aggressive Capitalism']) {
      const v = logro(p.data, nombre);
      console.log(`  ${v === null ? 'NO EXISTE' : 'ok       '}  "${nombre}"${v === null ? '' : ` = ${v}`}`);
    }
    const otros = (p.data.achievements || [])
      .filter((a) => /war|game|capital|raid|league/i.test(a.name))
      .map((a) => `${a.name}=${a.value}`);
    console.log(`  relacionados: ${otros.join(', ')}`);
  }
  console.log('');
}

console.log('--- Lectura del resultado ---');
console.log('Si /leaguegroup dio SI, la CWL de este mes se puede rescatar completa.');
console.log('Si /currentwar dio SI con registro privado, tenemos detalle por ataque');
console.log('de guerra normal y no hace falta el plan B de deltas de warStars.');
console.log('El numero de ataques FALLADOS en raids dice cuanta actividad real');
console.log('esta quedando fuera del sistema de premios hoy.');

if (fatal) {
  console.error('\nHubo clanes que no respondieron. Corrige eso antes de seguir.');
  process.exit(1);
}
