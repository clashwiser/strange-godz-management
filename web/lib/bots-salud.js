// La salud de un bot, preguntada a Telegram: token valido, webhook
// apuntando a donde debe y sin errores, dentro del grupo. Lo usan la
// pestaña Bots (/api/bots), el Cerebro y el latido. Ningun token sale de
// aqui: solo si esta puesto.

const SITIO = (process.env.SITIO_URL || 'https://strange-godz-management.vercel.app').replace(/\/$/, '');
const GRUPO = (process.env.TELEGRAM_CHAT_ID || '')
  .split(',')
  .map((x) => x.trim())
  .find((x) => x.startsWith('-'));

export const BOTS = {
  heraldo: { token: () => process.env.TELEGRAM_BOT_TOKEN, secreto: () => process.env.TELEGRAM_SECRET_TOKEN, ruta: '/api/telegram' },
  recluta: { token: () => process.env.RECLUTA_BOT_TOKEN, secreto: () => process.env.RECLUTA_SECRET_TOKEN, ruta: '/api/recluta' },
};

export const tg = async (token, metodo, cuerpo) => {
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/${metodo}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo ?? {}),
      signal: AbortSignal.timeout(8000),
    });
    return await r.json();
  } catch (e) {
    return { ok: false, description: e.message };
  }
};

export async function saludDelBot(clave) {
  const b = BOTS[clave];
  const token = b.token();
  const base = { clave, ruta: b.ruta, webhookEsperado: `${SITIO}${b.ruta}`, configurado: Boolean(token && b.secreto()) };
  if (!token) return { ...base, error: 'sin token' };

  const [yo, wh, miembro] = await Promise.all([
    tg(token, 'getMe'),
    tg(token, 'getWebhookInfo'),
    GRUPO ? tg(token, 'getChatMember', { chat_id: GRUPO, user_id: Number(token.split(':')[0]) }) : null,
  ]);

  if (!yo.ok) return { ...base, error: `token rechazado: ${yo.description ?? '?'}` };

  const info = wh.result ?? {};
  return {
    ...base,
    usuario: yo.result.username,
    nombre: yo.result.first_name,
    // can_read_all_group_messages = modo privacidad QUITADO.
    oyeTodo: Boolean(yo.result.can_read_all_group_messages),
    webhook: {
      url: info.url || null,
      ok: Boolean(info.url) && info.url === base.webhookEsperado,
      pendientes: info.pending_update_count ?? 0,
      ultimoError: info.last_error_message || null,
      ultimoErrorEn: info.last_error_date ? new Date(info.last_error_date * 1000).toISOString() : null,
    },
    enGrupo: ['member', 'administrator', 'creator'].includes(miembro?.result?.status),
    esAdmin: ['administrator', 'creator'].includes(miembro?.result?.status),
  };
}

/**
 * Los administradores humanos del grupo: a ellos les escribe Heraldo en
 * privado cuando algo falla. Solo llega a los que alguna vez le dieron a
 * Start; a los demas Telegram no deja escribirles, y se ignora.
 */
export async function administradoresDelGrupo(grupo = GRUPO) {
  const token = BOTS.heraldo.token();
  if (!token || !grupo) return [];
  const r = await tg(token, 'getChatAdministrators', { chat_id: grupo });
  return (r.result ?? []).map((m) => m.user).filter((u) => u && !u.is_bot);
}

/**
 * Manda un texto (HTML) en privado a cada administrador. Devuelve a cuantos
 * llego. `grupo` por si el id del env ya no vale (grupo.js).
 */
export async function avisarALideres(texto, { grupo = GRUPO } = {}) {
  const token = BOTS.heraldo.token();
  let llegaron = 0;
  for (const u of await administradoresDelGrupo(grupo)) {
    const r = await tg(token, 'sendMessage', { chat_id: u.id, text: texto, parse_mode: 'HTML', link_preview_options: { is_disabled: true } });
    if (r.ok) llegaron += 1;
  }
  return llegaron;
}
