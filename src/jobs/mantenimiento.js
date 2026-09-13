// El cartel de "en mantenimiento": Heraldo manda al grupo la foto del
// taller (web/public/taller.jpg) con un aviso de que Cris esta arreglando
// los bots, para que nadie se extrañe de los mensajes de prueba ni de que
// un comando conteste raro mientras tanto.
//
//   npm run mantenimiento             la foto y el aviso
//   npm run mantenimiento -- --seco   solo imprime el texto, no manda nada
//
// Va ANTES de tocar el codigo de Heraldo o Valquiria (no el panel). Al
// terminar, el anuncio de lo que cambio lo manda Heraldo con el texto de
// ese dia (src/jobs/anuncio.js). Lo pidio Cris el 13 sep 2026: "la gente
// del grupo no sabe lo que esta pasando".

import { readFileSync } from 'node:fs';
import { grupoTelegram } from '../lib/config.js';

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const SECO = process.argv.includes('--seco');

// A lo que se va Valquiria mientras tanto: una cada vez, para que el
// aviso no sea siempre el mismo.
const VALQUIRIA_SE_VA = [
  'a interrogar a la tostadora, que todavía no ha aceptado las normas',
  'a afilar el hacha con el cuervo de supervisor',
  'a pedirle el tag del jugador a las gallinas del pueblo',
  'a practicar la cara de mala delante del espejo',
  'a enseñarle al cuervo a decir «acepto las normas»',
  'a hacerle la entrevista de ingreso al gato del vecino',
];

const escoger = (lista) => lista[Math.floor(Math.random() * lista.length)];

export function textoMantenimiento(valquiria = escoger(VALQUIRIA_SE_VA)) {
  return (
    `🔧 <b>Estamos en mantenimiento.</b>\n\n` +
    `Cris nos tiene en el taller arreglándonos un par de cosas. Si ven mensajes de prueba o un comando contesta raro, es eso: no le hagan caso.\n\n` +
    `Cuando termine, vuelvo con la lista de lo que cambió. Gracias por esperar. 📜\n\n` +
    `Mientras tanto, yo me voy a tomar una siesta 😴 y Valquiria ${valquiria}.`
  );
}

async function mandar() {
  const texto = textoMantenimiento();
  if (SECO) {
    console.log(texto);
    return;
  }
  if (!TOKEN) throw new Error('falta TELEGRAM_BOT_TOKEN');
  const grupo = await grupoTelegram();
  if (!grupo) throw new Error('no sé cuál es el grupo (config.telegram_grupo_id o TELEGRAM_CHAT_ID)');
  const foto = readFileSync(new URL('../../web/public/taller.jpg', import.meta.url));
  const cuerpo = new FormData();
  cuerpo.append('chat_id', String(grupo));
  cuerpo.append('caption', texto);
  cuerpo.append('parse_mode', 'HTML');
  cuerpo.append('photo', new Blob([foto], { type: 'image/jpeg' }), 'taller.jpg');
  const r = await fetch(`https://api.telegram.org/bot${TOKEN}/sendPhoto`, { method: 'POST', body: cuerpo, signal: AbortSignal.timeout(30000) }).then((x) => x.json());
  if (!r.ok) throw new Error(`Telegram: ${r.description}`);
  console.log(`cartel de mantenimiento mandado al grupo ${grupo} (mensaje ${r.result.message_id})`);
}

if (process.argv[1] && /mantenimiento\.js$/.test(process.argv[1])) {
  mandar().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
