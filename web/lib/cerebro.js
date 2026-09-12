// El cerebro: los signos vitales del sistema, medidos en un solo sitio.
//
// Lo usan dos cosas: la ruta /api/cerebro (la pestaña Cerebro del panel)
// y el job cerebro-latido (GitHub Actions, cada hora), que avisa a los
// lideres cuando la nota cae. Una sola funcion para que los dos cuenten
// lo mismo.
//
// Cada pieza sale con { clave, titulo, ok, detalle, sub, peso }. La nota
// es la suma de los pesos de lo que esta bien sobre la suma de los pesos
// de lo que se pudo medir: lo que no se puede medir donde corre (la
// version de Vercel en GitHub, la llave de la IA si no esta en ese
// entorno) pesa cero en vez de dar falsa alarma.

import { glosarioJuego, reglasDelClan } from './entrenamiento.js';
import { MODELOS_VISION } from './vision.js';
import { saludDelBot } from './bots-salud.js';

const BASE_COC = process.env.COC_BASE_URL || 'https://cocproxy.royaleapi.dev/v1';

/** Mide cuanto tarda algo y si salio; nunca tira. */
async function medir(fn) {
  const t0 = Date.now();
  try {
    const r = await fn();
    return { ok: true, ms: Date.now() - t0, ...r };
  } catch (e) {
    return { ok: false, ms: Date.now() - t0, error: String(e?.message ?? e).slice(0, 160) };
  }
}

export const horasDesde = (iso) => (iso ? Math.round((Date.now() - new Date(iso).getTime()) / 3_600_000) : null);

/** Con que cara esta el cerebro segun la nota. */
export function animoDe(nota) {
  if (nota == null) return 'pensando';
  if (nota >= 85) return 'sano';
  if (nota >= 60) return 'atento';
  return 'sobrecargado';
}

/**
 * Todo el chequeo. `admin` es un cliente de Supabase con service_role.
 *
 * @returns {Promise<object>} piezas, nota, animo, y los datos crudos que la pestaña enseña
 */
export async function medirSalud(admin) {
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Havana' });
  const mes = hoy.slice(0, 7);
  const version = (process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 7) || null;
  const region = process.env.VERCEL_REGION || null;
  const llaveIA = process.env.IA_LLAVE;
  const urlIA = (process.env.IA_URL || '').replace(/\/$/, '');

  const [supabase, clash, ia, heraldo, valquiria, datos] = await Promise.all([
    medir(async () => {
      const { error, count } = await admin.from('config').select('*', { count: 'exact', head: true });
      if (error) throw error;
      return { filas: count ?? 0 };
    }),

    medir(async () => {
      const { data: c } = await admin.from('clans').select('clan_tag, nombre').order('escuadra').limit(1).maybeSingle();
      if (!c) return { clan: null, nota: 'sin clanes dados de alta' };
      if (!process.env.COC_TOKEN) throw new Error('COC_TOKEN no está en este entorno');
      const r = await fetch(`${BASE_COC}/clans/${encodeURIComponent(c.clan_tag)}`, {
        headers: { Authorization: `Bearer ${process.env.COC_TOKEN}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(8000),
      });
      if (!r.ok) throw new Error(`Clash respondió ${r.status}`);
      const j = await r.json();
      return { clan: j.name, miembros: j.members, nivel: j.clanLevel };
    }),

    medir(async () => {
      if (!llaveIA || !urlIA) return { configurada: false, medible: false, texto: null, vision: null };
      const r = await fetch(`${urlIA}/models`, { headers: { Authorization: `Bearer ${llaveIA}` }, signal: AbortSignal.timeout(6000) });
      if (!r.ok) throw new Error(`la IA respondió ${r.status}`);
      const ids = ((await r.json()).data ?? []).map((m) => String(m.id));
      return {
        configurada: true,
        medible: true,
        texto: process.env.IA_MODELO || ids.find((m) => /gpt-oss-120b/.test(m)) || ids[0] || null,
        vision: MODELOS_VISION.find((m) => ids.includes(m)) ?? null,
        modelos: ids.length,
      };
    }),

    saludDelBot('heraldo'),
    saludDelBot('recluta'),

    medir(async () => {
      const [jobs, snap, cfg, lecc, vinc, players, clans, cast, ret, out, bases, sol, uso, bit] = await Promise.all([
        admin.from('job_runs').select('job, started_at, finished_at, ok, filas, error').order('started_at', { ascending: false }).limit(150),
        admin.from('snapshots').select('fecha').order('fecha', { ascending: false }).limit(1).maybeSingle(),
        admin.from('config').select('clave, valor').in('clave', ['meta_digest', 'bots_memoria', 'ia_activa', 'telegram_activo', 'meta_canales', 'cerebro_estado']),
        admin.from('lecciones').select('bot, activa, propuesta'),
        admin.from('tg_vinculos').select('tg_user_id'),
        admin.from('players').select('*', { count: 'exact', head: true }).eq('activo', true),
        admin.from('clans').select('clan_tag, nombre, escuadra').order('escuadra'),
        admin.from('castillos').select('verificado').eq('temporada', mes),
        admin.from('retos').select('verificado').eq('temporada', mes),
        admin.from('outbox').select('*', { count: 'exact', head: true }).eq('estado', 'pendiente'),
        admin.from('bases').select('*', { count: 'exact', head: true }),
        admin.from('solicitudes').select('estado'),
        admin.from('ia_uso').select('llamadas, fallos').eq('dia', hoy).maybeSingle(),
        admin.from('bitacora').select('id, creado_en, bot, modo, nombre, texto').order('creado_en', { ascending: false }).limit(40),
      ]);

      const ultimos = new Map();
      for (const j of jobs.data ?? []) if (!ultimos.has(j.job)) ultimos.set(j.job, j);
      const listaJobs = [...ultimos.values()].map((j) => ({ ...j, hace: horasDesde(j.started_at) }));

      const config = Object.fromEntries((cfg.data ?? []).map((c) => [c.clave, c.valor]));
      const digest = config.meta_digest ?? null;
      const glosario = await glosarioJuego(admin);
      const reglas = await reglasDelClan(admin);
      const lecciones = (lecc.data ?? []).filter((l) => l.activa && !l.propuesta);
      const propuestas = (lecc.data ?? []).filter((l) => l.propuesta).length;
      const estados = (sol.data ?? []).reduce((a, s) => ((a[s.estado] = (a[s.estado] ?? 0) + 1), a), {});

      return {
        jobs: listaJobs,
        snapshot: { fecha: snap.data?.fecha ?? null, hace: snap.data?.fecha ? horasDesde(`${snap.data.fecha}T12:00:00Z`) : null },
        meta: digest ? { actualizado: digest.actualizado ?? null, hace: horasDesde(digest.actualizado), videos: digest.videos ?? null, articulos: digest.articulos ?? null, caracteres: String(digest.texto ?? '').length } : null,
        memoria: {
          lecciones: { total: lecciones.length, heraldo: lecciones.filter((l) => l.bot !== 'valquiria').length, valquiria: lecciones.filter((l) => l.bot !== 'heraldo').length, propuestas },
          glosario: (glosario ?? []).length,
          reglas: { fecha: reglas.fecha ?? null, palabras: reglas.texto ? reglas.texto.split(/\s+/).length : 0 },
          memoriaLideres: String(config.bots_memoria ?? '').length,
          canales: Array.isArray(config.meta_canales) ? config.meta_canales.length : null,
          vinculados: new Set((vinc.data ?? []).map((v) => v.tg_user_id)).size, // personas, no cuentas
          jugadores: players.count ?? 0,
          clanes: (clans.data ?? []).length,
          bases: bases.count ?? 0,
          solicitudes: { pendientes: (estados.pendiente ?? 0) + (estados.prueba ?? 0), aceptadas: estados.aceptada ?? 0 },
        },
        puntos: {
          mes,
          castillos: (cast.data ?? []).filter((c) => c.verificado).length,
          castillosPendientes: (cast.data ?? []).filter((c) => !c.verificado).length,
          retos: (ret.data ?? []).filter((r) => r.verificado).length,
        },
        outbox: out.count ?? 0,
        interruptores: { ia: config.ia_activa !== false, telegram: config.telegram_activo !== false },
        cuota: { hoy: uso.data?.llamadas ?? 0, fallos: uso.data?.fallos ?? 0, tope: Number(process.env.IA_TOPE_DIA) || 300 },
        bitacora: bit.data ?? [],
        latido: config.cerebro_estado ?? null,
      };
    }),
  ]);

  // ---- Las piezas, con su peso ----
  const piezas = [];
  const pon = (clave, titulo, ok, detalle, sub = '', peso = 0) => piezas.push({ clave, titulo, ok: Boolean(ok), detalle: String(detalle ?? ''), sub: String(sub ?? ''), peso });

  pon('vercel', 'Vercel', true, version ? `desplegado ${version}` : 'no medido aquí', region ? `región ${region}` : '', version ? 10 : 0);
  pon('supabase', 'Supabase', supabase.ok, supabase.ok ? `${supabase.ms} ms` : supabase.error, 'la base de datos', 15);
  pon('clash', 'API de Clash', clash.ok, clash.ok ? `${clash.ms} ms` : clash.error, clash.clan ? `${clash.clan} · ${clash.miembros} miembros` : 'por el proxy de RoyaleAPI', 15);
  pon('ia', 'IA (Groq)', ia.ok && ia.configurada, ia.ok ? (ia.configurada ? ia.texto : 'sin llave en este entorno') : ia.error, ia.vision ? `visión: ${ia.vision}` : ia.medible ? 'sin modelo de visión' : '', ia.medible === false && ia.ok ? 0 : 10);

  const okBot = (x) => Boolean(x && !x.error && x.webhook?.ok && !x.webhook?.ultimoError);
  const detBot = (x) => (!x ? 'sin datos' : x.error ? x.error : x.webhook?.ok ? (x.webhook.ultimoError ? `último error: ${x.webhook.ultimoError}` : 'webhook conectado') : 'webhook mal apuntado');
  const subBot = (x) => (x?.usuario ? `@${x.usuario} · ${x.enGrupo ? 'en el grupo' : 'fuera del grupo'} · ${x.webhook?.pendientes ?? 0} pendientes` : '');
  pon('heraldo', 'Heraldo', okBot(heraldo), detBot(heraldo), subBot(heraldo), heraldo?.configurado === false ? 0 : 10);
  pon('valquiria', 'Valquiria', okBot(valquiria), detBot(valquiria), subBot(valquiria), valquiria?.configurado === false ? 0 : 5);

  const d = datos.ok ? datos : null;
  const jobsMal = (d?.jobs ?? []).filter((j) => j.ok === false);
  pon('jobs', 'Jobs (GitHub Actions)', d && jobsMal.length === 0, !d ? datos.error : jobsMal.length ? `${jobsMal.length} con error: ${jobsMal.map((j) => j.job).join(', ')}` : `${d.jobs.length} jobs, todos bien`, 'los robots de fondo: sincronizar, avisar, cerrar el mes', 15);
  pon('snapshot', 'Datos de los jugadores', d?.snapshot?.hace != null && d.snapshot.hace <= 36, d?.snapshot?.fecha ? `último snapshot ${d.snapshot.fecha}` : 'sin snapshots', d?.snapshot?.hace != null ? `hace ${d.snapshot.hace} h` : '', 10);
  pon('meta', 'Digesto del meta', d?.meta?.hace != null && d.meta.hace <= 72, d?.meta ? `${d.meta.videos ?? '?'} videos · ${d.meta.articulos ?? '?'} artículos` : 'sin digesto', d?.meta?.hace != null ? `hace ${d.meta.hace} h` : '', 5);
  pon('outbox', 'Bandeja de salida', d && (d.outbox ?? 0) < 10, `${d?.outbox ?? '?'} pendientes`, 'avisos por mandar', 5);
  if (d) pon('cuota', 'Cuota de IA hoy', d.cuota.hoy < d.cuota.tope * 0.9, `${d.cuota.hoy} / ${d.cuota.tope} llamadas`, `${d.cuota.fallos} fallos`, 0);

  const total = piezas.reduce((s, p) => s + p.peso, 0);
  const suma = piezas.reduce((s, p) => s + (p.ok ? p.peso : 0), 0);
  const nota = total ? Math.round((100 * suma) / total) : null;

  return {
    ok: true,
    hoy,
    version,
    region,
    nota,
    animo: animoDe(nota),
    piezas,
    fallan: piezas.filter((p) => p.peso > 0 && !p.ok).map((p) => p.titulo),
    supabase,
    clash,
    ia,
    bots: { heraldo, recluta: valquiria },
    ...(d ?? { jobs: [], memoria: null, puntos: null, meta: null, snapshot: null, outbox: null, cuota: null, bitacora: [], latido: null, errorDatos: datos.error }),
  };
}

/** Resumen en texto plano, para la IA del panel y para los avisos. */
export function resumenDeSalud(s) {
  const l = [];
  l.push(`Salud general: ${s.nota ?? '?'}/100 (${s.animo}). Fecha: ${s.hoy}. Versión desplegada: ${s.version ?? 'no medida'}.`);
  for (const x of s.piezas ?? []) l.push(`- ${x.titulo}: ${x.ok ? 'OK' : x.peso ? 'FALLA' : 'OJO'} · ${x.detalle}${x.sub ? ` · ${x.sub}` : ''}`);
  for (const j of s.jobs ?? []) l.push(`- job ${j.job}: ${j.ok === false ? `ERROR ${j.error ?? ''}` : j.ok ? 'ok' : 'en curso'} hace ${j.hace ?? '?'} h${j.filas != null ? ` · ${j.filas} filas` : ''}`);
  const m = s.memoria;
  if (m) {
    l.push(`- Sabe: ${m.jugadores} jugadores, ${m.clanes} clanes, ${m.vinculados} vinculados con /soy, ${m.lecciones.total} lecciones (${m.lecciones.propuestas} propuestas por aprobar), glosario de ${m.glosario} entidades, normas de ${m.reglas.palabras} palabras (${m.reglas.fecha ?? 'sin fecha'}), ${m.memoriaLideres} caracteres de 'lo que deben saber', ${m.canales ?? '?'} canales del meta, ${m.bases} bases, ${m.solicitudes.pendientes} solicitudes pendientes.`);
  }
  if (s.puntos) l.push(`- Puntos de ${s.puntos.mes}: ${s.puntos.castillos} castillos confirmados (${s.puntos.castillosPendientes} por confirmar), ${s.puntos.retos} retos de FC.`);
  if (s.bitacora?.length) l.push(`- Bitácora: ${s.bitacora.length} respuestas recientes de la IA (la última: ${String(s.bitacora[0].texto).slice(0, 120)}).`);
  return l.join('\n').slice(0, 4000);
}
