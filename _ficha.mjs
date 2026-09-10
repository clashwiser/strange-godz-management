import { pedirPerfil, resumir, banderas, ficha } from './web/lib/aspirante.js';
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// Uno fuerte, uno flojo y uno intermedio, todos reales.
for (const tag of ['#9VLQ0CR99', '#2QC8QJ0PY', '#LJ98CJG9']) {
  const p = await pedirPerfil(tag);
  if (!p) { console.log(tag, '-> sin perfil'); continue; }
  const r = resumir(p);
  console.log('=========================================');
  console.log(ficha(r, esc).replace(/<[^>]+>/g, ''));
}
