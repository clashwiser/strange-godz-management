// Leer una imagen con la IA: una captura del juego, y sacar de ella datos.
//
// Groq gratis tiene dos modelos que ven imagenes, qwen/qwen3.8-27b y
// qwen/qwen3.6-27b (console.groq.com/docs/vision, sep 2026): OCR y
// preguntas sobre la imagen, hasta 3 imagenes de 20 MB por llamada, y cada
// imagen cuesta 2.048 tokens de entrada. En el plan Free van a 30 llamadas
// por minuto, 1.000 al dia y 8.000 tokens por minuto: con una imagen y un
// prompt corto caben dos o tres lecturas por minuto, que para un grupo de
// sesenta es de sobra.
//
// La imagen va en base64 dentro de la peticion, no como URL: la URL de un
// archivo de Telegram lleva el token del bot, y mandarsela a un tercero
// para que la descargue es regalarle el token.
//
// Usa la misma llave y la misma cuota diaria (ia_contar) que pensar.js.

import { ajusteWeb } from './entrenamiento.js';

const LLAVE = process.env.IA_LLAVE;
const URL_BASE = (process.env.IA_URL || '').replace(/\/$/, '');
const TOPE_DIA = Number(process.env.IA_TOPE_DIA) || 300;

/** Por orden de preferencia; si el primero no existe para la llave, el siguiente. */
export const MODELOS_VISION = ['qwen/qwen3.8-27b', 'qwen/qwen3.6-27b'];
const descartados = new Set();

export const visionConfigurada = Boolean(LLAVE && URL_BASE);

const diaCuba = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Havana' });

// Un fallo no cuenta como llamada (migracion 023). El builder de Supabase
// tiene then pero no catch: se espera dentro de un try.
async function contarFallo(admin) {
  try {
    await admin.rpc('ia_contar', { p_dia: diaCuba(), p_fallo: true });
  } catch {
    /* informativo */
  }
}

/**
 * Saca el primer objeto JSON de lo que contesto el modelo. Se le pide JSON
 * a secas, pero a veces lo envuelve en ```json o le pone una frase
 * delante; con esto da igual.
 */
export function extraerJson(texto) {
  const s = String(texto ?? '');
  const a = s.indexOf('{');
  const b = s.lastIndexOf('}');
  if (a < 0 || b <= a) return null;
  try {
    return JSON.parse(s.slice(a, b + 1));
  } catch {
    return null;
  }
}

/**
 * Le enseña una imagen al modelo con unas instrucciones y devuelve lo que
 * contesto: { texto, json } (json es null si no devolvio un objeto). Null
 * si no hay llave, la IA esta apagada, se paso el tope del dia o fallo.
 *
 * @param {object} admin   Supabase con service_role (para el tope)
 * @param {{ base64:string, mime?:string, instrucciones:string, max_tokens?:number, timeout?:number }} p
 */
export async function leerImagen(admin, { base64, mime = 'image/jpeg', instrucciones, max_tokens = 700, timeout = 20000 }) {
  if (!visionConfigurada || !base64 || !instrucciones) return null;
  if (!(await ajusteWeb(admin, 'ia_activa', true))) return null;

  const { data: n, error } = await admin.rpc('ia_contar', { p_dia: diaCuba() });
  if (error || Number(n) > TOPE_DIA) return null;

  const messages = [
    {
      role: 'user',
      content: [
        { type: 'text', text: instrucciones },
        { type: 'image_url', image_url: { url: `data:${mime};base64,${base64}` } },
      ],
    },
  ];

  for (const modelo of MODELOS_VISION) {
    if (descartados.has(modelo)) continue;
    try {
      const r = await fetch(`${URL_BASE}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${LLAVE}` },
        body: JSON.stringify({
          model: modelo,
          messages,
          // Leer numeros de una pantalla no es crear: lo mas frio posible,
          // y sin razonar, que en estos modelos gasta tokens de salida.
          temperature: 0.1,
          max_tokens,
          reasoning_effort: 'none',
        }),
        signal: AbortSignal.timeout(timeout),
      });
      if (r.status === 404) {
        console.error(`[vision] ${modelo} no existe para esta llave; se descarta`);
        descartados.add(modelo);
        continue;
      }
      if (!r.ok) {
        const detalle = (await r.text().catch(() => '')).slice(0, 300);
        console.error(`[vision] ${modelo} respondio ${r.status}: ${detalle}`);
        await contarFallo(admin);
        return null;
      }
      const j = await r.json();
      const texto = String(j?.choices?.[0]?.message?.content ?? '').trim();
      console.log(`[vision] ${modelo}: ${texto.slice(0, 400)}`);
      if (!texto) return null;
      return { texto, json: extraerJson(texto), modelo };
    } catch (e) {
      console.error(`[vision] ${modelo} fallo la llamada: ${e?.message ?? e}`);
      await contarFallo(admin);
      return null;
    }
  }
  console.error('[vision] ningun modelo con vision disponible para esta llave');
  return null;
}
