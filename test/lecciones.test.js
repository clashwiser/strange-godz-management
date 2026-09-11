// Las lecciones de los lideres: cuando aplican y cuando no.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { elegirLeccion, aplicarLeccion } from '../web/lib/lecciones.js';

const lecciones = [
  { id: 1, bot: 'ambos', cuando: 'como entro al clan', respuesta: 'Escríbele a @Valqui_bot, {nombre}.' },
  { id: 2, bot: 'heraldo', cuando: 'horario de guerra', respuesta: 'Las guerras se buscan a las 9 pm de Cuba.' },
  { id: 3, bot: 'valquiria', cuando: 'premio', respuesta: 'Los premios los reparte Cris el día 1, mi cielo.' },
  { id: 4, bot: 'ambos', cuando: 'premio del mes', respuesta: 'Este mes el premio es un pase de oro.' },
  { id: 5, bot: 'ambos', cuando: 'apagada', respuesta: 'no deberia salir', activa: false },
];

test('elegirLeccion: la frase entera, con tildes y mayusculas distintas', () => {
  const l = elegirLeccion(lecciones, 'Heraldo, ¿CÓMO ENTRO AL CLAN?', 'heraldo');
  assert.equal(l?.id, 1);
});

test('elegirLeccion: por palabras con sustancia, en otro orden y con relleno', () => {
  const l = elegirLeccion(lecciones, 'oye, al clan cómo se entra... entro?', 'valquiria');
  assert.equal(l?.id, 1);
});

test('elegirLeccion: respeta el bot', () => {
  assert.equal(elegirLeccion(lecciones, 'cual es el horario de guerra', 'heraldo')?.id, 2);
  assert.equal(elegirLeccion(lecciones, 'cual es el horario de guerra', 'valquiria'), null);
});

test('elegirLeccion: con varias, gana la mas larga (la mas especifica)', () => {
  assert.equal(elegirLeccion(lecciones, 'valquiria cual es el premio del mes?', 'valquiria')?.id, 4);
  assert.equal(elegirLeccion(lecciones, 'valquiria hay premio?', 'valquiria')?.id, 3);
  assert.equal(elegirLeccion(lecciones, 'heraldo hay premio?', 'heraldo'), null, 'la 3 es solo de valquiria');
});

test('elegirLeccion: las apagadas no cuentan, y sin texto no hay leccion', () => {
  assert.equal(elegirLeccion(lecciones, 'esa esta apagada', 'heraldo'), null);
  assert.equal(elegirLeccion(lecciones, '', 'heraldo'), null);
  assert.equal(elegirLeccion([], 'como entro al clan', 'heraldo'), null);
});

test('elegirLeccion: una leccion de puras palabras vacias no casa con todo', () => {
  const l = [{ bot: 'ambos', cuando: 'como es', respuesta: 'x' }];
  assert.equal(elegirLeccion(l, 'hola heraldo', 'heraldo'), null);
  assert.equal(elegirLeccion(l, 'y como es la cosa', 'heraldo')?.respuesta, 'x', 'pero entera si');
});

test('aplicarLeccion: pone el nombre, o "socio" si no hay', () => {
  assert.equal(aplicarLeccion(lecciones[0], 'Deibis'), 'Escríbele a @Valqui_bot, Deibis.');
  assert.equal(aplicarLeccion(lecciones[0], null), 'Escríbele a @Valqui_bot, socio.');
});
