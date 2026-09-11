// El reto de los desafios amistosos: el pie que lo pide, las tarjetas
// leidas del chat, la cuenta y la firma contra capturas repetidas.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { esFotoDeFC, normalizarTarjeta, contarFC, firmaFC, FC_MINIMO, FC_ESTRELLAS } from '../web/lib/retos.js';
import { tablaPuntos } from '../web/lib/castillos.js';

test('esFotoDeFC: como lo pide la gente', () => {
  for (const s of ['fc', '@Heraldo mis FC de hoy', 'reto', 'desafíos amistosos', '5 amistosas', 'Heraldo, los FCs']) assert.equal(esFotoDeFC(s), true, s);
  for (const s of ['ya doné mi castillo', 'hola', 'mira esta base']) assert.equal(esFotoDeFC(s), false, s);
});

test('normalizarTarjeta: el porcentaje manda sobre las estrellas leidas', () => {
  assert.equal(normalizarTarjeta({ estrellas: 2, porcentaje: 100 }).estrellas, 3);
  assert.equal(normalizarTarjeta({ estrellas: 3, porcentaje: 0 }).estrellas, 0);
  assert.equal(normalizarTarjeta({ estrellas: 3, porcentaje: 75 }).estrellas, 2);
  assert.equal(normalizarTarjeta({ estrellas: 2, porcentaje: 40 }).estrellas, 1);
  assert.equal(normalizarTarjeta({ estrellas: 2, porcentaje: '75%' }).estrellas, 2);
  assert.equal(normalizarTarjeta({ estrellas: null, porcentaje: null }).estrellas, null);
});

// La captura de Cris: ocho tarjetas «ΛVΞNTUS» ➡ «ΛVΞNTUS» en un plegable.
const capturaDeCris = () => ({
  json: {
    es_chat_del_clan: true,
    clan: 'x300',
    tarjetas: [
      { atacante: '«ΛVΞNTUS»', defensor: '«ΛVΞNTUS»', estrellas: 0, porcentaje: 0 },
      { atacante: '«ΛVΞNTUS»', defensor: '«ΛVΞNTUS»', estrellas: 3, porcentaje: 100 },
      { atacante: '«ΛVΞNTUS»', defensor: '«ΛVΞNTUS»', estrellas: 3, porcentaje: 100 },
      { atacante: '«ΛVΞNTUS»', defensor: '«ΛVΞNTUS»', estrellas: 0, porcentaje: 0 },
      { atacante: 'AVENTUS', defensor: 'AVENTUS', estrellas: 2, porcentaje: 75 },
      { atacante: '«ΛVΞNTUS»', defensor: '«ΛVΞNTUS»', estrellas: 3, porcentaje: 100 },
      { atacante: '«ΛVΞNTUS»', defensor: '«ΛVΞNTUS»', estrellas: 3, porcentaje: 100 },
      { atacante: 'Beto', defensor: '«ΛVΞNTUS»', estrellas: 3, porcentaje: 100 },
    ],
    contadores: { oro: 4685086, elixir: 10855644, elixir_oscuro: 422557, gemas: 7689 },
  },
});

test('contarFC: solo las tarjetas del que manda la captura, con las estrellas minimas', () => {
  const c = contarFC(capturaDeCris(), '«ΛVΞNTUS»');
  assert.equal(c.total, 8);
  assert.equal(c.mias, 7); // la de Beto no
  assert.equal(c.buenas, 5); // 4 de 100% + la de 75% (2⭐); los dos 0% no
  assert.equal(c.buenas >= FC_MINIMO, true);
  assert.equal(FC_ESTRELLAS, 2);
  // El nombre de la API con adornos y el OCR sin ellos se entienden.
  assert.equal(contarFC(capturaDeCris(), 'AVENTUS').mias, 7);
  assert.equal(contarFC(capturaDeCris(), 'Caro').mias, 0);
  assert.equal(contarFC({ json: null }, 'AVENTUS').total, 0);
});

test('firmaFC: la misma captura da la misma firma; otra sesion, otra', () => {
  const a = firmaFC(capturaDeCris());
  assert.equal(a, 'fc|0-0,3-100,3-100,0-0,2-75,3-100,3-100,3-100|4685086/10855644/422557/7689');
  const otra = capturaDeCris();
  otra.json.contadores.oro = 6138640;
  assert.notEqual(firmaFC(otra), a);
});

test('tablaPuntos: suma castillos y retos y cuenta cada clase', () => {
  const filas = [
    { tg_user_id: 1, nombre: 'Ana', verificado: true, puntos: 5 },
    { tg_user_id: 1, nombre: 'Ana', verificado: true, puntos: 5, tipo: 'fc' },
    { tg_user_id: 2, nombre: 'Beto', verificado: true, puntos: 5, tipo: 'fc' },
  ];
  assert.deepEqual(tablaPuntos(filas), [
    { nombre: 'Ana', puntos: 10, veces: 2, castillos: 1, fc: 1 },
    { nombre: 'Beto', puntos: 5, veces: 1, castillos: 0, fc: 1 },
  ]);
});

test('nombres: los adornos de verdad del clan se reducen a ASCII (para /soy y para la captura)', async () => {
  const { plano, parecidos } = await import('../web/lib/nombres.js');
  assert.equal(plano('﹏⪻ΛＶΞＮΤＵՏ⪼﹏'), 'aventus');
  assert.equal(plano('﹏⪨ΛՏՏΛՏՏI͏N͏Տ⪩﹏'), 'assassins');
  assert.equal(plano('﹏⪻ΛＶΞＮΤＵՏ⪼﹏').includes(plano('Aventus')), true); // "/soy Aventus"
  assert.equal(parecidos('«ΛVΞNTUS»', '﹏⪻ΛＶΞＮΤＵՏ⪼﹏'), true); // lo leido vs la API
  assert.equal(contarFC(capturaDeCris(), '﹏⪻ΛＶΞＮΤＵՏ⪼﹏').buenas, 5);
});
