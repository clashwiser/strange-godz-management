// Bandeja de salida. Todo aviso se escribe aca ANTES de intentar mandarlo.
// Si WhatsApp falla, el mensaje sigue existiendo y el website lo muestra
// con boton de copiar. El envio puede fallar; el aviso no se pierde.

import { db } from './db.js';
import { avisar as avisarTelegram, telegramConfigurado } from './telegram.js';

/**
 * Encola un mensaje. `clave` evita que el cron cada 2 horas repita el mismo
 * aviso: si ya existe una fila con esa clave, no se inserta otra.
 * Devuelve true si el mensaje es nuevo.
 */
export async function encolar({
  tipo,
  cuerpo,
  clave = null,
  destino = 'grupo_clan',
  pose = null,
  menciones = [],
  fotos = [],
}) {
  const { data, error } = await db
    .from('outbox')
    .upsert(
      { tipo, cuerpo, clave_dedupe: clave, destino },
      { onConflict: 'clave_dedupe', ignoreDuplicates: true }
    )
    .select('id');

  if (error) throw new Error(`encolar ${tipo}: ${error.message}`);

  const nuevo = Array.isArray(data) && data.length > 0;
  if (!nuevo) {
    console.log(`  [outbox] ya encolado antes (${clave}), no repito`);
    return false;
  }

  console.log(`  [outbox] encolado #${data[0].id} (${tipo})`);

  // Telegram es opcional y secundario: si esta configurado, manda el aviso
  // por Heraldo. Un fallo aca nunca debe tumbar el job. Con `pose`, va con
  // Heraldo delante; con `fotos`, con esas imagenes (la miniatura de un
  // video) delante de Heraldo.
  //
  // Si salio, la fila queda como enviada. Hasta ahora se quedaba en
  // "pendiente" aunque Heraldo ya lo hubiera dicho en el grupo: la pestaña
  // Mensajes lo enseñaba como "por enviar" y un lider podia mandarlo dos
  // veces.
  if (telegramConfigurado) {
    const salio = await avisarTelegram(cuerpo, { pose, menciones, fotos }).catch(() => false);
    if (salio) {
      await db
        .from('outbox')
        .update({ estado: 'enviado', enviado_en: new Date().toISOString() })
        .eq('id', data[0].id);
    }
  }

  return true;
}

// ---------- Formato de WhatsApp ----------------------------------------
// WhatsApp no entiende HTML ni Markdown completo. Solo: *negrita*,
// _cursiva_, ~tachado~ y ```monoespaciado```.

export const negrita = (s) => `*${s}*`;
export const mono = (s) => '```' + s + '```';
