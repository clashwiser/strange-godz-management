// El recordatorio de inscribirse en la Liga de Guerra: la ventana real
// (dos días, del 1 a las 08:00 UTC al 3 a la misma hora) y el texto.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inscripcionAbierta, horasParaCerrar, estaInscrito, textoInscripcion, botonLanzado, DATO_LANZADO } from '../src/lib/liga-inscripcion.js';

const d = (s) => new Date(s);

test('la inscripción abre el día 1 a las 08:00 UTC y cierra el 3 a la misma hora', () => {
  assert.equal(inscripcionAbierta(d('2026-10-01T07:59:00Z')), false);
  assert.equal(inscripcionAbierta(d('2026-10-01T08:00:00Z')), true);
  assert.equal(inscripcionAbierta(d('2026-10-02T03:00:00Z')), true);
  assert.equal(inscripcionAbierta(d('2026-10-03T07:59:00Z')), true);
  // A las 4:00 AM de Cuba del día 3 ya está cerrada: esto fue lo que costó
  // una liga en octubre de 2026.
  assert.equal(inscripcionAbierta(d('2026-10-03T08:00:00Z')), false);
  assert.equal(inscripcionAbierta(d('2026-10-05T12:00:00Z')), false);
});

test('las horas que quedan, y null fuera de la ventana', () => {
  assert.equal(horasParaCerrar(d('2026-10-01T08:00:00Z')), 48);
  assert.equal(horasParaCerrar(d('2026-10-02T20:00:00Z')), 12);
  assert.equal(horasParaCerrar(d('2026-10-03T08:00:00Z')), null);
});

test('estaInscrito: el grupo del mes pasado (ended) no cuenta', () => {
  assert.equal(estaInscrito({ state: 'preparation' }), true);
  assert.equal(estaInscrito({ state: 'inWar' }), true);
  assert.equal(estaInscrito({ state: 'ended' }), false);
  assert.equal(estaInscrito(null), false);
});

test('el texto dice cuánto queda, a quién no ve y cómo callarlo', () => {
  const t = textoInscripcion(['ＳＴＲＡＮＧＥ - ＷＯＲＬＤ'], 31.5);
  assert.match(t, /dura <b>dos días<\/b>/);
  assert.match(t, /1 día y 8 h/);
  assert.match(t, /ＳＴＲＡＮＧＥ - ＷＯＲＬＤ/);
  assert.match(t, /Ya lanzamos/);
  // Sin nadie pendiente no se nombra a ningún clan.
  assert.doesNotMatch(textoInscripcion([], 3), /No veo inscrito/);
  assert.match(textoInscripcion([], 0.5), /menos de una hora/);
});

test('el botón de los líderes', () => {
  assert.deepEqual(botonLanzado(), { inline_keyboard: [[{ text: '✅ Ya lanzamos', callback_data: DATO_LANZADO }]] });
});
