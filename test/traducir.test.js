// El boton "🌐 English" y la memoria de updates vistos del webhook.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { conBotonTraducir, markupTraducir, sinBotonTraducir, BOTON_TRADUCIR, atenderBotonTraducir } from '../web/lib/traducir.js';
import { yaVisto, olvidarVistos, esViejo } from '../web/lib/webhook.js';

test('el boton va al final si el texto lo merece, y una sola vez', () => {
  assert.equal(conBotonTraducir(null, 'ok 👍'), null);
  assert.deepEqual(conBotonTraducir(null, 'x'.repeat(40)), [[BOTON_TRADUCIR]]);
  const soy = [[{ text: 'a', callback_data: 'soy:c:1' }]];
  assert.deepEqual(conBotonTraducir(soy, 'x'.repeat(50)), [...soy, [BOTON_TRADUCIR]]);
  assert.deepEqual(conBotonTraducir(soy, 'corto'), soy);
  assert.deepEqual(conBotonTraducir([...soy, [BOTON_TRADUCIR]], 'x'.repeat(50)), [...soy, [BOTON_TRADUCIR]]);
  // Las etiquetas HTML no cuentan como texto.
  assert.equal(conBotonTraducir(null, '<b>' + 'x'.repeat(30) + '</b>'), null);
  assert.deepEqual(markupTraducir(null, 'x'.repeat(40)), { reply_markup: { inline_keyboard: [[BOTON_TRADUCIR]] } });
  assert.deepEqual(markupTraducir(null, 'corto'), {});
  assert.deepEqual(sinBotonTraducir([...soy, [BOTON_TRADUCIR]]), soy);
});

test('al tocarlo: contesta el callback, traduce en respuesta al original y quita el boton', async () => {
  const llamadas = [];
  const fetchOriginal = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    llamadas.push([url.split('/').pop(), JSON.parse(opts.body)]);
    return { json: async () => ({ ok: true, result: { message_id: 9 } }) };
  };
  try {
    const cq = { id: 'cq1', message: { message_id: 5, chat: { id: -100 }, text: 'Hola, asere', reply_markup: { inline_keyboard: [[BOTON_TRADUCIR]] } } };
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
