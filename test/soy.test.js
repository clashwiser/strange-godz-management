// /soy: por nombre (con los adornos del juego), por tag, o tocando en la
// lista. Sin red: lo puro se prueba directo, y los botones con un
// Telegram fingido.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { esTag, tagLimpio, buscarPorNombre, botonesMiembros, botonesCandidatos, atenderBotonSoy } from '../web/lib/soy.js';

// Nombres de verdad de los clanes: los que dieron guerra el 12 sep 2026.
const jugadores = [
  { player_tag: '#20RVR0LP0', nombre_actual: 'DR∆K⚫️N' },
  { player_tag: '#A1', nombre_actual: '﹏⪻ΛSSΛSSINS⪼﹏' },
  { player_tag: '#A2', nombre_actual: "Assassin's Cred" },
  { player_tag: '#L1', nombre_actual: 'LIO D10S' },
  { player_tag: '#S1', nombre_actual: 'DR STRANGE~❤️' },
  { player_tag: '#S2', nombre_actual: 'ᴵᴬᴹ◎Dя Strange◎' },
  { player_tag: '#X1', nombre_actual: 'x300' },
];
const tags = (q) => buscarPorNombre(jugadores, q).hallados.map((p) => p.player_tag);

test('un tag es un tag, con o sin #, y la O se vuelve 0', () => {
  assert.ok(esTag('#20RVR0LP0'));
  assert.ok(esTag('20RVR0LP0'));
  assert.ok(esTag('#L9P88U'));
  assert.ok(esTag('#2GC'));
  assert.ok(!esTag('POLLO'), 'un nombre con letras del alfabeto de tags no es un tag');
  assert.ok(!esTag('Drakon'));
  assert.ok(!esTag('LIO D10S'));
  assert.equal(tagLimpio('2orvrolpo'), '#20RVR0LP0');
});

test('"Drakon" encuentra a DR∆K⚫️N (el triangulo es una A y la bola una O)', () => {
  assert.deepEqual(tags('Drakon'), ['#20RVR0LP0']);
  assert.deepEqual(tags('DRAKON'), ['#20RVR0LP0']);
  assert.deepEqual(tags('dracon'), ['#20RVR0LP0'], 'con una letra cambiada, tambien');
});

test('"lio dios" encuentra a LIO D10S (digitos que hacen de letra)', () => {
  assert.deepEqual(tags('lio dios'), ['#L1']);
  assert.deepEqual(tags('LIO D10S'), ['#L1']);
});

test('"assassins" da la cuenta igualita como exacta y la parecida como otra', () => {
  const r = buscarPorNombre(jugadores, 'ASSASSINS');
  assert.deepEqual(r.exactos.map((p) => p.player_tag), ['#A1']);
  assert.deepEqual(r.hallados.map((p) => p.player_tag), ['#A1', '#A2']);
});

test('"Dr strange" casa con las dos y la exacta va primero', () => {
  const r = buscarPorNombre(jugadores, 'Dr strange');
  assert.deepEqual(r.hallados.map((p) => p.player_tag), ['#S1', '#S2']);
  assert.deepEqual(r.exactos.map((p) => p.player_tag), ['#S1']);
});

test('lo que no se parece a nadie no encuentra nada', () => {
  assert.deepEqual(tags('Fulanito'), []);
});

test('los botones de la lista van de dos en dos, con "otro clan" y "cerrar" al final, y con el id del dueño', () => {
  const miembros = [{ tag: '#1', nombre: 'Ana' }, { tag: '#2', nombre: 'Beto' }, { tag: '#3', nombre: 'Caro' }];
  const filas = botonesMiembros(miembros, 742056647);
  assert.equal(filas.length, 3);
  assert.equal(filas[0].length, 2);
  assert.equal(filas[0][0].callback_data, 'soy:t:#1:742056647');
  assert.equal(filas[2][0].callback_data, 'soy:m:742056647');
  assert.equal(filas[2][1].callback_data, 'soy:x:742056647');
  const cand = botonesCandidatos([{ tag: '#S1', nombre: 'a' }, { tag: '#S2', nombre: 'b' }], 5);
  assert.equal(cand[2][0].callback_data, 'soy:a:5');
  assert.match(cand[2][0].text, /Las dos/);
});

test('el boton de otra persona no hace nada: se le dice que escriba /soy', async () => {
  const llamadas = [];
  const tg = async (metodo, cuerpo) => (llamadas.push({ metodo, cuerpo }), { ok: true });
  const cq = { id: 'cq', data: 'soy:t:#20RVR0LP0:111', from: { id: 222, first_name: 'Otro' }, message: { message_id: 9, chat: { id: -1 } } };
  await atenderBotonSoy({}, cq, { tg, esc: (s) => s });
  assert.equal(llamadas.length, 1);
  assert.equal(llamadas[0].metodo, 'answerCallbackQuery');
  assert.match(llamadas[0].cuerpo.text, /otra persona/);
});

test('despues de atar hay boton de "me equivoque", y deshace lo recien atado', async () => {
  const { botonesDespues } = await import('../web/lib/soy.js');
  const filas = botonesDespues(7);
  assert.equal(filas[1][0].callback_data, 'soy:u:7');
  assert.match(filas[1][0].text, /equivoqué/);
});
