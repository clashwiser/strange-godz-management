'use client';

// Vista de ejemplo, sin Supabase ni login. Sirve para ver como queda el panel
// antes de que haya datos reales, y para mostrarselo a Carlos y Deibis.
// Los CLANES son los de verdad; los numeros son inventados.

import { useState } from 'react';
import { Resumen, CWL, Jugadores, Mensajes } from '../page';
import Alineacion from '../alineacion';
import SelectorTema from '../temas';
import { SelectorIdioma, useT } from '../idioma';
import Bots from '../bots';
import Bases from '../bases';
import Bonos from '../bonos';

const d = {
  temporada: '2026-09',
  fechaSnap: '2026-09-08',
  clans: [
    { clan_tag: '#2GC',       nombre: 'x300',                     escuadra: 'A', es_principal: true, orden: 1, cwl_tamano: 15 },
    { clan_tag: '#2CCJYG2YL', nombre: 'ＳＴＲＡＮＧＥ - ＷＯＲＬＤ', escuadra: 'B', orden: 2, cwl_tamano: 15 },
    { clan_tag: '#228QU9Q8',  nombre: 'Olympus',                  escuadra: 'C', orden: 3, cwl_tamano: 15 },
    { clan_tag: '#JUYP2PL',   nombre: 'Cuban Pirates ⚓️',          orden: 4, cwl_tamano: 15 },
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
    { player_tag: '#P1', clan_tag: '#2GC',       th_level: 18, trofeos: 5820, liga: 'Legend League',      war_stars: 2410, donaciones: 1200 },
    { player_tag: '#P2', clan_tag: '#2GC',       th_level: 18, trofeos: 5410, liga: 'Titan League I',     war_stars: 1980, donaciones: 900 },
    { player_tag: '#P6', clan_tag: '#2GC',       th_level: 18, trofeos: 5330, liga: 'Titan League I',     war_stars: 2050, donaciones: 1440 },
    { player_tag: '#P3', clan_tag: '#2CCJYG2YL', th_level: 18, trofeos: 5100, liga: 'Titan League II',    war_stars: 1750, donaciones: 640 },
    { player_tag: '#P4', clan_tag: '#2CCJYG2YL', th_level: 18, trofeos: 4980, liga: 'Titan League III',   war_stars: 1520, donaciones: 430 },
    { player_tag: '#P7', clan_tag: '#228QU9Q8',  th_level: 17, trofeos: 4710, liga: 'Champion League I',  war_stars: 1310, donaciones: 380 },
    { player_tag: '#P5', clan_tag: '#228QU9Q8',  th_level: 17, trofeos: 4600, liga: 'Champion League I',  war_stars: 1180, donaciones: 220 },
    { player_tag: '#P8', clan_tag: '#JUYP2PL',   th_level: 16, trofeos: 4310, liga: 'Champion League II', war_stars: 940,  donaciones: 510 },
  ],
  wars: [
    { id: 1, ronda: 1, clan_rival_nombre: 'Rivales FC', estrellas_nuestras: 44, estrellas_rival: 41, estado: 'warEnded' },
    { id: 2, ronda: 2, clan_rival_nombre: 'Los Duros',  estrellas_nuestras: 45, estrellas_rival: 45, estado: 'warEnded' },
    { id: 3, ronda: 3, clan_rival_nombre: 'Titanes',    estrellas_nuestras: 30, estrellas_rival: 28, estado: 'inWar' },
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
    { id: 1, pack_id: 1, th: 18, tipo: 'WB', preview: '/bases/clash-champ1-sept/00.webp', url: 'https://link.clashofclans.com/en?action=OpenLayout&id=TH18%3AWB%3Aaaa', asignada_a: null },
    { id: 2, pack_id: 1, th: 18, tipo: 'HV', preview: '/bases/clash-champ1-sept/01.webp', url: 'https://link.clashofclans.com/en?action=OpenLayout&id=TH18%3AHV%3Abbb', asignada_a: '#P1' },
    { id: 3, pack_id: 2, th: 18, tipo: 'WB', preview: '/bases/rh-champs1-sept/00.webp', url: 'https://link.clashofclans.com/en?action=OpenLayout&id=TH18%3AWB%3Accc', asignada_a: null },
    { id: 4, pack_id: 3, th: 18, tipo: 'HV', preview: null, url: 'https://link.clashofclans.com/en?action=OpenLayout&id=TH18%3AHV%3Addd', asignada_a: null },
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
};

const TABS = [
  ['resumen', 'Resumen'],
  ['alineacion', 'Lista CWL'],
  ['cwl', 'CWL Resultados'],
  ['jugadores', 'Jugadores'],
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
        <div className="acciones-top">
          <SelectorTema />
          <SelectorIdioma />
          <span className="correo">cris@ejemplo.com</span>
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
        {tab === 'cwl' && <CWL d={d} />}
        {tab === 'jugadores' && <Jugadores d={d} />}
        {tab === 'mensajes' && <Mensajes d={d} recargar={() => {}} />}
        {tab === 'bases' && <Bases d={d} demo />}
        {tab === 'bonos' && <Bonos d={d} demo />}
        {tab === 'bots' && <Bots d={d} demo />}
      </div>
    </>
  );
}
