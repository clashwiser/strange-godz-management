'use client';

// Armado de alineaciones de CWL. Reemplaza los mensajes de WhatsApp donde se
// escribe a mano quien va en cada clan.
//
// El roster NO se carga a mano: sale del ultimo snapshot, que la API baja
// todos los dias. Aca solo se arrastra.
//
// Se puede mover un jugador de DOS formas, y las dos funcionan con el dedo:
//
//   Arrastrar desde el asa   con raton o con el dedo.
//   Desplegable de la ficha  un toque, sin gesto que pueda salir mal.
//
// Antes esto usaba la API de arrastre de HTML5 (draggable + onDrop). Esa API
// NO dispara en pantallas tactiles: en el telefono el arrastre no hacia
// absolutamente nada y solo servia el desplegable. Con eventos de puntero el
// mismo codigo sirve para los dos, que es lo que hace falta cuando los
// lideres arman la CWL desde el movil.
//
// El asa lleva touch-action:none ella sola. Si se lo pusieramos a la ficha
// entera, tocar un nombre bloquearia el scroll de la columna.

import { useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useT } from './idioma';

const SIN = '__sin__';

// `demo` = tablero jugable sin base de datos, para la vista de ejemplo.
export default function Alineacion({ d, recargar, demo = false }) {
  const t = useT();
  // Copia local para que la UI responda al instante y no espere a la base.
  const [asig, setAsig] = useState(() => {
    const m = {};
    for (const a of d.alineaciones ?? []) m[a.player_tag] = a.clan_tag;
    return m;
  });
  const [arrastrando, setArrastrando] = useState(null);
  const [sobre, setSobre] = useState(null);
  const [msg, setMsg] = useState('');
  const [guardando, setGuardando] = useState(false);

  const nombre = useMemo(
    () => Object.fromEntries((d.players ?? []).map((p) => [p.player_tag, p.nombre_actual])),
    [d.players]
  );
  const snap = useMemo(
    () => Object.fromEntries((d.snaps ?? []).map((s) => [s.player_tag, s])),
    [d.snaps]
  );

  // Todo el que aparecio en el ultimo snapshot es candidato.
  const candidatos = useMemo(
    () =>
      (d.snaps ?? [])
        .map((s) => ({
          tag: s.player_tag,
          nombre: nombre[s.player_tag] ?? s.player_tag,
          th: s.th_level,
          trofeos: s.trofeos ?? 0,
        }))
        .sort((a, b) => b.trofeos - a.trofeos),
    [d.snaps, nombre]
  );

  const columnas = useMemo(() => {
    const clanes = [...(d.clans ?? [])].sort(
      (a, b) => (b.es_principal ? 1 : 0) - (a.es_principal ? 1 : 0) || (a.orden ?? 100) - (b.orden ?? 100)
    );
    return [{ clan_tag: SIN, nombre: t('Sin asignar'), cwl_tamano: null }, ...clanes];
  }, [d.clans]);

  const enColumna = (clanTag) =>
    candidatos.filter((p) => (asig[p.tag] ?? SIN) === clanTag);

  async function mover(tag, destino) {
    const previo = asig[tag] ?? SIN;
    if (previo === destino) return;

    setAsig((a) => ({ ...a, [tag]: destino }));
    setMsg('');
    if (demo) return;

    try {
      if (destino === SIN) {
        const { error } = await supabase
          .from('alineaciones')
          .delete()
          .eq('temporada', d.temporada)
          .eq('player_tag', tag);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('alineaciones').upsert(
          { temporada: d.temporada, player_tag: tag, clan_tag: destino, actualizado: new Date().toISOString() },
          { onConflict: 'temporada,player_tag' }
        );
        if (error) throw error;
      }
    } catch (e) {
      // Revertir: si la base rechazo, la pantalla no puede mentir.
      setAsig((a) => ({ ...a, [tag]: previo }));
      setMsg(`No se pudo guardar: ${e.message}`);
    }
  }

  // ---- Arrastrar con raton o dedo ----
  function alAgarrar(e, tag) {
    // Capturar el puntero: a partir de aqui todos los eventos del gesto
    // llegan a este elemento aunque el dedo salga de la columna, asi que el
    // 'pointerup' nunca se pierde y la ficha no queda pegada al dedo.
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setArrastrando(tag);
  }

  /** Columna que hay debajo del puntero. elementFromPoint hace su propia
   *  prueba de impacto sobre el documento: la captura del puntero no le
   *  afecta, por eso sigue viendo lo que hay debajo. */
  const columnaBajo = (e) =>
    document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-col]')?.dataset.col ?? null;

  function alArrastrar(e) {
    if (!arrastrando) return;
    setSobre(columnaBajo(e));
  }

  function alSoltar(e) {
    if (!arrastrando) return;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    const destino = columnaBajo(e);
    const tag = arrastrando;
    setArrastrando(null);
    setSobre(null);
    if (destino) mover(tag, destino);
  }

  async function generarMensaje() {
    setGuardando(true);
    setMsg('');
    try {
      const bloques = columnas
        .filter((c) => c.clan_tag !== SIN)
        .map((c) => {
          const lista = enColumna(c.clan_tag);
          if (!lista.length) return null;
          const filas = lista.map((p, i) => `${String(i + 1).padStart(2)}. ${p.nombre}`).join('\n');
          return `*${c.nombre}*  (${lista.length}/${c.cwl_tamano ?? 15})\n\`\`\`${filas}\`\`\``;
        })
        .filter(Boolean);

      if (!bloques.length) {
        setMsg('No hay nadie asignado todavía.');
        return;
      }

      const cuerpo =
        `📋 *ALINEACIÓN CWL ${d.temporada}*\n\n` +
        bloques.join('\n\n') +
        `\n\n_Si no puedes jugar, avisa ANTES del día de batalla._`;

      if (demo) {
        setMsg('Así quedaría el mensaje:\n\n' + cuerpo);
        return;
      }

      const { error } = await supabase.from('outbox').insert({
        tipo: 'alineacion_cwl',
        cuerpo,
        clave_dedupe: `alineacion:${d.temporada}:${Date.now()}`,
      });
      if (error) throw error;

      setMsg('Mensaje generado. Está en la pestaña Mensajes, listo para copiar.');
      recargar?.();
    } catch (e) {
      setMsg(`Error: ${e.message}`);
    } finally {
      setGuardando(false);
    }
  }

  if (!candidatos.length) {
    return <p className="vacio">{t('Sin jugadores todavía. Corre el snapshot primero.')}</p>;
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
        <h2 className="sec" style={{ margin: 0 }}>{t('Alineación')} · {t('temporada')} {d.temporada}</h2>
        <span style={{ flex: 1 }} />
        <button className="accion" onClick={generarMensaje} disabled={guardando}>
          {guardando ? t('Generando…') : t('Generar mensaje')}
        </button>
      </div>
      <p className="sub" style={{ color: 'var(--tenue)', fontSize: 13, marginTop: 0 }}>
        {t('Arrastra los nombres entre clanes. En el teléfono usa el desplegable de cada tarjeta.')}
      </p>
      {msg &&
        // Un mensaje de varias lineas dentro de un <p> colapsa los saltos y
        // el preview mentiria sobre como se ve en WhatsApp.
        (msg.includes('\n') ? (
          <pre className="msg">{msg}</pre>
        ) : (
          <p className={msg.startsWith('Error') || msg.startsWith('No se pudo') ? 'error' : 'sub'}>{msg}</p>
        ))}

      <div className="columnas">
        {columnas.map((c) => {
          const lista = enColumna(c.clan_tag);
          const lleno = c.cwl_tamano && lista.length > c.cwl_tamano;
          return (
            <div
              key={c.clan_tag}
              className="col"
              data-col={c.clan_tag}
              data-sobre={sobre === c.clan_tag ? '1' : '0'}
            >
              <div className="col-cab">
                <strong>{c.nombre}</strong>
                {c.es_principal && <span className="pill">{t('principal')}</span>}
                <span style={{ flex: 1 }} />
                <span className={lleno ? 'pill mal' : 'pill'}>
                  {lista.length}
                  {c.cwl_tamano ? `/${c.cwl_tamano}` : ''}
                </span>
              </div>

              {lista.map((p) => (
                <div
                  key={p.tag}
                  className="ficha"
                  data-agarrada={arrastrando === p.tag ? '1' : '0'}
                >
                  <span
                    className="asa asa-ficha"
                    role="button"
                    tabIndex={-1}
                    aria-hidden="true"
                    title={t('Arrastrar a otro clan')}
                    onPointerDown={(e) => alAgarrar(e, p.tag)}
                    onPointerMove={alArrastrar}
                    onPointerUp={alSoltar}
                    onPointerCancel={alSoltar}
                  >
                    ⠿
                  </span>
                  <div className="ficha-nom">{p.nombre}</div>
                  <div className="ficha-sub">
                    TH{p.th ?? '?'} · {p.trofeos} 🏆
                  </div>
                  <select
                    className="ficha-sel"
                    value={asig[p.tag] ?? SIN}
                    onChange={(e) => mover(p.tag, e.target.value)}
                    aria-label={`${t('Clan de')} ${p.nombre}`}
                  >
                    {columnas.map((o) => (
                      <option key={o.clan_tag} value={o.clan_tag}>
                        {o.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              ))}

              {!lista.length && <p className="col-vacia">{t('suelta nombres aquí')}</p>}
            </div>
          );
        })}
      </div>
    </>
  );
}
