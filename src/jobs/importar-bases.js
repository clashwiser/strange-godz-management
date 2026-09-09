// Importa un pack de bases desde un PDF: enlaces + miniaturas.
//
//   npm run bases:importar "C:/ruta/RH CWL Pack Sept 2026.pdf" "RH CWL Sept"
//
// Dos cosas que no son obvias de estos packs:
//
// 1. Los enlaces viven como ANOTACIONES del PDF, no como texto. Copiar y
//    pegar el contenido del PDF no trae nada.
// 2. El formato es imagen -> texto -> enlace -> imagen -> texto -> enlace,
//    con el enlace repetido dos veces y el flujo cruzando de pagina en
//    pagina. La miniatura de una base puede estar en la pagina anterior.
//
// El recorrido y el recorte de miniaturas lo hace src/py/extraer_bases.py,
// porque leer imagenes embebidas de un PDF en Node es mucho mas fragil.
// Requiere Python con pymupdf y pillow:  pip install pymupdf pillow

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { db, chk, correrJob } from '../lib/db.js';

const ruta = process.argv[2];
const nombre = process.argv[3] || ruta?.split(/[\\/]/).pop()?.replace(/\.pdf$/i, '');

if (!ruta) {
  console.error('Uso: npm run bases:importar <archivo.pdf> [nombre del pack]');
  process.exit(1);
}
if (!existsSync(ruta)) {
  console.error(`No existe el archivo: ${ruta}`);
  process.exit(1);
}

const slug = (nombre || 'pack')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '');

/** TH18:HV:AAAA... -> { th: 18, tipo: 'HV' } */
function leerEnlace(url) {
  const m = /[?&]id=([^&]+)/.exec(url);
  if (!m) return {};
  const [th, tipo] = decodeURIComponent(m[1]).split(':');
  return {
    th: Number((th || '').replace(/\D/g, '')) || null,
    tipo: ['HV', 'WB'].includes(tipo) ? tipo : null,
  };
}

await correrJob('importar_bases', async () => {
  const destino = path.resolve('web/public/bases');
  const py = spawnSync(
    process.env.PYTHON || 'python',
    [path.resolve('src/py/extraer_bases.py'), ruta, destino, slug],
    { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }
  );

  if (py.error || py.status !== 0) {
    throw new Error(
      `Fallo el extractor de PDF: ${py.error?.message || py.stderr || 'codigo ' + py.status}\n` +
        'Necesita Python con pymupdf y pillow:  pip install pymupdf pillow'
    );
  }

  // El script imprime avisos y al final el JSON; nos quedamos con el JSON.
  const i = py.stdout.indexOf('[');
  if (i < 0) throw new Error(`El extractor no devolvio JSON:\n${py.stdout}`);
  const encontradas = JSON.parse(py.stdout.slice(i));

  if (!encontradas.length) throw new Error('No se encontro ningun enlace de base en el PDF');

  const conMini = encontradas.filter((b) => b.preview).length;
  console.log(`  ${encontradas.length} bases, ${conMini} con miniatura`);
  if (!conMini) console.log('  (este pack es solo texto, sin imagenes)');

  const mes = new Date().toISOString().slice(0, 7);
  const pack = chk(
    await db
      .from('base_packs')
      .insert({ nombre, mes, origen: ruta.split(/[\\/]/).pop() })
      .select('id')
      .single(),
    'crear pack'
  );

  const filas = encontradas.map((b) => ({
    pack_id: pack.id,
    url: b.url,
    preview: b.preview,
    ...leerEnlace(b.url),
  }));

  chk(
    await db.from('bases').upsert(filas, { onConflict: 'pack_id,url', ignoreDuplicates: true }),
    'insertar bases'
  );

  const porTipo = filas.reduce((a, b) => ({ ...a, [b.tipo ?? '?']: (a[b.tipo ?? '?'] ?? 0) + 1 }), {});
  console.log(`  guardadas: ${JSON.stringify(porTipo)}`);
  console.log(`  miniaturas en web/public/bases/${slug}/`);
  return { filas: filas.length, detalle: { pack: nombre, porTipo, conMini } };
});

process.exit(0);
