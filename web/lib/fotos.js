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

/** El pie entero es "prueba", "prueba fc", "prueba castillo"...: modo de prueba. */
export function esPruebaDeLectura(pie) {
  return /^(prueba|lectura|que ves)( de lectura)?( (fc|chat|castillo|mapa|guerra))?$/.test(plano(pie).replace(/[¿?.!]/g, '').trim());
}

/** A que bot le hablan en el pie: 'valquiria', 'heraldo' o null. Los dos: Heraldo. */
export function botNombrado(pie) {
  const q = plano(pie);
  if (/heraldo/.test(q)) return 'heraldo';
  if (/valqui/.test(q)) return 'valquiria';
  return null;
}

/**
 * Decide que es la foto por el pie y el contexto.
 *
 * @param {string} pie
 * @param {{ aUnBot: number|null }} ctx  id del mensaje del bot al que responde, si responde a uno
 * @returns {'prueba_chat'|'prueba_mapa'|'fc'|'castillo'|'castillo_respuesta'|'duda'|null}
 */
export function modoDeFoto(pie, { aUnBot = null } = {}) {
  const q = plano(pie);
  if (esPruebaDeLectura(pie)) return /fc|chat/.test(q) ? 'prueba_chat' : 'prueba_mapa';
  if (avisaCastillo(pie) || (botNombrado(pie) && /castillo/.test(q))) return 'castillo';
  if (esFotoDeFC(pie)) return 'fc';
  if (aUnBot) return 'castillo_respuesta';
  if (botNombrado(pie)) return 'duda';
  return null;
}

export const TEXTO_DUDA =
  '📷 ¿Qué te reviso? Si es el castillo de guerra, manda la captura con "ya doné mi castillo" en el pie; ' +
  'si son tus desafíos amistosos, con "fc" (o "amistosos", "entrenando"). Los administradores pueden poner solo "prueba" para ver qué leo.';

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
