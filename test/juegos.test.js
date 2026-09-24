// Los Juegos del Clan: los dos escalones de premio (4.000 y 10.000), leer
// la fila del jugador en la lista y el pie que dispara el comando.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { premioPorJuegos, esFotoDeJuegos, filaDe, firmaJuegos, JUEGOS_BASE, JUEGOS_MAX, PUNTOS_JUEGOS_BASE, PUNTOS_JUEGOS_MAX } from '../web/lib/juegos.js';

test('premioPorJuegos: 4.000 es el premio normal, 10.000 el grande', () => {
  assert.equal(premioPorJuegos(0), 0);
  assert.equal(premioPorJuegos(3999), 0);
  assert.equal(premioPorJuegos(JUEGOS_BASE), PUNTOS_JUEGOS_BASE);
  assert.equal(premioPorJuegos(7500), PUNTOS_JUEGOS_BASE);
  assert.equal(premioPorJuegos(JUEGOS_MAX), PUNTOS_JUEGOS_MAX);
  assert.equal(premioPorJuegos(12000), PUNTOS_JUEGOS_MAX);
  assert.equal(premioPorJuegos(null), 0);
});

test('premioPorJuegos: los miles con punto, coma o "k" son el mismo numero', () => {
  assert.equal(premioPorJuegos('10.000'), PUNTOS_JUEGOS_MAX);
  assert.equal(premioPorJuegos('10,000'), PUNTOS_JUEGOS_MAX);
  assert.equal(premioPorJuegos('4 000'), PUNTOS_JUEGOS_BASE);
  assert.equal(premioPorJuegos('10k'), PUNTOS_JUEGOS_MAX);
  assert.equal(premioPorJuegos('4k'), PUNTOS_JUEGOS_BASE);
});

test('esFotoDeJuegos: como lo dice la gente', () => {
  for (const s of ['/juegos', 'juegos del clan', 'Heraldo, mis juegos', 'clan games', 'CG terminados', '/juegosdeclan'])
    assert.equal(esFotoDeJuegos(s), true, s);
  for (const s of ['ya doné mi castillo', 'mis fc de hoy', 'hola', 'mira esta base']) assert.equal(esFotoDeJuegos(s), false, s);
});

test('filaDe: la fila del jugador en la lista, con los adornos traducidos', () => {
  const lectura = {
    json: {
      es_juegos_del_clan: true,
      jugadores: [
        { nombre: 'Pepe', puntos: 10000 },
        { nombre: '﹏⪻ΛＶΞＮΤＵՏ⪼﹏', puntos: 4000 },
        { nombre: 'Otro', puntos: 1200 },
      ],
    },
  };
  assert.equal(filaDe(lectura, 'Pepe').puntos, 10000);
  assert.equal(filaDe(lectura, 'Aventus').puntos, 4000); // el nombre adornado se reconoce
  assert.equal(filaDe(lectura, 'NoEstá'), null);
});

test('filaDe: si sale dos veces (destacado y en la lista), la de mas puntos', () => {
  const lectura = { json: { jugadores: [{ nombre: 'Pepe', puntos: 4000 }, { nombre: 'Pepe', puntos: 10000 }] } };
  assert.equal(filaDe(lectura, 'Pepe').puntos, 10000);
});

test('filaDe: sin lista legible, null', () => {
  assert.equal(filaDe({ json: { jugadores: [] } }, 'Pepe'), null);
  assert.equal(filaDe({ json: {} }, 'Pepe'), null);
  assert.equal(filaDe(null, 'Pepe'), null);
});

test('firmaJuegos: cambia con la cuenta y con los puntos', () => {
  assert.notEqual(firmaJuegos('#A', 4000), firmaJuegos('#A', 10000));
  assert.notEqual(firmaJuegos('#A', 4000), firmaJuegos('#B', 4000));
  assert.equal(firmaJuegos('#A', 4000), firmaJuegos('#A', 4000));
});
