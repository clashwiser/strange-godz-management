// Suscribe (y renueva) los avisos instantaneos de YouTube.
//
//   npm run youtube:suscribir
//
// YouTube avisa por WebSub en cuanto un canal sube algo, pero la
// suscripcion CADUCA — el hub da una concesion de unos cinco dias y despues
// deja de avisar sin decir nada. Por eso esto corre todos los dias: renovar
// de mas no cuesta nada, y quedarse sin avisar durante una semana sin que
// salte ningun error es la peor forma de romperse.
//
// La confirmacion es asincrona: el hub responde 202 aqui y despues llama a
// nuestro endpoint con hub.challenge. Que esto diga 202 significa "aceptado
// para verificar", no "verificado".

import { correrJob } from '../lib/db.js';

const HUB = 'https://pubsubhubbub.appspot.com/subscribe';
const SITIO = (process.env.SITIO_URL || 'https://strange-godz-management.vercel.app').replace(/\/$/, '');

const CANALES = [
  { id: 'UCD1Em4q90ZUK2R5HKesszJg', nombre: 'Clash of Clans' },
  { id: 'UC3TsnHL_rW3ig7_oCFS-Ohw', nombre: 'Gonca Clash' },
  { id: 'UC85aYbNSFjsJdxfpxgQr8tA', nombre: 'Judo Sloth Gaming' },
];

await correrJob('youtube_suscribir', async () => {
  const callback = `${SITIO}/api/youtube`;
  const detalle = {};
  let ok = 0;

  for (const c of CANALES) {
    // Con /xml/ delante. La ruta sin /xml/ devuelve 404 y el hub rechazaria
    // la suscripcion por un topic que no existe.
    const topic = `https://www.youtube.com/xml/feeds/videos.xml?channel_id=${c.id}`;

    const cuerpo = new URLSearchParams({
      'hub.mode': 'subscribe',
      'hub.topic': topic,
      'hub.callback': callback,
      'hub.verify': 'async',
      // El maximo que acepta el hub. Aun asi se renueva a diario.
      'hub.lease_seconds': '432000',
    });

    try {
      const r = await fetch(HUB, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: cuerpo,
        signal: AbortSignal.timeout(20000),
      });
      const texto = await r.text().catch(() => '');
      // 202 = aceptado para verificar. 204 tambien vale en algunos hubs.
      const bien = r.status === 202 || r.status === 204;
      if (bien) ok += 1;
      detalle[c.nombre] = r.status;
      console.log(`  ${c.nombre}: ${r.status}${bien ? '' : ' — ' + texto.slice(0, 120)}`);
    } catch (e) {
      detalle[c.nombre] = e.message;
      console.log(`  ${c.nombre}: fallo — ${e.message}`);
    }
  }

  console.log(`  callback: ${callback}`);
  return { filas: ok, detalle: { callback, ...detalle } };
});

process.exit(0);
