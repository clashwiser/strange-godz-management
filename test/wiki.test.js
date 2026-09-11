// La wiki como fuente de mecanicas: que entidades nombra un texto, y como
// se recorta una pagina para la IA. Sin red: el glosario va a mano.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { entidadesEn, recortar, aTexto } from '../web/lib/wiki.js';
import { esPreguntaDelJuego } from '../web/lib/conocimiento.js';

const glosario = [
  { pagina: 'Ruin Witch', tipo: 'tropa', nombres: ['ruin witch', 'ruin witches', 'bruja de ruina', 'brujas de ruina'] },
  { pagina: 'Thrower', tipo: 'tropa', nombres: ['thrower', 'throwers', 'lancero', 'lanceros'] },
  { pagina: 'Bowler', tipo: 'tropa', nombres: ['bowler', 'bowlers', 'lanzarrocas'] },
  { pagina: 'Super Bowler', tipo: 'tropa', nombres: ['super bowler', 'super bowlers', 'superlanzarrocas'] },
  { pagina: 'Dragon Rider', tipo: 'tropa', nombres: ['dragon rider', 'montadragones'] },
  { pagina: 'Archer', tipo: 'tropa', nombres: ['archer', 'arquera'] },
];

test('entidadesEn: ingles, español, plurales y sin tildes', () => {
  assert.deepEqual(entidadesEn('No haz visto el de lanceros? Throwers with ruin witches?', glosario).map((e) => e.pagina), ['Ruin Witch', 'Thrower']);
  assert.deepEqual(entidadesEn('¿qué hace la Bruja de Ruina?', glosario).map((e) => e.pagina), ['Ruin Witch']);
  assert.deepEqual(entidadesEn('los montadragones son buenos?', glosario).map((e) => e.pagina), ['Dragon Rider']);
});

test('entidadesEn: el nombre mas largo gana y no cuenta dos veces', () => {
  assert.deepEqual(entidadesEn('super bowler spam sirve?', glosario).map((e) => e.pagina), ['Super Bowler']);
  assert.deepEqual(entidadesEn('bowlers y bowlers', glosario).map((e) => e.pagina), ['Bowler']);
});

test('entidadesEn: no casa dentro de otras palabras ni sin glosario', () => {
  assert.deepEqual(entidadesEn('la marchera llego', glosario), []);
  assert.deepEqual(entidadesEn('hola heraldo', glosario), []);
  assert.deepEqual(entidadesEn('throwers', []), []);
  assert.deepEqual(entidadesEn('throwers', null), []);
});

test('esPreguntaDelJuego con glosario: nombrar una tropa en una pregunta ya cuenta', () => {
  assert.equal(esPreguntaDelJuego('Throwers with ruin witches?', glosario), true);
  assert.equal(esPreguntaDelJuego('cuéntame de los lanceros', glosario), true);
  assert.equal(esPreguntaDelJuego('Throwers with ruin witches?'), false, 'sin glosario no las conoce');
  assert.equal(esPreguntaDelJuego('mis lanceros estan en nivel 2', glosario), false, 'no es pregunta');
  assert.equal(esPreguntaDelJuego('¿quién falta por atacar con throwers?', glosario), false, 'dato del clan');
});

test('aTexto y recortar: de la pagina en HTML a resumen e historial', () => {
  const html = `<div class="mw-parser-output"><table class="infobox"><tr><td>x</td></tr></table>
<h2><span class="mw-headline">Summary</span><span class="mw-editsection">[ <a>edit</a> ]</span></h2>
<p>The Ruin Witch is a <b>Dark Elixir</b> troop. She summons a Ruin Knight.</p>
<h2><span>Strategies</span></h2><p>Pair her with Throwers.</p>
<h2><span>Upgrade Differences</span></h2><p>Level 2 looks blue.</p>
<h2><span>Statistics</span></h2><table><tr><td>HP 1000</td></tr></table>
<h2><span>History</span></h2><table><tr><th>Date</th><th>Description</th></tr>
<tr><td>August 31, 2026</td><td>Increased the numbers of Ruin Knight summoned from 8 to 10.</td></tr></table>
<h2><span>Audio</span></h2><p>ruido</p><script>x()</script></div>`;
  const t = aTexto(html);
  assert.doesNotMatch(t, /<|edit|x\(\)/);
  const cuerpo = recortar(t, /\bSummary\b/, /\b(Upgrade Differences|Statistics)\b/, 2000);
  assert.match(cuerpo, /^Summary/);
  assert.match(cuerpo, /She summons a Ruin Knight\. Strategies Pair her with Throwers\./);
  assert.doesNotMatch(cuerpo, /Level 2 looks blue/);
  const historia = recortar(t, /\bHistory\b/, /\b(Audio|Trivia|Comparisons|Gallery)\b/, 700);
  assert.match(historia, /August 31, 2026 Increased the numbers of Ruin Knight summoned from 8 to 10\./);
  assert.doesNotMatch(historia, /ruido/);
});
