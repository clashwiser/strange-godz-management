// El portavoz de Facebook: que toca publicar hoy, con los numeros del clan
// puestos desde la API. Lo usa la tarea programada del escritorio (que
// publica en Facebook con el Chrome de Cris) y sirve para leer los textos.
//
//   npm run portavoz                 el post de hoy (grupo, url, texto, imagen) en JSON
//   npm run portavoz -- --texto 3    un texto concreto, con los datos de hoy
//   npm run portavoz -- --todos      los siete, para revisarlos
//   npm run portavoz -- --fecha 2026-09-25   el de otro dia
//
// Ver src/lib/portavoz-textos.js (los textos y las reglas de Cris) y
// docs/portavoz-facebook.md.

import { getClan } from '../lib/coc.js';
import { datosDe, textoDe, grupoDelDia, imagenDelDia, GRUPOS, TAG } from '../lib/portavoz-textos.js';

const args = process.argv.slice(2);
const valor = (nombre) => {
  const i = args.indexOf(nombre);
  return i >= 0 ? args[i + 1] : null;
};

const fecha = valor('--fecha') ? new Date(`${valor('--fecha')}T12:00:00`) : new Date();
const clan = await getClan(TAG);
const datos = datosDe(clan);

if (args.includes('--todos')) {
  console.log(`# x300 hoy: nivel ${datos.nivel}, ${datos.victorias} guerras ganadas, racha ${datos.racha}, ${datos.th18}/${datos.miembros} en TH18, ${datos.liga}\n`);
  for (const g of GRUPOS) console.log(`## Texto ${g.texto} · ${g.nombre} (${g.idioma})\n\n${textoDe(g.texto, datos)}\n`);
  process.exit(0);
}

const n = valor('--texto');
if (n) {
  console.log(textoDe(Number(n), datos));
  process.exit(0);
}

const grupo = grupoDelDia(fecha);
console.log(
  JSON.stringify(
    {
      fecha: fecha.toISOString().slice(0, 10),
      grupo: grupo.nombre,
      url: grupo.url,
      idioma: grupo.idioma,
      imagen: imagenDelDia(fecha),
      datos,
      texto: textoDe(grupo.texto, datos),
    },
    null,
    2
  )
);
process.exit(0);
