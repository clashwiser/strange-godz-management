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
export async function encolar({ tipo, cuerpo, clave = null, destino = 'grupo_clan', pose = null, menciones = [] }) {
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

  // Telegram es opcional y secundario: si esta configurado, duplica el aviso.
  // Un fallo aca nunca debe tumbar el job. Con `pose`, va como foto de
  // Heraldo con el texto de pie.
  if (telegramConfigurado) await avisarTelegram(cuerpo, { pose, menciones }).catch(() => {});

  return true;
}

// ---------- Formato de WhatsApp ----------------------------------------
// WhatsApp no entiende HTML ni Markdown completo. Solo: *negrita*,
// _cursiva_, ~tachado~ y ```monoespaciado```.

export const negrita = (s) => `*${s}*`;
export const mono = (s) => '```' + s + '```';
