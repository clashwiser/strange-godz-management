// Que hacer con una foto que llega al grupo. Lo usan los dos bots.
//
// La gente no manda "fc" a secas: manda "Heraldo, he estado entrenando con
// fc, revisa mi prueba". Asi que el pie se entiende por lo que dice, no
// por una palabra exacta, y con "prueba" en medio de una frase no se
// entra en el modo de prueba de los administradores (paso el primer dia:
// "revisa mi prueba" devolvio la lectura cruda en vez de los puntos). El
// modo de prueba es SOLO el pie entero "prueba", "prueba fc" o "prueba
// castillo".
//
// Quien contesta: el bot al que le hablan. Si nombran a Valquiria, ella;
// si nombran a Heraldo, o a ninguno, el. Nunca los dos: leer una captura
// gasta cupo de la IA y contestar dos veces es ruido.

import { avisaCastillo, anotarCastillo, recordarMensaje } from './castillos.js';
import { fotoDe, filaParaFoto, verificarCastilloConFoto, leerMapaDePrueba } from './castillo-foto.js';
import { esFotoDeFC, verificarFCConFoto, recordarMensajeReto, leerChatDePrueba } from './retos.js';

const plano = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

/** El pie entero es "prueba", "prueba fc", "Valquiria, prueba castillo"...: modo de prueba. */
export function esPruebaDeLectura(pie) {
  const q = plano(pie)
    .replace(/[¿?.!,:]/g, ' ')
    .replace(/^\s*@?(heraldo|valqui\w*)\s+/, '')
    .replace(/\s+/g, ' ')
    .trim();
  return /^(prueba|lectura|que ves)( de lectura)?( (fc|chat|castillo|mapa|guerra))?$/.test(q);
}

/** A que bot le hablan en el pie: 'valquiria', 'heraldo' o null. Los dos: Heraldo. */
export function botNombrado(pie) {
  const q = plano(pie);
  if (/heraldo/.test(q)) return 'heraldo';
  if (/valqui/.test(q)) return 'valquiria';
  return null;
}

/**
 * El pie trae un comando: /fc, /castillo, /prueba (con o sin @bot detras,
 * que es como los pega Telegram desde el menu). Tambien vale el pie que
 * es SOLO esa palabra ("fc", "castillo", "prueba fc"): corto y sin
 * ambiguedad. Una palabra suelta dentro de una frase, no.
 */
export function comandoDelPie(pie) {
  const q = plano(pie).trim();
  const m = /(?:^|\s)\/(fc|castillo|prueba)(?:@\w+)?\b/.exec(q);
  if (m) return m[1];
  const solo = /^(fc|castillo|prueba)( (fc|chat|castillo|mapa|guerra))?$/.exec(q);
  return solo ? solo[1] : null;
}

/**
 * Si la foto va dirigida a un bot. Solo entonces se mira: con un comando
 * en el pie (/fc, /castillo, /prueba), con el bot nombrado o mencionado
 * (@Strange_godz_heraldo_bot, "Heraldo", @Valqui_bot, "Valquiria"), o
 * contestando a un mensaje de un bot. Una foto suelta con "reto" o
 * "entrenando" en el pie, sin nada de eso, no es para nosotros: la gente
 * habla de FC en el grupo todo el dia y eso no puede disparar al bot.
 */
export function fotoDirigida(pie, { aUnBot = null } = {}) {
  return Boolean(comandoDelPie(pie) || botNombrado(pie) || aUnBot);
}

/**
 * Decide que es la foto por el pie y el contexto, si va dirigida a un bot.
 *
 * @param {string} pie
 * @param {{ aUnBot: number|null }} ctx  id del mensaje del bot al que responde, si responde a uno
 * @returns {'prueba_chat'|'prueba_mapa'|'fc'|'castillo'|'castillo_respuesta'|'duda'|null}
 */
export function modoDeFoto(pie, { aUnBot = null } = {}) {
  if (!fotoDirigida(pie, { aUnBot })) return null;
  const q = plano(pie);
  const comando = comandoDelPie(pie);
  if (comando === 'prueba' || esPruebaDeLectura(pie)) return /fc|chat/.test(q) ? 'prueba_chat' : 'prueba_mapa';
  if (comando === 'castillo' || avisaCastillo(pie) || /castillo/.test(q)) return 'castillo';
  if (comando === 'fc' || esFotoDeFC(pie)) return 'fc';
  if (aUnBot) return 'castillo_respuesta';
  return 'duda';
}

export const TEXTO_DUDA =
  '📷 ¿Qué te reviso? Si es el castillo de guerra, manda la captura del mapa con <code>/castillo</code> en el pie (o "@Heraldo ya doné mi castillo"); ' +
  'si son tus desafíos amistosos, la captura del chat con <code>/fc</code>. Los administradores pueden poner <code>/prueba</code> para ver qué leo.';

/**
 * Atiende la foto y devuelve { texto, despues } o null si no es para
 * nosotros. `despues(idMensaje)` se llama con el id del mensaje que el bot
 * mando, para que un lider pueda contestar ✅/❌ a ese mensaje.
 *
 * @param {object} admin
 * @param {{ token:string, msg:object, quien:{id:number,nombre:string}, esAdmin:() => Promise<boolean>, aUnBot?:number|null }} p
 *   quien.nombre ya escapado; esAdmin se consulta solo en el modo de prueba
 */
export async function atenderFoto(admin, { token, msg, quien, esAdmin, aUnBot = null }) {
  if (!fotoDe(msg)) return null;
  const pie = (msg.caption || '').trim();
  const modo = modoDeFoto(pie, { aUnBot });
  if (!modo) return null;

  switch (modo) {
    case 'prueba_chat':
    case 'prueba_mapa': {
      if (!(await esAdmin())) return { texto: TEXTO_DUDA };
      const texto = modo === 'prueba_chat' ? await leerChatDePrueba(admin, { token, msg }) : await leerMapaDePrueba(admin, { token, msg });
      return { texto };
    }
    case 'fc': {
      const r = await verificarFCConFoto(admin, { token, msg, tgId: quien.id, quien: quien.nombre });
      return { texto: r.texto, despues: r.verificado ? (id) => recordarMensajeReto(admin, r.id, id) : null };
    }
    case 'castillo':
    case 'castillo_respuesta': {
      const fila =
        modo === 'castillo'
          ? ((await anotarCastillo(admin, { tgId: quien.id, nombre: quien.nombre, texto: pie })).fila ?? null)
          : await filaParaFoto(admin, { tgId: quien.id, mensajeBotId: aUnBot });
      if (!fila) return null;
      const r = await verificarCastilloConFoto(admin, { token, msg, fila, quien: quien.nombre });
      // Sin verificar, un lider confirma contestando ✅ al mensaje que sale ahora.
      return { texto: r.texto, despues: r.verificado ? null : (id) => recordarMensaje(admin, fila.id, id) };
    }
    case 'duda':
      return { texto: TEXTO_DUDA };
    default:
      return null;
  }
}
