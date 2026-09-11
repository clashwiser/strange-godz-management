// El digesto del meta: de la API de YouTube y los feeds de Blueprint al
// texto que lee la IA.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { enlaceEjercito, resumirVideo, parsearAtom, digerir, CANALES_DEFECTO, WEBS_DEFECTO } from '../web/lib/meta-fuentes.js';

const ARMY = 'https://link.clashofclans.com/en?action=CopyArmy&army=h7p4e52_60-2p7e4_19-0p9e14_32u2x5-6x80s2x120-1x9';

test('enlaceEjercito: saca el enlace de copiar ejercito y nada mas', () => {
  assert.equal(enlaceEjercito(`🚀Army link~\n\n${ARMY}\n\nChat: https://link.clashofclans.com/?action=OpenGlobalChat&chatId=P1`), ARMY);
  assert.equal(enlaceEjercito('sin enlaces'), null);
  assert.equal(enlaceEjercito(null), null);
});

test('resumirVideo: titulo, fecha, enlace, y la descripcion sin enlaces ni hashtags', () => {
  const v = resumirVideo(
    {
      title: 'Super Bowler Spam Makes Legend 1 Promotion EASY! | best th18 attack',
      publishedAt: '2026-09-10T14:00:01Z',
      description: `#ClashOfClans #supercell\n\n🚀Army link~\n\n${ARMY}\n\n🔥 NEW META ATTACK STRATEGY 🔥\nIn this video, I share a strong and easy attack. #th18`,
    },
    'Clash With HABIBI'
  );
  assert.equal(v.canal, 'Clash With HABIBI');
  assert.equal(v.fecha, '2026-09-10');
  assert.equal(v.ejercito, ARMY);
  assert.match(v.titulo, /^Super Bowler Spam/);
  assert.doesNotMatch(v.texto, /https?:|#|🚀/);
  assert.match(v.texto, /NEW META ATTACK STRATEGY/);
});

test('parsearAtom: entradas con titulo, fecha, enlace y texto plano del contenido', () => {
  const xml = `<?xml version="1.0"?><feed><title>Blog</title>
<entry><id>x</id><published>2026-08-27T06:55:03+01:00</published><updated>2026-08-27T20:53:28+01:00</updated>
<link rel="alternate" type="text/html" href="https://blueprintcoc.com/blogs/town-hall-18/best"/>
<title>The Best TH18 Attack Strategies of 2026</title>
<content type="html"><![CDATA[<p>Hey Chief, <b>Super Bowler Smash</b> &amp; Hydra.</p><script>x()</script>]]></content></entry>
<entry><id>y</id><published>2026-06-01T00:00:00+01:00</published><title>Otra</title>
<link rel="alternate" href="https://blueprintcoc.com/o"/><summary type="html"><![CDATA[Resumen corto]]></summary></entry>
</feed>`;
  const e = parsearAtom(xml);
  assert.equal(e.length, 2);
  assert.equal(e[0].titulo, 'The Best TH18 Attack Strategies of 2026');
  assert.equal(e[0].fecha, '2026-08-27');
  assert.equal(e[0].enlace, 'https://blueprintcoc.com/blogs/town-hall-18/best');
  assert.equal(e[0].texto, 'Hey Chief, Super Bowler Smash & Hydra.');
  assert.equal(e[1].texto, 'Resumen corto', 'sin content usa summary');
  assert.equal(parsearAtom('').length, 0);
});

test('digerir: videos primero, del mas nuevo al mas viejo, con enlace; luego los articulos; y cabe en el tope', () => {
  const videos = [
    { canal: 'iTzu', fecha: '2026-09-08', titulo: 'Viejo', ejercito: null, texto: '' },
    { canal: 'Habibi', fecha: '2026-09-10', titulo: 'Super Bowler Spam', ejercito: ARMY, texto: 'x' },
  ];
  const feeds = [{ fuente: 'blueprintcoc.com', entradas: [{ titulo: 'Best TH18', fecha: '2026-08-27', enlace: 'u', texto: 'Hydra y Super Bowler.' }] }];
  const d = digerir(videos, feeds);
  const lineas = d.split('\n');
  assert.match(lineas[0], /ÚLTIMOS VIDEOS/);
  assert.equal(lineas[1], `- [2026-09-10] Habibi: Super Bowler Spam · ejército: ${ARMY}`);
  assert.equal(lineas[2], '- [2026-09-08] iTzu: Viejo');
  assert.match(d, /ARTÍCULO \(blueprintcoc\.com, 2026-08-27\): Best TH18\nHydra y Super Bowler\./);
  assert.ok(digerir(videos, feeds, { tope: 50 }).length <= 50);
});

test('las fuentes por defecto tienen forma', () => {
  assert.ok(CANALES_DEFECTO.length >= 7);
  for (const c of CANALES_DEFECTO) assert.match(c.id, /^UC[\w-]{22}$/, c.nombre);
  assert.ok(WEBS_DEFECTO.includes('blueprintcoc.com'));
});
