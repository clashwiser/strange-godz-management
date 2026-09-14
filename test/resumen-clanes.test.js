// /resumen: cada clan como lo ve un jugador.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bloqueClan, textoResumenClanes, lineaGuerra } from '../web/lib/resumen-clanes.js';

const api = { name: 'x300', clanLevel: 25, members: 34, clanPoints: 52310, warLeague: { name: 'Champion League I' }, warWins: 412, warWinStreak: 7, requiredTownhallLevel: 15, type: 'inviteOnly' };
const ahora = Date.parse('2026-09-13T20:00:00Z');

test('el bloque de un clan con su guerra', () => {
  const guerra = { estado: 'inWar', liga: false, rival: 'Canadian Elite', termina: '2026-09-14T02:48:00Z', estrellas: { nosotros: 80, ellos: 77 } };
  const s = bloqueClan({ nombre: 'x300', api, guerra }, { ahora });
  assert.equal(
    s,
    '<b>x300</b> · nivel 25 · 34/50 miembros\n🏆 52.310 copas · 🎖 Champion League I\n⚔️ 412 guerras ganadas · 🔥 racha de 7\n🔥 guerra contra Canadian Elite: día de batalla, quedan 7 h · 80⭐ – 77⭐\n🔑 TH15 mínimo · entrada por invitación'
  );
});

test('sin racha, sin guerra, registro privado, y sin API', () => {
  const s = bloqueClan({ nombre: 'Cuba', api: { ...api, warWinStreak: 0, type: 'open', requiredTownhallLevel: 0 }, guerra: { estado: 'privado' } }, { ahora });
  assert.match(s, /sin racha/);
  assert.match(s, /🔑 entrada abierta$/);
  assert.ok(!/guerra contra|sin guerra/.test(s));
  assert.equal(lineaGuerra({ estado: 'notInWar' }), '💤 sin guerra ahora');
  assert.match(bloqueClan({ nombre: 'Olympus', api: null, guerra: null }), /no puedo leerlo en el juego/);
});

test('el resumen entero lleva cabecera y un bloque por clan', () => {
  const s = textoResumenClanes([{ nombre: 'x300', api, guerra: null }, { nombre: 'Cuba', api, guerra: null }], { ahora });
  assert.match(s, /^🏰 <b>Strange Godz · los clanes ahora<\/b>\n\n<b>x300<\/b>/);
  assert.equal((s.match(/guerras ganadas/g) ?? []).length, 2);
});
