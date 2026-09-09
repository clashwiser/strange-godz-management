// Manda al grupo de WhatsApp lo que haya pendiente en el outbox.
//
// Solo abre conexion SI hay algo que mandar. A menos conexiones, menos
// probabilidad de que WhatsApp marque el numero como automatizado.
//
// Si algo falla, el mensaje queda en la base con estado 'fallido' y el
// website lo muestra con boton de copiar. Nunca se pierde un aviso.

import { conectar, desconectar, marcarEstado } from '../lib/whatsapp.js';
import { db, chk, correrJob } from '../lib/db.js';

const MAX_INTENTOS = 3;

// Apagado por defecto. Encender SOLO con un numero secundario dedicado:
// la sesion guardada en Supabase da acceso completo a ese WhatsApp.
if (process.env.WA_HABILITADO !== 'true') {
  console.log('WhatsApp desactivado (WA_HABILITADO != true).');
  console.log('Los mensajes quedan en el outbox y se copian desde el website.');
  process.exit(0);
}

await correrJob('wa_enviar', async () => {
  const pendientes = chk(
    await db
      .from('outbox')
      .select('id, tipo, cuerpo, intentos')
      .eq('estado', 'pendiente')
      .lt('intentos', MAX_INTENTOS)
      .order('creado_en', { ascending: true })
      .limit(10),
    'leer outbox'
  );

  if (!pendientes.length) {
    console.log('Outbox vacio, no abro conexion.');
    return { filas: 0 };
  }

  const estado = chk(
    await db.from('wa_estado').select('grupo_jid, vinculado').eq('id', 1).single(),
    'leer wa_estado'
  );

  if (!estado.vinculado || !estado.grupo_jid) {
    // No es un error del job: es que falta configurar. Los mensajes esperan.
    console.log('WhatsApp sin vincular o sin grupo definido. Los mensajes quedan pendientes.');
    await marcarEstado({ ultimo_error: 'sin vincular o sin grupo_jid' });
    return { filas: 0 };
  }

  let sock;
  try {
    sock = await conectar({ timeoutMs: 60000 });
  } catch (err) {
    // La sesion se cayo. Marcamos para que el website avise de re-vincular.
    await marcarEstado({
      vinculado: !/SESION CERRADA/.test(err.message),
      ultimo_error: err.message.slice(0, 500),
    });
    chk(
      await db
        .from('outbox')
        .update({ intentos: 1, error: err.message.slice(0, 500) })
        .in('id', pendientes.map((p) => p.id)),
      'marcar intento fallido'
    );
    throw err;
  }

  let enviados = 0;

  for (const msg of pendientes) {
    try {
      await sock.sendMessage(estado.grupo_jid, { text: msg.cuerpo });
      chk(
        await db
          .from('outbox')
          .update({ estado: 'enviado', enviado_en: new Date().toISOString(), error: null })
          .eq('id', msg.id),
        `marcar enviado ${msg.id}`
      );
      enviados++;
      console.log(`  enviado #${msg.id} (${msg.tipo})`);
      // Ritmo humano entre mensajes.
      await new Promise((r) => setTimeout(r, 1500 + Math.random() * 2000));
    } catch (err) {
      const intentos = (msg.intentos ?? 0) + 1;
      chk(
        await db
          .from('outbox')
          .update({
            intentos,
            error: String(err.message).slice(0, 500),
            estado: intentos >= MAX_INTENTOS ? 'fallido' : 'pendiente',
          })
          .eq('id', msg.id),
        `marcar fallo ${msg.id}`
      );
      console.error(`  fallo #${msg.id} (intento ${intentos}):`, err.message);
    }
  }

  await marcarEstado({
    vinculado: true,
    ultimo_ok: new Date().toISOString(),
    ultimo_error: enviados === pendientes.length ? null : 'algunos mensajes fallaron',
  });

  await desconectar(sock);
  return { filas: enviados, detalle: { pendientes: pendientes.length, enviados } };
});

process.exit(0);
