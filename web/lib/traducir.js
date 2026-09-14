// El boton "🌐 English" en los mensajes de los bots. Al tocarlo, el bot
// traduce ESE mensaje (Telegram manda el texto con el callback) con la IA
// y lo contesta debajo, en respuesta al original; despues quita el boton
// para que no se traduzca dos veces. Lo pidio Cris el 14 sep 2026: entran
// jugadores que no hablan español.
//
// Puro salvo atenderBotonTraducir, que habla con Telegram y con la IA.

export const DATO_TRADUCIR = 'tr:en';
export const BOTON_TRADUCIR = { text: '🌐 English', callback_data: DATO_TRADUCIR };

/** Debajo de esto no vale la pena un boton: un "ok" o un emoji. */
const MINIMO = 40;

/**
 * Las filas de botones de un mensaje con el de traducir al final, si el
 * texto lo merece. `botones` son las filas que ya tenia (o nada).
 */
export function conBotonTraducir(botones, texto) {
  const filas = Array.isArray(botones) ? botones.filter((f) => Array.isArray(f) && f.length) : [];
  const largo = String(texto ?? '').replace(/<[^>]*>/g, '').trim().length;
  if (largo < MINIMO) return filas.length ? filas : null;
  if (filas.some((f) => f.some((b) => b?.callback_data === DATO_TRADUCIR))) return filas;
  return [...filas, [BOTON_TRADUCIR]];
}

/** El reply_markup listo para Telegram, o nada si no hay botones. */
export function markupTraducir(botones, texto) {
  const filas = conBotonTraducir(botones, texto);
  return filas ? { reply_markup: { inline_keyboard: filas } } : {};
}

/** Las filas de un teclado sin el boton de traducir (para editar el original). */
export function sinBotonTraducir(inlineKeyboard) {
  return (inlineKeyboard ?? [])
    .map((f) => f.filter((b) => b?.callback_data !== DATO_TRADUCIR))
    .filter((f) => f.length);
}

/**
 * El toque del boton. `traducir(texto)` devuelve la traduccion o null.
 * Se contesta el callback al momento (que el reloj del boton no se quede
 * dando vueltas), se traduce, y va como respuesta al mensaje original.
 */
export async function atenderBotonTraducir(token, cq, traducir) {
  const tg = (metodo, cuerpo) =>
    fetch(`https://api.telegram.org/bot${token}/${metodo}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
      signal: AbortSignal.timeout(10000),
    })
      .then((r) => r.json())
      .catch(() => ({ ok: false }));
  const msg = cq.message;
  const texto = String(msg?.text ?? msg?.caption ?? '').trim();
  if (!msg || !texto) {
    await tg('answerCallbackQuery', { callback_query_id: cq.id, text: 'Nothing to translate here.' });
    return false;
  }
  await tg('answerCallbackQuery', { callback_query_id: cq.id, text: 'Translating…' });
  const traduccion = await traducir(texto);
  if (!traduccion) {
    await tg('sendMessage', {
      chat_id: msg.chat.id,
      text: "🌐 I can't translate right now. Try again in a minute.",
      reply_parameters: { message_id: msg.message_id },
    });
    return false;
  }
  const r = await tg('sendMessage', {
    chat_id: msg.chat.id,
    text: `🌐 ${traduccion}`,
    reply_parameters: { message_id: msg.message_id },
    link_preview_options: { is_disabled: true },
  });
  if (r.ok) {
    // Ya esta traducido debajo: fuera el boton, que no se traduzca dos veces.
    await tg('editMessageReplyMarkup', {
      chat_id: msg.chat.id,
      message_id: msg.message_id,
      reply_markup: { inline_keyboard: sinBotonTraducir(msg.reply_markup?.inline_keyboard) },
    });
  }
  return Boolean(r.ok);
}
