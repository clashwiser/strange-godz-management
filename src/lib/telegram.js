// Notificaciones por Telegram. Gratis, sin limites relevantes, soporta
// grupos y no depende de ninguna PC encendida.
//
// Setup: hablarle a @BotFather -> /newbot -> guarda el token.
// Crear un grupo con los 3 lideres, meter al bot, y sacar el chat_id con:
//   https://api.telegram.org/bot<TOKEN>/getUpdates

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

export const telegramConfigurado = Boolean(TOKEN && CHAT_ID);

/**
 * Manda un mensaje. Si Telegram no esta configurado, lo escribe en el log
 * y sigue: nunca debe tumbar un job de ingesta por un fallo de aviso.
 */
export async function avisar(texto, { silencioso = false } = {}) {
  if (!telegramConfigurado) {
    console.log('[telegram] no configurado, mensaje no enviado:\n' + texto);
    return false;
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: texto,
        parse_mode: 'HTML',
        disable_notification: silencioso,
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      console.error('[telegram] error', res.status, await res.text().catch(() => ''));
      return false;
    }
    return true;
  } catch (err) {
    console.error('[telegram] fallo el envio:', err);
    return false;
  }
}
