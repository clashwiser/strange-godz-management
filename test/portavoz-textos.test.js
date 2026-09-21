// El portavoz de Facebook: la rotacion de grupos (cada uno una vez por
// semana, aunque un dia se publique fuera de turno), las reglas de Cris
// para los textos y el rastreo de candidatos.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { elegirGrupo, grupoDelDia, textoDe, mensajeCandidato, pistasCandidato, GRUPOS } from '../src/lib/portavoz-textos.js';

const lunes = new Date('2026-09-21T12:00:00');
const martes = new Date('2026-09-22T12:00:00');
const miercoles = new Date('2026-09-23T12:00:00');
const datos = { nivel: 25, victorias: 437, racha: 22, miembros: 38, th18: 32, liga: 'Champion League I' };
const activos = GRUPOS.filter((g) => !g.pausado);

test('sin posts recientes toca el grupo del dia', () => {
  const { grupo, motivo } = elegirGrupo(martes, []);
  assert.equal(grupo.nombre, 'Comunidad Latina de Clash of Clans');
  assert.equal(motivo, null);
});

test('los sustitutos del lunes y del miercoles ocupan el sitio de los pausados', () => {
  assert.equal(grupoDelDia(lunes).nombre, 'CLASH OF CLANS RECRUITMENT');
  assert.equal(grupoDelDia(miercoles).nombre, 'Clash of Clans - Reclutamiento de Clanes! 🏆');
  assert.ok(GRUPOS.find((g) => g.nombre === 'Clash of Clans Recruitment').pausado);
  assert.ok(GRUPOS.find((g) => g.nombre === 'Clash of Clans Latinoamerica').pausado);
});

test('si el grupo del dia ya tuvo post esta semana, sigue la rotacion desde mañana', () => {
  // El lunes 21 el post fue al grupo del martes: el martes toca el del miercoles.
  const { grupo, motivo } = elegirGrupo(martes, ['Comunidad Latina de Clash of Clans']);
  assert.equal(grupo.nombre, 'Clash of Clans - Reclutamiento de Clanes! 🏆');
  assert.match(motivo, /Comunidad Latina de Clash of Clans ya tuvo post esta semana/);
});

test('salta los grupos con post reciente hasta dar con uno libre, dando la vuelta al domingo', () => {
  const usados = activos.filter((g) => g.dia !== 0).map((g) => g.nombre);
  const { grupo } = elegirGrupo(martes, usados);
  assert.equal(grupo.nombre, 'Clash of Clans Recruiting Worldwide');
});

test('con todos los grupos activos usados no hay post y lo dice', () => {
  const { grupo, motivo } = elegirGrupo(martes, GRUPOS.map((g) => g.nombre));
  assert.equal(grupo, null);
  assert.match(motivo, /todos los grupos activos/);
});

test('hay un grupo activo para cada dia de la semana', () => {
  for (let d = 0; d < 7; d += 1) {
    const g = grupoDelDia(new Date(2026, 8, 20 + d));
    assert.ok(g && !g.pausado, `dia ${d}`);
  }
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

test('el mensaje al candidato lleva premios, bases, tag y Telegram, sin enlaces, rayas ni "bots"', () => {
  for (const idioma of ['es', 'en']) {
    const m = mensajeCandidato(idioma);
    assert.ok(/premios|prizes/.test(m) && /bases|layouts/.test(m), idioma);
    assert.ok(/tag 2GC/.test(m) && /Valqui_bot/.test(m), idioma);
    // Sin http ni #: los grupos filtran enlaces y Facebook convierte #2GC en hashtag.
    assert.ok(!/https?:\/\//.test(m) && !m.includes('#') && !m.includes('@'), `${idioma}: sin enlaces, hashtags ni menciones`);
    assert.ok(!m.includes('—') && !/\bbots?\b/i.test(m), idioma);
    assert.ok(m.length < 420, `${idioma}: corto, es un comentario`);
  }
  assert.match(mensajeCandidato('es'), /Vi que estás buscando clan/);
  assert.match(mensajeCandidato('en'), /looking for a clan/);
});

test('las pistas de candidato: busca clan y TH18', () => {
  assert.deepEqual(pistasCandidato('Busco clan activo th18 max'), { buscaClan: true, th18: true });
  assert.deepEqual(pistasCandidato('Algún clan activo ?'), { buscaClan: true, th18: false });
  assert.deepEqual(pistasCandidato('Looking for a war clan, Town Hall 18'), { buscaClan: true, th18: true });
  assert.deepEqual(pistasCandidato('Ayuntamiento 18 necesito clan'), { buscaClan: true, th18: true });
  assert.deepEqual(pistasCandidato('vendo cuenta th16'), { buscaClan: false, th18: false });
});
