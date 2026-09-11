// El cerebro del panel: los signos vitales del sistema y lo que sabe.
//
// Una sola llamada que toca todo lo que puede fallar -Vercel, Supabase,
// la API de Clash, la IA, los jobs, los datos- y devuelve cada cosa con
// su semaforo y una nota de salud de 0 a 100. La pestaña Cerebro la pinta
// y se la pasa a la IA para que conteste "¿cómo estás?" con datos de
// verdad y no con una frase.
//
// Los bots (webhooks, cupo de la IA de hoy) ya los mira /api/bots; la
// pestaña llama a las dos y las junta. Aqui va lo demas.
//
// Solo lideres con sesion: son las tripas del sistema.

import { admin } from '../../../lib/supabase-admin';
import { glosarioJuego, reglasDelClan } from '../../../lib/entrenamiento';
import { MODELOS_VISION } from '../../../lib/vision';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const BASE_COC = process.env.COC_BASE_URL || 'https://cocproxy.royaleapi.dev/v1';

async function quienLlama(request) {
  const jwt = (request.headers.get('authorization') ?? '').replace(/^Bearer /, '');
  if (!jwt) return null;
  const { data: usuario, error } = await admin.auth.getUser(jwt);
  if (error || !usuario?.user) return null;
  const { data: lider } = await admin.from('dashboard_users').select('puede_editar, nombre').eq('user_id', usuario.user.id).maybeSingle();
  return lider ?? null;
}

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

const horas = (iso) => (iso ? Math.round((Date.now() - new Date(iso).getTime()) / 3_600_000) : null);

export async function GET(request) {
  const lider = await quienLlama(request);
  if (!lider) return Response.json({ ok: false, error: 'no autorizado' }, { status: 401 });

  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Havana' });
  const mes = hoy.slice(0, 7);

  const [supabase, clash, ia, datos] = await Promise.all([
    // Supabase: una consulta minima, cronometrada.
    medir(async () => {
      const { error, count } = await admin.from('config').select('*', { count: 'exact', head: true });
      if (error) throw error;
      return { filas: count ?? 0 };
    }),

    // La API de Clash, por el proxy, con el primer clan de la alianza.
    medir(async () => {
      const { data: c } = await admin.from('clans').select('clan_tag, nombre').order('escuadra').limit(1).maybeSingle();
      if (!c) return { clan: null, nota: 'sin clanes dados de alta' };
      if (!process.env.COC_TOKEN) throw new Error('COC_TOKEN no está en Vercel');
      const r = await fetch(`${BASE_COC}/clans/${encodeURIComponent(c.clan_tag)}`, {
        headers: { Authorization: `Bearer ${process.env.COC_TOKEN}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(8000),
      });
      if (!r.ok) throw new Error(`Clash respondió ${r.status}`);
      const j = await r.json();
      return { clan: j.name, miembros: j.members, nivel: j.clanLevel, guerra: j.warLeague?.name ?? null };
    }),

    // La IA: la llave responde, y que modelos hay (texto y vision).
    medir(async () => {
      const llave = process.env.IA_LLAVE;
      const url = (process.env.IA_URL || '').replace(/\/$/, '');
      if (!llave || !url) return { configurada: false, texto: null, vision: false };
      const r = await fetch(`${url}/models`, { headers: { Authorization: `Bearer ${llave}` }, signal: AbortSignal.timeout(6000) });
      if (!r.ok) throw new Error(`la IA respondió ${r.status}`);
      const ids = ((await r.json()).data ?? []).map((m) => String(m.id));
      return {
        configurada: true,
        texto: process.env.IA_MODELO || ids.find((m) => /gpt-oss-120b/.test(m)) || ids[0] || null,
        vision: MODELOS_VISION.find((m) => ids.includes(m)) ?? null,
        modelos: ids.length,
      };
    }),

    // Lo que hay en la base: jobs, datos, memoria.
    medir(async () => {
      const [jobs, snap, cfg, lecc, vinc, players, clans, cast, ret, out, bases, sol] = await Promise.all([
        admin.from('job_runs').select('job, started_at, finished_at, ok, filas, error').order('started_at', { ascending: false }).limit(150),
        admin.from('snapshots').select('fecha').order('fecha', { ascending: false }).limit(1).maybeSingle(),
        admin.from('config').select('clave, valor').in('clave', ['meta_digest', 'reglas_fecha', 'bots_memoria', 'ia_activa', 'telegram_activo', 'meta_canales']),
        admin.from('lecciones').select('bot, activa'),
        admin.from('tg_vinculos').select('*', { count: 'exact', head: true }),
        admin.from('players').select('*', { count: 'exact', head: true }).eq('activo', true),
        admin.from('clans').select('clan_tag, nombre, escuadra').order('escuadra'),
        admin.from('castillos').select('verificado').eq('temporada', mes),
        admin.from('retos').select('verificado').eq('temporada', mes),
        admin.from('outbox').select('*', { count: 'exact', head: true }).eq('estado', 'pendiente'),
        admin.from('bases').select('*', { count: 'exact', head: true }),
        admin.from('solicitudes').select('estado'),
      ]);

      // El ultimo run de cada job.
      const ultimos = new Map();
      for (const j of jobs.data ?? []) if (!ultimos.has(j.job)) ultimos.set(j.job, j);
      const listaJobs = [...ultimos.values()].map((j) => ({ ...j, hace: horas(j.started_at) }));

      const config = Object.fromEntries((cfg.data ?? []).map((c) => [c.clave, c.valor]));
      const digest = config.meta_digest ?? null;
      const glosario = await glosarioJuego(admin);
      const reglas = await reglasDelClan(admin);
      const lecciones = (lecc.data ?? []).filter((l) => l.activa);
      const estados = (sol.data ?? []).reduce((a, s) => ((a[s.estado] = (a[s.estado] ?? 0) + 1), a), {});

      return {
        jobs: listaJobs,
        snapshot: { fecha: snap.data?.fecha ?? null, hace: snap.data?.fecha ? horas(`${snap.data.fecha}T12:00:00Z`) : null },
        meta: digest ? { actualizado: digest.actualizado ?? null, hace: horas(digest.actualizado), videos: digest.videos ?? null, articulos: digest.articulos ?? null, caracteres: String(digest.texto ?? '').length } : null,
        memoria: {
          lecciones: { total: lecciones.length, heraldo: lecciones.filter((l) => l.bot !== 'valquiria').length, valquiria: lecciones.filter((l) => l.bot !== 'heraldo').length },
          glosario: (glosario ?? []).length,
          reglas: { fecha: reglas.fecha ?? null, palabras: reglas.texto ? reglas.texto.split(/\s+/).length : 0 },
          memoriaLideres: String(config.bots_memoria ?? '').length,
          canales: Array.isArray(config.meta_canales) ? config.meta_canales.length : null,
          vinculados: vinc.count ?? 0,
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
      };
    }),
  ]);

  // La nota. Cada cosa pesa lo que duele cuando falla.
  const partes = [];
  const nota = (clave, peso, bien, detalle) => partes.push({ clave, peso, bien: Boolean(bien), detalle });
  nota('vercel', 10, true, process.env.VERCEL_GIT_COMMIT_SHA ? 'desplegado' : 'local');
  nota('supabase', 15, supabase.ok, supabase.ok ? `${supabase.ms} ms` : supabase.error);
  nota('clash', 15, clash.ok, clash.ok ? `${clash.ms} ms` : clash.error);
  nota('ia', 10, ia.ok && ia.configurada, ia.ok ? (ia.configurada ? `${ia.texto}${ia.vision ? ' + visión' : ''}` : 'sin llave') : ia.error);
  const jobsMal = (datos.jobs ?? []).filter((j) => j.ok === false);
  nota('jobs', 15, datos.ok && jobsMal.length === 0, jobsMal.length ? `${jobsMal.length} con error: ${jobsMal.map((j) => j.job).join(', ')}` : `${(datos.jobs ?? []).length} jobs, todos bien`);
  nota('snapshot', 10, datos.ok && datos.snapshot?.hace != null && datos.snapshot.hace <= 36, datos.snapshot?.fecha ? `${datos.snapshot.fecha}` : 'sin snapshots');
  nota('meta', 5, datos.ok && datos.meta && datos.meta.hace != null && datos.meta.hace <= 72, datos.meta ? `hace ${datos.meta.hace} h` : 'sin digesto');
  nota('outbox', 5, datos.ok && (datos.outbox ?? 0) < 10, `${datos.outbox ?? '?'} pendientes`);
  // Los bots (15) los suma la pestaña con /api/bots: aqui quedan fuera del 100.
  const total = partes.reduce((s, p) => s + p.peso, 0);
  const suma = partes.reduce((s, p) => s + (p.bien ? p.peso : 0), 0);

  return Response.json({
    ok: true,
    version: (process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 7) || null,
    region: process.env.VERCEL_REGION || null,
    hoy,
    supabase,
    clash,
    ia,
    ...(datos.ok ? datos : { jobs: [], memoria: null, puntos: null, meta: null, snapshot: null, outbox: null, errorDatos: datos.error }),
    salud: { partes, suma, total },
    lider: lider.nombre ?? null,
  });
}
