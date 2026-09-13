// /asignar: a quien va dirigido (respuesta, mencion con id, @usuario apuntado).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { objetivoDe } from '../web/lib/asignar.js';

const adminFingido = (usuarios) => ({
  from: () => ({
    select: () => ({
      ilike: (_, u) => ({
        limit: () => ({ maybeSingle: async () => ({ data: usuarios.find((x) => x.username.toLowerCase() === u.toLowerCase()) ?? null }) }),
      }),
    }),
  }),
});

test('contestando al mensaje de alguien, es ese alguien', async () => {
  const o = await objetivoDe(adminFingido([]), { text: '/asignar Drakon', reply_to_message: { from: { id: 55, first_name: 'Deivis', is_bot: false } } });
  assert.deepEqual(o, { id: 55, nombre: 'Deivis' });
});

test('contestando a un bot no vale', async () => {
  const o = await objetivoDe(adminFingido([]), { text: '/asignar Drakon', reply_to_message: { from: { id: 1, first_name: 'Heraldo', is_bot: true } } });
  assert.equal(o, null);
});

test('una mencion sin @ trae el id en text_mention', async () => {
  const o = await objetivoDe(adminFingido([]), { text: '/asignar Deivis Drakon', entities: [{ type: 'text_mention', offset: 9, length: 6, user: { id: 77, first_name: 'Deivis' } }] });
  assert.deepEqual(o, { id: 77, nombre: 'Deivis' });
});

test('un @usuario se busca entre los apuntados', async () => {
  const admin = adminFingido([{ tg_user_id: 88, username: 'LM10viscabarsa', nombre: "Assassin's Creed" }]);
  const o = await objetivoDe(admin, { text: '/asignar @LM10viscabarsa Drakon' });
  assert.deepEqual(o, { id: 88, nombre: "Assassin's Creed" });
  assert.equal(await objetivoDe(admin, { text: '/asignar @nadie Drakon' }), null);
});
