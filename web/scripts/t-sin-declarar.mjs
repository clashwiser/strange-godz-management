// Busca componentes que llaman a t('...') sin haber hecho `const t = useT()`.
//
//   node scripts/t-sin-declarar.mjs
//
// Existe porque ese error NO lo atrapa el build: JSX compila igual y el fallo
// aparece recien al renderizar, como ReferenceError, y solo en la pestana
// afectada. Paso una vez: se envolvio un texto dentro de Resumen, que es una
// funcion aparte de Panel y no tenia la traduccion en ambito.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

function jsx(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = path.join(dir, n);
    if (statSync(p).isDirectory()) return jsx(p);
    return /\.jsx$/.test(n) ? [p] : [];
  });
}

let malos = 0;
for (const archivo of jsx('app')) {
  if (archivo.endsWith('idioma.jsx')) continue;
  const lineas = readFileSync(archivo, 'utf8').split(/\r?\n/);

  let fn = null;
  let declara = false;
  let usa = 0;
  const cerrar = () => {
    if (fn && usa && !declara) {
      console.log(`  ${path.basename(archivo).padEnd(16)} ${fn}()  usa t() ${usa} vez(ces) sin declararlo`);
      malos++;
    }
  };

  for (const l of lineas) {
    // Solo funciones en el nivel superior del modulo: son los componentes.
    const m = l.match(/^(?:export (?:default )?)?function (\w+)/);
    if (m) {
      cerrar();
      fn = m[1];
      declara = false;
      usa = 0;
    }
    if (/const t = useT\(\)/.test(l)) declara = true;
    // t('...') o t(variable), pero no useT() ni .then(
    if (/(?<![\w.])t\(/.test(l) && !/useT\(\)/.test(l)) usa++;
  }
  cerrar();
}

console.log(malos ? `\n${malos} componente(s) rotos` : 'Todos los componentes que traducen declaran useT().');
process.exit(malos ? 1 : 0);
