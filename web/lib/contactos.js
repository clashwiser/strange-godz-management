// /contacto: como localizar a los lideres (Telegram y WhatsApp).
//
// La lista vive en config.contactos y se edita desde la pestaña Bots del
// panel: [{ nombre, rol, telegram, tg_id, whatsapp }]. telegram es el
// @usuario si lo tiene; si no, tg_id (el id numerico) sirve para la
// mencion, que en Telegram abre el perfil igual.

/** La lista de contactos de config, o [] si no hay. */
export async function contactosDe(admin) {
  const { data } = await admin.from('config').select('valor').eq('clave', 'contactos').maybeSingle();
  const v = data?.valor;
  return Array.isArray(v) ? v.filter((c) => c && c.nombre) : [];
}

// Un toque y se abre el chat con esa persona: con @usuario, el enlace
// t.me/usuario; sin @usuario, la mencion por id (abre su perfil, y de ahi
// "Mensaje").
const enlaceTelegram = (c, esc) => {
  const usuario = String(c.telegram ?? '').trim().replace(/^@/, '');
  if (usuario && /^[A-Za-z0-9_]{4,}$/.test(usuario)) return `<a href="https://t.me/${esc(usuario)}">@${esc(usuario)}</a>`;
  if (c.tg_id) return `<a href="tg://user?id=${Number(c.tg_id)}">${esc(c.telegram || c.nombre)}</a>`;
  return c.telegram ? esc(c.telegram) : null;
};

const enlaceWhatsapp = (c, esc) => {
  const url = String(c.whatsapp ?? '').trim();
  if (!url) return null;
  const visible = url.replace(/^https?:\/\//, '');
  return `<a href="${esc(url)}">${esc(visible)}</a>`;
};

/** El mensaje de /contacto (HTML de Telegram). */
export function textoContactos(contactos, esc = (s) => s) {
  if (!contactos.length) return 'Los líderes todavía no pusieron sus contactos en el panel (Bots → Contactos de los líderes).';
  const lineas = contactos.map((c) => {
    const tg = enlaceTelegram(c, esc);
    const wa = enlaceWhatsapp(c, esc);
    const partes = [`Telegram: ${tg ?? '—'}`, `WhatsApp: ${wa ?? 'pendiente'}`];
    return `<b>${esc(c.nombre)}</b>${c.rol ? ` · ${esc(c.rol)}` : ''}\n   ${partes.join(' · ')}`;
  });
  return `📇 <b>Contactos de los líderes</b>\n\n${lineas.join('\n\n')}\n\nPara lo del clan escríbele a cualquiera, por aquí o por WhatsApp.`;
}
