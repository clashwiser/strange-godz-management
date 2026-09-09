// Une sql/0*.sql en sql/INSTALAR.sql, en orden.
//
// Existe porque instalar la base son 9 archivos que hay que pegar EN ORDEN en
// el editor de Supabase: cada uno se apoya en tablas del anterior. Pegarlos
// salteados falla con errores que no dicen que el problema fue el orden.
//
// Correr cada vez que se agregue un sql/0NN_*.sql nuevo, o el archivo unido
// queda viejo sin avisar.
//
//   npm run sql:unir

import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import path from 'node:path';

const dir = 'sql';
const partes = readdirSync(dir).filter((f) => /^0\d+_.*\.sql$/.test(f)).sort();

if (!partes.length) {
  console.error('No hay archivos sql/0NN_*.sql');
  process.exit(1);
}

const cabecera = `-- =====================================================================
--  Strange Godz Alliance - Management
--  INSTALACION COMPLETA EN UN SOLO PASO
--
--  Pegar TODO este archivo en el SQL Editor de Supabase y darle Run.
--  Es la union de los ${partes.length} archivos de sql/ en el orden correcto; el orden
--  importa porque cada uno se apoya en tablas del anterior.
--
--  Se puede correr dos veces sin romper nada: todo va con
--  "if not exists" / "or replace" / "drop policy if exists".
--  Si algo falla a mitad, se arregla y se vuelve a pegar entero.
--
--  GENERADO - no editar a mano. Regenerar con: npm run sql:unir
-- =====================================================================

`;

const cuerpo = partes
  .map(
    (f) =>
      `\n\n-- ####################################################################\n` +
      `-- ##  ${f}\n` +
      `-- ####################################################################\n\n` +
      readFileSync(path.join(dir, f), 'utf8').trimEnd() +
      '\n'
  )
  .join('');

const salida = path.join(dir, 'INSTALAR.sql');
writeFileSync(salida, cabecera + cuerpo, 'utf8');

console.log(`${salida}  <-  ${partes.length} archivos, ${Math.round(statSync(salida).size / 1024)} KB`);
for (const f of partes) console.log('   ', f);
