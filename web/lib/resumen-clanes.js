// /resumen para todo el grupo: cada clan como lo ve un jugador (miembros,
// copas, liga de guerra, racha, la guerra de ahora). Lo de dentro -jobs,
// snapshots, bandeja de salida- era de los lideres y se fue a /sistema.
// Lo pidio Cris el 13 sep 2026: "los users no lo entienden".

import { enCuanto } from './guerras.js';

const num = (n) => Number(n ?? 0).toLocaleString('es');

const ENTRADA = { open: 'abierta', inviteOnly: 'por invitación', closed: 'cerrada' };

/** La linea de la guerra de ahora, a partir de estadoDelClan (guerras.js). */
export function lineaGuerra(g, { esc = (s) => s, ahora = Date.now() } = {}) {
  if (!g) return null;
  const que = g.liga ? 'liga' : 'guerra';
  if (g.estado === 'preparation') return `🛡 ${que} contra ${esc(g.rival)}: día de preparación, la batalla empieza en ${enCuanto(g.empieza, ahora)}`;
  if (g.estado === 'inWar') return `🔥 ${que} contra ${esc(g.rival)}: día de batalla, quedan ${enCuanto(g.termina, ahora)} · ${g.estrellas?.nosotros ?? 0}⭐ – ${g.estrellas?.ellos ?? 0}⭐`;
  if (g.estado === 'privado') return null;
  return '💤 sin guerra ahora';
}

/**
 * El bloque de un clan. `api` es lo que devuelve /clans/{tag} de la API
 * de Clash; `guerra`, estadoDelClan de ese clan (o null).
 */
export function bloqueClan({ nombre, api, guerra }, { esc = (s) => s, ahora = Date.now() } = {}) {
  const l = [];
  const cab = `<b>${esc(nombre || api?.name || '?')}</b>`;
  if (!api) {
    l.push(`${cab} · ahora mismo no puedo leerlo en el juego`);
    return l.join('\n');
  }
  l.push(`${cab} · nivel ${api.clanLevel ?? '?'} · ${api.members ?? '?'}/50 miembros`);
  l.push(`🏆 ${num(api.clanPoints)} copas · 🎖 ${esc(api.warLeague?.name ?? 'sin liga')}`);
  const racha = Number(api.warWinStreak ?? 0);
  l.push(`⚔️ ${num(api.warWins)} guerras ganadas · 🔥 ${racha ? `racha de ${racha}` : 'sin racha'}`);
  const guerraLinea = lineaGuerra(guerra, { esc, ahora });
  if (guerraLinea) l.push(guerraLinea);
  const entrada = ENTRADA[api.type] ?? null;
  const requisitos = [api.requiredTownhallLevel ? `TH${api.requiredTownhallLevel} mínimo` : null, entrada ? `entrada ${entrada}` : null].filter(Boolean);
  if (requisitos.length) l.push(`🔑 ${requisitos.join(' · ')}`);
  return l.join('\n');
}

/** El resumen entero. `clanes`: [{ nombre, api, guerra }] en el orden de la alianza. */
export function textoResumenClanes(clanes, opciones = {}) {
  const bloques = clanes.map((c) => bloqueClan(c, opciones));
  return `🏰 <b>Strange Godz · los clanes ahora</b>\n\n${bloques.join('\n\n')}`;
}
