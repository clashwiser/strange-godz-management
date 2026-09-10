// Restaurar una copia de seguridad. La otra mitad del backup: una copia
// que nadie ha probado a restaurar no es una copia.
//
//   BACKUP_PASSPHRASE=... npm run restaurar -- backups/strange-godz-2026-09-14.sgb
//
// Asi, SIN mas, solo descifra y cuenta: dice que hay dentro y no toca la
// base. Es la forma de comprobar que la copia sirve y que la frase es la
// buena, y se puede correr cuando se quiera.
//
// Para escribir de verdad hay que pedirlo dos veces:
//
//   ... -- archivo.sgb --tabla solicitudes --si      solo esa tabla
//   ... -- archivo.sgb --todo --si                   todas, en orden
//
// Escribe con upsert por clave primaria: las filas que ya esten iguales
// no cambian, las que falten se crean, las que difieran se pisan con lo
// de la copia. NO borra lo que haya en la base y no este en la copia; si
// hace falta eso, se hace a mano y mirando.

import { readFileSync } from 'node:fs';
import { db } from '../lib/db.js';
import { descifrar } from '../lib/backup-cifrado.js';
import { TABLAS } from '../lib/backup-tablas.js';

const args = process.argv.slice(2);
const archivo = args.find((a) => !a.startsWith('--'));
const escribir = args.includes('--si');
const todo = args.includes('--todo');
const soloTabla = args.includes('--tabla') ? args[args.indexOf('--tabla') + 1] : null;

if (!archivo) {
  console.error('Uso: npm run restaurar -- backups/archivo.sgb [--tabla nombre | --todo] [--si]');
  process.exit(1);
}
const frase = process.env.BACKUP_PASSPHRASE;
if (!frase) {
  console.error('Falta BACKUP_PASSPHRASE.');
  process.exit(1);
}

let copia;
try {
  copia = descifrar(readFileSync(archivo), frase);
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
console.log(`Copia del ${copia.fecha}, ${copia.filas} filas, version ${copia.version}\n`);
for (const t of TABLAS) {
  if (copia.tablas[t]) console.log(`  ${t.padEnd(16)} ${String(copia.tablas[t].length).padStart(6)}`);
}

if (!escribir) {
  console.log('\nSolo lectura. Para escribir: añade --tabla nombre (o --todo) y --si.');
  process.exit(0);
}
if (!todo && !soloTabla) {
  console.error('\nDime que restaurar: --tabla nombre, o --todo.');
  process.exit(1);
}

const objetivo = todo ? TABLAS.filter((t) => copia.tablas[t]) : [soloTabla];
for (const t of objetivo) {
  const filas = copia.tablas[t];
  if (!filas) {
    console.log(`  ${t}: no esta en la copia`);
    continue;
  }
  let hechas = 0;
  for (let i = 0; i < filas.length; i += 500) {
    const { error } = await db.from(t).upsert(filas.slice(i, i + 500));
    if (error) {
      console.error(`  ${t}: fallo en la fila ${i}: ${error.message}`);
      process.exit(1);
    }
    hechas += Math.min(500, filas.length - i);
  }
  console.log(`  ${t.padEnd(16)} restauradas ${hechas}`);
}
console.log('\nListo.');
