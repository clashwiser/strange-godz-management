// El analisis de la liga: la tabla del grupo y la simulacion de lo que
// falta. Es la pieza que decide si Heraldo dice "riesgo de descenso" o
// "vamos bien", asi que no puede cambiar sin que se note.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { topeRonda, tablaDesdeGrupo, rondasPendientes, analizar } from '../src/lib/cwl-analisis.js';

// Un grupo de cuatro clanes, dos rondas cerradas y una en curso. Los
// numeros estan puestos para que x300 vaya primero con margen.
const fila = (id, ronda, a, ea, da, b, eb, db, estado = 'warEnded') => ({
  id,
  season_id: 10,
  ronda,
  war_tag: `#W${id}`,
  clan_a_tag: `#${a}`,
  clan_a_nombre: a,
  estrellas_a: ea,
  destruccion_a: da,
  clan_b_tag: `#${b}`,
  clan_b_nombre: b,
  estrellas_b: eb,
  destruccion_b: db,
  estado,
});
const filas = [
  fila(1, 1, 'X300', 40, 85.0, 'RIVAL', 30, 70.0),
  fila(2, 1, 'DUROS', 35, 78.0, 'NAKAMA', 36, 80.0),
  fila(3, 2, 'X300', 42, 88.0, 'DUROS', 31, 72.0),
  fila(4, 2, 'RIVAL', 33, 75.0, 'NAKAMA', 34, 76.0),
  fila(5, 3, 'X300', 10, 20.0, 'NAKAMA', 8, 18.0, 'inWar'),
  fila(6, 3, 'RIVAL', 0, 0, 'DUROS', 0, 0, 'preparation'),
];

test('topeRonda: 3 estrellas por rival mas el bono de 10', () => {
  assert.equal(topeRonda(15), 55);
  assert.equal(topeRonda(30), 100);
});

test('tablaDesdeGrupo: suma estrellas, bono por victoria y ordena', () => {
  const tabla = tablaDesdeGrupo(filas);
  assert.equal(tabla.length, 4);
  const x300 = tabla.find((c) => c.clan_tag === '#X300');
  // Dos rondas cerradas ganadas: 40 + 42 de ataque, +10 por cada victoria.
  assert.equal(x300.estrellas_ataque, 82);
  assert.equal(x300.ganadas, 2);
  assert.equal(x300.estrellas, 102);
  assert.equal(x300.puesto, 1);
  assert.deepEqual(x300.porRonda, [40, 42]);
  // La ronda en curso no cuenta como cerrada.
  assert.equal(x300.rondas_cerradas, 2);
});

test('rondasPendientes: las que no han terminado', () => {
  const p = rondasPendientes(filas);
  assert.ok(p.length >= 1);
  assert.ok(p.every((r) => r.estado !== 'warEnded'));
});

test('analizar: el lider con margen tiene alta probabilidad de subir y nula de bajar', () => {
  const a = analizar({ filas, clanTag: '#X300', promueven: 1, descienden: 1, iteraciones: 500 });
  assert.ok(a, 'analizar devuelve algo');
  assert.equal(a.yo.puesto, 1);
  assert.equal(a.enAscenso, true);
  assert.equal(a.enDescenso, false);
  assert.ok(a.probSubir >= 0.9, `probSubir=${a.probSubir}`);
  assert.ok(a.probBajar <= 0.05, `probBajar=${a.probBajar}`);
  // Con 39 estrellas de margen sobre el ultimo y una ronda por jugar, no
  // hay forma de bajar: el tope de una ronda de 15 son 55.
  assert.equal(a.margenSobreDescenso, 39);
  assert.equal(a.rondasPendientes, 1);
  assert.equal(a.rival.clan_tag, '#NAKAMA');
});

test('analizar: es determinista (misma semilla, mismo resultado)', () => {
  const a = analizar({ filas, clanTag: '#X300', iteraciones: 300 });
  const b = analizar({ filas, clanTag: '#X300', iteraciones: 300 });
  assert.deepEqual(a, b);
});

test('analizar: un clan que no esta en el grupo devuelve null', () => {
  assert.equal(analizar({ filas, clanTag: '#NADIE' }), null);
});
