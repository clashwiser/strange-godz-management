// Leer una imagen con la IA: una captura del juego, y sacar de ella datos.
//
// Groq gratis tenia dos modelos que ven imagenes; desde octubre 2026 queda
// uno, qwen/qwen3.8-27b (ver MODELOS_VISION): OCR y preguntas sobre la
// imagen, hasta 3 imagenes de 20 MB por llamada, y cada imagen cuesta
// 2.048 tokens de entrada. En el plan Free van a 30 llamadas por minuto,
// 1.000 al dia, 8.000 tokens de entrada por minuto y 1.000 de SALIDA por
// minuto y modelo, descontando max_tokens entero al pedir. Con un solo
// modelo caben unas dos lecturas de captura por minuto: la segunda lectura
// de un castillo puede chocar con el limite, y entonces espera lo que pide
// Groq ("try again in 8.4s") si le da tiempo a la funcion.
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

/**
 * Por orden de preferencia; si el primero no existe para la llave, el siguiente.
 *
 * Hoy es UNO. qwen/qwen3.6-27b lo retiro Groq: el 16 oct 2026 respondia
 * 404 y la "segunda opinion con el otro modelo" llevaba dias llamando a un
 * modelo que no existia. El otro con vision que lista Groq
 * (meta-models/muse-spark-open) esta en vista previa con acceso a pedir,
 * razona siempre sin poder apagarlo y no admite reasoning_effort 'none':
 * no sirve aqui. Si Groq abre otro, va detras del primero.
 */
export const MODELOS_VISION = ['qwen/qwen3.8-27b'];
const descartados = new Set();

export const visionConfigurada = Boolean(LLAVE && URL_BASE);

const diaCuba = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Havana' });

/**
 * Cuenta la llamada del dia y devuelve el total (ia_contar sube y devuelve
 * en una sola operacion). El API de Supabase falla a ratos con un 504
 * pasajero (13 sep 2026: una captura de /fc salio con "no puedo leer la
 * captura" sin que la IA llegara a verla): se reintenta una vez y, si
 * sigue caido, la llamada pasa sin contarse -Groq tiene su propio tope
 * y un bot mudo es peor- y queda dicho en el log. -1 si no se pudo contar.
 */
export async function contarLlamada(admin) {
  let r = await admin.rpc('ia_contar', { p_dia: diaCuba() });
  if (r?.error) {
    await new Promise((x) => setTimeout(x, 400));
    r = await admin.rpc('ia_contar', { p_dia: diaCuba() });
  }
  if (r?.error) {
    console.error(`[ia] ia_contar falló dos veces (${r.error.message}); sigo sin contar`);
    return -1;
  }
  return Number(r?.data) || 0;
}

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
 * @param {{ base64:string, mime?:string, instrucciones:string, max_tokens?:number, timeout?:number, modelos?:string[], rastro?:string[] }} p
 *   modelos: el orden de preferencia, si se quiere otro (la segunda
 *   lectura de Valquiria pide el modelo que NO uso Heraldo).
 *   rastro: si se pasa un array, se le apunta por qué falló cada intento
 *   ("qwen3.6: sin JSON (cortado)"). Va a la nota del castillo: los logs de
 *   Vercel no siempre están a mano, y sin esto un "no leyó" no dice nada.
 *   esperaMax: lo más que se espera tras un 429 (ms). 12 s por defecto;
 *   más solo si la función que llama tiene tiempo de sobra.
 */
export async function leerImagen(admin, { base64, mime = 'image/jpeg', instrucciones, max_tokens = 400, timeout = 15000, modelos = MODELOS_VISION, rastro = null, esperaMax = 12000 }) {
  const apunta = (s) => {
    if (Array.isArray(rastro)) rastro.push(s);
  };
  if (!visionConfigurada || !base64 || !instrucciones) {
    console.error(`[vision] sin leer: ${!visionConfigurada ? 'falta IA_LLAVE o IA_URL' : !base64 ? 'sin imagen' : 'sin instrucciones'}`);
    return null;
  }
  if (!(await ajusteWeb(admin, 'ia_activa', true))) {
    console.log('[vision] la IA está apagada desde el panel');
    return null;
  }
  const n = await contarLlamada(admin);
  if (n > TOPE_DIA) {
    console.error(`[vision] tope del día alcanzado (${n} > ${TOPE_DIA})`);
    return null;
  }

  const messages = [
    {
      role: 'user',
      content: [
        { type: 'text', text: instrucciones },
        { type: 'image_url', image_url: { url: `data:${mime};base64,${base64}` } },
      ],
    },
  ];

  // El limite que muerde en el plan Free no es el de entrada sino el de
  // SALIDA: 1.000 tokens de salida por minuto y modelo, y Groq descuenta
  // max_tokens entero al pedir, no lo que sale. Por eso max_tokens va
  // justo (el JSON de una captura son 150-250 tokens), y ante un 429 se
  // prueba el otro modelo -tiene su propio cupo- y, si tambien esta a
  // tope, se espera lo que Groq pide ("try again in 8.4s") y se repite,
  // una vez, si cabe en lo que le queda de vida a la funcion.
  const t0 = Date.now();
  const candidatos = (Array.isArray(modelos) && modelos.length ? modelos : MODELOS_VISION).filter((m) => !descartados.has(m));
  const cola = [...candidatos];
  let esperoYa = false;
  while (cola.length) {
    const modelo = cola.shift();
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
        apunta(`${modelo.replace(/^.*\//, '')}: no existe (404)`);
        descartados.add(modelo);
        continue;
      }
      if (r.status === 429) {
        const detalle = (await r.text().catch(() => '')).slice(0, 300);
        console.error(`[vision] ${modelo} respondio 429: ${detalle}`);
        apunta(`${modelo.replace(/^.*\//, '')}: límite (429)`);
        if (cola.length) continue;
        const segundos = Number(/try again in ([\d.]+)s/i.exec(detalle)?.[1] ?? NaN);
        const cabe = Number.isFinite(segundos) && segundos * 1000 <= esperaMax && Date.now() - t0 + segundos * 1000 < esperaMax + 6000;
        if (cabe && !esperoYa) {
          esperoYa = true;
          // Se repite con EL MISMO modelo que dio el 429. Antes se repetia con
          // el primero de la lista, que en la segunda lectura era el modelo
          // retirado (404): la espera no servia de nada.
          console.log(`[vision] espero ${segundos}s y repito con ${modelo}`);
          apunta(`espero ${Math.round(segundos)}s`);
          await new Promise((res) => setTimeout(res, segundos * 1000 + 300));
          cola.push(modelo);
          continue;
        }
        await contarFallo(admin);
        return null;
      }
      if (!r.ok) {
        const detalle = (await r.text().catch(() => '')).slice(0, 300);
        console.error(`[vision] ${modelo} respondio ${r.status}: ${detalle}`);
        apunta(`${modelo.replace(/^.*\//, '')}: error ${r.status}`);
        await contarFallo(admin);
        return null;
      }
      const j = await r.json();
      const texto = String(j?.choices?.[0]?.message?.content ?? '').trim();
      const fin = j?.choices?.[0]?.finish_reason ?? '?';
      // Entero, o casi: es lo que un lider mira cuando una lectura no cuadra.
      console.log(`[vision] ${modelo}: ${texto.slice(0, 1500)}`);
      const json = extraerJson(texto);
      // Todas las lecturas piden un JSON. Una respuesta vacia o sin JSON
      // (cortada por max_tokens, o con una frase en vez del objeto) antes
      // se daba por buena y el otro modelo ni se probaba: el 16 oct 2026 la
      // segunda lectura de los castillos "no leyó" tres veces seguidas con
      // los tres castillos llenos. Ahora pasa al siguiente modelo, si queda.
      if (!json) {
        const motivo = `${modelo.replace(/^.*\//, '')}: ${texto ? 'sin JSON' : 'vacío'}${fin === 'length' ? ' (cortado)' : ''}`;
        console.error(`[vision] ${motivo} (finish_reason: ${fin})`);
        apunta(motivo);
        if (cola.length) continue;
        return texto ? { texto, json: null, modelo } : null;
      }
      return { texto, json, modelo };
    } catch (e) {
      console.error(`[vision] ${modelo} fallo la llamada: ${e?.message ?? e}`);
      apunta(`${modelo.replace(/^.*\//, '')}: ${/abort|timeout/i.test(String(e?.name ?? e?.message ?? '')) ? 'tardó demasiado' : 'falló la llamada'}`);
      // Un timeout (Groq con cola) se reintenta con el otro modelo si queda
      // tiempo de funcion; la primera prueba real se perdio por uno de 20 s.
      const timeout_ = /abort|timeout/i.test(String(e?.name ?? e?.message ?? ''));
      if (timeout_ && cola.length && Date.now() - t0 < 22000) continue;
      await contarFallo(admin);
      return null;
    }
  }
  console.error('[vision] ningun modelo con vision disponible para esta llave');
  return null;
}
