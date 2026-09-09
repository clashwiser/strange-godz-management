// Envio a WhatsApp con Baileys, sin servidor encendido 24/7.
//
// La clave es guardar la sesion en Supabase en vez de en archivos: asi el bot
// vive dentro de un job efimero de GitHub Actions (conecta, manda, guarda,
// desconecta) y no hace falta ninguna PC prendida.
//
// AVISO: Baileys no es oficial. Usar SIEMPRE un numero secundario, nunca el
// personal. Si WhatsApp lo banea se pierde el bot, no tu cuenta.

import makeWASocket, {
  initAuthCreds,
  BufferJSON,
  proto,
  DisconnectReason,
  makeCacheableSignalKeyStore,
} from '@whiskeysockets/baileys';
import { db, chk } from './db.js';

const ser = (v) => JSON.parse(JSON.stringify(v, BufferJSON.replacer));
const des = (v) => JSON.parse(JSON.stringify(v), BufferJSON.reviver);

/**
 * Implementa la interfaz de auth de Baileys contra la tabla wa_auth.
 * Es el equivalente de useMultiFileAuthState pero en Postgres, que es lo
 * que la propia documentacion recomienda para produccion.
 */
export async function useSupabaseAuthState() {
  const leer = async (clave) => {
    const { data, error } = await db.from('wa_auth').select('valor').eq('clave', clave).maybeSingle();
    if (error) throw new Error(`wa_auth leer ${clave}: ${error.message}`);
    return data ? des(data.valor) : null;
  };

  const escribir = async (clave, valor) => {
    chk(
      await db.from('wa_auth').upsert(
        { clave, valor: ser(valor), actualizado: new Date().toISOString() },
        { onConflict: 'clave' }
      ),
      `wa_auth escribir ${clave}`
    );
  };

  const borrar = async (clave) => {
    chk(await db.from('wa_auth').delete().eq('clave', clave), `wa_auth borrar ${clave}`);
  };

  const creds = (await leer('creds')) || initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: async (tipo, ids) => {
          const salida = {};
          await Promise.all(
            ids.map(async (id) => {
              let valor = await leer(`${tipo}-${id}`);
              // Las llaves de app-state hay que rehidratarlas al tipo protobuf
              // o Baileys las rechaza en silencio.
              if (tipo === 'app-state-sync-key' && valor) {
                valor = proto.Message.AppStateSyncKeyData.fromObject(valor);
              }
              if (valor) salida[id] = valor;
            })
          );
          return salida;
        },
        set: async (data) => {
          // Guardar TODA llave que Baileys pida guardar. Si se omite una,
          // los mensajes fallan sin error visible.
          const tareas = [];
          for (const tipo in data) {
            for (const id in data[tipo]) {
              const valor = data[tipo][id];
              const clave = `${tipo}-${id}`;
              tareas.push(valor ? escribir(clave, valor) : borrar(clave));
            }
          }
          await Promise.all(tareas);
        },
      },
    },
    saveCreds: () => escribir('creds', creds),
  };
}

/**
 * Abre la conexion y espera a que quede lista.
 * onQR recibe el string del QR cuando hace falta vincular por primera vez.
 */
export async function conectar({ onQR, timeoutMs = 60000 } = {}) {
  const { state, saveCreds } = await useSupabaseAuthState();

  const sock = makeWASocket({
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys),
    },
    browser: ['x300 bot', 'Chrome', '1.0.0'],
    syncFullHistory: false,
    markOnlineOnConnect: false, // no aparecer "en linea": es un bot, no una persona
  });

  sock.ev.on('creds.update', saveCreds);

  await new Promise((resolve, reject) => {
    const reloj = setTimeout(() => reject(new Error('timeout conectando a WhatsApp')), timeoutMs);

    sock.ev.on('connection.update', (u) => {
      const { connection, lastDisconnect, qr } = u;

      if (qr && onQR) onQR(qr);

      if (connection === 'open') {
        clearTimeout(reloj);
        resolve();
      }

      if (connection === 'close') {
        const codigo = lastDisconnect?.error?.output?.statusCode;
        clearTimeout(reloj);
        if (codigo === DisconnectReason.loggedOut) {
          reject(new Error('SESION CERRADA: hay que re-vincular con npm run wa:vincular'));
        } else {
          reject(new Error(`conexion cerrada (codigo ${codigo ?? 'desconocido'})`));
        }
      }
    });
  });

  return sock;
}

/** Cierra la conexion sin cerrar la sesion (logout borraria las credenciales). */
export async function desconectar(sock) {
  try {
    sock.ws?.close();
  } catch {
    /* da igual, el job termina igual */
  }
}

/** Deja constancia del estado para que el website lo muestre. */
export async function marcarEstado(campos) {
  await db
    .from('wa_estado')
    .update({ ...campos, actualizado: new Date().toISOString() })
    .eq('id', 1);
}
