'use client';

// Tarjetas de clan reordenables arrastrando, con raton O con el dedo.
//
// No usa la API de arrastre de HTML5 a proposito: esa no dispara en pantallas
// tactiles. Con eventos de puntero el mismo codigo sirve para los dos, que es
// lo que hace falta cuando los lideres entran desde el telefono.

import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function Clanes({ d, demo = false }) {
  const [orden, setOrden] = useState(() => d.clans.map((c) => c.clan_tag));
  const [agarrado, setAgarrado] = useState(null);
  const [msg, setMsg] = useState('');
  const cambiado = useRef(false);

  // Si llegan clanes nuevos desde la base, rehacemos el orden local.
  useEffect(() => {
    setOrden(d.clans.map((c) => c.clan_tag));
  }, [d.clans]);

  const porTag = useMemo(
    () => Object.fromEntries(d.clans.map((c) => [c.clan_tag, c])),
    [d.clans]
  );

  const miembros = (tag) => d.snaps.filter((s) => s.clan_tag === tag).length;

  function alMover(e) {
    if (!agarrado) return;
    const p = e.touches ? e.touches[0] : e;
    const bajo = document.elementFromPoint(p.clientX, p.clientY)?.closest('[data-tag]');
    const destino = bajo?.dataset.tag;
    if (!destino || destino === agarrado) return;

    setOrden((prev) => {
      const i = prev.indexOf(agarrado);
      const j = prev.indexOf(destino);
      if (i < 0 || j < 0) return prev;
      const copia = [...prev];
      copia.splice(i, 1);
      copia.splice(j, 0, agarrado);
      cambiado.current = true;
      return copia;
    });
  }

  async function alSoltar() {
    const tag = agarrado;
    setAgarrado(null);
    if (!tag || !cambiado.current) return;
    cambiado.current = false;

    if (demo) {
      setMsg('Orden cambiado (en la demo no se guarda).');
      setTimeout(() => setMsg(''), 2500);
      return;
    }

    try {
      // Una fila por clan con su nueva posicion. upsert en lote: si falla,
      // no queda medio orden guardado.
      const filas = orden.map((t, i) => ({ clan_tag: t, orden: i + 1 }));
      const { error } = await supabase.from('clans').upsert(filas, { onConflict: 'clan_tag' });
      if (error) throw error;
      setMsg('Orden guardado.');
      setTimeout(() => setMsg(''), 2000);
    } catch (e) {
      setMsg(`No se pudo guardar: ${e.message}`);
      setOrden(d.clans.map((c) => c.clan_tag)); // volver a lo que dice la base
    }
  }

  if (!d.clans.length) {
    return (
      <div className="card">
        <h3>Sin clanes todavía</h3>
        <p className="sub">
          Falta cargar <code>CLAN_TAGS</code> y correr el snapshot por primera vez.
        </p>
      </div>
    );
  }

  return (
    <>
      <p className="sub pista-arrastre">
        Arrastrá las tarjetas para cambiar el orden — con el ratón o con el dedo.
      </p>
      {msg && <p className={msg.startsWith('No se pudo') ? 'error' : 'sub'}>{msg}</p>}

      <div
        className="grid"
        onPointerMove={alMover}
        onPointerUp={alSoltar}
        onPointerCancel={alSoltar}
      >
        {orden.map((tag) => {
          const c = porTag[tag];
          if (!c) return null;
          const n = miembros(tag);
          return (
            <div
              key={tag}
              data-tag={tag}
              className="card carta-clan"
              data-agarrado={agarrado === tag ? '1' : '0'}
              onPointerDown={(e) => {
                // setPointerCapture en el contenedor haria que elementFromPoint
                // siempre devuelva la misma tarjeta; capturamos solo el gesto.
                e.currentTarget.releasePointerCapture?.(e.pointerId);
                setAgarrado(tag);
              }}
            >
              <span className="asa" aria-hidden="true">⠿</span>
              <h3>
                {c.nombre}{' '}
                {c.escuadra && <span className="pill">escuadra {c.escuadra}</span>}{' '}
                {c.es_principal && <span className="pill aviso">principal</span>}
              </h3>
              <p className="sub">{c.clan_tag}</p>
              <p className="big">{n}</p>
              <p className="sub">miembros en el último snapshot</p>
            </div>
          );
        })}
      </div>
    </>
  );
}
