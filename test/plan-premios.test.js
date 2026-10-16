// El plan de premios que hereda un mes sin plan (web/lib/plan-premios.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mesAnterior, filasHeredadas, planDelMes } from '../web/lib/plan-premios.js';

test('mesAnterior: el mes de antes, con la vuelta de enero', () => {
  assert.equal(mesAnterior('2026-10'), '2026-09');
  assert.equal(mesAnterior('2026-01'), '2025-12');
  assert.equal(mesAnterior('2026-12'), '2026-11');
});

test('filasHeredadas: las mismas filas con el mes nuevo y sin id', () => {
  const plan = [{ id: 7, mes: '2026-09', orden: 0, titulo: 'x300 · 1er lugar CWL', criterio: 'Mas estrellas', clan_tag: '#2GC', monto_usd: 15, tipo: 'efectivo', activo: true }];
  const [f] = filasHeredadas(plan, '2026-10');
  assert.equal(f.mes, '2026-10');
  assert.equal(f.titulo, 'x300 · 1er lugar CWL');
  assert.equal(f.monto_usd, 15);
  assert.equal('id' in f, false);
});

// Un Supabase de mentira: lo justo para from().select().eq().order() y upsert().
function falso(filas) {
  const escritas = [];
  return {
    escritas,
    from: () => ({
      select: () => ({
        eq: (_col, mes) => ({ order: async () => ({ data: filas.filter((f) => f.mes === mes) }) }),
      }),
      upsert: async (nuevas) => {
        escritas.push(...nuevas);
        return { error: null };
      },
    }),
  };
}

const SEPT = [
  { mes: '2026-09', orden: 0, titulo: 'Puntos del mes', monto_usd: 5, tipo: 'pase_evento', activo: true },
  { mes: '2026-09', orden: 1, titulo: 'Cuba · 2do lugar', monto_usd: 7, tipo: 'pase_oro', activo: false },
];

test('planDelMes: un mes con plan devuelve el suyo, solo los activos, y no hereda', async () => {
  const db = falso(SEPT);
  const r = await planDelMes(db, '2026-09', { guardar: true });
  assert.equal(r.heredado, false);
  assert.deepEqual(r.premios.map((p) => p.titulo), ['Puntos del mes']);
  assert.equal(db.escritas.length, 0);
});

test('planDelMes: octubre sin plan hereda el de septiembre; guardando, lo escribe entero', async () => {
  const db = falso(SEPT);
  const r = await planDelMes(db, '2026-10', { guardar: true });
  assert.equal(r.heredado, true);
  assert.deepEqual(r.premios.map((p) => p.titulo), ['Puntos del mes']);
  // Se copian tambien las apagadas: en Bonos tienen que seguir ahi para encenderlas.
  assert.deepEqual(db.escritas.map((p) => `${p.mes} ${p.titulo}`), ['2026-10 Puntos del mes', '2026-10 Cuba · 2do lugar']);
});

test('planDelMes: sin guardar (el cartel, que es un GET) no escribe nada', async () => {
  const db = falso(SEPT);
  const r = await planDelMes(db, '2026-10');
  assert.equal(r.heredado, true);
  assert.equal(db.escritas.length, 0);
});

test('planDelMes: sin plan ni este mes ni el anterior, vacio', async () => {
  const r = await planDelMes(falso([]), '2026-10', { guardar: true });
  assert.deepEqual(r, { premios: [], heredado: false });
});
