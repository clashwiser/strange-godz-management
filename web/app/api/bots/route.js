// Salud y mandos de los dos bots, para la pestaña Bots del panel.
//
// Hasta ahora saber si un bot estaba bien era correr un job en PowerShell
// y leer JSON. Los lideres no van a hacer eso. Aqui se les pregunta a
// Telegram las tres cosas que importan de cada bot y se devuelven
// masticadas:
//
//   - el webhook apunta a donde debe y no tiene errores
//   - esta dentro del grupo de la comunidad
//   - oye todo el chat o solo cuando le hablan (modo privacidad)
//
// Y tres cosas que se pueden HACER desde el panel sin tocar una terminal:
// mandar un mensaje de prueba al grupo, reinstalar el webhook y publicar
// la lista de comandos en el menu "/" de Telegram.
//
// Ningun token sale de aqui. Solo se dice si esta puesto.

import { admin } from '../../../lib/supabase-admin';

export const dynamic = 'force-dynamic';

const SITIO = (process.env.SITIO_URL || 'https://strange-godz-management.vercel.app').replace(/\/$/, '');
const GRUPO = (process.env.TELEGRAM_CHAT_ID || '')
  .split(',')
  .map((x) => x.trim())
  .find((x) => x.startsWith('-'));

const BOTS = {
  heraldo: {
    token: process.env.TELEGRAM_BOT_TOKEN,
    secreto: process.env.TELEGRAM_SECRET_TOKEN,
    ruta: '/api/telegram',
    prueba: '📯 Prueba desde el panel. Heraldo a la orden.',
    // Lo que sale en el menu "/" de Telegram. Solo lo que sirve a todo el
    // mundo: /reporte es de lideres y no hace falta anunciarlo.
    comandos: [
      { command: 'yo', description: 'Tus estrellas y ataques de esta CWL' },
      { command: 'miclan', description: 'A qué clan te toca ir esta CWL' },
      { command: 'cobro', description: 'En qué puesto vas del reparto' },
      { command: 'base', description: 'Una base del pack, con su mini' },
      { command: 'faltan', description: 'Quién no ha atacado en la CWL' },
      { command: 'estrellas', description: 'Tabla de estrellas de la temporada' },
      { command: 'resumen', description: 'Estado de los clanes' },
      { command: 'soy', description: 'Dile tu nombre del juego: /soy Fulano' },
      { command: 'ayuda', description: 'Todo lo que sabe hacer' },
    ],
  },
  recluta: {
    token: process.env.RECLUTA_BOT_TOKEN,
    secreto: process.env.RECLUTA_SECRET_TOKEN,
    ruta: '/api/recluta',
    prueba: '⚔️ Prueba desde el panel. Valquiria presente.',
    // Sin comandos a proposito: en el grupo, el menu "/" mezclaria los
    // suyos con los de Heraldo, y ella no atiende comandos.
    comandos: [],
  },
};

const tg = async (token, metodo, cuerpo) => {
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

/** Quien llama y que puede. Devuelve null si no es lider. */
async function quienLlama(request) {
  const jwt = (request.headers.get('authorization') ?? '').replace(/^Bearer /, '');
  if (!jwt) return null;
  const { data: usuario, error } = await admin.auth.getUser(jwt);
  if (error || !usuario?.user) return null;
  const { data: lider } = await admin
    .from('dashboard_users')
    .select('puede_editar, nombre')
    .eq('user_id', usuario.user.id)
    .maybeSingle();
  return lider ? { ...lider, email: usuario.user.email } : null;
}

async function saludDe(clave) {
  const b = BOTS[clave];
  const base = { clave, ruta: b.ruta, webhookEsperado: `${SITIO}${b.ruta}`, configurado: Boolean(b.token && b.secreto) };
  if (!b.token) return { ...base, error: 'sin token' };

  const [yo, wh, miembro] = await Promise.all([
    tg(b.token, 'getMe'),
    tg(b.token, 'getWebhookInfo'),
    GRUPO ? tg(b.token, 'getChatMember', { chat_id: GRUPO, user_id: Number(b.token.split(':')[0]) }) : null,
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

export async function GET(request) {
  const lider = await quienLlama(request);
  if (!lider) return Response.json({ ok: false, error: 'no autorizado' }, { status: 401 });

  // El dia de Cuba, igual que el cupo de bases: a las 11 de la noche en La
  // Habana ya es mañana en UTC y el contador se pondria a cero antes de tiempo.
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Havana' });
  const [heraldo, recluta, sol, vinc, basesHoy, outbox] = await Promise.all([
    saludDe('heraldo'),
    saludDe('recluta'),
    admin.from('solicitudes').select('estado'),
    admin.from('tg_vinculos').select('*', { count: 'exact', head: true }),
    admin.from('base_pedidos').select('*', { count: 'exact', head: true }).eq('dia', hoy),
    admin.from('outbox').select('*', { count: 'exact', head: true }).eq('estado', 'pendiente'),
  ]);

  const estados = (sol.data ?? []).reduce((a, s) => ((a[s.estado] = (a[s.estado] ?? 0) + 1), a), {});

  return Response.json({
    ok: true,
    grupo: GRUPO ? { id: GRUPO } : null,
    bots: { heraldo, recluta },
    actividad: {
      solicitudesPendientes: (estados.pendiente ?? 0) + (estados.prueba ?? 0),
      solicitudesTotal: (sol.data ?? []).filter((s) => s.estado !== 'borrador').length,
      aceptadas: estados.aceptada ?? 0,
      vinculados: vinc.count ?? 0,
      basesHoy: basesHoy.count ?? 0,
      outboxPendientes: outbox.count ?? 0,
    },
  });
}

export async function POST(request) {
  const lider = await quienLlama(request);
  if (!lider) return Response.json({ ok: false, error: 'no autorizado' }, { status: 401 });
  if (!lider.puede_editar) return Response.json({ ok: false, error: 'solo quien puede editar' }, { status: 403 });

  const { bot, accion } = await request.json().catch(() => ({}));
  const b = BOTS[bot];
  if (!b) return Response.json({ ok: false, error: 'ese bot no existe' }, { status: 400 });
  if (!b.token) return Response.json({ ok: false, error: 'ese bot no tiene token en Vercel' }, { status: 503 });

  if (accion === 'probar') {
    if (!GRUPO) return Response.json({ ok: false, error: 'sin grupo configurado' }, { status: 503 });
    const r = await tg(b.token, 'sendMessage', { chat_id: GRUPO, text: b.prueba });
    return Response.json({ ok: r.ok, error: r.ok ? null : r.description });
  }

  if (accion === 'webhook') {
    if (!b.secreto) return Response.json({ ok: false, error: 'falta el secreto en Vercel' }, { status: 503 });
    const r = await tg(b.token, 'setWebhook', {
      url: `${SITIO}${b.ruta}`,
      secret_token: b.secreto,
      allowed_updates: ['message', 'edited_message'],
      drop_pending_updates: true,
    });
    return Response.json({ ok: r.ok, error: r.ok ? null : r.description });
  }

  if (accion === 'comandos') {
    const r = await tg(b.token, 'setMyCommands', { commands: b.comandos });
    return Response.json({ ok: r.ok, error: r.ok ? null : r.description, cuantos: b.comandos.length });
  }

  return Response.json({ ok: false, error: 'acción desconocida' }, { status: 400 });
}
