// Que es una foto por su pie: solo si va dirigida a un bot (comando,
// mencion o respuesta), y entonces el castillo, los desafios amistosos,
// una prueba de un administrador, o una duda. Con los pies de verdad.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { modoDeFoto, esPruebaDeLectura, botNombrado, comandoDelPie, fotoDirigida } from '../web/lib/fotos.js';
import { esFotoDeFC } from '../web/lib/retos.js';

test('fotoDirigida: comando, mencion o respuesta; una frase suelta no', () => {
  for (const pie of ['/fc', '/fc@Strange_godz_heraldo_bot', 'fc', 'Fc', 'castillo', 'prueba fc', '@Heraldo mis fc', 'Valquiria, mira', '@Valqui_bot ya doné mi castillo']) {
    assert.equal(fotoDirigida(pie), true, pie);
  }
  for (const pie of ['mis fcs de hoy', 'estuve practicando', 'reto', 'friendly challenges', 'jajaja', '', 'ya doné mi castillo']) {
    assert.equal(fotoDirigida(pie), false, pie);
  }
  assert.equal(fotoDirigida('', { aUnBot: 40 }), true);
});

test('comandoDelPie: con barra en cualquier sitio, o la palabra sola', () => {
  assert.equal(comandoDelPie('/fc'), 'fc');
  assert.equal(comandoDelPie('mira /fc@Strange_godz_heraldo_bot'), 'fc');
  assert.equal(comandoDelPie('/castillo'), 'castillo');
  assert.equal(comandoDelPie('FC'), 'fc');
  assert.equal(comandoDelPie('prueba castillo'), 'prueba');
  assert.equal(comandoDelPie('mis fc de hoy'), null);
  assert.equal(comandoDelPie('el castillo de abajo'), null);
});

test('modoDeFoto: los desafios amistosos, con comando o con el bot delante', () => {
  for (const pie of ['/fc', 'fc', 'Heraldo, esh estado entrenando con fc, revisa mi prueba', '@Heraldo estuve practicando', 'Valquiria, mis amistosas', '@Strange_godz_heraldo_bot friendly challenges']) {
    assert.equal(modoDeFoto(pie), 'fc', pie);
  }
  assert.equal(modoDeFoto('mis fcs de hoy'), null);
  assert.equal(modoDeFoto('estuve practicando'), null);
});

test('modoDeFoto: el castillo gana si el pie habla del castillo', () => {
  assert.equal(modoDeFoto('@Heraldo ya doné mi castillo'), 'castillo');
  assert.equal(modoDeFoto('/castillo'), 'castillo');
  assert.equal(modoDeFoto('castillo'), 'castillo');
  assert.equal(modoDeFoto('Heraldo, el castillo, entrenando'), 'castillo');
  assert.equal(modoDeFoto('Valquiria mira mi castillo'), 'castillo');
  assert.equal(modoDeFoto('ya doné mi castillo'), null); // sin comando ni bot: no es para nosotros
});

test('modoDeFoto: la prueba es el pie entero, con o sin barra, con o sin bot delante', () => {
  for (const pie of ['prueba', 'Prueba', 'prueba fc', 'prueba castillo', '/prueba', '/prueba fc', 'Valquiria, prueba fc', '@Heraldo prueba']) {
    assert.ok(['prueba_chat', 'prueba_mapa'].includes(modoDeFoto(pie)), pie);
  }
  assert.equal(modoDeFoto('prueba'), 'prueba_mapa');
  assert.equal(modoDeFoto('/prueba fc'), 'prueba_chat');
  assert.equal(modoDeFoto('prueba chat'), 'prueba_chat');
  assert.equal(esPruebaDeLectura('revisa mi prueba'), false);
  assert.equal(modoDeFoto('Heraldo, esh estado entrenando con fc, revisa mi prueba'), 'fc');
});

test('modoDeFoto: contestar a un bot, dudas, y fotos que no son para nosotros', () => {
  assert.equal(modoDeFoto('', { aUnBot: 40 }), 'castillo_respuesta');
  assert.equal(modoDeFoto('aquí va', { aUnBot: 40 }), 'castillo_respuesta');
  assert.equal(modoDeFoto('Heraldo mira esto'), 'duda');
  assert.equal(modoDeFoto('valqui, esto'), 'duda');
  assert.equal(modoDeFoto(''), null);
  assert.equal(modoDeFoto('jajaja'), null);
});

test('botNombrado: a quien le hablan; los dos, Heraldo', () => {
  assert.equal(botNombrado('Valquiria, mis fc'), 'valquiria');
  assert.equal(botNombrado('@Heraldo ya doné'), 'heraldo');
  assert.equal(botNombrado('@Strange_godz_heraldo_bot'), 'heraldo');
  assert.equal(botNombrado('@Valqui_bot'), 'valquiria');
  assert.equal(botNombrado('Heraldo y Valquiria'), 'heraldo');
  assert.equal(botNombrado('fc'), null);
});

test('esFotoDeFC: no confunde el aviso del castillo', () => {
  assert.equal(esFotoDeFC('ya doné mi castillo'), false);
  assert.equal(esFotoDeFC('estuve entrenando'), true);
});
