// Los botones de traducir en los mensajes de los bots. Al tocar uno, el
// bot traduce ESE mensaje (Telegram manda el texto con el callback) con la
// IA y lo contesta debajo, en respuesta al original; despues quita ese
// boton para que no se traduzca dos veces. Lo pidio Cris el 14 sep 2026:
// entran jugadores que no hablan español. El 3 oct 2026 entro Queen, de
// Filipinas, y se añadio el segundo boton.
//
// Los botones de un mensaje son los mismos para todo el mundo (Telegram no
// los personaliza por usuario), asi que van los dos. Para el idioma propio
// de cada uno esta /idioma, que afecta a lo que el bot le contesta en
// privado.
//
// Puro salvo atenderBotonTraducir, que habla con Telegram y con la IA.

/** Los idiomas con boton: codigo del callback -> como pedirselo a la IA. */
export const IDIOMAS_BOTON = {
  en: { etiqueta: '🌐 English', nombre: 'English' },
  fil: { etiqueta: '🇵🇭 Filipino', nombre: 'Filipino (Tagalog)' },
};

export const DATO_TRADUCIR = 'tr:en';
export const BOTON_TRADUCIR = { text: IDIOMAS_BOTON.en.etiqueta, callback_data: DATO_TRADUCIR };
export const BOTONES_TRADUCIR = Object.entries(IDIOMAS_BOTON).map(([codigo, x]) => ({ text: x.etiqueta, callback_data: `tr:${codigo}` }));

/** El idioma que pide un callback "tr:xx", o null si no es de traducir. */
export function idiomaDelDato(dato) {
  const m = /^tr:([a-z-]+)$/i.exec(String(dato ?? ''));
  if (!m) return null;
  return IDIOMAS_BOTON[m[1].toLowerCase()]?.nombre ?? 'English';
}

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
  if (filas.some((f) => f.some((b) => esDeTraducir(b)))) return filas;
  return [...filas, BOTONES_TRADUCIR];
}

/** Si un boton es de los de traducir (de cualquier idioma). */
export const esDeTraducir = (b) => /^tr:/.test(String(b?.callback_data ?? ''));

/** El reply_markup listo para Telegram, o nada si no hay botones. */
export function markupTraducir(botones, texto) {
  const filas = conBotonTraducir(botones, texto);
  return filas ? { reply_markup: { inline_keyboard: filas } } : {};
}

/** Las filas de un teclado sin el boton de traducir (para editar el original). */
/**
 * Las filas sin UN boton de traducir (el que se acaba de usar). Los de los
 * otros idiomas se quedan: alguien mas puede querer el suyo.
 */
export function sinBotonTraducir(inlineKeyboard, dato = DATO_TRADUCIR) {
  return (inlineKeyboard ?? [])
    .map((f) => f.filter((b) => b?.callback_data !== dato))
    .filter((f) => f.length);
}

/**
 * El toque del boton. `traducir(texto)` devuelve la traduccion o null.
 * Se contesta el callback al momento (que el reloj del boton no se quede
 * dando vueltas), se traduce, y va como respuesta al mensaje original.
 */
export async function atenderBotonTraducir(token, cq, traducir) {
  const idioma = idiomaDelDato(cq?.data) ?? 'English';
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
  await tg('answerCallbackQuery', { callback_query_id: cq.id, text: `Translating to ${idioma}…` });
  const traduccion = await traducir(texto, idioma);
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
      reply_markup: { inline_keyboard: sinBotonTraducir(msg.reply_markup?.inline_keyboard, cq.data) },
    });
  }
  return Boolean(r.ok);
}
