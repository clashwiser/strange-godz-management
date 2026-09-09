// Lista las cadenas envueltas en t('...') que no tienen traduccion al ingles,
// y las entradas del diccionario que ya nadie usa.
//
//   node scripts/faltan-en.mjs
//
// Existe porque la clave del diccionario es el propio texto en espanol: si se
// edita una frase y no se actualiza la traduccion, la entrada se desconecta
// sin dar error y el usuario en ingles ve esa linea en espanol. Este script
// convierte ese fallo silencioso en una lista.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const raiz = 'app';

function jsx(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = path.join(dir, n);
    if (statSync(p).isDirectory()) return jsx(p);
    return /\.jsx?$/.test(n) ? [p] : [];
  });
}

// Las claves del diccionario, leidas del propio archivo.
const fuente = readFileSync(path.join(raiz, 'idioma.jsx'), 'utf8');
const bloque = fuente.slice(fuente.indexOf('export const EN'), fuente.indexOf('const Ctx ='));
const claves = new Set([...bloque.matchAll(/^\s*'((?:[^'\\]|\\.)*)':/gm)].map((m) => m[1]));

// Las cadenas realmente usadas. Solo t('...') con comillas simples, que es
// como se escriben en este proyecto.
const usadas = new Map();
for (const f of jsx(raiz)) {
  const t = readFileSync(f, 'utf8');
  for (const m of t.matchAll(/\bt\('((?:[^'\\]|\\.)*)'\)/g)) {
    if (!usadas.has(m[1])) usadas.set(m[1], []);
    usadas.get(m[1]).push(path.basename(f));
  }
}

// Claves que se usan a traves de una variable -- t(label) en el menu de
// pestanas -- y que el barrido por texto no puede ver.
const DINAMICAS = new Set([
  'Resumen', 'Lista CWL', 'CWL Resultados', 'Jugadores', 'Mensajes', 'Bases', 'Bonos', 'Bots',
  'Alineación', 'CWL',
  // t(TIPOS[b.tipo]) en bases.jsx: el codigo de la API se traduce al pintar.
  'Aldea', 'Guerra',
]);
for (const k of DINAMICAS) if (!usadas.has(k)) usadas.set(k, ['page.jsx (dinamica)']);

const faltan = [...usadas.keys()].filter((k) => !claves.has(k));
const sobran = [...claves].filter((k) => !usadas.has(k));

console.log(`cadenas traducidas en uso: ${usadas.size}`);
console.log(`entradas en el diccionario: ${claves.size}`);
console.log('');

if (faltan.length) {
  console.log(`SIN TRADUCCION AL INGLES (${faltan.length}) - se mostraran en espanol:`);
  for (const k of faltan) console.log(`  ${[...new Set(usadas.get(k))].join(',').padEnd(18)} ${JSON.stringify(k)}`);
  console.log('');
}
if (sobran.length) {
  console.log(`EN EL DICCIONARIO PERO SIN USAR (${sobran.length}) - texto cambiado o entrada muerta:`);
  for (const k of sobran) console.log(`  ${JSON.stringify(k)}`);
  console.log('');
}
if (!faltan.length && !sobran.length) console.log('Diccionario y codigo coinciden.');

// Falla la ejecucion solo si hay cadenas sin traducir: una entrada de sobra
// es ruido, una cadena sin traducir es un bug visible para el usuario.
process.exit(faltan.length ? 1 : 0);
