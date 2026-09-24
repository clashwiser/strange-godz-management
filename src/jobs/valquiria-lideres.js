// Valquiria les manda un texto en privado a los lideres (los administradores
// del grupo de Telegram: Cris, Carlos, Deivis). Para los avisos de
// reclutamiento que no salen de la tarea diaria: novedades, cambios, etc.
//
//   npm run valquiria:lideres -- --archivo docs/aviso.md
//   npm run valquiria:lideres -- --texto "Buenas, ..."
//
// El texto va en HTML de Telegram (<b>, <i>, <a>); las & < > sueltas hay
// que escaparlas a mano en el archivo.

import { readFileSync } from 'node:fs';
import { grupoTelegram } from '../lib/config.js';

const TOKEN = process.env.RECLUTA_BOT_TOKEN;
if (!TOKEN) throw new Error('Falta RECLUTA_BOT_TOKEN (Valquiria)');
const args = process.argv.slice(2);
const valor = (nombre) => {
  const i = args.indexOf(nombre);
  return i >= 0 ? args[i + 1] : null;
};
const texto = valor('--archivo') ? readFileSync(valor('--archivo'), 'utf8').trim() : valor('--texto');
if (!texto) throw new Error('falta --archivo o --texto');

async function tg(metodo, cuerpo) {
  const r = await fetch(`https://api.telegram.org/bot${TOKEN}/${metodo}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
    signal: AbortSignal.timeout(15000),
  });
  return r.json();
}

const grupo = await grupoTelegram();
const admins = ((await tg('getChatAdministrators', { chat_id: grupo })).result ?? []).map((m) => m.user).filter((u) => u && !u.is_bot);
let mandados = 0;
for (const u of admins) {
  const r = await tg('sendMessage', { chat_id: u.id, text: texto, parse_mode: 'HTML', link_preview_options: { is_disabled: true } });
  if (r.ok) mandados += 1;
  else console.log(`  ${u.first_name}: ${r.description}`);
}
console.log(`Valquiria se lo mandó a ${mandados} líder(es)`);
