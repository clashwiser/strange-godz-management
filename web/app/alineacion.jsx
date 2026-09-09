'use client';

// Armado de alineaciones de CWL. Reemplaza los mensajes de WhatsApp donde se
// escribe a mano quien va en cada clan.
//
// El roster NO se carga a mano: sale del ultimo snapshot, que la API baja
// todos los dias. Aca solo se arrastra.
//
// Arrastrar no funciona en telefonos, asi que cada tarjeta lleva ademas un
// desplegable. Misma accion, dos formas.

import { useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

const SIN = '__sin__';

// `demo` = tablero jugable sin base de datos, para la vista de ejemplo.
export default function Alineacion({ d, recargar, demo = false }) {
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
    return [{ clan_tag: SIN, nombre: 'Sin asignar', cwl_tamano: null }, ...clanes];
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
        `\n\n_Si no podés jugar, avisá ANTES del día de batalla._`;

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
    return <p className="vacio">Sin jugadores todavía. Corré el snapshot primero.</p>;
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
        <h2 className="sec" style={{ margin: 0 }}>Alineación · temporada {d.temporada}</h2>
        <span style={{ flex: 1 }} />
        <button className="accion" onClick={generarMensaje} disabled={guardando}>
          {guardando ? 'Generando…' : 'Generar mensaje'}
        </button>
      </div>
      <p className="sub" style={{ color: 'var(--tenue)', fontSize: 13, marginTop: 0 }}>
        Arrastrá los nombres entre clanes. En el teléfono usá el desplegable de cada tarjeta.
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
              data-sobre={sobre === c.clan_tag ? '1' : '0'}
              onDragOver={(e) => {
                e.preventDefault();
                setSobre(c.clan_tag);
              }}
              onDragLeave={() => setSobre((s) => (s === c.clan_tag ? null : s))}
              onDrop={(e) => {
                e.preventDefault();
                setSobre(null);
                const tag = arrastrando || e.dataTransfer.getData('text/plain');
                if (tag) mover(tag, c.clan_tag);
                setArrastrando(null);
              }}
            >
              <div className="col-cab">
                <strong>{c.nombre}</strong>
                {c.es_principal && <span className="pill">principal</span>}
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
                  draggable
                  onDragStart={(e) => {
                    setArrastrando(p.tag);
                    e.dataTransfer.setData('text/plain', p.tag);
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  onDragEnd={() => setArrastrando(null)}
                >
                  <div className="ficha-nom">{p.nombre}</div>
                  <div className="ficha-sub">
                    TH{p.th ?? '?'} · {p.trofeos} 🏆
                  </div>
                  <select
                    className="ficha-sel"
                    value={asig[p.tag] ?? SIN}
                    onChange={(e) => mover(p.tag, e.target.value)}
                    aria-label={`Clan de ${p.nombre}`}
                  >
                    {columnas.map((o) => (
                      <option key={o.clan_tag} value={o.clan_tag}>
                        {o.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              ))}

              {!lista.length && <p className="col-vacia">soltá nombres acá</p>}
            </div>
          );
        })}
      </div>
    </>
  );
}
