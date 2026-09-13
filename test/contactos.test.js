// /contacto: Telegram que abre el chat y WhatsApp que abre WhatsApp.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { textoContactos } from '../web/lib/contactos.js';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

test('con @usuario va el enlace t.me; sin @, la mencion por id; el WhatsApp es un enlace', () => {
  const s = textoContactos(
    [
      { nombre: 'Cris', rol: 'Líder', telegram: '@YHLQMDLG2', tg_id: 742056647, whatsapp: 'https://wa.me/qr/WVEABIBOBC5DP1' },
      { nombre: 'Carlos', rol: 'Líder', telegram: 'Pmc', tg_id: 8319208377, whatsapp: 'https://wa.me/qr/65KZOBJGV5YIM1' },
      { nombre: 'Deibis', rol: 'Líder', telegram: '@LM10viscabarsa', tg_id: 1626048117, whatsapp: '' },
    ],
    esc
  );
  assert.match(s, /<a href="https:\/\/t\.me\/YHLQMDLG2">@YHLQMDLG2<\/a>/);
  assert.match(s, /<a href="tg:\/\/user\?id=8319208377">Pmc<\/a>/);
  assert.match(s, /<a href="https:\/\/wa\.me\/qr\/WVEABIBOBC5DP1">wa\.me\/qr\/WVEABIBOBC5DP1<\/a>/);
  assert.match(s, /Deibis.*\n.*WhatsApp: pendiente/);
});

test('sin contactos lo dice', () => {
  assert.match(textoContactos([], esc), /todavía no pusieron/);
});
