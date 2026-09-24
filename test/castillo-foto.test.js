// La foto del castillo: que imagen trae el mensaje, quien esta debajo de
// quien, y el juicio de lo que leyo el modelo contra lo que dice la API.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fotoDe, castilloDeAbajo, parecidos, juzgar, tropaValida, pareceNombreDeClan, confirmaSegunda, estaLleno, lecturaDudosa, barraDelCastillo } from '../web/lib/castillo-foto.js';
import { extraerJson } from '../web/lib/vision.js';

const guerra = {
  state: 'preparation',
  opponent: { name: 'Dragones Rojos' },
  clan: {
    members: [
      { tag: '#C', name: 'Caro', mapPosition: 3, townhallLevel: 16 },
      { tag: '#A', name: 'Assassins', mapPosition: 1, townhallLevel: 18 },
      { tag: '#B', name: 'Beto ツ', mapPosition: 2, townhallLevel: 17 },
    ],
  },
};

test('fotoDe: la foto mas grande, o un archivo de imagen; nada mas', () => {
  const msg = { photo: [{ file_id: 'chica', width: 90, height: 160 }, { file_id: 'grande', width: 720, height: 1280, file_size: 150000 }] };
  assert.deepEqual(fotoDe(msg), { fileId: 'grande', mime: 'image/jpeg', bytes: 150000 });
  assert.deepEqual(fotoDe({ document: { file_id: 'd', mime_type: 'image/png', file_size: 10 } }), { fileId: 'd', mime: 'image/png', bytes: 10 });
  assert.equal(fotoDe({ document: { file_id: 'd', mime_type: 'application/pdf' } }), null);
  assert.equal(fotoDe({ text: 'hola' }), null);
});

test('castilloDeAbajo: el siguiente en el mapa, y el ultimo dona al primero', () => {
  assert.deepEqual(castilloDeAbajo(guerra, '#A').abajo, { posicion: 2, nombre: 'Beto ツ', tag: '#B', th: 17 });
  assert.deepEqual(castilloDeAbajo(guerra, 'b').abajo.nombre, 'Caro');
  assert.equal(castilloDeAbajo(guerra, '#C').abajo.tag, '#A');
  assert.equal(castilloDeAbajo(guerra, '#ZZ'), null);
  assert.equal(castilloDeAbajo({ clan: { members: [] } }, '#A'), null);
});

test('parecidos: nombres leidos por OCR con un fallo o un simbolo de menos', () => {
  assert.equal(parecidos('Beto ツ', 'Beto'), true);
  assert.equal(parecidos('Assasins', 'Assassins'), true);
  assert.equal(parecidos('ASSASSINS', 'Assassins'), true);
  assert.equal(parecidos('Caro', 'Carlos'), true); // contiene; aceptable en un mapa de 15
  assert.equal(parecidos('Beto', 'Caro'), false);
  assert.equal(parecidos('', 'Caro'), false);
  // El alfabeto "tachado": el juego lo pinta como letras normales y asi lo lee el modelo.
  assert.equal(parecidos('ØVERHAMMER', '꧁Ø︎VɆⱤⱧ₳₥₥ɆⱤ꧂'), true);
  assert.equal(parecidos('OVERHAMMER', '꧁Ø︎VɆⱤⱧ₳₥₥ɆⱤ꧂'), true);
  // Nombres que no son latinos: el rival «龙之城» (14 sep 2026) se leia igual y aun asi "otra guerra".
  assert.equal(parecidos('龙之城', '龙之城'), true);
  assert.equal(parecidos('龙之城 ', '龙之城'), true);
  assert.equal(parecidos('龙之城', '北方狼'), false);
  assert.equal(parecidos('龙之城', 'x300'), false);
});

test('juzgar: el rival chino leido igual no es "otra guerra"', () => {
  const l = lectura({ es_mapa_de_guerra: true, clan_enemigo: '龙之城', bases: [{ posicion: 9, nombre: 'DRAKON', tropas: 55, capacidad: 55, ventana: true }] });
  const r = juzgar({ lectura: l, abajo: { posicion: 9, nombre: 'DR∆K⚫️N' }, oponente: '龙之城', propio: 'x300' });
  assert.equal(r.veredicto, 'lleno');
  assert.equal(juzgar({ lectura: l, abajo: { posicion: 9, nombre: 'DR∆K⚫️N' }, oponente: '北方狼', propio: 'x300' }).veredicto, 'otra_guerra');
});

test('juzgar: la ventana de abajo con un nombre de letras tachadas (la foto de Cris del 14 sep)', () => {
  const l = lectura({
    es_mapa_de_guerra: true,
    fase: 'preparacion',
    clan_enemigo: 'CHRISTIAN ARMY',
    bases: [
      { posicion: 1, nombre: '★(K)(I)(N)(G)★', tropas: 0, capacidad: 55, ventana: false },
      { posicion: 4, nombre: "Assassin's Cred", tropas: 0, capacidad: 55, ventana: false },
      { posicion: 3, nombre: 'ØVERHAMMER', tropas: 55, capacidad: 55, ventana: true },
    ],
    tropas_donadas: [{ tropa: 'Arquera', cantidad: 1, nivel: 14 }, { tropa: 'Bruja', cantidad: 4, nivel: 4 }],
  });
  const r = juzgar({ lectura: l, abajo: { posicion: 3, nombre: '꧁Ø︎VɆⱤⱧ₳₥₥ɆⱤ꧂' }, oponente: 'Christian Army', propio: 'x300' });
  assert.equal(r.veredicto, 'lleno');
  assert.equal(r.tropas, 55);
});

const lectura = (json) => ({ json });
const abajo = { posicion: 2, nombre: 'Beto ツ' };

test('juzgar: lleno cuando el de abajo esta a tope', () => {
  const l = lectura({ es_mapa_de_guerra: true, clan_enemigo: 'Dragones Rojos', bases: [{ posicion: 1, nombre: 'Assassins', tropas: 55, capacidad: 55 }, { posicion: 2, nombre: 'Beto', tropas: 50, capacidad: 50 }] });
  assert.deepEqual(juzgar({ lectura: l, abajo, oponente: 'Dragones Rojos' }), { veredicto: 'lleno', tropas: 50, capacidad: 50, leido: 'Beto', donado: '' });
});

test('juzgar: la ventana de abajo manda sobre la etiqueta del mapa, y se cuentan las tropas donadas', () => {
  // La captura de Cris: en el mapa "22. Axe", y la ventana "23. davinder 55/55" con 1 golem de hielo y 1 dragon.
  const l = lectura({
    es_mapa_de_guerra: true,
    fase: 'preparacion',
    clan_enemigo: 'ITALIA REIS',
    bases: [
      { posicion: 20, nombre: 'Adima', tropas: 0, capacidad: 55, ventana: false },
      { posicion: 21, nombre: 'Zip', tropas: 0, capacidad: 55, ventana: false },
      { posicion: 22, nombre: 'Axe', tropas: null, capacidad: null, ventana: false },
      { posicion: 23, nombre: 'davinder', tropas: 0, capacidad: 55, ventana: false },
      { posicion: 23, nombre: 'davinder', tropas: 55, capacidad: 55, ventana: true },
    ],
    tropas_donadas: [{ tropa: 'Ice Golem', cantidad: 1, nivel: 9 }, { tropa: 'Dragon', cantidad: 1, nivel: 13 }],
  });
  const r = juzgar({ lectura: l, abajo: { posicion: 23, nombre: 'davinder' }, oponente: 'ITALIA REIS', propio: 'KRIPTIC SOULS' });
  assert.equal(r.veredicto, 'lleno');
  assert.equal(r.tropas, 55);
  assert.equal(r.donado, '1× Ice Golem n9, 1× Dragon n13');
  // Y si el modelo lee "KRIPTIC SOULS" como rival (el lado equivocado de la cabecera), no se rechaza.
  const l2 = lectura({ ...l.json, clan_enemigo: 'KRIPTIC SOULS' });
  assert.equal(juzgar({ lectura: l2, abajo: { posicion: 23, nombre: 'davinder' }, oponente: 'ITALIA REIS', propio: 'KRIPTIC SOULS' }).veredicto, 'lleno');
});

test('juzgar: incompleto con los numeros leidos', () => {
  const l = lectura({ es_mapa_de_guerra: true, clan_enemigo: null, bases: [{ posicion: 2, nombre: 'Beto ツ', tropas: 30, capacidad: 50 }] });
  assert.equal(juzgar({ lectura: l, abajo, oponente: 'Dragones Rojos' }).veredicto, 'incompleto');
});

test('juzgar: la ventana de una sola base, sin posicion, se casa por el nombre', () => {
  const l = lectura({ es_mapa_de_guerra: true, bases: [{ posicion: null, nombre: 'Beto', tropas: 50, capacidad: 50 }] });
  assert.equal(juzgar({ lectura: l, abajo, oponente: 'Dragones Rojos' }).veredicto, 'lleno');
});

test('juzgar: otra guerra si el rival leido no es el de ahora; nuestro propio nombre no cuenta', () => {
  const l = lectura({ es_mapa_de_guerra: true, clan_enemigo: 'Los Pollos', bases: [{ posicion: 2, nombre: 'Beto', tropas: 50, capacidad: 50 }] });
  assert.deepEqual(juzgar({ lectura: l, abajo, oponente: 'Dragones Rojos', propio: 'x300' }), { veredicto: 'otra_guerra', leido: 'Los Pollos' });
  const nuestro = lectura({ es_mapa_de_guerra: true, clan_enemigo: 'x300', bases: [{ posicion: 2, nombre: 'Beto', tropas: 50, capacidad: 50 }] });
  assert.equal(juzgar({ lectura: nuestro, abajo, oponente: 'Dragones Rojos', propio: 'x300' }).veredicto, 'lleno');
});

test('juzgar: no se ve si el de abajo no sale, o la posicion cuadra pero el nombre no', () => {
  const sinEl = lectura({ es_mapa_de_guerra: true, bases: [{ posicion: 1, nombre: 'Assassins', tropas: 55, capacidad: 55 }, { posicion: 3, nombre: 'Caro', tropas: 40, capacidad: 40 }] });
  assert.equal(juzgar({ lectura: sinEl, abajo, oponente: null }).veredicto, 'no_se_ve');
  const otroNombre = lectura({ es_mapa_de_guerra: true, bases: [{ posicion: 2, nombre: 'Pepe', tropas: 50, capacidad: 50 }, { posicion: 3, nombre: 'Caro', tropas: 40, capacidad: 40 }] });
  assert.equal(juzgar({ lectura: otroNombre, abajo, oponente: null }).veredicto, 'no_se_ve');
  const sinNumeros = lectura({ es_mapa_de_guerra: true, bases: [{ posicion: 2, nombre: 'Beto', tropas: null, capacidad: null }] });
  assert.equal(juzgar({ lectura: sinNumeros, abajo, oponente: null }).veredicto, 'no_se_ve');
});

test('juzgar: no es mapa, o ilegible', () => {
  assert.equal(juzgar({ lectura: lectura({ es_mapa_de_guerra: false, bases: [] }), abajo, oponente: null }).veredicto, 'no_es_mapa');
  assert.equal(juzgar({ lectura: null, abajo, oponente: null }).veredicto, 'ilegible');
  assert.equal(juzgar({ lectura: { json: null }, abajo, oponente: null }).veredicto, 'ilegible');
});

test('extraerJson: el objeto aunque venga envuelto', () => {
  assert.deepEqual(extraerJson('Aquí va:\n```json\n{"a": 1}\n```'), { a: 1 });
  assert.equal(extraerJson('sin nada'), null);
  assert.equal(extraerJson('{roto'), null);
});

test('las tropas donadas: solo nombres de Clash of Clans; lo de Clash Royale se descarta', () => {
  assert.equal(tropaValida('Headhunter'), 'Headhunter');
  assert.equal(tropaValida('super witch'), 'Super Witch');
  assert.equal(tropaValida('Dark Wizard'), null);
  assert.equal(tropaValida('Royal Giant'), null);
  assert.equal(tropaValida(null), null);
  const l = lectura({ es_mapa_de_guerra: true, clan_enemigo: 'Rival', bases: [{ posicion: 2, nombre: 'Beto', tropas: 55, capacidad: 55, ventana: true }], tropas_donadas: [{ tropa: 'Archer', cantidad: 7, nivel: 14 }, { tropa: 'Dark Wizard', cantidad: 5, nivel: 4 }, { tropa: 'Furnace', cantidad: 1, nivel: 4 }] });
  assert.equal(juzgar({ lectura: l, abajo, oponente: 'Rival' }).donado, '7× Archer n14, 1× Furnace n4');
});

// El reloj de la cabecera no es el rival: el 24 sep 2026 Heraldo rechazo
// una captura buena de Pepe porque leyo "21M" donde buscaba el clan.
test('pareceNombreDeClan: el reloj y los numeros no son un clan', () => {
  for (const x of ['STIVEN_COC_500', 'Canadian Elite', '龙之城', 'WILD GORKHAS']) assert.equal(pareceNombreDeClan(x), true, x);
  for (const x of ['21M', '2D', '2D 4H', '45S', '0/55', '12:30', '45%', 'x300', '', null]) assert.equal(pareceNombreDeClan(x), false, String(x));
});

test('confirmaSegunda: la 2a lectura vale si esta llena Y es la base de abajo', () => {
  const abajo = { posicion: 20, nombre: '[ $alvo ]' };
  assert.equal(confirmaSegunda({ tropas: 55, capacidad: 55, posicion: 20, nombre: '[ $alvo ]' }, abajo), true);
  assert.equal(confirmaSegunda({ tropas: 45, capacidad: 45, posicion: null, nombre: '[ $alvo ]' }, abajo), true);
  assert.equal(confirmaSegunda({ tropas: 55, capacidad: 55, posicion: 21, nombre: 'Otro' }, abajo), false);
  assert.equal(confirmaSegunda({ tropas: 20, capacidad: 55, posicion: 20 }, abajo), false);
  assert.equal(confirmaSegunda({ tropas: null, capacidad: null }, abajo), false);
  // Sin nombre ni posicion no se sabe de quien es la ventana: no cuela.
  assert.equal(confirmaSegunda({ tropas: 55, capacidad: 55, posicion: null, nombre: null }, abajo), false);
  assert.equal(confirmaSegunda(null, abajo), false);
});

// El castillo de Deibis (24 sep 2026): estaba lleno y Heraldo le dijo
// "0/55". Los numeros de la barra se leen mal; hay dos señas mas.
test('estaLleno: los numeros, la barra entera o el boton Donate apagado', () => {
  assert.equal(estaLleno({ tropas: 55, capacidad: 55 }), true);
  assert.equal(estaLleno({ tropas: 30, capacidad: 55 }), false);
  assert.equal(estaLleno({ tropas: null, capacidad: null, barraLlena: true }), true);
  assert.equal(estaLleno({ tropas: null, capacidad: null, barraLlena: false }), false);
  assert.equal(estaLleno({ tropas: null, capacidad: null, botonDonar: 'apagado', tropasDonadas: 4 }), true);
  assert.equal(estaLleno({ tropas: null, capacidad: null, botonDonar: 'apagado', tropasDonadas: 0 }), false);
  assert.equal(estaLleno(null), false);
});

test('lecturaDudosa: un 0 con tropas dentro no se le dice a nadie', () => {
  assert.equal(lecturaDudosa({ tropas: 0, capacidad: 55, tropasDonadas: 4 }), true);
  assert.equal(lecturaDudosa({ tropas: null, capacidad: 55, tropasDonadas: 2 }), true);
  assert.equal(lecturaDudosa({ tropas: 20, capacidad: 55, tropasDonadas: 3 }), false);
  assert.equal(lecturaDudosa({ tropas: 0, capacidad: 55, tropasDonadas: 0 }), false); // vacio de verdad
  assert.equal(lecturaDudosa(null), true);
});

test('confirmaSegunda: vale la barra llena aunque los numeros no se lean', () => {
  const abajo = { posicion: 7, nombre: 'EL MATATAN' };
  assert.equal(confirmaSegunda({ tropas: null, capacidad: null, barraLlena: true, posicion: 7 }, abajo), true);
  assert.equal(confirmaSegunda({ tropas: null, capacidad: null, botonDonar: 'apagado', tropasDonadas: 5, nombre: 'EL MATATAN' }, abajo), true);
  assert.equal(confirmaSegunda({ tropas: null, capacidad: null, barraLlena: true, posicion: 8 }, abajo), false); // otra base
});

// La foto de Deibis (24 sep 2026), mirada de verdad: la ventana de "7. EL
// MATATAN" tiene DOS numeros, "0/55" arriba junto a "¡Necesito refuerzos!"
// y "55/55" pegado al boton "Donar". Heraldo cogio el de arriba y le dijo
// que no habia donado, con el castillo lleno.
test('barraDelCastillo: de los dos numeros de la ventana, el de junto a "Donar"', () => {
  const foto = { tropas: 0, capacidad: 55, numeros: [{ texto: '0/55', junto_a_donar: false }, { texto: '55/55', junto_a_donar: true }] };
  assert.deepEqual(barraDelCastillo(foto), { tropas: 55, capacidad: 55 });
  assert.equal(estaLleno({ ...barraDelCastillo(foto), tropasDonadas: 4 }), true);
});

test('barraDelCastillo: sin saber cual es el de "Donar", el que más tropas ve', () => {
  assert.deepEqual(barraDelCastillo({ tropas: 0, capacidad: 55, numeros: [{ texto: '0/55' }, { texto: '55/55' }] }), { tropas: 55, capacidad: 55 });
});

test('barraDelCastillo: un castillo a medias sigue saliendo a medias', () => {
  const medio = { tropas: 30, capacidad: 55, numeros: [{ texto: '0/55' }, { texto: '30/55', junto_a_donar: true }] };
  assert.deepEqual(barraDelCastillo(medio), { tropas: 30, capacidad: 55 });
  assert.equal(estaLleno(barraDelCastillo(medio)), false);
});

test('barraDelCastillo: vacio de verdad (un solo numero, el de Donar) sigue vacio', () => {
  assert.deepEqual(barraDelCastillo({ tropas: 0, capacidad: 55, numeros: [{ texto: '0/55', junto_a_donar: true }] }), { tropas: 0, capacidad: 55 });
});

test('barraDelCastillo: sin lista de numeros, lo que dijo suelto', () => {
  assert.deepEqual(barraDelCastillo({ tropas: 45, capacidad: 45 }), { tropas: 45, capacidad: 45 });
  assert.deepEqual(barraDelCastillo({}), { tropas: null, capacidad: null });
});
