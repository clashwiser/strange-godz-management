// El parte de un post de Facebook: VALQUIRIA (la que recluta) les manda
// en privado a los administradores del grupo de Telegram (Cris, Carlos,
// Deibis) la captura del post con el grupo, la hora, el estado y el
// enlace. Si no hubo post, el motivo. Sin captura, va la imagen del post.
//
//   npm run portavoz:reporte -- --grupo "Nombre" --enlace URL --captura ruta.png
//   npm run portavoz:reporte -- --grupo "Nombre" --captura ruta.png --estado pendiente
//   npm run portavoz:reporte -- --grupo "Nombre" --fallo "por qué no salió"

import { readFileSync } from 'node:fs';
import { grupoTelegram } from '../lib/config.js';

const TOKEN = process.env.RECLUTA_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
const args = process.argv.slice(2);
const valor = (nombre) => {
  const i = args.indexOf(nombre);
  return i >= 0 ? args[i + 1] : null;
};
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

async function tg(metodo, cuerpo) {
  const r = await fetch(`https://api.telegram.org/bot${TOKEN}/${metodo}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
    signal: AbortSignal.timeout(15000),
  });
  return r.json();
}

async function lideres() {
  const grupo = await grupoTelegram();
  const r = await tg('getChatAdministrators', { chat_id: grupo });
  return (r.result ?? []).map((m) => m.user).filter((u) => u && !u.is_bot);
}

const hora = new Date().toLocaleString('es', { timeZone: 'America/Havana', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true });
const grupo = valor('--grupo') ?? '?';
const enlace = valor('--enlace');
const captura = valor('--captura');
const fallo = valor('--fallo');

const pendiente = valor('--estado') === 'pendiente';

const texto = fallo
  ? `📣 <b>Facebook · hoy no hubo post</b>\n\nGrupo: <b>${esc(grupo)}</b> · ${hora}\nMotivo: ${esc(fallo)}\n\nLo intento mañana con el grupo que toque.`
  : pendiente
    ? `📣 <b>Facebook · post enviado, pendiente de aprobación</b>\n\nGrupo: <b>${esc(grupo)}</b> · ${hora}\nLos administradores del grupo lo revisan antes de publicarlo; en cuanto salga, apunto el enlace en Reclutamiento.`
    : `📣 <b>Facebook · post publicado</b>\n\nGrupo: <b>${esc(grupo)}</b> · ${hora}` + (enlace ? `\n${esc(enlace)}` : '');

let mandados = 0;
for (const u of await lideres()) {
  let r;
  if (captura && !fallo) {
    const fd = new FormData();
    fd.append('chat_id', String(u.id));
    fd.append('caption', texto);
    fd.append('parse_mode', 'HTML');
    fd.append('photo', new Blob([readFileSync(captura)], { type: /\.jpe?g$/i.test(captura) ? 'image/jpeg' : 'image/png' }), 'post.png');
    r = await fetch(`https://api.telegram.org/bot${TOKEN}/sendPhoto`, { method: 'POST', body: fd, signal: AbortSignal.timeout(30000) }).then((x) => x.json());
  } else {
    r = await tg('sendMessage', { chat_id: u.id, text: texto, parse_mode: 'HTML', link_preview_options: { is_disabled: true } });
  }
  if (r.ok) mandados += 1;
  else console.log(`  ${u.first_name}: ${r.description}`);
}
console.log(`parte mandado a ${mandados} líder(es)`);
