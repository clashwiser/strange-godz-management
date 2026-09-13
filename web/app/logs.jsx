'use client';

// La pestaña Logs: quien cambio que en el panel, y cuando.
//
// Lo escribe un trigger en la base (sql/035): cada INSERT/UPDATE/DELETE en
// las tablas que se editan deja una fila en `logs` con el nombre del lider
// (dashboard_users), la tabla, la fila y el antes/despues. Aqui se lee y
// se cuenta en cristiano: "12/9 21:05 · Cris editó Premios «x300 · 2do
// lugar CWL»: monto 10 → 7". Lo que hacen los bots y los jobs sale como
// "sistema" y va escondido salvo que se pida.

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useT } from './idioma';
import { Info } from './info';

/** Nombre de cada tabla en cristiano. */
const TABLAS = {
  premios_plan: 'Premios',
  alineaciones: 'Lista CWL',
  clans: 'Clanes',
  bases: 'Bases',
  base_packs: 'Packs de bases',
  config: 'Ajustes',
  lecciones: 'Lecciones',
  bonos: 'Bonos pagados',
  castillos: 'Castillos',
  retos: 'Retos',
  solicitudes: 'Solicitudes',
  tg_vinculos: 'Telegram de jugadores',
  owners: 'Dueños',
  players: 'Jugadores',
};

/** Campos que no cuentan como cambio o no se enseñan. */
const RUIDO = new Set(['id', 'updated_at', 'actualizado', 'actualizado_en', 'creado_en', 'created_at', 'visto_en', 'firma', 'mensaje_bot_id']);

/** Un valor, corto y legible. */
function corto(v) {
  if (v == null || v === '') return '∅';
  if (typeof v === 'boolean') return v ? 'sí' : 'no';
  if (typeof v === 'object') v = JSON.stringify(v);
  const s = String(v);
  return s.length > 70 ? `${s.slice(0, 67)}…` : s;
}

/** Los campos que cambiaron entre antes y despues: [{ campo, de, a }]. */
export function cambiosDe(antes, despues) {
  const a = antes ?? {};
  const d = despues ?? {};
  const campos = [...new Set([...Object.keys(a), ...Object.keys(d)])].filter((k) => !RUIDO.has(k));
  return campos
    .filter((k) => JSON.stringify(a[k] ?? null) !== JSON.stringify(d[k] ?? null))
    .map((k) => ({ campo: k, de: a[k], a: d[k] }));
}

const VERBO = { INSERT: 'creó', UPDATE: 'editó', DELETE: 'borró' };

export default function Logs({ demo = false }) {
  const t = useT();
  const [filas, setFilas] = useState(demo ? DEMO : null);
  const [error, setError] = useState('');
  const [conSistema, setConSistema] = useState(false);
  const [quien, setQuien] = useState('');
  const [q, setQ] = useState('');
  const [tope, setTope] = useState(300);

  useEffect(() => {
    if (demo) return;
    let vivo = true;
    (async () => {
      const { data, error: e } = await supabase.from('logs').select('*').order('hecho_en', { ascending: false }).limit(tope);
      if (!vivo) return;
      if (e) setError(e.message);
      else setFilas(data ?? []);
    })();
    return () => {
      vivo = false;
    };
  }, [demo, tope]);

  const personas = useMemo(() => [...new Set((filas ?? []).map((f) => f.quien).filter(Boolean))].sort(), [filas]);

  const visibles = useMemo(() => {
    const b = q.trim().toLowerCase();
    return (filas ?? []).filter((f) => {
      if (!conSistema && f.origen !== 'panel') return false;
      if (quien && f.quien !== quien) return false;
      if (b) {
        const texto = `${f.quien ?? ''} ${TABLAS[f.tabla] ?? f.tabla} ${f.clave ?? ''} ${JSON.stringify(f.despues ?? f.antes ?? {})}`.toLowerCase();
        if (!texto.includes(b)) return false;
      }
      return true;
    });
  }, [filas, conSistema, quien, q]);

  // Agrupadas por dia, para leerlas como un diario.
  const porDia = useMemo(() => {
    const m = new Map();
    for (const f of visibles) {
      const dia = new Date(f.hecho_en).toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' });
      if (!m.has(dia)) m.set(dia, []);
      m.get(dia).push(f);
    }
    return [...m.entries()];
  }, [visibles]);

  return (
    <>
      <h2 className="sec">
        {t('Logs')} <Info clave="logs" />
      </h2>
      <p className="sub" style={{ color: 'var(--tenue)', fontSize: 13 }}>
        {t('Cada cambio que se guarda en el panel queda aquí: quién, cuándo y qué cambió. Lo que hacen los bots y los robots de fondo se puede ver marcando "también el sistema".')}
      </p>

      <div className="logs-filtros">
        <input className="campo" placeholder={t('Buscar…')} value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 260 }} />
        <select className="campo campo-corto" value={quien} onChange={(e) => setQuien(e.target.value)}>
          <option value="">{t('Todos')}</option>
          {personas.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <label className="fila-check">
          <input type="checkbox" checked={conSistema} onChange={(e) => setConSistema(e.target.checked)} />
          <span>{t('también el sistema')}</span>
        </label>
      </div>

      {error && <p className="error">{t('Error: ')}{error}</p>}
      {filas === null && !error && <p className="sub">{t('Cargando…')}</p>}
      {filas !== null && !visibles.length && <p className="vacio">{t('Todavía no hay cambios apuntados.')}</p>}

      {porDia.map(([dia, lista]) => (
        <div className="card logs-dia" key={dia}>
          <h3>{dia}</h3>
          <ul className="logs-lista">
            {lista.map((f) => {
              const cambios = f.accion === 'UPDATE' ? cambiosDe(f.antes, f.despues) : [];
              const hora = new Date(f.hecho_en).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
              return (
                <li key={f.id} className={`logs-fila ${f.origen}`}>
                  <span className="logs-hora">{hora}</span>
                  <span className="logs-texto">
                    <b>{f.quien === 'sistema' ? t('el sistema') : f.quien ?? '?'}</b> {t(VERBO[f.accion] ?? f.accion)}{' '}
                    <span className="logs-tabla">{t(TABLAS[f.tabla] ?? f.tabla)}</span>
                    {f.clave ? <> «{f.clave}»</> : null}
                    {cambios.length > 0 && (
                      <>
                        {': '}
                        {cambios.slice(0, 6).map((c, i) => (
                          <span className="logs-cambio" key={c.campo}>
                            {i > 0 ? ', ' : ''}
                            <code>{c.campo}</code> {corto(c.de)} → {corto(c.a)}
                          </span>
                        ))}
                        {cambios.length > 6 ? ` … (+${cambios.length - 6})` : ''}
                      </>
                    )}
                    {f.accion === 'INSERT' && f.despues && (
                      <span className="logs-cambio"> · {resumenFila(f.despues)}</span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      {filas !== null && filas.length >= tope && !demo && (
        <button className="fantasma" onClick={() => setTope((n) => n + 300)}>{t('Cargar más')}</button>
      )}
    </>
  );
}

/** Para un INSERT, los tres o cuatro campos que mas dicen. */
function resumenFila(fila) {
  const claves = Object.keys(fila).filter((k) => !RUIDO.has(k) && fila[k] != null && fila[k] !== '' && typeof fila[k] !== 'object').slice(0, 4);
  return claves.map((k) => `${k} ${corto(fila[k])}`).join(', ');
}

// Para la demo: unas filas de ejemplo.
const DEMO = [
  { id: 3, hecho_en: new Date(Date.now() - 3600_000).toISOString(), quien: 'Carlos', origen: 'panel', tabla: 'premios_plan', accion: 'UPDATE', clave: 'x300 · 2do lugar CWL', antes: { monto_usd: 10, tipo: 'efectivo' }, despues: { monto_usd: 7, tipo: 'pase_oro' } },
  { id: 2, hecho_en: new Date(Date.now() - 7200_000).toISOString(), quien: 'Cris', origen: 'panel', tabla: 'tg_vinculos', accion: 'INSERT', clave: 'Pmc', antes: null, despues: { tg_user_id: 8319208377, player_tag: '#92CJG2RQ', tg_nombre: 'Pmc', principal: true } },
  { id: 1, hecho_en: new Date(Date.now() - 86400_000).toISOString(), quien: 'sistema', origen: 'sistema', tabla: 'castillos', accion: 'UPDATE', clave: 'YHLQMDLG', antes: { verificado: false, puntos: 0 }, despues: { verificado: true, puntos: 10 } },
];
