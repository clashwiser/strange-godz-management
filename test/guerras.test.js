// Las guerras de ahora para el cerebro: fase, rival, quien falta por
// atacar, y que pasa cuando en CWL coexisten batalla y preparacion.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fechaClash, resumirGuerra, estadoDelClan } from '../web/lib/guerras.js';

const clan = { clan_tag: '#2GC', nombre: 'x300' };

const normal = {
  state: 'inWar',
  teamSize: 15,
  attacksPerMember: 2,
  startTime: '20260911T183000.000Z',
  endTime: '20260912T183000.000Z',
  clan: {
    stars: 21,
    members: [
      { name: 'Axe', attacks: [{}, {}] },
      { name: 'davinder', attacks: [{}] },
      { name: 'Zoe' },
    ],
  },
  opponent: { name: 'Dragones Rojos', stars: 17 },
};

const liga = {
  state: 'inWar',
  teamSize: 15,
  startTime: '20260911T183000.000Z',
  endTime: '20260912T183000.000Z',
  clan: { stars: 30, members: [{ name: 'Axe', attacks: [{}] }, { name: 'Zoe' }] },
  opponent: { name: 'Nakama', stars: 28 },
};

test('fechaClash pasa las fechas de la API a ISO', () => {
  assert.equal(fechaClash('20260911T183000.000Z'), '2026-09-11T18:30:00.000Z');
  assert.equal(fechaClash(null), null);
});

test('guerra normal: 2 ataques por cabeza, faltan ordenados por lo que les queda', () => {
  const r = resumirGuerra(normal);
  assert.equal(r.liga, false);
  assert.equal(r.porMiembro, 2);
  assert.equal(r.rival, 'Dragones Rojos');
  assert.deepEqual(r.estrellas, { nosotros: 21, ellos: 17 });
  assert.deepEqual(r.faltan, [
    { nombre: 'Zoe', restantes: 2 },
    { nombre: 'davinder', restantes: 1 },
  ]);
  assert.equal(r.empieza, '2026-09-11T18:30:00.000Z');
});

test('ronda de liga: sin attacksPerMember es 1 ataque por cabeza', () => {
  const r = resumirGuerra(liga);
  assert.equal(r.liga, true);
  assert.equal(r.porMiembro, 1);
  assert.deepEqual(r.faltan, [{ nombre: 'Zoe', restantes: 1 }]);
});

test('sin guerras abiertas el clan esta notInWar', () => {
  assert.deepEqual(estadoDelClan(clan, []), { clan: 'x300', tag: '#2GC', estado: 'notInWar' });
});

test('en CWL manda la ronda en batalla y la de preparacion va en siguiente', () => {
  const prep = { ...liga, state: 'preparation', opponent: { name: 'Blitz' }, startTime: '20260912T183000.000Z' };
  const e = estadoDelClan(clan, [prep, liga]);
  assert.equal(e.estado, 'inWar');
  assert.equal(e.rival, 'Nakama');
  assert.equal(e.siguiente.estado, 'preparation');
  assert.equal(e.siguiente.rival, 'Blitz');
});

test('solo preparacion: no hay siguiente y nadie falta todavia', () => {
  const e = estadoDelClan(clan, [{ ...normal, state: 'preparation', clan: { members: normal.clan.members.map((m) => ({ name: m.name })) } }]);
  assert.equal(e.estado, 'preparation');
  assert.equal(e.siguiente, null);
  assert.equal(e.faltan.length, 3);
});

test('sin guerras visibles y registro privado: estado privado', () => {
  assert.equal(estadoDelClan(clan, [], { privado: true }).estado, 'privado');
  assert.equal(estadoDelClan(clan, [liga], { privado: true }).estado, 'inWar');
});
