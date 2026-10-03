// El idioma de cada quien, para lo que el bot le contesta EN PRIVADO.
//
// Por qué solo en privado: los botones de un mensaje de grupo son los
// mismos para todo el mundo (Telegram no los personaliza), y traducir
// cada mensaje del grupo a tres idiomas sería ruido y gasto de IA. En el
// grupo están los botones de traducir; en privado, el bot habla directo
// en el idioma de cada uno.
//
// Lo pidió Cris el 3 oct 2026, cuando entró Queen desde Filipinas.

/** Los idiomas que se pueden elegir. La clave es lo que se guarda. */
export const IDIOMAS = {
  es: { etiqueta: '🇪🇸 Español', nombre: 'Spanish', confirma: 'Listo. Te hablo en español por privado.' },
  en: { etiqueta: '🇬🇧 English', nombre: 'English', confirma: "Done. I'll write to you in English in private chat." },
  fil: { etiqueta: '🇵🇭 Filipino', nombre: 'Filipino (Tagalog)', confirma: 'Tapos na. Kakausapin kita sa Filipino sa private chat.' },
};

export const DATO_IDIOMA = 'idi:';
export const botonesIdioma = () => ({
  inline_keyboard: [Object.entries(IDIOMAS).map(([codigo, x]) => ({ text: x.etiqueta, callback_data: `${DATO_IDIOMA}${codigo}` }))],
});

export const TEXTO_IDIOMA =
  '🌐 <b>¿En qué idioma te hablo?</b>\n' +
  'Elige y te contesto en ese idioma cuando me escribas por privado. En el grupo siguen los botones de traducir.\n\n' +
  '🌐 <i>Pick your language and I will reply in it when you write to me in private. In the group, use the translate buttons.</i>';

/** El código que pide un callback "idi:xx", o null. */
export function idiomaDelDato(dato) {
  const m = new RegExp(`^${DATO_IDIOMA}([a-z-]+)$`, 'i').exec(String(dato ?? ''));
  const codigo = m?.[1]?.toLowerCase();
  return codigo && IDIOMAS[codigo] ? codigo : null;
}

/** Lo que eligió alguien, o 'es' si no eligió nada. */
export async function idiomaDe(admin, tgId) {
  if (!tgId) return 'es';
  const { data } = await admin.from('tg_usuarios').select('idioma').eq('tg_user_id', tgId).maybeSingle();
  const codigo = data?.idioma;
  return codigo && IDIOMAS[codigo] ? codigo : 'es';
}

/** Guarda la elección. Devuelve el texto de confirmación. */
export async function guardarIdioma(admin, tgId, codigo) {
  if (!IDIOMAS[codigo]) return null;
  const { error } = await admin.from('tg_usuarios').upsert({ tg_user_id: tgId, idioma: codigo }, { onConflict: 'tg_user_id' });
  if (error) {
    console.error(`[idioma] ${error.message}`);
    return null;
  }
  return IDIOMAS[codigo].confirma;
}

/**
 * Traduce lo que el bot va a contestar, si quien pregunta no quiere
 * español. `traducir(texto, idioma)` devuelve la traducción o null; si
 * falla, se manda en español antes que no mandar nada.
 */
export async function enSuIdioma(texto, codigo, traducir) {
  if (!codigo || codigo === 'es' || !IDIOMAS[codigo] || !String(texto ?? '').trim()) return texto;
  const t = await traducir(String(texto), IDIOMAS[codigo].nombre);
  return t || texto;
}
