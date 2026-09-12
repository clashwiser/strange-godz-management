// Lo que dice el cerebro cuando le preguntan quien falta por atacar.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PREGUNTA_FALTAN, textoDeGuerras } from '../web/app/guerras-texto.js';

const t = (s) => s;
const en = (h) => new Date(Date.now() + h * 3_600_000).toISOString();

test('reconoce la pregunta como la escribe la gente, y no confunde otros pendientes', () => {
  for (const q of ['quien falta por atacar', 'quien no ha atacado', 'quienes no han atacado', 'faltan', 'quien debe atacar', 'ataques pendientes']) {
    assert.ok(PREGUNTA_FALTAN.test(q), q);
  }
  for (const q of ['que mensajes estan pendientes', 'que falla ahora mismo', 'como estas']) {
    assert.ok(!PREGUNTA_FALTAN.test(q), q);
  }
});

test('sin guerras: lo dice, con los clanes, y promete avisar el dia de batalla', () => {
  const s = textoDeGuerras([{ clan: 'x300', estado: 'notInWar' }, { clan: 'Olympus', estado: 'warEnded' }], t);
  assert.match(s, /^Ahora mismo ningún clan está en guerra \(x300, Olympus\)/);
  assert.match(s, /Cuando empiece el día de batalla/);
});

test('preparacion: nadie tiene que atacar todavia, y dice cuando empieza', () => {
  const s = textoDeGuerras([{ clan: 'x300', estado: 'preparation', liga: false, rival: 'Dragones', empieza: en(5), faltan: [] }], t);
  assert.equal(s, 'x300 · guerra contra Dragones: día de preparación, la batalla empieza en 5 h. Todavía nadie tiene que atacar.');
});

test('en batalla: lista quien falta con los ataques que le quedan', () => {
  const s = textoDeGuerras(
    [
      {
        clan: 'x300',
        estado: 'inWar',
        liga: false,
        rival: 'Dragones',
        termina: en(3),
        estrellas: { nosotros: 21, ellos: 17 },
        faltan: [
          { nombre: 'Zoe', restantes: 2 },
          { nombre: 'davinder', restantes: 1 },
        ],
      },
      { clan: 'Olympus', estado: 'notInWar' },
    ],
    t
  );
  assert.equal(s, 'x300 · guerra contra Dragones (21⭐ – 17⭐, quedan 3 h)\nFaltan por atacar:\n• Zoe — 2\n• davinder');
});

test('CWL: todos atacaron, y anuncia la siguiente ronda; menos de una hora sale en minutos', () => {
  const s = textoDeGuerras(
    [{ clan: 'x300', estado: 'inWar', liga: true, rival: 'Nakama', termina: en(0.5), estrellas: { nosotros: 30, ellos: 28 }, faltan: [], siguiente: { rival: 'Blitz', empieza: en(0.5) } }],
    t
  );
  assert.equal(s, 'x300 · liga contra Nakama (30⭐ – 28⭐, quedan 30 min): todos atacaron ✅\nSiguiente ronda: contra Blitz, la batalla empieza en 30 min.');
});

test('registro de guerra privado: se dice, no se da por "sin guerra"', () => {
  const s = textoDeGuerras([{ clan: 'x300', estado: 'notInWar' }, { clan: 'Cuba', estado: 'privado' }], t);
  assert.match(s, /ningún clan está en guerra \(x300\)/);
  assert.match(s, /No puedo ver la guerra normal de Cuba: registro de guerra privado/);
});

test('Heraldo: "¿estamos en guerra?" con la fase, las horas y el recordatorio del castillo', async () => {
  const { textoGuerrasHeraldo } = await import('../web/lib/guerras.js');
  const ahora = Date.parse('2026-09-12T20:00:00Z');
  const g = [
    { clan: 'x300', estado: 'preparation', liga: false, rival: 'Canadian Elite', empieza: '2026-09-13T02:48:02.000Z', faltan: [], miembros: ['#L9P88U'] },
    { clan: 'STRANGE WORLD', estado: 'notInWar' },
    { clan: 'Cuba', estado: 'privado' },
  ];
  const mio = textoGuerrasHeraldo(g, { mio: ['#L9P88U'], ahora });
  assert.match(mio, /x300.*día de preparación.*empieza en <b>7 h<\/b>/);
  assert.match(mio, /¿Ya donaste tu castillo\?/);
  assert.match(mio, /Sin guerra: STRANGE WORLD/);
  assert.match(mio, /Cuba: registro de guerra privado/);
  const otro = textoGuerrasHeraldo(g, { mio: [], ahora });
  assert.match(otro, /Los que están en guerra: donen el castillo/);
  const anotado = textoGuerrasHeraldo(g, { mio: ['#L9P88U'], castilloHoy: true, ahora });
  assert.match(anotado, /Tu castillo de hoy ya está anotado/);
  const nada = textoGuerrasHeraldo([{ clan: 'x300', estado: 'notInWar' }], { ahora });
  assert.match(nada, /ningún clan está en guerra/);
  assert.ok(!/castillo/.test(nada));
});
