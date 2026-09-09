// Capa de acceso a Supabase.
// Los jobs usan la SERVICE ROLE key: salta RLS por diseno y solo vive en
// GitHub Secrets. Nunca debe llegar al navegador.

import { createClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !KEY) {
  throw new Error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno');
}

export const db = createClient(URL, KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** Tira si Supabase devolvio error, para que el job falle ruidosamente. */
export function chk({ data, error }, contexto) {
  if (error) throw new Error(`${contexto}: ${error.message}`);
  return data;
}

/**
 * Garantiza que el jugador existe y mantiene el historial de nombres.
 * La llave es SIEMPRE el tag: los jugadores se renombran.
 */
export async function asegurarJugador(tag, nombre) {
  chk(
    await db.from('players').upsert(
      { player_tag: tag, nombre_actual: nombre, updated_at: new Date().toISOString() },
      { onConflict: 'player_tag' }
    ),
    `upsert player ${tag}`
  );
  chk(
    await db
      .from('player_names')
      .upsert({ player_tag: tag, nombre }, { onConflict: 'player_tag,nombre', ignoreDuplicates: true }),
    `upsert player_name ${tag}`
  );
}

/** Version en lote: una sola ida y vuelta para todo el clan. */
export async function asegurarJugadores(pares) {
  if (!pares.length) return;
  const ahora = new Date().toISOString();
  chk(
    await db.from('players').upsert(
      pares.map(({ tag, nombre }) => ({
        player_tag: tag,
        nombre_actual: nombre,
        updated_at: ahora,
      })),
      { onConflict: 'player_tag' }
    ),
    'upsert players en lote'
  );
  chk(
    await db.from('player_names').upsert(
      pares.map(({ tag, nombre }) => ({ player_tag: tag, nombre })),
      { onConflict: 'player_tag,nombre', ignoreDuplicates: true }
    ),
    'upsert player_names en lote'
  );
}

/**
 * Envuelve un job: registra inicio, fin, filas y error en job_runs.
 * Si falla, deja rastro en la base ANTES de propagar, para que el dashboard
 * muestre "la ultima corrida fallo" aunque GitHub Actions se haya caido.
 */
export async function correrJob(nombre, fn) {
  const inicio = new Date().toISOString();
  const { data: fila } = await db
    .from('job_runs')
    .insert({ job: nombre, started_at: inicio })
    .select('id')
    .single();

  const cerrar = (campos) =>
    fila?.id
      ? db.from('job_runs').update({ finished_at: new Date().toISOString(), ...campos }).eq('id', fila.id)
      : Promise.resolve();

  try {
    const res = await fn();
    const filas = typeof res === 'number' ? res : (res?.filas ?? null);
    await cerrar({ ok: true, filas, detalle: res?.detalle ?? null });
    console.log(`[${nombre}] OK${filas != null ? ` - ${filas} filas` : ''}`);
    return res;
  } catch (err) {
    await cerrar({ ok: false, error: String(err?.message || err).slice(0, 2000) });
    console.error(`[${nombre}] FALLO:`, err);
    throw err;
  }
}
