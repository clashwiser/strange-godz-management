// El boton "🌐 English" y la memoria de updates vistos del webhook.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { conBotonTraducir, markupTraducir, sinBotonTraducir, BOTON_TRADUCIR, BOTONES_TRADUCIR, idiomaDelDato, atenderBotonTraducir } from '../web/lib/traducir.js';
import { yaVisto, olvidarVistos, esViejo } from '../web/lib/webhook.js';

test('los botones van al final si el texto lo merece, y una sola vez', () => {
  assert.equal(conBotonTraducir(null, 'ok 👍'), null);
  // Dos idiomas: ingles y filipino (entro Queen, de Filipinas, 3 oct 2026).
  assert.deepEqual(conBotonTraducir(null, 'x'.repeat(40)), [BOTONES_TRADUCIR]);
  assert.equal(BOTONES_TRADUCIR.length, 2);
  const soy = [[{ text: 'a', callback_data: 'soy:c:1' }]];
  assert.deepEqual(conBotonTraducir(soy, 'x'.repeat(50)), [...soy, BOTONES_TRADUCIR]);
  assert.deepEqual(conBotonTraducir(soy, 'corto'), soy);
  assert.deepEqual(conBotonTraducir([...soy, BOTONES_TRADUCIR], 'x'.repeat(50)), [...soy, BOTONES_TRADUCIR]);
  // Las etiquetas HTML no cuentan como texto.
  assert.equal(conBotonTraducir(null, '<b>' + 'x'.repeat(30) + '</b>'), null);
  assert.deepEqual(markupTraducir(null, 'x'.repeat(40)), { reply_markup: { inline_keyboard: [BOTONES_TRADUCIR] } });
  assert.deepEqual(markupTraducir(null, 'corto'), {});
});

test('al traducir se quita solo el botón usado; el otro idioma se queda', () => {
  const soy = [[{ text: 'a', callback_data: 'soy:c:1' }]];
  assert.deepEqual(sinBotonTraducir([...soy, [BOTON_TRADUCIR]]), soy);
  const conDos = [...soy, BOTONES_TRADUCIR];
  const trasIngles = sinBotonTraducir(conDos, 'tr:en');
  assert.deepEqual(trasIngles, [...soy, [BOTONES_TRADUCIR[1]]]);
  assert.deepEqual(sinBotonTraducir(trasIngles, 'tr:fil'), soy);
});

test('idiomaDelDato: el idioma que pide cada botón', () => {
  assert.equal(idiomaDelDato('tr:en'), 'English');
  assert.equal(idiomaDelDato('tr:fil'), 'Filipino (Tagalog)');
  assert.equal(idiomaDelDato('tr:xx'), 'English'); // uno que no conozco: ingles
  assert.equal(idiomaDelDato('soy:c:1'), null);
  assert.equal(idiomaDelDato(null), null);
});

test('al tocarlo: contesta el callback, traduce en respuesta al original y quita el boton', async () => {
  const llamadas = [];
  const fetchOriginal = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    llamadas.push([url.split('/').pop(), JSON.parse(opts.body)]);
    return { json: async () => ({ ok: true, result: { message_id: 9 } }) };
  };
  try {
    const cq = { id: 'cq1', data: 'tr:en', message: { message_id: 5, chat: { id: -100 }, text: 'Hola, asere', reply_markup: { inline_keyboard: [[BOTON_TRADUCIR]] } } };
    const ok = await atenderBotonTraducir('T', cq, async (t) => `Hi, bro (${t})`);
    assert.equal(ok, true);
    assert.deepEqual(llamadas.map((l) => l[0]), ['answerCallbackQuery', 'sendMessage', 'editMessageReplyMarkup']);
    assert.equal(llamadas[1][1].text, '🌐 Hi, bro (Hola, asere)');
    assert.deepEqual(llamadas[1][1].reply_parameters, { message_id: 5 });
    assert.deepEqual(llamadas[2][1].reply_markup, { inline_keyboard: [] });
    // Sin IA: lo dice en ingles y no toca el boton.
    llamadas.length = 0;
    await atenderBotonTraducir('T', cq, async () => null);
    assert.deepEqual(llamadas.map((l) => l[0]), ['answerCallbackQuery', 'sendMessage']);
    assert.match(llamadas[1][1].text, /can't translate right now/);
  } finally {
    globalThis.fetch = fetchOriginal;
  }
});

test('un update repetido se reconoce; uno nuevo no', () => {
  olvidarVistos();
  assert.equal(yaVisto(100), false);
  assert.equal(yaVisto(100), true);
  assert.equal(yaVisto(101), false);
  assert.equal(yaVisto(undefined), false);
});

test('un mensaje entregado media hora tarde es viejo; uno de hace un minuto no', () => {
  const ahora = Date.parse('2026-09-14T13:59:00Z');
  assert.equal(esViejo({ date: Math.floor(Date.parse('2026-09-14T13:27:00Z') / 1000) }, ahora), true);
  assert.equal(esViejo({ date: Math.floor(Date.parse('2026-09-14T13:58:00Z') / 1000) }, ahora), false);
  assert.equal(esViejo({}, ahora), false);
});
