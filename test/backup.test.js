// El cifrado de las copias: lo que se cifra se descifra igual, la frase
// equivocada no devuelve basura, y un archivo tocado no pasa.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cifrar, descifrar } from '../src/lib/backup-cifrado.js';
import { TABLAS } from '../src/lib/backup-tablas.js';

const copia = {
  version: 1,
  fecha: '2026-09-10',
  filas: 3,
  tablas: { clans: [{ clan_tag: '#2GC', nombre: 'x300' }], players: [{ player_tag: '#A', nombre_actual: 'Ñandú ⚔️' }] },
};

test('cifrar/descifrar: ida y vuelta exacta, con acentos y emojis', () => {
  const buf = cifrar(copia, 'una-frase-larga-de-prueba');
  assert.ok(buf.length > 48, 'lleva cabecera, sal, iv y etiqueta');
  assert.equal(buf.subarray(0, 4).toString(), 'SGB1');
  assert.deepEqual(descifrar(buf, 'una-frase-larga-de-prueba'), copia);
});

test('cifrar: dos copias del mismo contenido no se parecen (sal e iv nuevos)', () => {
  const a = cifrar(copia, 'una-frase-larga-de-prueba');
  const b = cifrar(copia, 'una-frase-larga-de-prueba');
  assert.notDeepEqual(a, b);
});

test('descifrar: la frase equivocada falla con un mensaje claro, no con basura', () => {
  const buf = cifrar(copia, 'una-frase-larga-de-prueba');
  assert.throws(() => descifrar(buf, 'otra-frase-distinta-xx'), /no se pudo descifrar/);
});

test('descifrar: un archivo tocado no pasa (GCM autentica)', () => {
  const buf = Buffer.from(cifrar(copia, 'una-frase-larga-de-prueba'));
  buf[buf.length - 1] ^= 0x01;
  assert.throws(() => descifrar(buf, 'una-frase-larga-de-prueba'), /no se pudo descifrar/);
});

test('descifrar: algo que no es una copia se rechaza por la cabecera', () => {
  assert.throws(() => descifrar(Buffer.from('hola que tal'), 'una-frase-larga-de-prueba'), /cabecera/);
});

test('cifrar: una frase corta no vale', () => {
  assert.throws(() => cifrar(copia, 'corta'), /12 caracteres/);
});

test('TABLAS: el orden respeta las claves foraneas', () => {
  const pos = (t) => TABLAS.indexOf(t);
  assert.ok(pos('clans') < pos('players'));
  assert.ok(pos('players') < pos('snapshots'));
  assert.ok(pos('players') < pos('memberships'));
  assert.ok(pos('cwl_seasons') < pos('cwl_wars'));
  assert.ok(pos('cwl_wars') < pos('cwl_attacks'));
  assert.ok(pos('cwl_wars') < pos('cwl_roster'));
  assert.ok(pos('base_packs') < pos('bases'));
  assert.ok(pos('clans') < pos('solicitudes'));
  assert.equal(new Set(TABLAS).size, TABLAS.length, 'tablas repetidas');
});
