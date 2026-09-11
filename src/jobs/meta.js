// Rehace el digesto del meta: los ultimos videos de los canales de
// confianza y los articulos de Blueprint, en un texto que la IA lee cuando
// preguntan por ejercitos. Cada seis horas desde GitHub Actions.
//
// La logica vive en web/lib/meta-fuentes.js, que es JavaScript puro sin
// nada de Next: el panel (boton "Actualizar el digesto ahora") y este job
// construyen exactamente lo mismo.
//
//   npm run meta            rehace y guarda
//   npm run meta -- --seco  imprime el digesto y no guarda nada

import { db, chk, correrJob } from '../lib/db.js';
import { CANALES_DEFECTO, FEEDS_DEFECTO, construirDigesto } from '../../web/lib/meta-fuentes.js';
import { glosarioDesdeWiki } from '../../web/lib/wiki.js';

const SECO = process.argv.includes('--seco');

await correrJob('meta', async () => {
  const conf = chk(await db.from('config').select('clave, valor').in('clave', ['meta_canales', 'meta_feeds']), 'leer config');
  const valor = (k, d) => conf.find((r) => r.clave === k)?.valor ?? d;

  const digesto = await construirDigesto({
    llave: process.env.YOUTUBE_API_KEY,
    canales: valor('meta_canales', CANALES_DEFECTO),
    feeds: valor('meta_feeds', FEEDS_DEFECTO),
  });
  console.log(`  ${digesto.videos} videos, ${digesto.articulos} articulos, ${digesto.texto.length} chars, ${digesto.ms} ms`);
  for (const e of digesto.errores) console.log(`  ! ${e}`);

  // Y el glosario del juego desde la wiki: las tropas, hechizos, heroes...
  // con sus nombres, para que la IA sepa de que hablan y lea su pagina
  // antes de contestar. Si la wiki falla, se queda el anterior.
  let glosario = null;
  try {
    glosario = await glosarioDesdeWiki();
    console.log(`  glosario: ${glosario.length} entidades`);
  } catch (e) {
    console.log(`  ! glosario: ${e.message}`);
  }

  if (SECO) {
    console.log(`\n${digesto.texto}\n`);
    return { filas: 0, detalle: { seco: true, videos: digesto.videos, articulos: digesto.articulos } };
  }
  chk(
    await db.from('config').upsert(
      {
        clave: 'meta_digest',
        valor: digesto,
        descripcion: 'Digesto del meta para la IA (lo rehacen /api/meta y src/jobs/meta.js)',
        actualizado: new Date().toISOString(),
      },
      { onConflict: 'clave' }
    ),
    'guardar digesto'
  );
  if (glosario?.length) {
    chk(
      await db.from('config').upsert(
        { clave: 'glosario_juego', valor: glosario, descripcion: 'Entidades del juego segun la wiki, con nombres (lo rehace src/jobs/meta.js)', actualizado: new Date().toISOString() },
        { onConflict: 'clave' }
      ),
      'guardar glosario'
    );
  }
  return { filas: 1, detalle: { videos: digesto.videos, articulos: digesto.articulos, chars: digesto.texto.length, glosario: glosario?.length ?? 0, errores: digesto.errores } };
});
