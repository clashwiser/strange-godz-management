// Que es una foto por su pie: el castillo, los desafios amistosos, una
// prueba de un administrador, o una duda. Con los pies de verdad.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { modoDeFoto, esPruebaDeLectura, botNombrado } from '../web/lib/fotos.js';
import { esFotoDeFC } from '../web/lib/retos.js';

test('modoDeFoto: los desafios amistosos, como lo dice la gente', () => {
  for (const pie of ['fc', 'Fc', 'mis FCs de hoy', 'Heraldo, esh estado entrenando con fc, revisa mi prueba', 'estuve practicando', 'desafíos amistosos', 'Valquiria, mis amistosas', 'friendly challenges', 'reto']) {
    assert.equal(modoDeFoto(pie), 'fc', pie);
  }
});

test('modoDeFoto: el castillo gana si el pie habla del castillo', () => {
  assert.equal(modoDeFoto('@Heraldo ya doné mi castillo'), 'castillo');
  assert.equal(modoDeFoto('castillo donado, entrenando'), 'castillo');
  assert.equal(modoDeFoto('Heraldo, el castillo'), 'castillo');
  assert.equal(modoDeFoto('Valquiria mira mi castillo'), 'castillo');
});

test('modoDeFoto: la prueba es SOLO el pie entero', () => {
  for (const pie of ['prueba', 'Prueba', 'prueba fc', 'prueba castillo', '¿qué ves?', 'prueba de lectura']) assert.equal(esPruebaDeLectura(pie), true, pie);
  assert.equal(modoDeFoto('prueba'), 'prueba_mapa');
  assert.equal(modoDeFoto('prueba fc'), 'prueba_chat');
  assert.equal(modoDeFoto('prueba chat'), 'prueba_chat');
  assert.equal(esPruebaDeLectura('revisa mi prueba'), false);
  assert.equal(esPruebaDeLectura('Heraldo, esh estado entrenando con fc, revisa mi prueba'), false);
});

test('modoDeFoto: contestar a un bot, dudas, y fotos que no son para nosotros', () => {
  assert.equal(modoDeFoto('', { aUnBot: 40 }), 'castillo_respuesta');
  assert.equal(modoDeFoto('Heraldo mira esto'), 'duda');
  assert.equal(modoDeFoto('valqui, esto'), 'duda');
  assert.equal(modoDeFoto(''), null);
  assert.equal(modoDeFoto('jajaja'), null);
});

test('botNombrado: a quien le hablan; los dos, Heraldo', () => {
  assert.equal(botNombrado('Valquiria, mis fc'), 'valquiria');
  assert.equal(botNombrado('@Heraldo ya doné'), 'heraldo');
  assert.equal(botNombrado('Heraldo y Valquiria'), 'heraldo');
  assert.equal(botNombrado('fc'), null);
});

test('esFotoDeFC: no confunde el aviso del castillo', () => {
  assert.equal(esFotoDeFC('ya doné mi castillo'), false);
  assert.equal(esFotoDeFC('estuve entrenando'), true);
});
