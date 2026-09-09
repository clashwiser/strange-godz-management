'use client';

// Tarjetas de clan reordenables. Pensado para el telefono primero, que es
// donde se usa de verdad.
//
// Hay DOS formas de mover un clan y las dos guardan igual:
//
//   Botones ↑ ↓   la via principal en el telefono. Un toque, sin gesto que
//                 pueda salir mal, y funciona con el lector de pantalla.
//   Arrastrar     comodo con raton, y en tactil solo desde el asa.
//
// Por que el arrastre estaba practicamente inservible en el telefono:
//
//   1. La tarjeta ENTERA llevaba touch-action:none. Eso le dice al navegador
//      "yo manejo este gesto", asi que tocar cualquier parte de un clan
//      arrancaba un arrastre y ademas bloqueaba el scroll: no se podia ni
//      recorrer la lista. Ahora esa regla vive solo en el asa.
//   2. El asa era un simbolo de 15px. Un dedo no acierta eso; la guia de
//      Apple y la de Android piden 44px de lado como minimo.
//   3. No se capturaba el puntero. Si el dedo salia de la grilla dejaban de
//      llegar eventos y el 'pointerup' nunca disparaba: la tarjeta quedaba
//      pegada al dedo hasta recargar.
//
// No se usa la API de arrastre de HTML5: no dispara en pantallas tactiles.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useT } from './idioma';
import AltaClan from './alta-clan';

export default function Clanes({ d, demo = false, recargar }) {
  const t = useT();
  const [orden, setOrden] = useState(() => d.clans.map((c) => c.clan_tag));
  const [agarrado, setAgarrado] = useState(null);
  const [msg, setMsg] = useState('');
  const temporizador = useRef(null);

  // Si llegan clanes nuevos desde la base, rehacemos el orden local.
  useEffect(() => {
    setOrden(d.clans.map((c) => c.clan_tag));
  }, [d.clans]);

  useEffect(() => () => clearTimeout(temporizador.current), []);

  const porTag = useMemo(
    () => Object.fromEntries(d.clans.map((c) => [c.clan_tag, c])),
    [d.clans]
  );

  const miembros = (tag) => d.snaps.filter((s) => s.clan_tag === tag).length;

  /**
   * Guarda el orden. Los botones no tienen un momento de "soltar", asi que
   * se guarda solo, esperando a que el usuario deje de tocar: cuatro toques
   * seguidos son una escritura, no cuatro.
   */
  const guardar = useCallback(
    (nuevo) => {
      clearTimeout(temporizador.current);
      temporizador.current = setTimeout(async () => {
        if (demo) {
          setMsg(t('Orden cambiado (en la demo no se guarda).'));
          setTimeout(() => setMsg(''), 2500);
          return;
        }
        try {
          // Una fila por clan con su posicion. upsert en lote: si falla, no
          // queda medio orden guardado.
          const filas = nuevo.map((t, i) => ({ clan_tag: t, orden: i + 1 }));
          const { error } = await supabase.from('clans').upsert(filas, { onConflict: 'clan_tag' });
          if (error) throw error;
          setMsg(t('Orden guardado.'));
          setTimeout(() => setMsg(''), 2000);
        } catch (e) {
          setMsg(t('No se pudo guardar: ') + e.message);
          setOrden(d.clans.map((c) => c.clan_tag)); // volver a lo que dice la base
        }
      }, 600);
    },
    [demo, d.clans]
  );

  /** Mueve un clan `paso` posiciones. Usado por los botones ↑ ↓. */
  function mover(tag, paso) {
    setOrden((prev) => {
      const i = prev.indexOf(tag);
      const j = i + paso;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const copia = [...prev];
      [copia[i], copia[j]] = [copia[j], copia[i]];
      guardar(copia);
      return copia;
    });
  }

  function alMover(e) {
    if (!agarrado) return;
    // Con el puntero capturado los eventos llegan siempre al asa, pero
    // elementFromPoint hace su propia prueba de impacto sobre el documento y
    // no le afecta la captura: sigue devolviendo la tarjeta de abajo.
    const bajo = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-tag]');
    const destino = bajo?.dataset.tag;
    if (!destino || destino === agarrado) return;

    setOrden((prev) => {
      const i = prev.indexOf(agarrado);
      const j = prev.indexOf(destino);
      if (i < 0 || j < 0) return prev;
      const copia = [...prev];
      copia.splice(i, 1);
      copia.splice(j, 0, agarrado);
      return copia;
    });
  }

  function alSoltar(e) {
    if (!agarrado) return;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    setAgarrado(null);
    setOrden((prev) => {
      guardar(prev);
      return prev;
    });
  }

  if (!d.clans.length) {
    return (
      <div className="card">
        <h3>{t('Sin clanes todavía')}</h3>
        <p className="sub">
          {t('Falta cargar')} <code>CLAN_TAGS</code> {t('y correr el snapshot por primera vez.')}
        </p>
      </div>
    );
  }

  return (
    <>
      <AltaClan demo={demo} recargar={recargar} yaEstan={d.clans.map((c) => c.clan_tag)} />

      <p className="sub pista-arrastre">
        {t('Cambia el orden con')} <b>↑ ↓</b>{t(', o arrastra desde el asa')} <b>⠿</b>{t('. Se guarda solo.')}
      </p>
      {msg && <p className={msg.startsWith(t('No se pudo guardar: ')) ? 'error' : 'sub'}>{msg}</p>}

      <div className="grid">
        {orden.map((tag, i) => {
          const c = porTag[tag];
          if (!c) return null;
          const n = miembros(tag);
          return (
            <div
              key={tag}
              data-tag={tag}
              className="card carta-clan"
              data-agarrado={agarrado === tag ? '1' : '0'}
            >
              <div className="mando">
                <button
                  className="fantasma mover"
                  onClick={() => mover(tag, -1)}
                  disabled={i === 0}
                  aria-label={`${t('Subir')} ${c.nombre}`}
                  title={t('Subir')}
                >
                  ↑
                </button>
                <button
                  className="fantasma mover"
                  onClick={() => mover(tag, 1)}
                  disabled={i === orden.length - 1}
                  aria-label={`${t('Bajar')} ${c.nombre}`}
                  title={t('Bajar')}
                >
                  ↓
                </button>
                <span
                  className="asa"
                  role="button"
                  tabIndex={-1}
                  aria-hidden="true"
                  title={t('Arrastrar para reordenar')}
                  onPointerDown={(e) => {
                    // Capturar el puntero: a partir de aca todos los eventos
                    // del gesto llegan a este elemento aunque el dedo salga
                    // de la grilla, asi que el 'pointerup' nunca se pierde.
                    e.currentTarget.setPointerCapture?.(e.pointerId);
                    setAgarrado(tag);
                  }}
                  onPointerMove={alMover}
                  onPointerUp={alSoltar}
                  onPointerCancel={alSoltar}
                >
                  ⠿
                </span>
              </div>

              <p className="posicion">#{i + 1}</p>
              <h3>
                {c.nombre}{' '}
                {c.escuadra && <span className="pill">{t('escuadra')} {c.escuadra}</span>}{' '}
                {c.es_principal && <span className="pill aviso">{t('principal')}</span>}
              </h3>
              <p className="sub">{c.clan_tag}</p>
              <p className="big">{n}</p>
              <p className="sub">{t('miembros en el último snapshot')}</p>
            </div>
          );
        })}
      </div>
    </>
  );
}
