'use client';

// Vista de ejemplo, sin Supabase ni login. Sirve para ver como queda el panel
// antes de que haya datos reales, y para mostrarselo a Carlos y Deibis.
// Los CLANES son los de verdad; los numeros son inventados.

import { useState } from 'react';
import { Resumen, CWL, Jugadores, Mensajes } from '../page';
import GrupoCWL from '../grupo-cwl';
import Alineacion from '../alineacion';
import SelectorTema from '../temas';
import { SelectorIdioma, useT } from '../idioma';
import Bots from '../bots';
import Bases from '../bases';
import Bonos from '../bonos';
import Salud from '../salud';
import Solicitudes from '../solicitudes';
import Heraldo from '../heraldo';

const d = {
  temporada: '2026-09',
  fechaSnap: '2026-09-08',
  clans: [
    { clan_tag: '#2GC',       nombre: 'x300',                     escuadra: 'A', es_principal: true, orden: 1, cwl_tamano: 15 },
    { clan_tag: '#2CCJYG2YL', nombre: 'ＳＴＲＡＮＧＥ - ＷＯＲＬＤ', escuadra: 'B', orden: 2, cwl_tamano: 15 },
    { clan_tag: '#228QU9Q8',  nombre: 'Olympus',                  escuadra: 'C', orden: 3, cwl_tamano: 15, proposito: 'trofeos' },
    { clan_tag: '#JUYP2PL',   nombre: 'Cuban Pirates ⚓️',          orden: 4, cwl_tamano: 15, proposito: 'trofeos' },
    { clan_tag: '#2Q0P0P2JU', nombre: 'Cuba',                     orden: 5, cwl_tamano: 15 },
  ],
  players: [
    { player_tag: '#P1', nombre_actual: 'Cris' },
    { player_tag: '#P2', nombre_actual: 'Dr Strange' },
    { player_tag: '#P3', nombre_actual: 'Deibis' },
    { player_tag: '#P4', nombre_actual: 'ElMago' },
    { player_tag: '#P5', nombre_actual: 'Yandy' },
    { player_tag: '#P6', nombre_actual: 'Reyniel' },
    { player_tag: '#P7', nombre_actual: 'Dayron' },
    { player_tag: '#P8', nombre_actual: 'Kraken' },
  ],
  snaps: [
    { player_tag: '#P1', clan_tag: '#2GC',       th_level: 18, trofeos: 5820, liga: 'Legend League',      war_stars: 2410, donaciones: 1200, donaciones_recibidas: 400 },
    { player_tag: '#P2', clan_tag: '#2GC',       th_level: 18, trofeos: 5410, liga: 'Titan League I',     war_stars: 1980, donaciones: 90, donaciones_recibidas: 1500 },
    { player_tag: '#P6', clan_tag: '#2GC',       th_level: 18, trofeos: 5330, liga: 'Titan League I',     war_stars: 2050, donaciones: 1440, donaciones_recibidas: 620 },
    { player_tag: '#P3', clan_tag: '#2CCJYG2YL', th_level: 18, trofeos: 5100, liga: 'Titan League II',    war_stars: 1750, donaciones: 640, donaciones_recibidas: 900 },
    { player_tag: '#P4', clan_tag: '#2CCJYG2YL', th_level: 18, trofeos: 4980, liga: 'Titan League III',   war_stars: 1520, donaciones: 0, donaciones_recibidas: 0 },
    { player_tag: '#P7', clan_tag: '#228QU9Q8',  th_level: 17, trofeos: 4710, liga: 'Champion League I',  war_stars: 1310, donaciones: 380, donaciones_recibidas: 0 },
    { player_tag: '#P5', clan_tag: '#228QU9Q8',  th_level: 17, trofeos: 4600, liga: 'Champion League I',  war_stars: 1180, donaciones: 0, donaciones_recibidas: 0 },
    { player_tag: '#P8', clan_tag: '#JUYP2PL',   th_level: 16, trofeos: 4310, liga: 'Champion League II', war_stars: 940,  donaciones: 0, donaciones_recibidas: 300 },
  ],
  seasons: [
    { id: 10, temporada: '2026-09', clan_tag: '#2GC',       liga: 'Champion League I' },
    { id: 11, temporada: '2026-09', clan_tag: '#2CCJYG2YL', liga: 'Master League I' },
  ],
  // Grupo de CWL de ejemplo: 8 clanes, 3 rondas cerradas y la cuarta en
  // curso. Sirve para ver la tabla y el analisis sin base de datos.
  grupo: [
    { id: 1, season_id: 10, ronda: 1, war_tag: '#W1', clan_a_tag: '#2GC', clan_a_nombre: 'x300', estrellas_a: 38, destruccion_a: 79.80, clan_b_tag: '#R1', clan_b_nombre: 'Rivales FC', estrellas_b: 35, destruccion_b: 73.50, estado: 'warEnded' },
    { id: 2, season_id: 10, ronda: 1, war_tag: '#W2', clan_a_tag: '#R2', clan_a_nombre: 'Los Duros', estrellas_a: 39, destruccion_a: 81.90, clan_b_tag: '#R3', clan_b_nombre: 'Nakama', estrellas_b: 43, destruccion_b: 90.30, estado: 'warEnded' },
    { id: 3, season_id: 10, ronda: 1, war_tag: '#W3', clan_a_tag: '#R4', clan_a_nombre: 'Blitz', estrellas_a: 33, destruccion_a: 69.30, clan_b_tag: '#R5', clan_b_nombre: 'Dragon', estrellas_b: 34, destruccion_b: 71.40, estado: 'warEnded' },
    { id: 4, season_id: 10, ronda: 1, war_tag: '#W4', clan_a_tag: '#R6', clan_a_nombre: 'UAE', estrellas_a: 41, destruccion_a: 86.10, clan_b_tag: '#R7', clan_b_nombre: 'Vampier', estrellas_b: 34, destruccion_b: 71.40, estado: 'warEnded' },
    { id: 5, season_id: 10, ronda: 2, war_tag: '#W5', clan_a_tag: '#2GC', clan_a_nombre: 'x300', estrellas_a: 38, destruccion_a: 79.80, clan_b_tag: '#R2', clan_b_nombre: 'Los Duros', estrellas_b: 42, destruccion_b: 88.20, estado: 'warEnded' },
    { id: 6, season_id: 10, ronda: 2, war_tag: '#W6', clan_a_tag: '#R1', clan_a_nombre: 'Rivales FC', estrellas_a: 33, destruccion_a: 69.30, clan_b_tag: '#R3', clan_b_nombre: 'Nakama', estrellas_b: 41, destruccion_b: 86.10, estado: 'warEnded' },
    { id: 7, season_id: 10, ronda: 2, war_tag: '#W7', clan_a_tag: '#R4', clan_a_nombre: 'Blitz', estrellas_a: 36, destruccion_a: 75.60, clan_b_tag: '#R6', clan_b_nombre: 'UAE', estrellas_b: 33, destruccion_b: 69.30, estado: 'warEnded' },
    { id: 8, season_id: 10, ronda: 2, war_tag: '#W8', clan_a_tag: '#R5', clan_a_nombre: 'Dragon', estrellas_a: 34, destruccion_a: 71.40, clan_b_tag: '#R7', clan_b_nombre: 'Vampier', estrellas_b: 39, destruccion_b: 81.90, estado: 'warEnded' },
    { id: 9, season_id: 10, ronda: 3, war_tag: '#W9', clan_a_tag: '#2GC', clan_a_nombre: 'x300', estrellas_a: 39, destruccion_a: 81.90, clan_b_tag: '#R3', clan_b_nombre: 'Nakama', estrellas_b: 34, destruccion_b: 71.40, estado: 'warEnded' },
    { id: 10, season_id: 10, ronda: 3, war_tag: '#W10', clan_a_tag: '#R1', clan_a_nombre: 'Rivales FC', estrellas_a: 36, destruccion_a: 75.60, clan_b_tag: '#R2', clan_b_nombre: 'Los Duros', estrellas_b: 34, destruccion_b: 71.40, estado: 'warEnded' },
    { id: 11, season_id: 10, ronda: 3, war_tag: '#W11', clan_a_tag: '#R4', clan_a_nombre: 'Blitz', estrellas_a: 41, destruccion_a: 86.10, clan_b_tag: '#R7', clan_b_nombre: 'Vampier', estrellas_b: 39, destruccion_b: 81.90, estado: 'warEnded' },
    { id: 12, season_id: 10, ronda: 3, war_tag: '#W12', clan_a_tag: '#R5', clan_a_nombre: 'Dragon', estrellas_a: 33, destruccion_a: 69.30, clan_b_tag: '#R6', clan_b_nombre: 'UAE', estrellas_b: 42, destruccion_b: 88.20, estado: 'warEnded' },
    { id: 13, season_id: 10, ronda: 4, war_tag: '#W13', clan_a_tag: '#2GC', clan_a_nombre: 'x300', estrellas_a: 21, destruccion_a: 44.10, clan_b_tag: '#R4', clan_b_nombre: 'Blitz', estrellas_b: 23, destruccion_b: 48.30, estado: 'inWar' },
    { id: 14, season_id: 10, ronda: 4, war_tag: '#W14', clan_a_tag: '#R1', clan_a_nombre: 'Rivales FC', estrellas_a: 30, destruccion_a: 63.00, clan_b_tag: '#R5', clan_b_nombre: 'Dragon', estrellas_b: 30, destruccion_b: 63.00, estado: 'inWar' },
    { id: 15, season_id: 10, ronda: 4, war_tag: '#W15', clan_a_tag: '#R2', clan_a_nombre: 'Los Duros', estrellas_a: 29, destruccion_a: 60.90, clan_b_tag: '#R6', clan_b_nombre: 'UAE', estrellas_b: 20, destruccion_b: 42.00, estado: 'inWar' },
    { id: 16, season_id: 10, ronda: 4, war_tag: '#W16', clan_a_tag: '#R3', clan_a_nombre: 'Nakama', estrellas_a: 29, destruccion_a: 60.90, clan_b_tag: '#R7', clan_b_nombre: 'Vampier', estrellas_b: 29, destruccion_b: 60.90, estado: 'inWar' },
  ],
  ligas: [
    { liga: 'Champion League I', orden: 18, promueven: 1, descienden: 2 },
    { liga: 'Master League I', orden: 15, promueven: 1, descienden: 2 },
  ],
  wars: [
    { id: 1, season_id: 10, ronda: 1, clan_rival_nombre: 'Rivales FC', estrellas_nuestras: 44, estrellas_rival: 41, estado: 'warEnded' },
    { id: 2, season_id: 10, ronda: 2, clan_rival_nombre: 'Los Duros',  estrellas_nuestras: 45, estrellas_rival: 45, estado: 'warEnded' },
    { id: 3, season_id: 11, ronda: 1, clan_rival_nombre: 'Titanes',    estrellas_nuestras: 30, estrellas_rival: 28, estado: 'inWar' },
  ],
  ataques: [
    { war_id: 1, player_tag: '#P1', estrellas: 3, destruccion_pct: 100 },
    { war_id: 2, player_tag: '#P1', estrellas: 3, destruccion_pct: 100 },
    { war_id: 1, player_tag: '#P2', estrellas: 3, destruccion_pct: 98 },
    { war_id: 2, player_tag: '#P2', estrellas: 2, destruccion_pct: 87 },
    { war_id: 1, player_tag: '#P6', estrellas: 3, destruccion_pct: 100 },
    { war_id: 2, player_tag: '#P6', estrellas: 3, destruccion_pct: 96 },
    { war_id: 1, player_tag: '#P4', estrellas: 2, destruccion_pct: 76 },
    { war_id: 1, player_tag: '#P7', estrellas: 3, destruccion_pct: 100 },
    { war_id: 2, player_tag: '#P7', estrellas: 1, destruccion_pct: 58 },
  ],
  roster: [1, 2].flatMap((w) =>
    ['#P1', '#P2', '#P3', '#P4', '#P6', '#P7'].map((p) => ({ war_id: w, player_tag: p }))
  ),
  solicitudes: [
    {
      id: 1, tg_user_id: 111, tg_nombre: 'Yandiel', tg_username: 'yandiel_cu',
      player_tag: '#PP0RJ2C', estado: 'pendiente', paso: 'listo',
      creado_en: '2026-09-10T14:20:00Z',
      perfil: {
        tag: '#PP0RJ2C', nombre: 'Yandiel', th: 16, nivel: 191, trofeos: 4210,
        mejorTrofeos: 5120, guerraEncendida: true, donadoVida: 412300,
        guerraVida: 3110, cwlVida: 940, juegosVida: 188400, capital: 421000,
        etiquetas: ['Clan Wars', 'Clan War League', 'Active Daily'], clan: null, rol: null,
      },
      respuestas: {
        pleno: '75', ejercito: 'Hydra con 4 globos y rabia',
        heroe: { nombre: 'Reina Arquera', real: 75, dijo: 75, segundos: 11, acierta: true },
        clanes: '1', prueba: 'video', video: { file_id: 'demo', duracion: 118 },
        cuenta: 'Soy de Santiago, juego de noche despues del trabajo. Vengo del clan de un primo que se disolvio y quiero guerra en serio.',
      },
    },
    {
      id: 2, tg_user_id: 222, tg_nombre: 'Miguel', tg_username: null,
      player_tag: '#LQ9CGY2', estado: 'pendiente', paso: 'listo',
      creado_en: '2026-09-10T09:05:00Z',
      perfil: {
        tag: '#LQ9CGY2', nombre: 'MiguelitoTH13', th: 13, nivel: 52, trofeos: 2100,
        mejorTrofeos: 2680, guerraEncendida: false, donadoVida: 3100,
        guerraVida: 180, cwlVida: 0, juegosVida: 4200, capital: 12000,
        etiquetas: ['Farming', 'Friendly'],
        clan: { tag: '#ABC', nombre: 'Los Panas', nivel: 3 }, rol: 'member',
      },
      respuestas: {
        pleno: 'menos', ejercito: 'gigantes y arqueras',
        heroe: { nombre: 'Rey Bárbaro', real: 65, dijo: 40, segundos: 140, acierta: false },
        clanes: '4+', prueba: 'reto',
        cuenta: 'quiero entrar',
      },
    },
    {
      id: 3, tg_user_id: 333, tg_nombre: 'Rey', tg_username: 'reyduro',
      player_tag: '#2QYU0LP', estado: 'prueba', paso: 'listo',
      clan_destino: '#2GC', creado_en: '2026-09-09T18:00:00Z',
      perfil: null,
      respuestas: { cuenta: 'Juego desde 2019, TH17, busco CWL competitiva.' },
      nota: 'Lo trajo Reyniel. Falta la amistosa.',
    },
  ],
  memberships: [
    { player_tag: '#P8', clan_tag: '#JUYP2PL',   desde: '2026-08-01', hasta: null,         rol: 'member' },
    { player_tag: '#P5', clan_tag: '#228QU9Q8',  desde: '2026-09-05', hasta: null,         rol: 'member' },
    { player_tag: '#P4', clan_tag: '#2CCJYG2YL', desde: '2026-09-02', hasta: '2026-09-07', rol: 'member' },
  ],
  jobs: [
    { id: 1, job: 'snapshot_diario', started_at: '2026-09-08T06:00:00Z', ok: true, filas: 118 },
    { id: 2, job: 'sync_cwl',        started_at: '2026-09-08T08:00:00Z', ok: true, filas: 92 },
    { id: 3, job: 'alerta_cwl',      started_at: '2026-09-08T08:01:00Z', ok: true, filas: 3 },
    { id: 4, job: 'raids_sync',      started_at: '2026-09-08T08:02:00Z', ok: true, filas: 240 },
  ],
  outbox: [
    {
      id: 9, tipo: 'alerta_cwl', estado: 'pendiente', creado_en: '2026-09-08T08:01:00Z',
      cuerpo:
        '⚔️ *ATAQUES DE CWL SIN USAR*\n\n*x300*  (escuadra A)\nCierra en *2.8h* - faltan 2:\n```# 7 Deibis\n#12 ElMago```\n\n_Si avisaste antes del dia de batalla, decilo y no cuenta como fallo._',
    },
    {
      id: 8, tipo: 'reporte_mensual', estado: 'copiado', creado_en: '2026-09-01T06:10:00Z',
      cuerpo:
        '🏆 *PREMIOS DE AGOSTO*\n\n*Liga A*\n1º Reyniel — 21★ — $20\n2º Dr Strange — 19★ — Pase de Oro\n\n*Liga B*\n1º Dayron — 18★ — $10\n\n_Se paga el dia 5 a quien siga en el clan._',
    },
  ],
  wa: { vinculado: false, numero: null, ultimo_ok: null, ultimo_error: null },
  basePacks: [
    { id: 1, nombre: 'Clash Champ1 Sept', mes: '2026-09' },
    { id: 2, nombre: 'RH Champs1 Sept', mes: '2026-09' },
    { id: 3, nombre: 'RH CWL Sept (solo texto)', mes: '2026-09' },
  ],
  bases: [
    { id: 1, pack_id: 1, th: 18, tipo: 'WB', etiqueta: null, nota: 'Builder: Aquiles · Recommendation 1: Ice Golem x2, Furnace x1, Headhunter x1, Goblin x1', preview: '/bases/clash-champ1-sept/00.webp', url: 'https://link.clashofclans.com/en?action=OpenLayout&id=TH18%3AWB%3Aaaa', asignada_a: null },
    { id: 2, pack_id: 1, th: 18, tipo: 'HV', etiqueta: null, nota: 'Builder: Bernaul · Recommendation 1: Ice Golem x1, Archer x22, Furnace x1', preview: '/bases/clash-champ1-sept/01.webp', url: 'https://link.clashofclans.com/en?action=OpenLayout&id=TH18%3AHV%3Abbb', asignada_a: '#P1' },
    { id: 3, pack_id: 2, th: 18, tipo: 'WB', etiqueta: 'Base 1', nota: 'RH September C1 | Vibes | 2 IG, 2 witches & archer', preview: '/bases/rh-champs1-sept/00.webp', url: 'https://link.clashofclans.com/en?action=OpenLayout&id=TH18%3AWB%3Accc', asignada_a: null },
    { id: 4, pack_id: 3, th: 18, tipo: 'HV', etiqueta: 'Base 9', nota: 'RH September CWL | Gaku | furnace, 6 HH & archer', preview: null, url: 'https://link.clashofclans.com/en?action=OpenLayout&id=TH18%3AHV%3Addd', asignada_a: null },
  ],
  bonos: [{ temporada: '2026-09', clan_tag: '#2GC', player_tag: '#P1', tipo: 'medallas_cwl', entregado: true }],
  premiosPlan: [
    { id: 1, mes: '2026-09', orden: 0, titulo: 'x300 CWL 1º',   criterio: 'Más estrellas en CWL (7/7 ataques)', monto_usd: 20, tipo: 'efectivo', activo: true },
    { id: 2, mes: '2026-09', orden: 1, titulo: 'x300 CWL 2º',   criterio: 'Segundo en estrellas de CWL',        monto_usd: 10, tipo: 'efectivo', activo: true },
    { id: 3, mes: '2026-09', orden: 2, titulo: 'Clan B CWL 1º', criterio: 'Más estrellas en CWL (7/7 ataques)', monto_usd: 10, tipo: 'efectivo', activo: true },
    { id: 4, mes: '2026-09', orden: 3, titulo: 'Clan B CWL 2º', criterio: 'Segundo en estrellas de CWL',        monto_usd: 7,  tipo: 'pase_oro', activo: true },
    { id: 5, mes: '2026-09', orden: 4, titulo: 'Clan C CWL 1º', criterio: 'Más estrellas en CWL (7/7 ataques)', monto_usd: 10, tipo: 'efectivo', activo: true },
    { id: 6, mes: '2026-09', orden: 5, titulo: 'Clan C CWL 2º', criterio: 'Segundo en estrellas de CWL',        monto_usd: 7,  tipo: 'pase_oro', activo: true },
    { id: 7, mes: '2026-09', orden: 6, titulo: 'Mejor en guerra', criterio: 'Pendiente de definir con el probe', monto_usd: 10, tipo: 'efectivo', activo: true },
    { id: 8, mes: '2026-09', orden: 7, titulo: 'Primero en Leyenda', criterio: 'Primero en llegar entre los que arrancaron fuera', monto_usd: 10, tipo: 'efectivo', activo: true },
  ],
  config: [
    { clave: 'bot_nombre',      valor: 'Heraldo' },
    { clave: 'bot_firma',       valor: '— Heraldo de Strange Godz' },
    { clave: 'alerta_umbrales', valor: [6, 3, 1] },
    { clave: 'alerta_cwl',      valor: true },
    { clave: 'alerta_guerra',   valor: false },
    { clave: 'alerta_raids',    valor: true },
    { clave: 'reporte_mensual', valor: true },
    { clave: 'telegram_activo', valor: true },
    { clave: 'whatsapp_activo', valor: false },
    { clave: 'presupuesto_mensual', valor: 80 },
  ],
  alineaciones: [
    { player_tag: '#P1', clan_tag: '#2GC' },
    { player_tag: '#P2', clan_tag: '#2GC' },
    { player_tag: '#P6', clan_tag: '#2GC' },
    { player_tag: '#P3', clan_tag: '#2CCJYG2YL' },
    { player_tag: '#P7', clan_tag: '#228QU9Q8' },
  ],
  // Meses cerrados, para poder probar aqui el desplegable de temporadas y
  // el copiado. En la app de verdad esto sale de la tabla alineaciones.
  alineacionesPrevias: {
    '2026-08': [
      { player_tag: '#P1', clan_tag: '#2GC' },
      { player_tag: '#P2', clan_tag: '#2GC' },
      { player_tag: '#P3', clan_tag: '#2GC' },
      { player_tag: '#P4', clan_tag: '#2CCJYG2YL' },
      { player_tag: '#P6', clan_tag: '#228QU9Q8' },
    ],
    '2026-07': [
      { player_tag: '#P1', clan_tag: '#2GC' },
      { player_tag: '#P5', clan_tag: '#2CCJYG2YL' },
    ],
  },
};

const TABS = [
  ['resumen', 'Resumen'],
  ['alineacion', 'Lista CWL'],
  ['cwl', 'CWL Resultados'],
  ['jugadores', 'Jugadores'],
  ['salud', 'Salud'],
  ['solicitudes', 'Solicitudes'],
  ['mensajes', 'Mensajes'],
  ['bases', 'Bases'],
  ['bonos', 'Bonos'],
  ['bots', 'Bots'],
];

export default function Demo() {
  const t = useT();
  const [tab, setTab] = useState('resumen');
  return (
    <>
      <div className="banda-demo">
        {t('Vista de ejemplo · clanes reales,')} <b>{t('números inventados')}</b>{' '}
        {t('· aún no hay Supabase conectado')}
      </div>
      <header className="top">
        <h1>Strange Godz Alliance · Management</h1>
        {/* Mismo orden que el panel de verdad: idioma, correo, temas y Salir
            al final. Si la demo lo pone distinto deja de servir para mirar
            como queda. */}
        <div className="acciones-top">
          <SelectorIdioma />
          <span className="correo">cris@ejemplo.com</span>
          <SelectorTema />
          <button className="fantasma">{t('Salir')}</button>
        </div>
      </header>
      <div className="wrap">
        <nav className="tabs">
          {TABS.map(([k, l]) => (
            <button key={k} data-on={tab === k ? '1' : '0'} onClick={() => setTab(k)}>
              {t(l)}
            </button>
          ))}
        </nav>
        {tab === 'resumen' && <Resumen d={d} demo />}
        {tab === 'alineacion' && <Alineacion d={d} demo />}
        {tab === 'cwl' && (
          <>
            <GrupoCWL d={d} />
            <CWL d={d} />
          </>
        )}
        {tab === 'jugadores' && <Jugadores d={d} />}
        {tab === 'salud' && <Salud d={d} />}
        {tab === 'solicitudes' && <Solicitudes d={d} demo />}
        {tab === 'mensajes' && <Mensajes d={d} recargar={() => {}} />}
        {tab === 'bases' && <Bases d={d} demo />}
        {tab === 'bonos' && <Bonos d={d} demo />}
        {tab === 'bots' && <Bots d={d} demo />}
      </div>
      <Heraldo d={d} />
    </>
  );
}
