// /guerrallena: llenar todos los castillos de una guerra (web/lib/guerra-llena.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { firmaGuerraLlena, textoYaPedida, PUNTOS_GUERRA_LLENA } from '../web/lib/guerra-llena.js';
import { tablaPuntos } from '../web/lib/castillos.js';
import { comandoDelPie, modoDeFoto } from '../web/lib/fotos.js';

test('los puntos de la guerra llena son 50, como fijo Cris', () => {
  assert.equal(PUNTOS_GUERRA_LLENA, 50);
});

test('firmaGuerraLlena: la guerra por nuestro clan y el rival, sin la hora', () => {
  // La API mueve la hora de inicio entre preparacion y batalla: no va en la firma.
  assert.equal(firmaGuerraLlena('#2gc', '#abc123'), 'guerra_llena|#2GC|#ABC123');
  assert.equal(firmaGuerraLlena('#2GC', '#ABC123'), firmaGuerraLlena('#2gc', '#abc123'));
  assert.notEqual(firmaGuerraLlena('#2GC', '#ABC123'), firmaGuerraLlena('#2GC', '#OTRO'));
});

test('textoYaPedida: la suya pendiente, la suya confirmada, o la de otro', () => {
  assert.match(textoYaPedida({ tg_user_id: 7, verificado: false }, 7, 'Yoan'), /Falta que un líder/);
  assert.match(textoYaPedida({ tg_user_id: 7, verificado: true }, 7, 'Yoan'), /Ya tienes confirmada/);
  const otro = textoYaPedida({ tg_user_id: 9, nombre: 'Pepe', verificado: false }, 7, 'Yoan');
  assert.match(otro, /Pepe/);
  assert.match(otro, /\/castillo/);
});

test('tablaPuntos: la guerra llena suma 50, se cuenta aparte y gana el desempate', () => {
  const filas = [
    { tg_user_id: 1, nombre: 'Yoan', tipo: 'guerra_llena', puntos: 50, verificado: true },
    // Pendiente de un lider: no cuenta todavia.
    { tg_user_id: 1, nombre: 'Yoan', tipo: 'guerra_llena', puntos: 0, verificado: false },
    // Cinco castillos = 50 tambien.
    ...[1, 2, 3, 4, 5].map(() => ({ tg_user_id: 2, nombre: 'Pepe', puntos: 10, verificado: true })),
  ];
  const t = tablaPuntos(filas);
  assert.equal(t[0].nombre, 'Yoan');
  assert.equal(t[0].puntos, 50);
  assert.equal(t[0].guerras, 1);
  assert.equal(t[1].puntos, 50);
  assert.equal(t[1].castillos, 5);
});

test('/guerrallena en el pie de una foto va a la guerra llena, no al castillo', () => {
  assert.equal(comandoDelPie('/guerrallena'), 'guerrallena');
  assert.equal(comandoDelPie('/guerrallena@Strange_godz_heraldo_bot'), 'guerrallena');
  assert.equal(comandoDelPie('/guerracompleta'), 'guerrallena');
  assert.equal(modoDeFoto('/guerrallena llené todos los castillos'), 'guerrallena');
  // Y /castillo sigue siendo castillo.
  assert.equal(modoDeFoto('/castillo'), 'castillo');
});
