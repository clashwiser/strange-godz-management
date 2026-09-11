// El latido del cerebro: cada hora mide la salud del sistema y, si cae,
// Heraldo se lo dice a los lideres en privado.
//
// La medida es la misma que la pestaña Cerebro (web/lib/cerebro.js).
// Aqui corre en GitHub Actions, asi que lo que no se puede medir desde
// fuera de Vercel (la version desplegada, la IA si la llave no esta en
// los secretos) pesa cero y no da falsa alarma.
//
// Cuando avisa: al bajar de 70 (y no antes de 6 horas del ultimo aviso
// mientras siga mal), y una vez al recuperarse. Lo ultimo medido queda en
// config.cerebro_estado para no repetirse y para que el panel diga "ultimo
// latido: hace 20 min". A quien: los administradores humanos del grupo
// que alguna vez le dieron a Start a Heraldo (a los demas Telegram no
// deja escribirles).
//
// Correr a mano:  npm run cerebro:latido

import { db, chk, correrJob } from '../lib/db.js';
import { medirSalud } from '../../web/lib/cerebro.js';
import { avisarALideres } from '../../web/lib/bots-salud.js';

const UMBRAL = 70;
const REPETIR_CADA_H = 6;
const SITIO = (process.env.SITIO_URL || 'https://strange-godz-management.vercel.app').replace(/\/$/, '');

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

await correrJob('cerebro-latido', async () => {
  const salud = await medirSalud(db);
  const { data: fila } = await db.from('config').select('valor').eq('clave', 'cerebro_estado').maybeSingle();
  const antes = fila?.valor && typeof fila.valor === 'object' ? fila.valor : null;
  const ahora = new Date().toISOString();

  const mal = salud.nota != null && salud.nota < UMBRAL;
  const estabaMal = antes?.nota != null && antes.nota < UMBRAL;
  const horasDesdeAviso = antes?.avisado_en ? (Date.now() - new Date(antes.avisado_en).getTime()) / 3_600_000 : Infinity;

  const detalle = salud.piezas.filter((p) => p.peso > 0 && !p.ok).map((p) => `• <b>${esc(p.titulo)}</b>: ${esc(p.detalle)}`);
  let avisado_en = antes?.avisado_en ?? null;
  let llegaron = 0;

  if (mal && (!estabaMal || horasDesdeAviso >= REPETIR_CADA_H)) {
    const texto =
      `🧠 <b>Cerebro: salud ${salud.nota}/100</b> (${salud.animo}).\n\n` +
      `Falla:\n${detalle.join('\n')}\n\n` +
      `Míralo en ${SITIO} → Cerebro.`;
    llegaron = await avisarALideres(texto);
    avisado_en = ahora;
  } else if (!mal && estabaMal) {
    llegaron = await avisarALideres(`🧠 <b>Cerebro: de vuelta a ${salud.nota}/100</b>. Lo que fallaba ya responde.`);
    avisado_en = ahora;
  }

  const estado = { nota: salud.nota, hora: ahora, fallan: salud.fallan, avisado_en, version: salud.version ?? antes?.version ?? null };
  chk(await db.from('config').upsert({ clave: 'cerebro_estado', valor: estado, actualizado: ahora }, { onConflict: 'clave' }), 'guardar cerebro_estado');

  console.log(`nota ${salud.nota}/100 (${salud.animo})${salud.fallan.length ? ` · falla: ${salud.fallan.join(', ')}` : ''}${llegaron ? ` · avisados ${llegaron}` : ''}`);
  return { filas: salud.piezas.length, detalle: { nota: salud.nota, fallan: salud.fallan, avisados: llegaron } };
});
