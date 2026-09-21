// La memoria del portavoz de Facebook: lo que la tarea diaria ve en el
// navegador se apunta aqui, en la base, para la pestaña Reclutamiento del
// panel y para los avisos por Telegram. Lo llama la tarea programada.
//
//   npm run portavoz:anotar -- post --grupo "Nombre" --url URL --estado publicado|pendiente|fallo --texto 2 --imagen vertical [--nota "..."]
//       Apunta el post de hoy (o lo actualiza si ya hay uno de hoy en ese grupo). Imprime su id.
//   npm run portavoz:anotar -- medir --id 12 --reacciones 5 --comentarios 2 --compartidos 1 [--url URL] [--estado publicado]
//       Guarda el engagement medido.
//   npm run portavoz:anotar -- buzon --remitente "Nombre" --texto "..." [--hora "2026-09-22T14:00:00Z"] [--url URL]
//       Apunta un mensaje del buzon de la Pagina (mismo remitente y texto = ya apuntado);
//       si es nuevo, Valquiria avisa a los lideres por Telegram.
//   npm run portavoz:anotar -- pendientes
//       Los posts sin enlace o sin medir en los ultimos 7 dias (para que la tarea los revise).

import { db } from '../lib/db.js';
import { grupoTelegram } from '../lib/config.js';

const VALQUIRIA = process.env.RECLUTA_BOT_TOKEN;
const args = process.argv.slice(2);
const orden = args[0];
const valor = (nombre) => {
  const i = args.indexOf(nombre);
  return i >= 0 ? args[i + 1] : null;
};
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const hoy = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Havana' });

async function tg(metodo, cuerpo) {
  const r = await fetch(`https://api.telegram.org/bot${VALQUIRIA}/${metodo}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
    signal: AbortSignal.timeout(15000),
  });
  return r.json();
}

async function lideres() {
  const grupo = await grupoTelegram();
  const r = await tg('getChatAdministrators', { chat_id: grupo });
  return (r.result ?? []).map((m) => m.user).filter((u) => u && !u.is_bot);
}

if (orden === 'post') {
  const grupo = valor('--grupo');
  if (!grupo) throw new Error('falta --grupo');
  const fila = {
    fecha: hoy(),
    grupo,
    grupo_url: valor('--grupo-url'),
    url: valor('--url'),
    estado: valor('--estado') ?? 'publicado',
    texto_num: valor('--texto') ? Number(valor('--texto')) : null,
    imagen: valor('--imagen'),
    nota: valor('--nota'),
  };
  const { data: previo } = await db.from('fb_posts').select('id').eq('fecha', fila.fecha).eq('grupo', grupo).maybeSingle();
  const limpio = Object.fromEntries(Object.entries(fila).filter(([, v]) => v != null));
  const r = previo
    ? await db.from('fb_posts').update(limpio).eq('id', previo.id).select('id').single()
    : await db.from('fb_posts').insert(limpio).select('id').single();
  if (r.error) throw new Error(`fb_posts: ${r.error.message}`);
  console.log(JSON.stringify({ id: r.data.id, actualizado: Boolean(previo) }));
} else if (orden === 'medir') {
  const id = Number(valor('--id'));
  if (!id) throw new Error('falta --id');
  const cambios = { revisado_en: new Date().toISOString() };
  for (const k of ['reacciones', 'comentarios', 'compartidos']) if (valor(`--${k}`) != null) cambios[k] = Number(valor(`--${k}`));
  if (valor('--url')) cambios.url = valor('--url');
  if (valor('--estado')) cambios.estado = valor('--estado');
  const { error } = await db.from('fb_posts').update(cambios).eq('id', id);
  if (error) throw new Error(`fb_posts: ${error.message}`);
  console.log(JSON.stringify({ id, ...cambios }));
} else if (orden === 'buzon') {
  const remitente = valor('--remitente');
  const texto = valor('--texto') ?? '';
  const hora = valor('--hora') ?? new Date().toISOString();
  if (!remitente) throw new Error('falta --remitente');
  // Mismo remitente y mismo texto = mismo mensaje (la hora que enseña
  // Facebook es relativa, "2 h", y cambiaria de una pasada a otra).
  const { data: previo, error: e1 } = await db
    .from('fb_mensajes')
    .select('id')
    .eq('remitente', remitente)
    .eq('texto', texto.slice(0, 2000))
    .limit(1);
  if (e1) throw new Error(`fb_mensajes: ${e1.message}`);
  if (previo?.length) {
    console.log(JSON.stringify({ nuevo: false, id: previo[0].id }));
  } else {
    const { data, error } = await db
      .from('fb_mensajes')
      .insert({ remitente, texto: texto.slice(0, 2000), recibido_en: hora, url: valor('--url') })
      .select('id, avisado');
    if (error) throw new Error(`fb_mensajes: ${error.message}`);
    // Valquiria avisa a los lideres: el buzon de Facebook no lo mira nadie.
    const aviso =
      `💌 <b>Mensaje nuevo en el buzón de Facebook</b>\n\n` +
      `De: <b>${esc(remitente)}</b>\n` +
      `«${esc(texto.slice(0, 600))}»` +
      (valor('--url') ? `\n\n${esc(valor('--url'))}` : '') +
      `\n\nContéstenle desde la Página; yo lo dejo apuntado en Reclutamiento.`;
    let mandados = 0;
    if (VALQUIRIA) {
      for (const u of await lideres()) {
        const r = await tg('sendMessage', { chat_id: u.id, text: aviso, parse_mode: 'HTML', link_preview_options: { is_disabled: true } });
        if (r.ok) mandados += 1;
      }
    }
    await db.from('fb_mensajes').update({ avisado: mandados > 0 }).eq('id', data[0].id);
    console.log(JSON.stringify({ nuevo: true, id: data[0].id, avisados: mandados }));
  }
} else if (orden === 'pendientes') {
  const desde = new Date(Date.now() - 7 * 86400000).toLocaleDateString('en-CA', { timeZone: 'America/Havana' });
  const { data, error } = await db
    .from('fb_posts')
    .select('id, fecha, grupo, grupo_url, url, estado, revisado_en, reacciones, comentarios')
    .gte('fecha', desde)
    .order('fecha', { ascending: false });
  if (error) throw new Error(`fb_posts: ${error.message}`);
  console.log(JSON.stringify(data ?? [], null, 1));
} else {
  console.error('uso: post | medir | buzon | pendientes');
  process.exit(1);
}
