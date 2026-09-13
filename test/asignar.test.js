// /asignar: a quien va dirigido (respuesta, aviso de entrada, bienvenida
// del bot, mencion con id, @usuario apuntado, nombre suelto delante).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { objetivoDe } from '../web/lib/asignar.js';

/** Un Supabase de mentira con la tabla tg_usuarios. */
const adminFingido = (usuarios) => ({
  from: () => ({
    select: () => ({
      ilike: (campo, valor) => {
        const v = String(valor).toLowerCase();
        const filas = usuarios.filter((x) => String(x[campo] ?? '').toLowerCase() === v);
        return {
          limit: (n) => Object.assign(Promise.resolve({ data: filas.slice(0, n) }), { maybeSingle: async () => ({ data: filas[0] ?? null }) }),
        };
      },
    }),
  }),
});
const quien = (o) => (o ? { id: o.id, nombre: o.nombre } : null);

test('contestando al mensaje de alguien, es ese alguien', async () => {
  const o = await objetivoDe(adminFingido([]), { text: '/asignar Drakon', reply_to_message: { from: { id: 55, first_name: 'Deivis', is_bot: false } } });
  assert.deepEqual(quien(o), { id: 55, nombre: 'Deivis' });
});

test('contestando al aviso de "Erick entró al grupo", es Erick', async () => {
  const o = await objetivoDe(adminFingido([]), { text: '/asignar', reply_to_message: { from: { id: 66, first_name: 'Erick', is_bot: false }, new_chat_members: [{ id: 66, first_name: 'Erick' }] } });
  assert.deepEqual(quien(o), { id: 66, nombre: 'Erick' });
});

test('contestando a la bienvenida de Valquiria, es el mencionado en ella', async () => {
  const bienvenida = { from: { id: 1, first_name: 'Valquiria', is_bot: true }, text: '⚔️ Erick, bienvenido…', entities: [{ type: 'text_mention', offset: 3, length: 5, user: { id: 66, first_name: 'Erick' } }] };
  const o = await objetivoDe(adminFingido([]), { text: '/asignar', reply_to_message: bienvenida });
  assert.deepEqual(quien(o), { id: 66, nombre: 'Erick' });
});

test('contestando a un bot sin mencion no vale', async () => {
  const o = await objetivoDe(adminFingido([]), { text: '/asignar Drakon', reply_to_message: { from: { id: 1, first_name: 'Heraldo', is_bot: true }, text: 'hola' } });
  assert.equal(o, null);
});

test('una mencion elegida del desplegable trae el id (text_mention), y se quita del texto', async () => {
  const o = await objetivoDe(adminFingido([]), { text: '/asignar Deivis Drakon', entities: [{ type: 'text_mention', offset: 9, length: 6, user: { id: 77, first_name: 'Deivis' } }] });
  assert.deepEqual(quien(o), { id: 77, nombre: 'Deivis' });
  assert.equal(o.quitar, 'Deivis');
});

test('un @usuario se busca entre los apuntados', async () => {
  const admin = adminFingido([{ tg_user_id: 88, username: 'LM10viscabarsa', nombre: "Assassin's Creed" }]);
  const o = await objetivoDe(admin, { text: '/asignar @LM10viscabarsa Drakon' });
  assert.deepEqual(quien(o), { id: 88, nombre: "Assassin's Creed" });
  assert.equal(await objetivoDe(admin, { text: '/asignar @nadie Drakon' }), null);
});

test('"Erick /asignar": el nombre delante del comando, si solo hay un Erick apuntado', async () => {
  const admin = adminFingido([{ tg_user_id: 66, username: null, nombre: 'Erick' }]);
  const msg = { text: 'Erick /asignar Drakon', entities: [{ type: 'bot_command', offset: 6, length: 8 }] };
  const o = await objetivoDe(admin, msg);
  assert.deepEqual(quien(o), { id: 66, nombre: 'Erick' });
  assert.equal(o.quitar, 'Erick');
  const dos = adminFingido([{ tg_user_id: 66, nombre: 'Erick' }, { tg_user_id: 67, nombre: 'Erick' }]);
  assert.equal(await objetivoDe(dos, msg), null, 'con dos Erick no se adivina');
});
