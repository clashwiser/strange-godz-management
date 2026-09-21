// El portavoz de Facebook: que toca publicar hoy, con los numeros del clan
// puestos desde la API. Lo usa la tarea programada del escritorio (que
// publica en Facebook con el Chrome de Cris) y sirve para leer los textos.
//
//   npm run portavoz                 el post de hoy (grupo, url, texto, imagen) en JSON
//   npm run portavoz -- --texto 3    un texto concreto, con los datos de hoy
//   npm run portavoz -- --todos      los siete, para revisarlos
//   npm run portavoz -- --fecha 2026-09-25   el de otro dia
//   npm run portavoz -- --saltar "Nombre"    como si ese grupo ya tuviera post (la Pagina
//                                            aun no esta aprobada ahi, etc.); se puede repetir
//
// Ver src/lib/portavoz-textos.js (los textos y las reglas de Cris) y
// docs/portavoz-facebook.md.

import { getClan } from '../lib/coc.js';
import { datosDe, textoDe, elegirGrupo, imagenDelDia, GRUPOS, TAG } from '../lib/portavoz-textos.js';

const args = process.argv.slice(2);
const valor = (nombre) => {
  const i = args.indexOf(nombre);
  return i >= 0 ? args[i + 1] : null;
};

const fecha = valor('--fecha') ? new Date(`${valor('--fecha')}T12:00:00`) : new Date();
const clan = await getClan(TAG);
const datos = datosDe(clan);

// Sin process.exit(): en Windows, salir a la fuerza justo despues de un
// fetch aborta el proceso con una asercion de libuv (y la tarea programada
// veria un fallo). El bucle de eventos se vacia solo.
if (args.includes('--todos')) {
  console.log(`# x300 hoy: nivel ${datos.nivel}, ${datos.victorias} guerras ganadas, racha ${datos.racha}, ${datos.th18}/${datos.miembros} en TH18, ${datos.liga}\n`);
  for (const g of GRUPOS) console.log(`## Texto ${g.texto} · ${g.nombre} (${g.idioma})\n\n${textoDe(g.texto, datos)}\n`);
} else if (valor('--texto')) {
  console.log(textoDe(Number(valor('--texto')), datos));
} else {
  // Un post al dia y cada grupo una vez por semana, mirando lo que ya se
  // publico (fb_posts). Sin credenciales de Supabase (leyendo los textos
  // en local) va por dia de la semana.
  const { hoy, recientes } = await postsRecientes(fecha);
  for (let i = 0; i < args.length; i += 1) if (args[i] === '--saltar' && args[i + 1]) recientes.push(args[i + 1]);
  const { grupo, motivo } = hoy ? { grupo: null, motivo: `ya hubo post hoy en ${hoy.grupo} (${hoy.estado})` } : elegirGrupo(fecha, recientes);
  if (!grupo) {
    console.log(JSON.stringify({ fecha: fecha.toISOString().slice(0, 10), saltar: true, motivo }, null, 2));
  } else {
    console.log(
      JSON.stringify(
        {
          fecha: fecha.toISOString().slice(0, 10),
          grupo: grupo.nombre,
          url: grupo.url,
          // Donde esta el compositor: 'feed' (la caja "Write something" del
          // grupo) o 'looking_for_players' (pestaña Look for players, boton Try it).
          via: grupo.via ?? 'feed',
          url_post: grupo.via ? `${grupo.url}${grupo.via}/` : grupo.url,
          idioma: grupo.idioma,
          texto_num: grupo.texto,
          imagen: imagenDelDia(fecha),
          motivo,
          datos,
          texto: textoDe(grupo.texto, datos),
        },
        null,
        2
      )
    );
  }
}

/**
 * Lo publicado (publicado, pendiente o rechazado; los fallos no cuentan)
 * en la fecha y en los seis dias anteriores: `hoy` es el post de la fecha
 * si ya lo hay, `recientes` los nombres de los grupos con post esos dias.
 */
async function postsRecientes(fecha) {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return { hoy: null, recientes: [] };
  const { db } = await import('../lib/db.js');
  const desde = new Date(fecha.getTime() - 6 * 86400000).toLocaleDateString('en-CA', { timeZone: 'America/Havana' });
  const hasta = fecha.toLocaleDateString('en-CA', { timeZone: 'America/Havana' });
  const { data, error } = await db.from('fb_posts').select('fecha, grupo, estado').gte('fecha', desde).lte('fecha', hasta);
  if (error) throw new Error(`fb_posts: ${error.message}`);
  const validos = (data ?? []).filter((p) => p.estado !== 'fallo');
  return {
    hoy: validos.find((p) => p.fecha === hasta) ?? null,
    recientes: validos.filter((p) => p.fecha < hasta).map((p) => p.grupo),
  };
}
