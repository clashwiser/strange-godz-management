// El paso de las normas en la entrevista: los botones van EN el mensaje
// (leerlas, y "He leído y acepto"), y tocar el boton cierra la solicitud
// igual que escribir "acepto". Sin red: Supabase y Telegram fingidos.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { flujoSolicitud, atenderBoton, ACEPTO_NORMAS } from '../web/lib/solicitud.js';

/** Un Supabase de mentira: tablas en memoria y el encadenado minimo que usa solicitud.js. */
function supabaseFingido(tablas) {
  const cambios = [];
  const ejecutar = (q) => {
    const filas = (tablas[q.tabla] ?? []).filter((f) => Object.entries(q.filtros).every(([k, v]) => f[k] === v));
    if (q.op === 'update') {
      for (const f of filas) Object.assign(f, q.parche);
      cambios.push({ tabla: q.tabla, parche: q.parche });
      return { data: filas, error: null };
    }
    if (q.op === 'insert') {
      (tablas[q.tabla] ??= []).push(q.parche);
      return { data: q.parche, error: null };
    }
    return { data: q.single ? (filas[0] ?? null) : filas, error: null };
  };
  const from = (tabla) => {
    const q = { tabla, op: 'select', filtros: {}, parche: null, single: false };
    const b = new Proxy(
      {},
      {
        get(_, prop) {
          if (prop === 'then') return (res) => res(ejecutar(q));
          return (...args) => {
            if (prop === 'update') {
              q.op = 'update';
              q.parche = args[0];
            } else if (prop === 'insert') {
              q.op = 'insert';
              q.parche = args[0];
            } else if (prop === 'eq') q.filtros[args[0]] = args[1];
            else if (prop === 'maybeSingle' || prop === 'single') q.single = true;
            return b;
          };
        },
      }
    );
    return b;
  };
  return { from, cambios };
}

/** Telegram de mentira: apunta lo que se le manda. */
function telegramFingido() {
  const llamadas = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    llamadas.push({ metodo: String(url).split('/').pop().split('?')[0], cuerpo: init?.body ? JSON.parse(init.body) : null });
    return { ok: true, json: async () => ({ ok: true, result: { message_id: 7 } }) };
  };
  return { llamadas, restaurar: () => (globalThis.fetch = original) };
}

const hace = (ms) => new Date(Date.now() - ms).toISOString();
const aspirante = { id: 55, is_bot: false, first_name: 'Carlos' };

test('al terminar de contarse, las normas llegan con botones en el mensaje', async () => {
  const sb = supabaseFingido({
    solicitudes: [{ tg_user_id: 55, paso: 'cuenta', estado: 'borrador', respuestas: {}, actualizado_en: hace(5000) }],
    config: [{ clave: 'reglas_resumen', valor: 'Las normas, en corto.' }],
    lecciones: [],
  });
  const r = await flujoSolicitud(sb, { from: aspirante, chat: { id: 55, type: 'private' } }, 'Salgo de La Habana, juego de noche', 'recluta');
  assert.ok(r.botones, 'lleva botones en el mensaje');
  const planos = r.botones.flat();
  assert.ok(planos.some((b) => b.url && /\/reglas$/.test(b.url)), 'uno abre las normas completas');
  assert.ok(planos.some((b) => b.callback_data === ACEPTO_NORMAS && /acepto/i.test(b.text)), 'otro acepta');
  assert.match(r.texto, /toca el botón/);
  assert.equal(sb.cambios.at(-1).parche.paso, 'reglas');
});

test('tocar "He leído y acepto" cierra la solicitud como si escribiera "acepto"', async () => {
  const sb = supabaseFingido({
    solicitudes: [{ tg_user_id: 55, paso: 'reglas', estado: 'borrador', respuestas: { cuenta: 'x' }, actualizado_en: hace(5000) }],
  });
  const tg = telegramFingido();
  try {
    const cq = { id: 'cq1', data: ACEPTO_NORMAS, from: aspirante, message: { message_id: 7, chat: { id: 55, type: 'private' }, from: { id: 1, is_bot: true } } };
    await atenderBoton(sb, 'TOKEN', cq, 'recluta');
  } finally {
    tg.restaurar();
  }
  const metodos = tg.llamadas.map((l) => l.metodo);
  assert.ok(metodos.includes('answerCallbackQuery'), 'contesta el callback');
  assert.ok(metodos.includes('editMessageReplyMarkup'), 'quita los botones');
  assert.ok(metodos.includes('sendMessage'), 'contesta');
  const fila = sb.cambios.find((c) => c.parche.paso === 'listo');
  assert.ok(fila, 'la solicitud pasa a lista');
  assert.equal(fila.parche.acepto_normas, true);
  assert.equal(fila.parche.estado, 'pendiente');
});

test('escrito, tambien vale "he leído y acepto los términos"', async () => {
  const sb = supabaseFingido({
    solicitudes: [{ tg_user_id: 55, paso: 'reglas', estado: 'borrador', respuestas: {}, actualizado_en: hace(5000) }],
  });
  const r = await flujoSolicitud(sb, { from: aspirante, chat: { id: 55, type: 'private' } }, 'he leído y acepto los términos', 'recluta');
  assert.match(r, /Anotado/);
  assert.equal(sb.cambios.at(-1).parche.paso, 'listo');
});
