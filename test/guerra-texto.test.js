// Los textos de Heraldo sobre la guerra normal: el bloque de ataques sin
// usar (con la guerra cerrada) y el aviso de que se acabo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bloqueAlerta, resultadoDe, textoFinGuerra } from '../src/lib/guerra-texto.js';

const base = { nombre: 'x300', rival: 'Canadian Elite', restan: 2.04, sinUsar: 12, lista: '#12 Fulano — 2' };

test('bloque normal: sin escuadra, marcador a secas y "Chicos, faltan"', () => {
  const s = bloqueAlerta({ ...base, nosotros: 80, ellos: 77, max: 90 });
  assert.equal(s, '*x300*\nContra Canadian Elite · cierra en *2.0h*\nVan 80★ contra 77★\nChicos, faltan *12* ataques:\n```#12 Fulano — 2```');
  assert.ok(!/escuadra/.test(s));
});

test('los dos con todas las estrellas: cerrada en empate, pero se ataca', () => {
  const s = bloqueAlerta({ ...base, nosotros: 90, ellos: 90, max: 90 });
  assert.match(s, /Van 90★ contra 90★: 90 es el máximo, la guerra está cerrada en empate\./);
  assert.match(s, /Aunque esté cerrada hay que usar todos los ataques: están dejando minerales y bono de guerra en la mesa\. ¡Ataquen!/);
});

test('solo nosotros perfectos: no se pierde, pero se ataca', () => {
  const s = bloqueAlerta({ ...base, nosotros: 90, ellos: 84, max: 90 });
  assert.match(s, /vamos perfectos, esta guerra no se pierde\. Pero hay que usar todos los ataques/);
  // Ellos perfectos y nosotros no: nada de "cerrada", que aun se puede empatar.
  assert.ok(!/cerrada|perfectos/.test(bloqueAlerta({ ...base, nosotros: 84, ellos: 90, max: 90 })));
});

test('el resultado: estrellas, luego destruccion, luego empate', () => {
  assert.equal(resultadoDe({ nosotros: 90, ellos: 87 }), 'ganamos');
  assert.equal(resultadoDe({ nosotros: 80, ellos: 87 }), 'perdimos');
  assert.equal(resultadoDe({ nosotros: 90, ellos: 90, destruccionNos: 100, destruccionEllos: 99.5 }), 'ganamos');
  assert.equal(resultadoDe({ nosotros: 90, ellos: 90, destruccionNos: 100, destruccionEllos: 100 }), 'empatamos');
});

test('la guerra se acabo: a los lideres, que lancen otra', () => {
  const s = textoFinGuerra({ nombre: 'x300', rival: 'Canadian Elite', nosotros: 90, ellos: 87 });
  assert.equal(s, '🏁 *Líderes*: la guerra de *x300* contra *Canadian Elite* ya se acabó — *ganamos* 90★ – 87★.\n\nLancen guerra, no podemos perder tiempo. ⚔️');
});
