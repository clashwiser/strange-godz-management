// Copia de seguridad de la base de datos. Corre cada semana en GitHub
// Actions y deja el archivo cifrado en backups/.
//
//   BACKUP_PASSPHRASE=... npm run backup
//
// Por que existe: el plan gratis de Supabase no tiene recuperacion a un
// punto en el tiempo. Un DELETE sin WHERE, una migracion mal escrita, o
// simplemente que un dia el proyecto se pause por inactividad, y se
// pierde todo. Y "todo" NO se puede regenerar desde la API de Clash: la
// API solo da el estado de HOY. Los snapshots de cada dia, quien entro y
// salio, las rondas de CWL pasadas, las solicitudes, los bonos, las
// alineaciones, la config... eso solo existe aqui.
//
// Se guarda cifrado porque el repo es publico. Ver backup-cifrado.js.
// Se guardan las ultimas doce (tres meses): mas no aporta y el repo
// engorda.
//
// El orden de las tablas es el de las claves foraneas, para que la
// restauracion pueda ir de arriba a abajo sin tropezar.

import { readdirSync, unlinkSync, writeFileSync, mkdirSync } from 'node:fs';
import { db, chk } from '../lib/db.js';
import { cifrar } from '../lib/backup-cifrado.js';
import { TABLAS } from '../lib/backup-tablas.js';
const GUARDAR = 12;
const PAGINA = 1000;

/** Toda una tabla, de mil en mil: PostgREST corta en mil por defecto. */
async function tablaEntera(nombre) {
  const filas = [];
  for (let desde = 0; ; desde += PAGINA) {
    const trozo = chk(await db.from(nombre).select('*').range(desde, desde + PAGINA - 1), `leer ${nombre}`);
    filas.push(...trozo);
    if (trozo.length < PAGINA) break;
  }
  return filas;
}

async function main() {
  const frase = process.env.BACKUP_PASSPHRASE;
  if (!frase) {
    console.error('Falta BACKUP_PASSPHRASE. Sin frase no hay copia: el repo es publico.');
    process.exit(1);
  }

  const inicio = Date.now();
  const tablas = {};
  let total = 0;
  for (const t of TABLAS) {
    try {
      tablas[t] = await tablaEntera(t);
      total += tablas[t].length;
      console.log(`  ${t.padEnd(16)} ${String(tablas[t].length).padStart(6)}`);
    } catch (e) {
      // Una tabla que aun no existe en esta base no puede tumbar la copia
      // de las demas. Se anota y se sigue.
      console.log(`  ${t.padEnd(16)}   (no se pudo: ${e.message.slice(0, 60)})`);
    }
  }

  const fecha = new Date().toISOString().slice(0, 10);
  const copia = { version: 1, fecha, filas: total, tablas };
  const cifrada = cifrar(copia, frase);

  mkdirSync('backups', { recursive: true });
  const archivo = `backups/strange-godz-${fecha}.sgb`;
  writeFileSync(archivo, cifrada);
  console.log(`\n${archivo}: ${total} filas, ${Math.round(cifrada.length / 1024)} KB cifrados, ${Math.round((Date.now() - inicio) / 1000)}s`);

  // Las viejas fuera. Por nombre, que lleva la fecha.
  const todas = readdirSync('backups')
    .filter((f) => /^strange-godz-\d{4}-\d{2}-\d{2}\.sgb$/.test(f))
    .sort();
  for (const vieja of todas.slice(0, Math.max(0, todas.length - GUARDAR))) {
    unlinkSync(`backups/${vieja}`);
    console.log(`  fuera ${vieja}`);
  }
}

main().catch((e) => {
  console.error('La copia fallo:', e.message);
  process.exit(1);
});
