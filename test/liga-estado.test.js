// El titulo de /estrellas: la liga del mes y en que va.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mesDe, temporadaAnterior, estadoDeLiga, tituloEstrellas } from '../web/lib/liga-estado.js';

test('mes y temporada anterior', () => {
  assert.equal(mesDe('2026-09'), 'septiembre');
  assert.equal(mesDe('2026-01'), 'enero');
  assert.equal(temporadaAnterior('2026-09'), '2026-08');
  assert.equal(temporadaAnterior('2026-01'), '2025-12');
});

test('estado de la liga por las rondas guardadas', () => {
  assert.equal(estadoDeLiga([]), null);
  assert.equal(estadoDeLiga([{ ronda: 1, estado: 'warEnded' }, { ronda: 2, estado: 'inWar' }]), 'en curso');
  assert.equal(estadoDeLiga([{ ronda: 3, estado: 'warEnded' }]), 'en curso');
  assert.equal(estadoDeLiga([{ ronda: 6, estado: 'warEnded' }, { ronda: 7, estado: 'warEnded' }]), 'pasada');
  assert.equal(estadoDeLiga([{ ronda: 7, estado: 'preparation' }]), 'en curso');
});

test('el titulo', () => {
  assert.equal(tituloEstrellas('2026-09', 'pasada'), '⭐ <b>Estrellas · Liga de septiembre (pasada)</b> · por clan');
  assert.equal(tituloEstrellas('2026-10', 'en curso', (s) => `*${s}*`), '⭐ *Estrellas · Liga de octubre (en curso)* · por clan');
});
