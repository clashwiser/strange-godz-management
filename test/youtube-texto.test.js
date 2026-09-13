// El anuncio de YouTube: el titulo de la entrada (no el del feed) y los
// directos dichos como directos.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tituloDeEntrada, directoDe, textoVideo, desescaparXml } from '../web/lib/youtube-texto.js';

const ATOM = `<?xml version='1.0' encoding='UTF-8'?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns="http://www.w3.org/2005/Atom">
  <link rel="hub" href="https://pubsubhubbub.appspot.com"/>
  <title>YouTube video feed</title>
  <updated>2026-09-13T18:03:00+00:00</updated>
  <entry>
    <id>yt:video:B3UtrfBLW10</id>
    <yt:videoId>B3UtrfBLW10</yt:videoId>
    <yt:channelId>UC3TsnHL_rW3ig7_oCFS-Ohw</yt:channelId>
    <title>🚨 BOTINAZOS &amp; RANKED | DIRECTAZO en Clash of Clans | #coc #gonca</title>
    <link rel="alternate" href="https://www.youtube.com/watch?v=B3UtrfBLW10"/>
  </entry>
</feed>`;

test('el titulo sale de la entrada, no del feed, y sin entidades', () => {
  assert.equal(tituloDeEntrada(ATOM), '🚨 BOTINAZOS & RANKED | DIRECTAZO en Clash of Clans | #coc #gonca');
  assert.equal(tituloDeEntrada('<feed><title>YouTube video feed</title></feed>'), null);
  assert.equal(desescaparXml('Tom &amp; Jerry &quot;live&quot; &#39;ya&#39;'), `Tom & Jerry "live" 'ya'`);
});

test('directoDe lee liveBroadcastContent y la hora real o la programada', () => {
  assert.deepEqual(directoDe({ snippet: { liveBroadcastContent: 'live' }, liveStreamingDetails: { actualStartTime: '2026-09-13T18:02:59Z', scheduledStartTime: '2026-09-13T18:02:40Z' } }), { directo: 'live', empieza: '2026-09-13T18:02:59Z' });
  assert.deepEqual(directoDe({ snippet: { liveBroadcastContent: 'upcoming' }, liveStreamingDetails: { scheduledStartTime: '2026-09-14T00:00:00Z' } }), { directo: 'upcoming', empieza: '2026-09-14T00:00:00Z' });
  assert.deepEqual(directoDe({ snippet: {} }), { directo: 'none', empieza: null });
});

test('textoVideo: video normal, directo en vivo y directo programado', () => {
  const v = { etiqueta: '🇪🇸 En español', canal: 'Gonca Clash', titulo: 'BOTINAZOS <en vivo>', videoId: 'B3UtrfBLW10' };
  const html = { b: (s) => `<b>${s}</b>`, esc: (s) => s.replace(/</g, '&lt;').replace(/>/g, '&gt;') };
  assert.equal(textoVideo(v), '🇪🇸 En español  *Gonca Clash*\n\nBOTINAZOS <en vivo>\n\nhttps://www.youtube.com/watch?v=B3UtrfBLW10');
  const live = textoVideo({ ...v, directo: 'live', empieza: '2026-09-13T18:02:59Z' }, html);
  assert.match(live, /^🇪🇸 En español  <b>Gonca Clash<\/b>\n\n🔴 <b>EN DIRECTO ahora<\/b>\nBOTINAZOS &lt;en vivo&gt;\n\nhttps/);
  const prog = textoVideo({ ...v, directo: 'upcoming', empieza: '2026-09-14T00:00:00Z' }, html);
  assert.match(prog, /⏰ <b>Directo programado: .*13 sept.*8:00.*<\/b>\nBOTINAZOS/);
  assert.match(textoVideo({ ...v, titulo: '' }), /\n\nVideo nuevo\n\n/);
});

test('el segundo aviso: que hacer con cada directo programado', async () => {
  const { decidirDirectos, PACIENCIA_H } = await import('../web/lib/youtube-directos.js');
  const { textoYaEmpezo } = await import('../web/lib/youtube-texto.js');
  const ahora = Date.parse('2026-09-14T00:30:00Z');
  const pendientes = {
    vivo: { canal: 'Gonca Clash', etiqueta: '🇪🇸 En español', titulo: 'Directazo', empieza: '2026-09-14T00:00:00Z' },
    espera: { canal: 'Gonca Clash', etiqueta: '🇪🇸 En español', titulo: 'Mañana', empieza: '2026-09-14T20:00:00Z' },
    viejo: { canal: 'Gonca Clash', etiqueta: '🇪🇸 En español', titulo: 'Nunca arrancó', empieza: '2026-09-13T00:00:00Z' },
    termino: { canal: 'Gonca Clash', etiqueta: '🇪🇸 En español', titulo: 'Ya fue', empieza: '2026-09-13T20:00:00Z' },
    borrado: { canal: 'Gonca Clash', etiqueta: '🇪🇸 En español', titulo: 'Se borró', empieza: null },
  };
  const items = [
    { id: 'vivo', snippet: { liveBroadcastContent: 'live' } },
    { id: 'espera', snippet: { liveBroadcastContent: 'upcoming' }, liveStreamingDetails: { scheduledStartTime: '2026-09-14T20:00:00Z' } },
    { id: 'viejo', snippet: { liveBroadcastContent: 'upcoming' }, liveStreamingDetails: { scheduledStartTime: '2026-09-13T00:00:00Z' } },
    { id: 'termino', snippet: { liveBroadcastContent: 'none' } },
  ];
  assert.ok(PACIENCIA_H >= 6);
  const d = decidirDirectos(pendientes, items, ahora);
  assert.deepEqual(d.avisar, ['vivo']);
  assert.deepEqual(d.olvidar.sort(), ['borrado', 'termino', 'viejo', 'vivo']);
  const t = textoYaEmpezo({ ...pendientes.vivo, videoId: 'vivo' });
  assert.equal(t, '🇪🇸 En español  *Gonca Clash*\n\n🔴 *¡Ya empezó el directo!*\nDirectazo\n\nhttps://www.youtube.com/watch?v=vivo');
});
