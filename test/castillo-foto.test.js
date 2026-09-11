// La foto del castillo: que imagen trae el mensaje, quien esta debajo de
// quien, y el juicio de lo que leyo el modelo contra lo que dice la API.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fotoDe, castilloDeAbajo, parecidos, juzgar } from '../web/lib/castillo-foto.js';
import { extraerJson } from '../web/lib/vision.js';

const guerra = {
  state: 'preparation',
  opponent: { name: 'Dragones Rojos' },
  clan: {
    members: [
      { tag: '#C', name: 'Caro', mapPosition: 3, townhallLevel: 16 },
      { tag: '#A', name: 'Assassins', mapPosition: 1, townhallLevel: 18 },
      { tag: '#B', name: 'Beto ツ', mapPosition: 2, townhallLevel: 17 },
    ],
  },
};

test('fotoDe: la foto mas grande, o un archivo de imagen; nada mas', () => {
  const msg = { photo: [{ file_id: 'chica', width: 90, height: 160 }, { file_id: 'grande', width: 720, height: 1280, file_size: 150000 }] };
  assert.deepEqual(fotoDe(msg), { fileId: 'grande', mime: 'image/jpeg', bytes: 150000 });
  assert.deepEqual(fotoDe({ document: { file_id: 'd', mime_type: 'image/png', file_size: 10 } }), { fileId: 'd', mime: 'image/png', bytes: 10 });
  assert.equal(fotoDe({ document: { file_id: 'd', mime_type: 'application/pdf' } }), null);
  assert.equal(fotoDe({ text: 'hola' }), null);
});

test('castilloDeAbajo: el siguiente en el mapa, y el ultimo dona al primero', () => {
  assert.deepEqual(castilloDeAbajo(guerra, '#A').abajo, { posicion: 2, nombre: 'Beto ツ', tag: '#B', th: 17 });
  assert.deepEqual(castilloDeAbajo(guerra, 'b').abajo.nombre, 'Caro');
  assert.equal(castilloDeAbajo(guerra, '#C').abajo.tag, '#A');
  assert.equal(castilloDeAbajo(guerra, '#ZZ'), null);
  assert.equal(castilloDeAbajo({ clan: { members: [] } }, '#A'), null);
});

test('parecidos: nombres leidos por OCR con un fallo o un simbolo de menos', () => {
  assert.equal(parecidos('Beto ツ', 'Beto'), true);
  assert.equal(parecidos('Assasins', 'Assassins'), true);
  assert.equal(parecidos('ASSASSINS', 'Assassins'), true);
  assert.equal(parecidos('Caro', 'Carlos'), true); // contiene; aceptable en un mapa de 15
  assert.equal(parecidos('Beto', 'Caro'), false);
  assert.equal(parecidos('', 'Caro'), false);
});

const lectura = (json) => ({ json });
const abajo = { posicion: 2, nombre: 'Beto ツ' };

test('juzgar: lleno cuando el de abajo esta a tope', () => {
  const l = lectura({ es_mapa_de_guerra: true, clan_enemigo: 'Dragones Rojos', bases: [{ posicion: 1, nombre: 'Assassins', tropas: 55, capacidad: 55 }, { posicion: 2, nombre: 'Beto', tropas: 50, capacidad: 50 }] });
  assert.deepEqual(juzgar({ lectura: l, abajo, oponente: 'Dragones Rojos' }), { veredicto: 'lleno', tropas: 50, capacidad: 50, leido: 'Beto' });
});

test('juzgar: incompleto con los numeros leidos', () => {
  const l = lectura({ es_mapa_de_guerra: true, clan_enemigo: null, bases: [{ posicion: 2, nombre: 'Beto ツ', tropas: 30, capacidad: 50 }] });
  assert.equal(juzgar({ lectura: l, abajo, oponente: 'Dragones Rojos' }).veredicto, 'incompleto');
});

test('juzgar: la ventana de una sola base, sin posicion, se casa por el nombre', () => {
  const l = lectura({ es_mapa_de_guerra: true, bases: [{ posicion: null, nombre: 'Beto', tropas: 50, capacidad: 50 }] });
  assert.equal(juzgar({ lectura: l, abajo, oponente: 'Dragones Rojos' }).veredicto, 'lleno');
});

test('juzgar: otra guerra si el rival leido no es el de ahora', () => {
  const l = lectura({ es_mapa_de_guerra: true, clan_enemigo: 'Los Pollos', bases: [{ posicion: 2, nombre: 'Beto', tropas: 50, capacidad: 50 }] });
  assert.deepEqual(juzgar({ lectura: l, abajo, oponente: 'Dragones Rojos' }), { veredicto: 'otra_guerra', leido: 'Los Pollos' });
});

test('juzgar: no se ve si el de abajo no sale, o la posicion cuadra pero el nombre no', () => {
  const sinEl = lectura({ es_mapa_de_guerra: true, bases: [{ posicion: 1, nombre: 'Assassins', tropas: 55, capacidad: 55 }, { posicion: 3, nombre: 'Caro', tropas: 40, capacidad: 40 }] });
  assert.equal(juzgar({ lectura: sinEl, abajo, oponente: null }).veredicto, 'no_se_ve');
  const otroNombre = lectura({ es_mapa_de_guerra: true, bases: [{ posicion: 2, nombre: 'Pepe', tropas: 50, capacidad: 50 }, { posicion: 3, nombre: 'Caro', tropas: 40, capacidad: 40 }] });
  assert.equal(juzgar({ lectura: otroNombre, abajo, oponente: null }).veredicto, 'no_se_ve');
  const sinNumeros = lectura({ es_mapa_de_guerra: true, bases: [{ posicion: 2, nombre: 'Beto', tropas: null, capacidad: null }] });
  assert.equal(juzgar({ lectura: sinNumeros, abajo, oponente: null }).veredicto, 'no_se_ve');
});

test('juzgar: no es mapa, o ilegible', () => {
  assert.equal(juzgar({ lectura: lectura({ es_mapa_de_guerra: false, bases: [] }), abajo, oponente: null }).veredicto, 'no_es_mapa');
  assert.equal(juzgar({ lectura: null, abajo, oponente: null }).veredicto, 'ilegible');
  assert.equal(juzgar({ lectura: { json: null }, abajo, oponente: null }).veredicto, 'ilegible');
});

test('extraerJson: el objeto aunque venga envuelto', () => {
  assert.deepEqual(extraerJson('Aquí va:\n```json\n{"a": 1}\n```'), { a: 1 });
  assert.equal(extraerJson('sin nada'), null);
  assert.equal(extraerJson('{roto'), null);
});
