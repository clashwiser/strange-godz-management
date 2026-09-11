// Las normas: cuando se piden, cuando se pregunta por ellas, como se
// convierten a HTML, y el aviso del castillo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { esPreguntaDeReglas, pideLasReglas, mensajeReglas, markdownAHtml } from '../web/lib/reglas.js';
import { avisaCastillo, confirmaCastillo, rechazaCastillo, tablaPuntos, PUNTOS_CASTILLO } from '../web/lib/castillos.js';

test('pideLasReglas: la peticion de las normas enteras', () => {
  for (const s of ['/reglas', 'reglas', 'Heraldo, las normas', 'mándame las reglas del clan', 'cuáles son las normas del clan']) {
    assert.equal(pideLasReglas(s), true, s);
  }
  for (const s of ['hola', '¿se puede tener dos cuentas?', 'que pasa si no ataco']) {
    assert.equal(pideLasReglas(s), false, s);
  }
});

test('esPreguntaDeReglas: dudas concretas sobre lo que se puede o no', () => {
  for (const s of ['¿se puede tener dos cuentas?', 'qué pasa si no ataco en liga', 'es obligatorio donar el castillo?', 'hay mínimo de donaciones?', 'me pueden expulsar por eso?']) {
    assert.equal(esPreguntaDeReglas(s), true, s);
  }
  for (const s of ['hola', 'qué ejército uso', 'cuántas estrellas llevo']) {
    assert.equal(esPreguntaDeReglas(s), false, s);
  }
});

test('mensajeReglas: resumen, enlace y fecha, escapado', () => {
  const m = mensajeReglas({ resumen: 'Regla 1 <b>', url: 'https://x/reglas', fecha: '2026-09-11', esc: (s) => s.replace(/</g, '&lt;') });
  assert.equal(m, 'Regla 1 &lt;b>\n\n📖 Completas: https://x/reglas (actualizadas el 2026-09-11)');
});

test('markdownAHtml: titulos, listas, negrita, codigo y parrafos; sin HTML colado', () => {
  const md = '# Normas\n\nTexto **fuerte** con `/soy` y *cursiva*.\n\n## 1. Guerra\n\n- Uno <script>x</script>\n- Dos\n\n1. Aviso\n2. Fuera\n';
  const html = markdownAHtml(md);
  assert.match(html, /^<h1>Normas<\/h1>/);
  assert.match(html, /<p>Texto <b>fuerte<\/b> con <code>\/soy<\/code> y <i>cursiva<\/i>\.<\/p>/);
  assert.match(html, /<h2>1\. Guerra<\/h2>/);
  assert.match(html, /<ul>\n<li>Uno &lt;script&gt;x&lt;\/script&gt;<\/li>\n<li>Dos<\/li>\n<\/ul>/);
  assert.match(html, /<ol>\n<li>Aviso<\/li>\n<li>Fuera<\/li>\n<\/ol>/);
  assert.doesNotMatch(html, /<script>/);
});

test('avisaCastillo: como lo dice la gente', () => {
  for (const s of ['@Heraldo ya doné mi castillo', 'castillo donado', 'listo el castillo de guerra', 'Valquiria, ya puse el castillo', 'castillo lleno ✅']) {
    assert.equal(avisaCastillo(s), true, s);
  }
  for (const s of ['¿quién dona mi castillo?', 'me falta el castillo', 'hola', 'doné 40 tropas']) {
    assert.equal(avisaCastillo(s), false, s);
  }
});

test('tablaPuntos: suma solo lo verificado, por persona, y ordena', () => {
  const filas = [
    { tg_user_id: 1, nombre: 'Ana', verificado: true, puntos: PUNTOS_CASTILLO },
    { tg_user_id: 1, nombre: 'Ana', verificado: true, puntos: PUNTOS_CASTILLO },
    { tg_user_id: 2, nombre: 'Beto', verificado: false, puntos: 0 },
    { tg_user_id: 3, nombre: 'Caro', verificado: true, puntos: PUNTOS_CASTILLO },
  ];
  assert.deepEqual(tablaPuntos(filas), [
    { nombre: 'Ana', puntos: 2 * PUNTOS_CASTILLO, veces: 2, castillos: 2, fc: 0 },
    { nombre: 'Caro', puntos: PUNTOS_CASTILLO, veces: 1, castillos: 1, fc: 0 },
  ]);
});

test('confirmaCastillo / rechazaCastillo: lo que contesta un lider al aviso', () => {
  for (const x of ['✅', '✅✅', 'ok', 'Confirmado', 'visto', 'dale']) assert.equal(confirmaCastillo(x), true, x);
  for (const x of ['❌', 'no', 'No donó', 'falso']) assert.equal(rechazaCastillo(x), true, x);
  for (const x of ['hola', 'qué buen castillo', 'ok pero mañana no']) assert.equal(rechazaCastillo(x), false, x);
  assert.equal(confirmaCastillo('hola'), false);
});
