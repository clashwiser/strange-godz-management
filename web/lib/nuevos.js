// Los botones de "miembro nuevo en el clan" (src/jobs/pulso.js): un lider
// dice si es de casa o de visita. Lo atiende el bot que mando la pregunta
// (Valquiria; Heraldo si a Valquiria le falta el token en GitHub), porque
// Telegram entrega el toque al dueño del mensaje.

import { esAdminDelGrupo } from './solicitud.js';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * "nm:casa:<id>" / "nm:visita:<id>" / "nm:nose:<id>". Solo administradores
 * del grupo. Se anota, se contesta el callback y se editan el mensaje
 * tocado y sus gemelos (grupo y privados) para que nadie conteste dos veces.
 */
export async function atenderBotonNuevo(admin, token, cq) {
  const tg = (metodo, cuerpo) =>
    fetch(`https://api.telegram.org/bot${token}/${metodo}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
      signal: AbortSignal.timeout(8000),
    })
      .then((r) => r.json())
      .catch(() => ({ ok: false }));
  const [, accion, idCrudo] = String(cq.data ?? '').split(':');
  const id = Number(idCrudo);
  if (!(await esAdminDelGrupo(cq.from?.id))) {
    await tg('answerCallbackQuery', { callback_query_id: cq.id, text: 'Eso lo deciden los líderes.' });
    return;
  }
  await tg('answerCallbackQuery', { callback_query_id: cq.id });
  const { data: fila } = await admin.from('miembros_vistos').select('id, nombre, clan_tag, estado, avisos').eq('id', id).maybeSingle();
  if (!fila) return;
  const quien = esc(cq.from.first_name || cq.from.username || 'un líder');
  const nombre = esc(fila.nombre ?? '?');
  const decidido = { decidido_por: cq.from.first_name ?? String(cq.from.id), decidido_en: new Date().toISOString() };
  let texto;
  if (accion === 'casa') {
    await admin.from('miembros_vistos').update({ estado: 'de_casa', ...decidido }).eq('id', id);
    texto = `🏠 <b>${nombre}</b> es de casa — lo dijo ${quien}. Cuando entre al grupo, preséntenlo con <code>/asignar</code> y listo.`;
  } else if (accion === 'visita') {
    await admin.from('miembros_vistos').update({ estado: 'visita', ...decidido }).eq('id', id);
    texto = `👀 <b>${nombre}</b> es solo un visitante — lo dijo ${quien}. No pregunto más por él.`;
  } else {
    texto = `❓ ${quien} todavía no sabe qué es <b>${nombre}</b>. Sigo esperando; en un rato recuerdo.`;
  }
  const avisos = Array.isArray(fila.avisos) ? fila.avisos : [];
  const propio = { chat_id: cq.message?.chat?.id, message_id: cq.message?.message_id };
  const todos = [propio, ...avisos.filter((a) => !(String(a.chat_id) === String(propio.chat_id) && a.message_id === propio.message_id))];
  for (const a of todos) {
    if (!a.chat_id || !a.message_id) continue;
    await tg('editMessageText', {
      chat_id: a.chat_id,
      message_id: a.message_id,
      text: texto,
      parse_mode: 'HTML',
      reply_markup: accion === 'nose' ? (cq.message?.reply_markup ?? { inline_keyboard: [] }) : { inline_keyboard: [] },
    });
  }
}
