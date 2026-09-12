// "¿Cual de los dos eres?": como se entiende la respuesta a un /soy con
// varios candidatos, tal como la escribe la gente.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { interpretarEleccion, listaNumerada } from '../web/lib/vinculos.js';

// Los dos "Dr Strange" de verdad, los de Carlos.
const c = [
  { tag: '#A', nombre: 'DR STRANGE~❤️' },
  { tag: '#B', nombre: 'ᴵᴬᴹ◎Dя Strange◎' },
];
const tags = (q) => interpretarEleccion(q, c).map((x) => x.tag);

test('"las dos", "ambos", "todas": las dos cuentas', () => {
  for (const q of ['Soy ambos', 'ambas', 'los dos', 'las dos', 'las 2', 'todas', 'yo soy los dos', 'las dos son mias']) {
    assert.deepEqual(tags(q), ['#A', '#B'], q);
  }
});

test('por numero u ordinal, con o sin "la": una, o varias', () => {
  assert.deepEqual(tags('1'), ['#A']);
  assert.deepEqual(tags('la 2'), ['#B']);
  assert.deepEqual(tags('la primera'), ['#A']);
  assert.deepEqual(tags('el segundo'), ['#B']);
  assert.deepEqual(tags('soy la segunda'), ['#B']);
  assert.deepEqual(tags('1 y 2'), ['#A', '#B']);
  assert.deepEqual(tags('yo soy el 1'), ['#A']);
  // Un numero que no existe no elige nada.
  assert.deepEqual(tags('5'), []);
});

test('por nombre: entero, o casi ("/DE strange" por "DR STRANGE" del telefono)', () => {
  assert.deepEqual(tags('DR STRANGE~❤️'), ['#A']);
  assert.deepEqual(tags('ᴵᴬᴹ◎Dя Strange◎'), ['#B']);
  assert.deepEqual(tags('/soy DR STRANGE~❤️'), ['#A']);
  assert.deepEqual(tags('DE strange~❤️'), ['#A']);
  // Igual que uno de los dos, exacto: ese.
  assert.deepEqual(tags('Dr strange'), ['#A']);
});

test('lo que no es una respuesta no elige nada', () => {
  for (const q of ['jaja', 'que bola', 'si', 'hola', '', 'vamos a la guerra']) {
    assert.deepEqual(tags(q), [], JSON.stringify(q));
  }
});

test('la lista numerada para preguntar', () => {
  assert.equal(listaNumerada(c), '1. DR STRANGE~❤️\n2. ᴵᴬᴹ◎Dя Strange◎');
});

test('"tambien" / "la otra": lo que quedaba por atar', () => {
  const resto = [c[1]];
  for (const q of ['también', 'tambien', 'la otra', 'esa también', 'y la otra']) {
    assert.deepEqual(interpretarEleccion(q, resto).map((x) => x.tag), ['#B'], q);
  }
});

test('a una cuenta ofrecida vale un "si", pero a una pregunta no', () => {
  const ofrecida = [{ ...c[1], ofrecida: true }];
  for (const q of ['Si es mia', 'sí', 'si', 'claro', 'esa es mía', 'si, es mia']) {
    assert.deepEqual(interpretarEleccion(q, ofrecida).map((x) => x.tag), ['#B'], q);
  }
  assert.deepEqual(interpretarEleccion('si', c), []);
});
