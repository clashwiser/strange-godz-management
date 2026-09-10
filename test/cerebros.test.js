// Los cerebros de Heraldo y Valquiria: que cada pregunta caiga en su
// categoria, y que las frases esten sanas.
//
// Esto existe porque ya paso dos veces que un patron nuevo se comio a
// otro sin que nadie lo notara: "mi reina" caia en piropo, "quien falta
// por atacar" en guerra. Una frase mal enrutada no rompe nada visible; se
// nota cuando un jugador pregunta y el bot contesta otra cosa.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { charlar, cuantasFrases, BIENVENIDAS, BIENVENIDAS_VARIOS, CIERRES_BASE } from '../web/lib/charla.js';
import {
  entenderValquiria,
  cuantasFrasesValquiria,
  BIENVENIDAS_VALQUIRIA,
  BIENVENIDAS_VALQUIRIA_VARIOS,
  cuantosEsperan,
} from '../web/lib/charla-valquiria.js';
import { MAS, masDe } from '../web/lib/charla-mas.js';

const plano = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// ------------------------------------------------------------ Valquiria
test('Valquiria: cada frase cae en su categoria', () => {
  const esperado = {
    'Valquiria como entra mi amigo al clan': 'como entrar',
    '@Valqui_bot mi primo quiere entrar': 'como entrar',
    'valquiria como me uno': 'como entrar',
    'valqui cuantos hay esperando?': 'esperando',
    'Valquiria quien eres': 'quien eres',
    'valquiria eres linda': 'piropo',
    'Valqui que opinas de Heraldo': 'heraldo',
    'valquiria me das una base': 'de heraldo',
    'valquiria quien falta por atacar': 'de heraldo',
    'valquiria que premio me toca': 'de heraldo',
    'valquiria gracias': 'gracias',
    'valquiria eres una inutil': 'insulto',
    'hola valquiria': 'saludo',
    Valquiria: 'saludo',
    'valquiria!!': 'saludo',
    'valquiria como estas': 'como estas',
    'valquiria todo bien?': 'como estas',
    'valquiria que hora es': 'hora',
    'valquiria cuentame un chiste': 'chiste',
    'valquiria perdimos': 'animo',
    'valquiria hice pleno': 'victoria',
    'valquiria mi reina esta durmiendo': 'heroes',
    'valquiria esa cuenta es comprada': 'trampas',
    'valquiria tengo hambre': 'hambre',
    'valquiria que calor': 'calor',
    'valquiria chao': 'despedida',
    'jajaja valquiria': 'risa',
    'valquiria que trae la actualizacion': 'supercell',
    'valquiria se me cerro el juego en medio del ataque': 'lag',
    'valquiria a quien ataco': 'espejo',
    'valquiria donde esta mi tag': 'tag y nombre',
    'valquiria buenas noches': 'buenas noches',
    'valquiria buenas tardes': 'buenas tardes',
    'valquiria buenos dias': 'buenos dias',
    'valquiria eres un bot': 'eres real',
    'valquiria tienes novio': 'amor',
    'valquiria dame un consejo': 'consejo',
    'valquiria que ejercito uso': 'meta',
    'valquiria te pones de pinga': 'reglas',
    'valquiria quien manda aqui': 'lideres',
    'valquiria soy nuevo': 'aprender',
    'valquiria vale la pena el pase': 'pase',
    'valquiria viene un huracan': 'clima',
    'valquiria cuando subo de th': 'ayuntamiento',
    'valquiria los juegos del clan': 'juegos del clan',
    'valquiria estoy cansado': 'cansado',
    'valquiria es mi cumpleanos': 'felicitar',
    'valquiria que es un cuarteto': 'no entiendo',
  };
  const fallos = [];
  for (const [frase, categoria] of Object.entries(esperado)) {
    const r = entenderValquiria(frase);
    if (r.categoria !== categoria) fallos.push(`${frase} -> ${r.categoria} (esperaba ${categoria})`);
  }
  assert.deepEqual(fallos, []);
});

test('Valquiria: "esperando" cuenta con gracia', () => {
  assert.match(cuantosEsperan(0), /Nadie/);
  assert.match(cuantosEsperan(1), /uno/);
  assert.match(cuantosEsperan(5), /5/);
});

test('Valquiria: habla como mujer y nunca como Heraldo', () => {
  const src = readFileSync(new URL('../web/lib/charla-valquiria.js', import.meta.url), 'utf8');
  // "hermano de armas" es sobre Heraldo y vale; "mi hermano" al jugador, no.
  const sinArmas = src.replace(/hermano de armas/g, '');
  assert.doesNotMatch(sinArmas, /\bmi hermano\b/, 'Valquiria no dice "mi hermano"');
  assert.doesNotMatch(src, /\basere\b/, 'Valquiria no dice "asere"');
  assert.doesNotMatch(src, /\bsocio\b/, 'Valquiria no dice "socio"');
  // Y sus frases del modulo compartido, igual.
  for (const c of masDe('valquiria')) {
    for (const f of c.respuestas) {
      assert.doesNotMatch(f, /\b(asere|socio|mi hermano|compadre)\b/, `voz de Heraldo en Valquiria: ${f}`);
    }
  }
});

test('Valquiria: tamaño del cerebro y bienvenidas con mencion', () => {
  assert.ok(cuantasFrasesValquiria() >= 350, `tiene ${cuantasFrasesValquiria()}`);
  for (const b of [...BIENVENIDAS_VALQUIRIA, ...BIENVENIDAS_VALQUIRIA_VARIOS]) {
    assert.ok(b.includes('{quien}'), `bienvenida sin {quien}: ${b.slice(0, 40)}`);
    assert.ok(b.length + 80 <= 1024, 'la bienvenida con la mencion no cabe en el pie de un video');
  }
});

// -------------------------------------------------------------- Heraldo
test('Heraldo: cada frase cae en su categoria', () => {
  const casos = [
    // Que caiga en "base mala" y no en "pide mas": el patron de "pide mas"
    // tiene "otra" y la queja lleva "otra mañana" en alguna respuesta.
    ['la base que me diste es una mierda', /base|caen|castillo|atacó|cobra|Defender|meta/i],
    ['tirame otra base', /alcanza|una|ma[nñ]ana|bodega|cabeza|tuya|pack/i],
    ['hola heraldo', /./],
    ['gracias', /./],
    ['quien eres', /./],
    ['un chiste', /./],
    ['como estas', /corneta|pergamino|donaste|heraldo|calor|castillo|base|ataques sin usar|sienta/i],
    ['buenas noches', /noche|descanses|dormir|guardia/i],
    ['buenas tardes', /tarde|toca|calma|almorzar/i],
    ['buenos dias', /d[ií]as|caf[eé]|dona|toca|atacar|pleno/i],
    ['que hora es', /hora|reloj|faltan/i],
    ['mi reina esta durmiendo', /Reina|héroe|heroe|altar|Centinela|Campeona|libros/i],
    ['esa cuenta es comprada', /reglas|hackearon|baneo|privado|Vender|un día/i],
    ['cuando subo de th', /TH|Rush|laboratorio|muros|subir/i],
    ['a quien ataco', /espejo|tres|caído|caido|líder|lider/i],
    ['que ejercito uso', /./],
    ['estoy aburrido', /./],
    ['tengo hambre', /./],
  ];
  const fallos = [];
  for (const [frase, patron] of casos) {
    const r = charlar(plano(frase));
    if (!r || !patron.test(r)) fallos.push(`${frase} -> ${r}`);
  }
  assert.deepEqual(fallos, []);
});

test('Heraldo: tamaño del cerebro, bienvenidas y cierres', () => {
  assert.ok(cuantasFrases() >= 300, `tiene ${cuantasFrases()}`);
  for (const b of [...BIENVENIDAS, ...BIENVENIDAS_VARIOS]) {
    assert.ok(b.includes('{quien}'), `bienvenida sin {quien}: ${b.slice(0, 40)}`);
  }
  assert.ok(CIERRES_BASE.length >= 10);
});

// ---------------------------------------------------------- compartido
test('charla-mas: cada categoria tiene patron valido y voz de Heraldo', () => {
  for (const c of MAS) {
    assert.ok(c.patron instanceof RegExp, `${c.nombre}: sin patron`);
    assert.ok(Array.isArray(c.heraldo) && Array.isArray(c.valquiria), `${c.nombre}: listas`);
    // Toda categoria tiene voz de Heraldo salvo las que el ya tenia en su
    // propio cerebro; las de Valquiria pueden ir vacias si ella ya las tiene.
    assert.ok(c.heraldo.length > 0, `${c.nombre}: Heraldo sin frases`);
  }
  const nombres = MAS.map((c) => c.nombre);
  assert.equal(new Set(nombres).size, nombres.length, 'categorias repetidas');
});

// ---------------------------------------------------------------- salud
test('las frases solo usan etiquetas HTML que Telegram acepta', () => {
  const todas = [
    ...BIENVENIDAS,
    ...BIENVENIDAS_VARIOS,
    ...BIENVENIDAS_VALQUIRIA,
    ...BIENVENIDAS_VALQUIRIA_VARIOS,
    ...MAS.flatMap((c) => [...c.heraldo, ...c.valquiria]),
  ];
  for (const f of todas) {
    const raras = (f.match(/<\/?([a-z]+)/g) ?? [])
      .map((x) => x.replace(/<\/?/, ''))
      .filter((x) => !['b', 'i', 'code', 'a'].includes(x));
    assert.deepEqual(raras, [], `etiqueta no permitida en: ${f.slice(0, 60)}`);
  }
});

test('ningun archivo de codigo tiene bytes de backspace (el \\b que se convirtio)', () => {
  // Ha pasado tres veces: un \b de regex que pasa por un heredoc se
  // convierte en 0x08 y el patron deja de casar en silencio.
  const dirs = ['web/lib', 'web/app/api', 'src/lib', 'src/jobs'];
  const conBackspace = [];
  for (const d of dirs) {
    const base = new URL(`../${d}/`, import.meta.url);
    for (const f of readdirSync(base, { recursive: true })) {
      if (!/\.(js|jsx|mjs)$/.test(f)) continue;
      const bytes = readFileSync(new URL(f.replace(/\\/g, '/'), base));
      if (bytes.includes(0x08)) conBackspace.push(`${d}/${f}`);
    }
  }
  assert.deepEqual(conBackspace, []);
});
