// Un anuncio de Heraldo al grupo, con el texto (HTML de Telegram) de un
// archivo. Es lo que cierra un mantenimiento: la lista de lo que cambio.
//
//   npm run anuncio -- anuncio.html          manda el archivo
//   npm run anuncio -- anuncio.html --seco   solo lo imprime
//
// El archivo no va al repo (es de ese dia); se escribe donde sea y se
// pasa la ruta. Antes esto era un script suelto por anuncio.

import { readFileSync } from 'node:fs';
import { grupoTelegram } from '../lib/config.js';

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const args = process.argv.slice(2);
const SECO = args.includes('--seco');
const ruta = args.find((a) => !a.startsWith('--'));

async function mandar() {
  if (!ruta) throw new Error('uso: npm run anuncio -- <archivo.html> [--seco]');
  const texto = readFileSync(ruta, 'utf8').trim();
  if (!texto) throw new Error('el archivo está vacío');
  if (SECO) {
    console.log(texto);
    return;
  }
  if (!TOKEN) throw new Error('falta TELEGRAM_BOT_TOKEN');
  const grupo = await grupoTelegram();
  if (!grupo) throw new Error('no sé cuál es el grupo (config.telegram_grupo_id o TELEGRAM_CHAT_ID)');
  const r = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: Number(grupo), text: texto, parse_mode: 'HTML', link_preview_options: { is_disabled: true } }),
    signal: AbortSignal.timeout(20000),
  }).then((x) => x.json());
  if (!r.ok) throw new Error(`Telegram: ${r.description}`);
  console.log(`anuncio mandado al grupo ${grupo} (mensaje ${r.result.message_id})`);
}

mandar().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
