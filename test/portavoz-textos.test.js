// El portavoz de Facebook: la rotacion de grupos (cada uno una vez por
// semana, aunque un dia se publique fuera de turno) y las reglas de Cris
// para los textos.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { elegirGrupo, grupoDelDia, textoDe, GRUPOS } from '../src/lib/portavoz-textos.js';

const lunes = new Date('2026-09-21T12:00:00');
const martes = new Date('2026-09-22T12:00:00');
const datos = { nivel: 25, victorias: 437, racha: 22, miembros: 38, th18: 32, liga: 'Champion League I' };

test('sin posts recientes toca el grupo del dia', () => {
  const { grupo, motivo } = elegirGrupo(lunes, []);
  assert.equal(grupo.nombre, 'Clash of Clans Recruitment');
  assert.equal(motivo, null);
});

test('si el grupo del dia ya tuvo post esta semana, sigue la rotacion desde mañana', () => {
  // El lunes 21 el post fue al grupo del martes: el martes toca el del miercoles.
  const { grupo, motivo } = elegirGrupo(martes, ['Comunidad Latina de Clash of Clans']);
  assert.equal(grupo.nombre, 'Clash of Clans Latinoamerica');
  assert.match(motivo, /Comunidad Latina de Clash of Clans ya tuvo post esta semana/);
});

test('salta los grupos con post reciente hasta dar con uno libre, dando la vuelta al domingo', () => {
  const usados = GRUPOS.filter((g) => g.dia !== 1).map((g) => g.nombre);
  const { grupo } = elegirGrupo(martes, usados);
  assert.equal(grupo.nombre, 'Clash of Clans Recruitment');
});

test('con los siete grupos usados no hay post y lo dice', () => {
  const { grupo, motivo } = elegirGrupo(martes, GRUPOS.map((g) => g.nombre));
  assert.equal(grupo, null);
  assert.match(motivo, /los siete grupos/);
});

test('hay un grupo para cada dia de la semana', () => {
  for (let d = 0; d < 7; d += 1) assert.ok(grupoDelDia(new Date(2026, 8, 20 + d)), `dia ${d}`);
});

test('los siete textos cumplen las reglas de Cris', () => {
  for (const g of GRUPOS) {
    const s = textoDe(g.texto, datos);
    assert.ok(!s.includes('—'), `texto ${g.texto}: sin rayas largas`);
    assert.ok(!/\bbots?\b/i.test(s), `texto ${g.texto}: sin la palabra bots`);
    assert.ok(s.indexOf('https://t.me/Valqui_bot') < s.indexOf('OpenClanProfile&tag=2GC'), `texto ${g.texto}: Telegram antes que el clan`);
    assert.ok(!/guerrero/i.test(s), `texto ${g.texto}: se busca jugador, no guerrero`);
    assert.ok(/437/.test(s) && /25/.test(s), `texto ${g.texto}: lleva los numeros de la API`);
    assert.ok(/layouts/.test(s), `texto ${g.texto}: bases top gratis por Telegram`);
  }
});

test('la racha solo se presume si es de 5 o mas', () => {
  assert.match(textoDe(2, datos), /racha de 22/);
  assert.doesNotMatch(textoDe(2, { ...datos, racha: 2 }), /racha/);
});
