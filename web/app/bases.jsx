'use client';

// Packs de bases. El PDF llega por DM del proveedor y se importa con
//   npm run bases:importar "ruta/al.pdf" "Nombre del pack"
// De ahi en adelante todo es automatico: nivel de TH y tipo (aldea o guerra)
// salen del propio enlace, no hay que etiquetar nada a mano.

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

const TIPOS = { HV: 'Aldea', WB: 'Guerra' };

export default function Bases({ d, demo = false, recargar }) {
  const [packSel, setPackSel] = useState('todos');
  const [tipoSel, setTipoSel] = useState('todos');
  const [soloLibres, setSoloLibres] = useState(false);
  const [copiada, setCopiada] = useState(null);
  const [ampliada, setAmpliada] = useState(null);
  const [msg, setMsg] = useState('');

  const nombre = useMemo(
    () => Object.fromEntries((d.players ?? []).map((p) => [p.player_tag, p.nombre_actual])),
    [d.players]
  );

  const filtradas = useMemo(() => {
    return (d.bases ?? []).filter(
      (b) =>
        (packSel === 'todos' || String(b.pack_id) === packSel) &&
        (tipoSel === 'todos' || b.tipo === tipoSel) &&
        (!soloLibres || !b.asignada_a)
    );
  }, [d.bases, packSel, tipoSel, soloLibres]);

  useEffect(() => {
    if (!ampliada) return;
    const alTecla = (e) => e.key === 'Escape' && setAmpliada(null);
    window.addEventListener('keydown', alTecla);
    return () => window.removeEventListener('keydown', alTecla);
  }, [ampliada]);

  async function copiar(b) {
    try {
      await navigator.clipboard.writeText(b.url);
      setCopiada(b.id);
      setTimeout(() => setCopiada(null), 1800);
    } catch {
      setMsg('No se pudo copiar. Abrila con el botón y copiá desde la barra.');
    }
  }

  async function asignar(b, playerTag) {
    if (demo) {
      setMsg('En la demo no se guarda.');
      setTimeout(() => setMsg(''), 2000);
      return;
    }
    try {
      const { error } = await supabase
        .from('bases')
        .update({ asignada_a: playerTag || null })
        .eq('id', b.id);
      if (error) throw error;
      recargar?.();
    } catch (e) {
      setMsg(`Error: ${e.message}`);
    }
  }

  if (!d.bases?.length) {
    return (
      <>
        <h2 className="sec">Bases</h2>
        <div className="card">
          <h3>Todavía no hay bases cargadas</h3>
          <p className="sub">
            Bajá el PDF del proveedor y corré:
          </p>
          <pre className="msg">npm run bases:importar &quot;C:/ruta/al/pack.pdf&quot; &quot;RH CWL Sept&quot;</pre>
          <p className="sub" style={{ marginTop: 10 }}>
            Los enlaces van como anotaciones dentro del PDF, no como texto — por eso copiar y
            pegar el contenido no trae nada. El importador los lee y saca de cada uno el nivel de
            ayuntamiento y si es base de aldea o de guerra.
          </p>
        </div>
      </>
    );
  }

  const libres = filtradas.filter((b) => !b.asignada_a).length;

  return (
    <>
      <h2 className="sec">Bases · {filtradas.length} de {d.bases.length}</h2>
      {msg && <p className="error">{msg}</p>}

      <div className="filtros">
        <select className="campo campo-corto" value={packSel} onChange={(e) => setPackSel(e.target.value)}>
          <option value="todos">Todos los packs</option>
          {(d.basePacks ?? []).map((p) => (
            <option key={p.id} value={String(p.id)}>{p.nombre}</option>
          ))}
        </select>
        <select className="campo campo-corto" value={tipoSel} onChange={(e) => setTipoSel(e.target.value)}>
          <option value="todos">Aldea y guerra</option>
          <option value="WB">Solo guerra</option>
          <option value="HV">Solo aldea</option>
        </select>
        <label className="fila-check" style={{ marginTop: 0 }}>
          <input type="checkbox" checked={soloLibres} onChange={(e) => setSoloLibres(e.target.checked)} />
          <span>Solo sin asignar ({libres})</span>
        </label>
      </div>

      <div className="tabla-scroll">
        <table>
          <thead>
            <tr>
              <th>Base</th>
              <th className="num">TH</th>
              <th>Tipo</th>
              <th>Asignada a</th>
              <th>Enlace</th>
            </tr>
          </thead>
          <tbody>
            {filtradas.map((b) => (
              <tr key={b.id}>
                <td>
                  {/* Solo algunos packs traen imagenes; los de texto van sin
                      miniatura y la fila igual sirve. */}
                  {b.preview ? (
                    <img
                      className="mini-base"
                      src={b.preview}
                      alt=""
                      loading="lazy"
                      onClick={() => setAmpliada(b)}
                    />
                  ) : (
                    <span className="mini-vacia">sin imagen</span>
                  )}
                </td>
                <td className="num">{b.th ?? '—'}</td>
                <td>
                  <span className="pill">{TIPOS[b.tipo] ?? b.tipo ?? '—'}</span>
                </td>
                <td>
                  <select
                    className="campo campo-corto"
                    style={{ marginTop: 0 }}
                    value={b.asignada_a ?? ''}
                    onChange={(e) => asignar(b, e.target.value)}
                  >
                    <option value="">— libre —</option>
                    {(d.players ?? []).map((p) => (
                      <option key={p.player_tag} value={p.player_tag}>
                        {nombre[p.player_tag]}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="acciones">
                  <button
                    className="fantasma"
                    onClick={() => setAmpliada(b)}
                    disabled={!b.preview}
                    title={b.preview ? 'Ver la base en grande' : 'Este pack no trae imagen'}
                  >
                    Ver
                  </button>
                  <button className="fantasma" onClick={() => copiar(b)}>
                    {copiada === b.id ? '¡Copiado!' : 'Copiar'}
                  </button>
                  <a href={b.url} target="_blank" rel="noopener noreferrer">
                    <button className="fantasma">Abrir</button>
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!filtradas.length && <p className="vacio">Ninguna base con esos filtros.</p>}

      {ampliada && (
        <div className="lupa" onClick={() => setAmpliada(null)}>
          {/* stopPropagation: tocar la imagen no debe cerrar la lupa */}
          <div className="lupa-caja" onClick={(e) => e.stopPropagation()}>
            <img src={ampliada.preview} alt="" />
            <div className="lupa-pie">
              <span className="pill">TH{ampliada.th ?? '?'}</span>{' '}
              <span className="pill">{TIPOS[ampliada.tipo] ?? ampliada.tipo ?? '—'}</span>
              <span style={{ flex: 1 }} />
              <button className="fantasma" onClick={() => copiar(ampliada)}>
                {copiada === ampliada.id ? '¡Copiado!' : 'Copiar enlace'}
              </button>
              <a href={ampliada.url} target="_blank" rel="noopener noreferrer">
                <button className="accion">Abrir en el juego</button>
              </a>
              <button className="fantasma" onClick={() => setAmpliada(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
