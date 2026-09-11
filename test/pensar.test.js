// El motor compatible con OpenAI de pensar.js, contra un proveedor falso
// en local: elige el modelo entre los que la llave tiene, y si el elegido
// devuelve 404 lo descarta y vuelve a elegir en la misma llamada. Es
// exactamente lo que paso el primer dia con Groq.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';

// Lo que el proveedor falso contesta y lo que recibe.
const estado = {
  modelos: ['whisper-large-v3', 'llama-3.3-70b-versatile', 'openai/gpt-oss-120b', 'openai/gpt-oss-20b'],
  retirados: new Set(['llama-3.3-70b-versatile']),
  peticiones: [],
  respuesta: '**Claro, mi cielo.** Bailo casino desde que tenía diez años.',
  datos: 'Según Clash Champs (septiembre 2026), en TH16 domina Super Archer Blimp con 4 super arqueras y globos. Fuente: https://clashchamps.com',
  busca: true,
};

let servidor;
let pensar;
let usoDeHoy;
let limpiar;

// El admin de Supabase, de mentira: cuenta como ia_contar (sql/023): una
// llamada, o un fallo, nunca las dos cosas.
const contador = { llamadas: 0, fallos: 0 };
const admin = {
  rpc: async (_fn, { p_fallo } = {}) => {
    if (p_fallo) contador.fallos++;
    else contador.llamadas++;
    return { data: contador.llamadas, error: null };
  },
  from: () => ({
    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { llamadas: contador.llamadas, fallos: contador.fallos } }) }) }),
  }),
};

before(async () => {
  servidor = createServer((req, res) => {
    let cuerpo = '';
    req.on('data', (c) => (cuerpo += c));
    req.on('end', () => {
      if (req.url === '/v1/models') {
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ data: estado.modelos.map((id) => ({ id, object: 'model' })) }));
        return;
      }
      if (req.url === '/v1/chat/completions') {
        const p = JSON.parse(cuerpo);
        estado.peticiones.push(p);
        res.setHeader('content-type', 'application/json');
        if (estado.retirados.has(p.model)) {
          res.statusCode = 404;
          res.end(JSON.stringify({ error: { message: `The model \`${p.model}\` does not exist or you do not have access to it.`, code: 'model_not_found' } }));
          return;
        }
        // El buscador: datos crudos, y executed_tools solo si "busco".
        if (/compound/.test(p.model)) {
          const message = { role: 'assistant', content: estado.datos };
          if (estado.busca) message.executed_tools = [{ type: 'search', arguments: '{"query":"mejor ejercito th16 2026"}' }];
          res.end(JSON.stringify({ choices: [{ message }] }));
          return;
        }
        res.end(JSON.stringify({ choices: [{ message: { role: 'assistant', content: estado.respuesta } }] }));
        return;
      }
      res.statusCode = 404;
      res.end('{}');
    });
  });
  await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok));
  const puerto = servidor.address().port;

  // Las variables se leen al cargar el modulo, asi que van antes del import.
  process.env.IA_LLAVE = 'llave-de-prueba';
  process.env.IA_URL = `http://127.0.0.1:${puerto}/v1/`;
  process.env.IA_MODELO = 'llama-3.3-70b-versatile'; // el forzado, que ya no existe
  delete process.env.GEMINI_API_KEY;
  ({ pensar, usoDeHoy, limpiar } = await import('../web/lib/pensar.js'));
});

after(() => servidor.close());

test('pensar: el modelo forzado da 404, se descarta, se elige otro y contesta en la misma llamada', async () => {
  const r = await pensar(admin, 'valquiria', '¿tú sabes bailar casino?', 'Cris');
  assert.equal(r, 'Claro, mi cielo. Bailo casino desde que tenía diez años.', 'sin markdown, texto limpio');

  assert.equal(estado.peticiones.length, 2, 'dos intentos: el retirado y el bueno');
  assert.equal(estado.peticiones[0].model, 'llama-3.3-70b-versatile');
  assert.equal(estado.peticiones[1].model, 'openai/gpt-oss-120b', 'el primero de la lista que la llave tiene');
  assert.equal(contador.fallos, 0, 'un 404 con reintento bueno no cuenta como fallo');
  assert.equal(contador.llamadas, 1, 'una llamada gastada, no dos');
});

test('pensar: la segunda vez va directo al modelo bueno', async () => {
  estado.peticiones = [];
  await pensar(admin, 'heraldo', 'pizza con piña', null);
  assert.equal(estado.peticiones.length, 1);
  assert.equal(estado.peticiones[0].model, 'openai/gpt-oss-120b');
});

test('pensar: a los gpt-oss se les pide razonar poco y no devolver el razonamiento', () => {
  const p = estado.peticiones[0];
  assert.equal(p.reasoning_effort, 'low');
  assert.equal(p.include_reasoning, false);
  assert.ok(p.max_tokens >= 300, 'el razonamiento cuenta en max_tokens; con 120 saldria vacio');
  assert.equal(p.messages[0].role, 'system');
  assert.match(p.messages[0].content, /Heraldo/);
  assert.equal(p.messages[1].content, 'pizza con piña');
});

test('pensar: con nombre, la pregunta lleva quien la hace', async () => {
  estado.peticiones = [];
  await pensar(admin, 'valquiria', 'hola', 'Deibis');
  assert.equal(estado.peticiones[0].messages[1].content, 'Deibis dice: hola');
});

test('pensar con buscar: dos pasos, el buscador sin personaje y el personaje con lo encontrado', async () => {
  estado.peticiones = [];
  const r = await pensar(admin, 'valquiria', '¿cuál es el mejor ejército ahora?', 'Cris', { buscar: true, th: 15 });
  assert.equal(r, 'Claro, mi cielo. Bailo casino desde que tenía diez años.');
  assert.equal(estado.peticiones.length, 2, 'buscar y luego contestar');

  const [busca, contesta] = estado.peticiones;
  assert.equal(busca.model, 'groq/compound-mini');
  assert.equal(busca.messages.length, 1, 'sin personaje: solo la peticion de datos');
  assert.equal(busca.messages[0].role, 'user');
  assert.match(busca.messages[0].content, /Busca en la web AHORA/);
  assert.match(busca.messages[0].content, /Pregunta: ¿cuál es el mejor ejército ahora\?$/);
  assert.equal(busca.reasoning_effort, undefined, 'compound no es gpt-oss');
  assert.equal(busca.temperature, 0.2, 'datos, no creatividad');

  assert.equal(contesta.model, 'openai/gpt-oss-120b');
  assert.equal(contesta.max_tokens, 700);
  assert.match(contesta.messages[0].content, /contesta CON ESO/);
  assert.match(contesta.messages[0].content, /Ayuntamiento 15/);
  assert.match(contesta.messages[0].content, /de 2026/, 'lleva el mes de hoy');
  assert.doesNotMatch(contesta.messages[0].content, /Máximo 2 frases/);
  assert.doesNotMatch(contesta.messages[0].content, /NO se pudo buscar/);
  assert.match(contesta.messages[1].content, /^Cris dice: ¿cuál es el mejor ejército ahora\?\n\nLo que se encontró hoy en la web:\nSegún Clash Champs/);
});

test('pensar con buscar: si el buscador contesto sin buscar, se avisa de que no hay web', async () => {
  estado.busca = false;
  estado.peticiones = [];
  const r = await pensar(admin, 'heraldo', '¿qué trae la actualización?', null, { buscar: true });
  assert.equal(r, 'Claro, mi cielo. Bailo casino desde que tenía diez años.');
  assert.deepEqual(estado.peticiones.map((p) => p.model), ['groq/compound-mini', 'openai/gpt-oss-120b']);
  const contesta = estado.peticiones[1];
  assert.match(contesta.messages[0].content, /NO se pudo buscar en la web/);
  assert.equal(contesta.messages[1].content, '¿qué trae la actualización?', 'sin datos inventados pegados');
  estado.busca = true;
});

test('pensar sin buscar: sigue con dos frases y sin TH', async () => {
  estado.peticiones = [];
  await pensar(admin, 'heraldo', 'hola', null);
  assert.equal(estado.peticiones.length, 1, 'sin buscador');
  const p = estado.peticiones[0];
  assert.equal(p.model, 'openai/gpt-oss-120b');
  assert.match(p.messages[0].content, /Máximo 2 frases/);
  assert.doesNotMatch(p.messages[0].content, /contesta CON ESO/);
});

test('usoDeHoy: enseña el modelo que de verdad se usa, y el que busca', async () => {
  const u = await usoDeHoy(admin);
  assert.equal(u.motor, 'openai');
  assert.equal(u.configurada, true);
  assert.equal(u.modelo, 'openai/gpt-oss-120b');
  assert.equal(u.busca, 'groq/compound-mini');
  assert.equal(u.tope, 300);
});

test('pensar con buscar: si el proveedor no tiene el modelo con web, contesta sin web y no insiste', async () => {
  estado.retirados.add('groq/compound-mini');
  estado.peticiones = [];
  const antes = { ...contador };
  const r = await pensar(admin, 'valquiria', '¿qué trae la actualización?', null, { buscar: true });
  assert.equal(r, 'Claro, mi cielo. Bailo casino desde que tenía diez años.');
  assert.deepEqual(
    estado.peticiones.map((p) => p.model),
    ['groq/compound-mini', 'openai/gpt-oss-120b'],
    'probo el de web, 404, y siguio con el de charla en la misma llamada',
  );
  assert.match(estado.peticiones[1].messages[0].content, /NO se pudo buscar en la web/);
  assert.equal(contador.fallos, antes.fallos, 'contesto: no es un fallo');

  estado.peticiones = [];
  await pensar(admin, 'valquiria', '¿y los héroes?', null, { buscar: true });
  assert.deepEqual(estado.peticiones.map((p) => p.model), ['openai/gpt-oss-120b'], 'ya no vuelve a probar el de web');
  assert.equal((await usoDeHoy(admin)).busca, null);
});

test('limpiar: quita enlaces, citas y markdown, y deja el texto', () => {
  const sucio = 'El meta es **Super Archer Blimp** [1] según [Clash Champs](https://clashchamps.com/meta) y https://x.com/a.\n\n\n- Punto';
  assert.equal(limpiar(sucio), 'El meta es Super Archer Blimp según Clash Champs y\n\n- Punto');
});

test('pensar: sin ningun modelo de texto, se rinde con fallo contado y sin reventar', async () => {
  const antes = { ...contador };
  estado.retirados.add('openai/gpt-oss-120b');
  estado.retirados.add('openai/gpt-oss-20b');
  estado.peticiones = [];
  const r = await pensar(admin, 'valquiria', 'otra cosa', null);
  assert.equal(r, null);
  assert.ok(contador.fallos > antes.fallos, 'cuenta el fallo');
  assert.deepEqual(
    estado.peticiones.map((p) => p.model),
    ['openai/gpt-oss-120b', 'openai/gpt-oss-20b'],
    'probo los dos que quedaban y no el whisper',
  );
  // Y a partir de aqui no hay modelo: la pestaña Bots lo enseña como tal.
  assert.equal((await usoDeHoy(admin)).modelo, null);
});
