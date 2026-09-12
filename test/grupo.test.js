// El grupo cambia de id cuando Telegram lo convierte en supergrupo: que se
// reconozca el aviso, en el chat viejo y en el nuevo, y solo si era nuestro.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { migracionDe } from '../web/lib/grupo.js';

const permitidos = ['-5541623671'];

test('en el chat viejo llega migrate_to_chat_id', () => {
  const m = { chat: { id: -5541623671, type: 'group' }, migrate_to_chat_id: -1004400687855 };
  assert.deepEqual(migracionDe(m, permitidos), { viejo: '-5541623671', nuevo: '-1004400687855' });
});

test('en el chat nuevo llega migrate_from_chat_id', () => {
  const m = { chat: { id: -1004400687855, type: 'supergroup' }, migrate_from_chat_id: -5541623671 };
  assert.deepEqual(migracionDe(m, permitidos), { viejo: '-5541623671', nuevo: '-1004400687855' });
});

test('la migracion de un grupo ajeno, o un mensaje normal, no es nada', () => {
  assert.equal(migracionDe({ chat: { id: -999 }, migrate_to_chat_id: -1001 }, permitidos), null);
  assert.equal(migracionDe({ chat: { id: -5541623671 }, text: 'hola' }, permitidos), null);
  assert.equal(migracionDe(null, permitidos), null);
});
