// El id del grupo de Telegram, con red de seguridad.
//
// Viene de TELEGRAM_CHAT_ID (el negativo de la lista). Pero Telegram cambia
// el id de un grupo cuando lo convierte en supergrupo -paso el 12 sep 2026
// al hacer administrador a alguien: -5541623671 paso a -1004400687855- y
// todo lo que apuntaba al viejo se quedo hablando solo, sin un error a la
// vista. Desde entonces:
//
//   - cuando llega el aviso de migracion, el webhook guarda el id nuevo en
//     config.telegram_grupo_id y avisa a los lideres en privado;
//   - las rutas y los avisos leen de aqui, asi que siguen atendiendo el
//     grupo aunque el env este viejo;
//   - los jobs de GitHub Actions siguen con el secreto TELEGRAM_CHAT_ID:
//     hay que cambiarlo a mano (Vercel y GitHub), y el aviso lo dice.

const ENV = (process.env.TELEGRAM_CHAT_ID || '')
  .split(',')
  .map((x) => x.trim())
  .filter(Boolean);

/** El grupo segun el env (el id negativo de la lista), o null. */
export const GRUPO_ENV = ENV.find((x) => x.startsWith('-')) ?? null;

/** Todos los chats del env (grupo y privados permitidos). */
export const CHATS_ENV = ENV;

const CACHE_MS = 60_000;
let cache = { hasta: 0, valor: null };

/** El id del grupo que vale ahora: el migrado (config) si lo hay, si no el del env. */
export async function grupoActual(admin) {
  if (Date.now() < cache.hasta) return cache.valor ?? GRUPO_ENV;
  let migrado = null;
  try {
    const { data } = await admin.from('config').select('valor').eq('clave', 'telegram_grupo_id').maybeSingle();
    const v = data?.valor;
    migrado = v == null ? null : String(typeof v === 'string' ? v : JSON.stringify(v)).replace(/"/g, '').trim() || null;
  } catch {
    migrado = null;
  }
  cache = { hasta: Date.now() + CACHE_MS, valor: migrado };
  return migrado ?? GRUPO_ENV;
}

/** Los chats permitidos ahora: los del env mas el grupo migrado, si lo hay. */
export async function chatsPermitidos(admin) {
  const grupo = await grupoActual(admin);
  return grupo && !ENV.includes(grupo) ? [...ENV, grupo] : ENV;
}

/**
 * Telegram avisa de la migracion de dos formas: en el chat viejo llega un
 * mensaje de servicio con migrate_to_chat_id, y en el nuevo uno con
 * migrate_from_chat_id. Devuelve { viejo, nuevo } si este mensaje es uno de
 * esos y el viejo era nuestro; si no, null.
 */
export function migracionDe(msg, permitidos) {
  if (!msg) return null;
  const chatId = String(msg.chat?.id ?? '');
  if (msg.migrate_to_chat_id && permitidos.includes(chatId)) return { viejo: chatId, nuevo: String(msg.migrate_to_chat_id) };
  if (msg.migrate_from_chat_id && permitidos.includes(String(msg.migrate_from_chat_id))) {
    return { viejo: String(msg.migrate_from_chat_id), nuevo: chatId };
  }
  return null;
}

/** Guarda el id nuevo del grupo para que las rutas lo atiendan desde ya. */
export async function anotarMigracion(admin, nuevo) {
  await admin.from('config').upsert(
    {
      clave: 'telegram_grupo_id',
      valor: JSON.stringify(String(nuevo)),
      descripcion: 'Id actual del grupo de Telegram (cambio al convertirse en supergrupo). Pon el mismo en TELEGRAM_CHAT_ID.',
      actualizado: new Date().toISOString(),
    },
    { onConflict: 'clave' }
  );
  cache = { hasta: 0, valor: null };
}

/** El aviso para los lideres cuando pasa. */
export const AVISO_MIGRACION = (nuevo) =>
  `⚠️ <b>El grupo cambió de id en Telegram</b> (se convirtió en supergrupo): ahora es <code>${nuevo}</code>.\n\n` +
  `Los bots ya lo atienden, pero los robots de fondo (GitHub Actions) no hasta que se ponga ese valor en ` +
  `<code>TELEGRAM_CHAT_ID</code> en Vercel y en los secretos de GitHub, y se redespliegue.`;
