// El parte semanal del cerebro: los lunes por la mañana, a los lideres en
// privado. Que paso en la semana, que aprendio, que fallo.
//
// Todo sale de la base: las corridas de los jobs (job_runs), las llamadas
// a la IA (ia_uso), las lecciones nuevas y las propuestas sin aprobar
// (lecciones), los puntos (castillos, retos), las solicitudes, la
// bitacora, y la salud ahora mismo (web/lib/cerebro.js). Nada se inventa:
// si algo no se pudo contar, se dice.
//
// Correr a mano:  npm run cerebro:parte

import { db, correrJob } from '../lib/db.js';
import { medirSalud } from '../../web/lib/cerebro.js';
import { avisarALideres } from '../../web/lib/bots-salud.js';

const SITIO = (process.env.SITIO_URL || 'https://strange-godz-management.vercel.app').replace(/\/$/, '');
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const fecha = (d) => d.toLocaleDateString('es', { day: 'numeric', month: 'short', timeZone: 'America/Havana' });

await correrJob('cerebro-parte', async () => {
  const hasta = new Date();
  const desde = new Date(hasta.getTime() - 7 * 24 * 3_600_000);
  const desdeIso = desde.toISOString();
  const desdeDia = desde.toLocaleDateString('en-CA', { timeZone: 'America/Havana' });

  const [salud, jobs, uso, lecciones, castillos, retos, solicitudes, bitacora] = await Promise.all([
    medirSalud(db),
    db.from('job_runs').select('job, ok, started_at, error').gte('started_at', desdeIso),
    db.from('ia_uso').select('dia, llamadas, fallos').gte('dia', desdeDia),
    db.from('lecciones').select('activa, propuesta, creado_en'),
    db.from('castillos').select('verificado, creado_en').gte('creado_en', desdeIso),
    db.from('retos').select('verificado, creado_en').gte('creado_en', desdeIso),
    db.from('solicitudes').select('estado, creado_en').gte('creado_en', desdeIso),
    db.from('bitacora').select('modo, creado_en').gte('creado_en', desdeIso),
  ]);

  const corridas = jobs.data ?? [];
  const fallidas = corridas.filter((j) => j.ok === false);
  const porJob = {};
  for (const j of fallidas) porJob[j.job] = (porJob[j.job] ?? 0) + 1;
  const llamadas = (uso.data ?? []).reduce((s, u) => s + (u.llamadas ?? 0), 0);
  const fallosIA = (uso.data ?? []).reduce((s, u) => s + (u.fallos ?? 0), 0);
  const nuevas = (lecciones.data ?? []).filter((l) => l.activa && !l.propuesta && l.creado_en >= desdeIso).length;
  const propuestas = (lecciones.data ?? []).filter((l) => l.propuesta).length;
  const cast = (castillos.data ?? []).filter((c) => c.verificado).length;
  const castPend = (castillos.data ?? []).filter((c) => !c.verificado).length;
  const fc = (retos.data ?? []).filter((r) => r.verificado).length;
  const sol = solicitudes.data ?? [];
  const bit = bitacora.data ?? [];
  const fotos = bit.filter((b) => String(b.modo).startsWith('foto')).length;

  const lineas = [
    `🧠 <b>Parte semanal del cerebro</b> · ${fecha(desde)} – ${fecha(hasta)}`,
    '',
    `<b>Salud ahora:</b> ${salud.nota ?? '?'}/100 (${salud.animo})${salud.fallan.length ? ` · falla: ${esc(salud.fallan.join(', '))}` : ''}`,
    `<b>Jobs:</b> ${corridas.length} corridas, ${fallidas.length} con error${fallidas.length ? ` (${esc(Object.entries(porJob).map(([j, n]) => `${j} ×${n}`).join(', '))})` : ''}`,
    `<b>IA:</b> ${llamadas} llamadas, ${fallosIA} fallos · ${bit.length} respuestas en la bitácora, ${fotos} capturas leídas`,
    `<b>Aprendí:</b> ${nuevas} ${nuevas === 1 ? 'lección nueva' : 'lecciones nuevas'}${propuestas ? ` · <b>${propuestas} propuestas esperan aprobación</b> (Cerebro → Entrenar)` : ''}`,
    `<b>Puntos:</b> ${cast} castillos confirmados${castPend ? ` (${castPend} por confirmar)` : ''}, ${fc} retos de FC`,
    `<b>Solicitudes:</b> ${sol.length} nuevas · ${sol.filter((s) => s.estado === 'aceptada').length} aceptadas · ${sol.filter((s) => ['pendiente', 'prueba'].includes(s.estado)).length} pendientes`,
    salud.meta ? `<b>Meta:</b> digesto renovado hace ${salud.meta.hace ?? '?'} h (${salud.meta.videos ?? '?'} videos, ${salud.meta.articulos ?? '?'} artículos)` : '<b>Meta:</b> sin digesto',
    '',
    `${SITIO} → Cerebro`,
  ];
  const texto = lineas.join('\n');
  const llegaron = await avisarALideres(texto);
  console.log(texto.replace(/<[^>]+>/g, ''));
  console.log(`avisados: ${llegaron}`);
  return { filas: llegaron, detalle: { llegaron, corridas: corridas.length, fallidas: fallidas.length } };
});
