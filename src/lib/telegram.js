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
 * Traduce el formato de WhatsApp al HTML de Telegram.
 *
 * Los mensajes se escriben una sola vez con marcas de WhatsApp (*negrita*,
 * _cursiva_, triple acento grave para monoespaciado) porque el clan vive
 * ahi. Telegram no las entiende y mostraria los asteriscos tal cual.
 *
 * Escapa ANTES de formatear. Al reves, un jugador llamado "<Rey>" hace que
 * Telegram responda 400 "can't parse entities" y el aviso se pierda entero
 * y sin ruido: avisar() traga el error para no tumbar el job. Hoy ningun
 * nombre tiene esos caracteres, pero en Clash la gente se renombra cuando
 * quiere y esto solo se notaria el dia que la alerta hiciera falta.
 */
export function aHtmlTelegram(texto) {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Partir por el delimitador de bloque deja los trozos alternados: los
  // indices pares quedan fuera del bloque y los impares dentro. Dentro no
  // se interpreta negrita ni cursiva, igual que en WhatsApp.
  return texto
    .split('```')
    .map((parte, i) =>
      i % 2 === 1
        ? `<pre>${esc(parte)}</pre>`
        : esc(parte)
            .replace(/\*([^*\n]+)\*/g, '<b>$1</b>')
            .replace(/_([^_\n]+)_/g, '<i>$1</i>')
    )
    .join('');
}

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
        text: aHtmlTelegram(texto),
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
