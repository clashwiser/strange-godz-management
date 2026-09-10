import { db } from './src/lib/db.js';
import { pedirPerfil, resumir, ficha } from './web/lib/aspirante.js';
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const { data } = await db.from('players').select('player_tag, nombre_actual').in('nombre_actual', ['ZOOM', 'Suly', 'Rela']);
for (const j of data) {
  const p = await pedirPerfil(j.player_tag);
  if (!p) continue;
  console.log('=========================================');
  console.log(ficha(resumir(p), esc).replace(/<[^>]+>/g, ''));
}
