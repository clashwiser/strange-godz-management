// Los partes de CWL de Heraldo: el tono es el de un clan estricto y
// competitivo. Dejar un ataque sin usar no se normaliza ni se suaviza.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mensajeFinal, parrafoRonda } from '../src/lib/cwl-mensajes.js';

const analisis = (extra = {}) => ({
  tabla: new Array(8).fill({}),
  rondasJugadas: 7,
  yo: { puesto: 5, estrellas: 325, ganadas: 3 },
  enAscenso: false,
  enDescenso: false,
  ...extra,
});

test('cierre sin subir: la meta era subir, nada de "eso tambien se defiende" ni "menos ataques sin usar"', () => {
  const m = mensajeFinal({ clan: 'x300', liga: 'Champion League I', analisis: analisis(), sinUsar: { total: 0, nombres: [] } });
  assert.match(m, /Terminamos 5º de 8 con 325★, 3 ganadas y 4 perdidas\./);
  assert.match(m, /la meta era subir/);
  assert.match(m, /cada ataque se usa, y se usa para tres estrellas/);
  assert.match(m, /Cero ataques sin usar en toda la liga\. Así se juega aquí\./);
  assert.doesNotMatch(m, /se defiende|menos ataques sin usar/);
});

test('cierre con ataques sin usar: se nombran y se dice que no pasa', () => {
  const m = mensajeFinal({
    clan: 'x300',
    liga: 'Champion League I',
    analisis: analisis(),
    sinUsar: { total: 2, nombres: ['Fulano ×2'] },
  });
  assert.match(m, /Este mes quedaron 2 ataques sin usar \(Fulano ×2\)\. En x300 eso no pasa, y no va a volver a pasar\./);
});

test('cierre con ascenso y con descenso: felicita o avisa, y la disciplina va igual', () => {
  const sube = mensajeFinal({ clan: 'x300', liga: 'Master I', analisis: analisis({ enAscenso: true }), sinUsar: { total: 1, nombres: ['Mengano'] } });
  assert.match(sube, /SUBIMOS/);
  assert.match(sube, /quedó 1 ataque sin usar \(Mengano\)/);
  const baja = mensajeFinal({ clan: 'x300', liga: 'Master I', analisis: analisis({ enDescenso: true }), sinUsar: null });
  assert.match(baja, /Bajamos de liga/);
  assert.doesNotMatch(baja, /sin usar/, 'sin datos, no se inventa la linea');
});

test('parrafoRonda: sin chiste con los que no atacaron; con todos, el estandar de la casa', () => {
  const con = parrafoRonda({ ronda: 3, mvp: { nombre: 'Batman', estrellas: 3, destruccion: 100 }, faltaron: [{ nombre: 'Fulano' }] });
  assert.match(con, /🏆 Lo mejor: \*Batman\* con 3★ \(100%\)/);
  assert.match(con, /❌ Dejó el ataque sin usar: Fulano\. Aquí eso no pasa\. Mañana, todos\./);
  assert.doesNotMatch(con, /durmieron/);
  const dos = parrafoRonda({ ronda: 3, mvp: null, faltaron: [{ nombre: 'A' }, { nombre: 'B' }] });
  assert.match(dos, /Dejaron el ataque sin usar \(2\): A, B\./);
  const todos = parrafoRonda({ ronda: 3, mvp: { nombre: 'Batman', estrellas: 3 }, faltaron: [] });
  assert.match(todos, /🟢 Atacaron todos\. Así se juega aquí\./);
});
