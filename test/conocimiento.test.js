// Que preguntas van a la IA con busqueda web y cuales no.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { esPreguntaDelJuego } from '../web/lib/conocimiento.js';

test('esPreguntaDelJuego: lo que se busca en la web', () => {
  const si = [
    'cual es el mejor ejercito de clash of clans en el momento?',
    '@Valqui_bot cuál es el mejor ejército de Clash of Clans en el momento?',
    'que ejercito uso para th14',
    '¿cuándo sale la actualización?',
    'como hago un lalo?',
    '¿qué hace el equipamiento del rey?',
    'cuanto cuesta subir el ayuntamiento 17?',
    'que tal el nuevo evento?',
    'Heraldo, ¿qué hechizos llevo con dragones?',
    'recomiendame una estrategia para th16',
    'valquiria que tropas te gustan?',
    'hay nerf a los super arqueros?',
  ];
  const fallos = si.filter((f) => !esPreguntaDelJuego(f));
  assert.deepEqual(fallos, [], 'deberian ir a la web');
});

test('esPreguntaDelJuego: lo que NO se busca en la web', () => {
  const no = [
    'Valquiria, ¿tú sabes bailar casino?',
    '¿qué opinas de los perros?',
    'mis heroes estan durmiendo',
    'heraldo dame una base para guerra',
    '¿quién falta por atacar?',
    '¿cómo vamos en la liga?',
    'hola',
    '¿tienes hambre?',
    'Heraldo que sabes?',
    'quiero cambiar de ejercito',
    'mi meta es llegar a leyenda',
    '¿cuánto voy a cobrar?',
    '¿pa qué clan voy yo?',
    '',
    null,
  ];
  const fallos = no.filter((f) => esPreguntaDelJuego(f));
  assert.deepEqual(fallos, [], 'no deberian ir a la web');
});
