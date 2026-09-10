// La entrevista: leer el tag, resumir el perfil y levantar banderas.
//
// Corre con `npm test`. No toca red ni base de datos: todo lo de aqui es
// puro, y por eso se puede probar en un segundo cada vez que se cambia
// una frase o un umbral.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  leerTag,
  resumir,
  banderas,
  banderasRespuestas,
  resumenRespuestas,
  PLENO,
  CLANES,
  PRUEBA,
} from '../web/lib/aspirante.js';

test('leerTag: saca el tag de frases reales y no ve tags donde no los hay', () => {
  const casos = [
    ['#9VLQ0CR99', '#9VLQ0CR99'],
    ['mi tag es #9VLQ0CR99', '#9VLQ0CR99'],
    ['#9vlq0cr99', '#9VLQ0CR99'],
    ['# 9VLQ0CR99', '#9VLQ0CR99'],
    ['9VLQ0CR99', '#9VLQ0CR99'],
    // La O y el cero se confunden al copiar a mano; en los tags no hay O.
    ['9VLQOCR99', '#9VLQ0CR99'],
    ['Hola soy Pepe y mi tag es 9VLQ0CR99, quiero entrar', '#9VLQ0CR99'],
    ['#2GC', '#2GC'],
    ['#2Q0P0P2JU', '#2Q0P0P2JU'],
    // Sin almohadilla hay que apretar: "CULO" no es un tag.
    ['eres un culo', null],
    ['quiero entrar al clan por favor', null],
    ['hola', null],
    ['no se cual es', null],
    ['', null],
    ['gracias', null],
    ['dale', null],
    ['ya lo puse', null],
    ['ok', null],
  ];
  for (const [entrada, esperado] of casos) {
    assert.equal(leerTag(entrada), esperado, `leerTag(${JSON.stringify(entrada)})`);
  }
});

// Un perfil como lo devuelve la API de Supercell, recortado a lo que se usa.
const perfil = (extra = {}) => ({
  tag: '#9VLQ0CR99',
  name: 'iDrkseid',
  townHallLevel: 14,
  expLevel: 219,
  trophies: 0,
  bestTrophies: 4727,
  warPreference: 'in',
  clanCapitalContributions: 595970,
  labels: [{ name: 'Clan Wars' }, { name: 'Clan War League' }],
  clan: { tag: '#2CCJYG2YL', name: 'STRANGE-WORLD', clanLevel: 5 },
  role: 'coLeader',
  heroes: [
    { name: 'Barbarian King', level: 75, village: 'home' },
    { name: 'Archer Queen', level: 80, village: 'home' },
    { name: 'Battle Machine', level: 30, village: 'builderBase' },
  ],
  achievements: [
    { name: 'Friend in Need', value: 229490 },
    { name: 'War Hero', value: 2673 },
    { name: 'War League Legend', value: 1081 },
    { name: 'Games Champion', value: 175265 },
  ],
  ...extra,
});

test('resumir: se queda con lo que importa y traduce los heroes', () => {
  const r = resumir(perfil());
  assert.equal(r.nombre, 'iDrkseid');
  assert.equal(r.th, 14);
  assert.equal(r.donadoVida, 229490);
  assert.equal(r.guerraVida, 2673);
  assert.equal(r.cwlVida, 1081);
  assert.equal(r.guerraEncendida, true);
  assert.deepEqual(r.clan, { tag: '#2CCJYG2YL', nombre: 'STRANGE-WORLD', nivel: 5 });
  // Solo los de la aldea principal, con nombre en español.
  assert.deepEqual(r.heroes, [
    { nombre: 'Rey Bárbaro', nivel: 75 },
    { nombre: 'Reina Arquera', nivel: 80 },
  ]);
});

test('banderas: un veterano de casa sale limpio salvo por estar en un clan', () => {
  const b = banderas(resumir(perfil()));
  assert.deepEqual(
    b.map((x) => x.txt),
    ['está en STRANGE-WORLD']
  );
  assert.equal(b[0].grave, false);
});

test('banderas: guerra apagada y cero donado son graves; poca guerra y cuenta nueva, avisos', () => {
  const r = resumir(
    perfil({
      warPreference: 'out',
      expLevel: 40,
      clan: null,
      achievements: [
        { name: 'Friend in Need', value: 500 },
        { name: 'War Hero', value: 120 },
      ],
    })
  );
  const b = banderas(r);
  const graves = b.filter((x) => x.grave).map((x) => x.txt);
  const avisos = b.filter((x) => !x.grave).map((x) => x.txt);
  assert.deepEqual(graves, ['tiene la guerra apagada', 'casi no ha donado nunca']);
  assert.deepEqual(avisos, ['poca guerra jugada', 'cuenta nueva']);
});

test('banderas: los umbrales no suspenden a un jugador normal de la casa', () => {
  // Nuestro p10 real: 34.905 donados, 825 estrellas de guerra. Tiene que
  // pasar sin bandera grave.
  const r = resumir(
    perfil({
      clan: null,
      achievements: [
        { name: 'Friend in Need', value: 34905 },
        { name: 'War Hero', value: 825 },
        { name: 'War League Legend', value: 55 },
      ],
    })
  );
  assert.equal(banderas(r).some((x) => x.grave), false);
});

test('banderasRespuestas: lo que dicen las respuestas de la entrevista', () => {
  const b = banderasRespuestas({
    pleno: 'menos',
    clanes: '4+',
    heroe: { nombre: 'Rey Bárbaro', real: 65, dijo: 40, segundos: 140, acierta: false },
    prueba: 'video',
  });
  assert.deepEqual(
    b.map((x) => [x.txt, x.grave]),
    [
      ['no supo el nivel de su Rey Bárbaro (dijo 40, tiene 65)', true],
      ['cambia de clan a menudo: 4 o más en 6 meses', true],
      ['dice que hace pleno menos de la mitad', false],
      ['prometió video y no lo mandó', false],
    ]
  );
  // Acierta pero tardo: aviso, no rojo.
  const lento = banderasRespuestas({ heroe: { nombre: 'Reina Arquera', real: 80, dijo: 80, segundos: 200, acierta: true } });
  assert.deepEqual(lento, [{ txt: 'tardó 200s en decir el nivel de su Reina Arquera', grave: false }]);
  // Sin respuestas, sin banderas.
  assert.deepEqual(banderasRespuestas({}), []);
});

test('resumenRespuestas: una linea por respuesta, en el orden de la entrevista', () => {
  const lineas = resumenRespuestas({
    pleno: '75',
    ejercito: 'hydra',
    heroe: { nombre: 'Reina Arquera', real: 80, dijo: 80, segundos: 11, acierta: true },
    clanes: '1',
    prueba: 'reto',
  });
  assert.equal(lineas.length, 5);
  assert.match(lineas[0], /3 de cada 4/);
  assert.match(lineas[2], /dijo 80, tiene 80 ✅ \(11s\)/);
  assert.match(lineas[4], /reto en amistosa/);
});

test('las opciones de la entrevista tienen clave y etiqueta, sin repetir', () => {
  for (const lista of [PLENO, CLANES, PRUEBA]) {
    const claves = lista.map(([k]) => k);
    assert.equal(new Set(claves).size, claves.length, 'claves repetidas');
    for (const [k, etiqueta] of lista) {
      assert.ok(k && etiqueta, `opcion vacia en ${JSON.stringify(lista)}`);
    }
  }
});
