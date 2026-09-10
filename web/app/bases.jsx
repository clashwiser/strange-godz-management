'use client';

// Packs de bases. El PDF llega por DM del proveedor y se importa con
//   npm run bases:importar "ruta/al.pdf" "Nombre del pack"
// De ahi en adelante todo es automatico: nivel de TH y tipo (aldea o guerra)
// salen del propio enlace, no hay que etiquetar nada a mano.

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useT } from './idioma';

// Se traducen al pintar, no aqui: el mapa es de codigo de la API a texto.
const TIPOS = { HV: 'Aldea', WB: 'Guerra' };

export default function Bases({ d, demo = false, recargar }) {
  const t = useT();
  const [packSel, setPackSel] = useState('todos');
  const [tipoSel, setTipoSel] = useState('todos');
  const [soloLibres, setSoloLibres] = useState(false);
  const [copiada, setCopiada] = useState(null);
  const [enviando, setEnviando] = useState(null);
  const [enviada, setEnviada] = useState(null);
  const [ampliada, setAmpliada] = useState(null);
  const [msg, setMsg] = useState('');

  const nombre = useMemo(
    () => Object.fromEntries((d.players ?? []).map((p) => [p.player_tag, p.nombre_actual])),
    [d.players]
  );

  const filtradas = useMemo(() => {
    return (d.bases ?? [])
      .filter(
        (b) =>
          (packSel === 'todos' || String(b.pack_id) === packSel) &&
          (tipoSel === 'todos' || b.tipo === tipoSel) &&
          (!soloLibres || !b.asignada_a)
      )
      // Las que traen miniatura, primero: se eligen de un vistazo. Las de
      // solo texto obligan a abrir el enlace en el juego para saber que son,
      // asi que estorban arriba. Dentro de cada grupo se respeta el orden
      // que trajo la consulta, que ya viene por TH descendente.
      .sort((a, b) => (b.preview ? 1 : 0) - (a.preview ? 1 : 0));
  }, [d.bases, packSel, tipoSel, soloLibres]);

  useEffect(() => {
    if (!ampliada) return;
    const alTecla = (e) => e.key === 'Escape' && setAmpliada(null);
    window.addEventListener('keydown', alTecla);
    return () => window.removeEventListener('keydown', alTecla);
  }, [ampliada]);

  /**
   * Estira la caja de la nota hasta que quepa todo.
   *
   * Con alto fijo las notas del proveedor salen cortadas y con una barrita
   * de scroll adentro, que para leerlas es casi tan incomodo como no
   * tenerlas. El tope lo pone max-height en el CSS.
   */
  function autoAlto(el) {
    if (!el) return;
    el.style.height = 'auto';
    // El borde va sumado aparte: con box-sizing:border-box el alto incluye
    // el borde pero scrollHeight no, asi que quedarse en scrollHeight deja
    // el contenido 4px por fuera y la barrita de scroll no se va nunca.
    const borde = el.offsetHeight - el.clientHeight;
    el.style.height = `${el.scrollHeight + borde}px`;
  }

  async function copiar(b) {
    try {
      await navigator.clipboard.writeText(b.url);
      setCopiada(b.id);
      setTimeout(() => setCopiada(null), 1800);
    } catch {
      setMsg(t('No se pudo copiar. Ábrela con el botón y copia desde la barra.'));
    }
  }

  /**
   * Guarda el comentario de una base.
   *
   * Los PDF del proveedor traen anotaciones que hoy se pierden al importar:
   * contra que ejercito defiende, que donar en el castillo. El importador
   * saca el enlace y el nivel de ayuntamiento, no el texto suelto de
   * alrededor, asi que esto se escribe a mano una vez y queda para todos.
   *
   * Se guarda al salir del campo y no en cada tecla: escribir "defiende
   * bien contra hydra" son 26 escrituras a la base contra una.
   */
  async function guardarNota(b, texto) {
    const limpio = texto.trim();
    if ((b.nota ?? '') === limpio) return;
    if (demo) {
      setMsg(t('En la demo no se guarda.'));
      setTimeout(() => setMsg(''), 2000);
      return;
    }
    try {
      const { error } = await supabase
        .from('bases')
        .update({ nota: limpio || null })
        .eq('id', b.id);
      if (error) throw error;
      recargar?.();
    } catch (e) {
      setMsg(`${t('No se pudo guardar: ')}${e.message}`);
    }
  }

  /**
   * Que Heraldo le mande la base al jugador que la tiene asignada.
   *
   * Va al grupo y no por privado porque un bot no puede escribirle primero
   * a quien nunca le ha hablado — Telegram no lo permite — y la mitad del
   * clan no le va a escribir nunca. Mencionado en el grupo llega igual, y
   * ademas los demas ven que esa base ya tiene dueño.
   */
  async function enviarAJugador(b) {
    if (!b.asignada_a) return;
    if (demo) {
      setMsg(t('En la demo no se envía.'));
      setTimeout(() => setMsg(''), 2000);
      return;
    }
    setEnviando(b.id);
    setMsg('');
    try {
      const { data: sesion } = await supabase.auth.getSession();
      const r = await fetch('/api/base-jugador', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sesion?.session?.access_token}`,
        },
        body: JSON.stringify({ baseId: b.id }),
      });
      const j = await r.json().catch(() => ({}));
      if (!j.ok) throw new Error(j.error ?? `error ${r.status}`);
      setEnviada(b.id);
      setTimeout(() => setEnviada(null), 2500);
      // Si no estaba atado, se avisa: llego, pero sin vibrarle el telefono.
      if (!j.mencionado) {
        setMsg(
          `${t('Enviado, pero')} ${j.jugador} ${t('no se ha presentado a Heraldo, así que no le sonó el teléfono. Dile que escriba')} "Heraldo yo soy ${j.jugador}".`
        );
      }
    } catch (e) {
      setMsg(`${t('No se pudo enviar: ')}${e.message}`);
    } finally {
      setEnviando(null);
    }
  }

  async function asignar(b, playerTag) {
    if (demo) {
      setMsg(t('En la demo no se guarda.'));
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
        <h2 className="sec">{t('Bases')}</h2>
        <div className="card">
          <h3>{t('Todavía no hay bases cargadas')}</h3>
          <p className="sub">
            {t('Baja el PDF del proveedor y corre:')}
          </p>
          <pre className="msg">npm run bases:importar &quot;C:/ruta/al/pack.pdf&quot; &quot;RH CWL Sept&quot;</pre>
          <p className="sub" style={{ marginTop: 10 }}>
            {t('Los enlaces van como anotaciones dentro del PDF, no como texto — por eso copiar y pegar el contenido no trae nada. El importador los lee y saca de cada uno el nivel de ayuntamiento y si es base de aldea o de guerra.')}
          </p>
        </div>
      </>
    );
  }

  const libres = filtradas.filter((b) => !b.asignada_a).length;

  return (
    <>
      <h2 className="sec">{t('Bases')} · {filtradas.length} {t('de')} {d.bases.length}</h2>
      {msg && <p className="error">{msg}</p>}

      <div className="filtros">
        <select className="campo campo-corto" value={packSel} onChange={(e) => setPackSel(e.target.value)}>
          <option value="todos">{t('Todos los packs')}</option>
          {(d.basePacks ?? []).map((p) => (
            <option key={p.id} value={String(p.id)}>{p.nombre}</option>
          ))}
        </select>
        <select className="campo campo-corto" value={tipoSel} onChange={(e) => setTipoSel(e.target.value)}>
          <option value="todos">{t('Aldea y guerra')}</option>
          <option value="WB">{t('Solo guerra')}</option>
          <option value="HV">{t('Solo aldea')}</option>
        </select>
        <label className="fila-check" style={{ marginTop: 0 }}>
          <input type="checkbox" checked={soloLibres} onChange={(e) => setSoloLibres(e.target.checked)} />
          <span>{t('Solo sin asignar')} ({libres})</span>
        </label>
      </div>

      <div className="tabla-scroll">
        <table>
          <thead>
            <tr>
              <th>{t('Base')}</th>
              <th className="num">TH</th>
              <th>{t('Tipo')}</th>
              <th>{t('Asignada a')}</th>
              <th>{t('Notas')}</th>
              <th>{t('Enlace')}</th>
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
                    <span className="mini-vacia">{t('sin imagen')}</span>
                  )}
                  {/* El numero que trae el PDF: es como el proveedor las
                      llama cuando alguien pregunta por una en el grupo. */}
                  {b.etiqueta && <span className="sub etiqueta-base">{b.etiqueta}</span>}
                </td>
                <td className="num">{b.th ?? '—'}</td>
                <td>
                  <span className="pill">{t(TIPOS[b.tipo] ?? b.tipo ?? '—')}</span>
                </td>
                <td>
                  <select
                    className="campo campo-corto"
                    style={{ marginTop: 0 }}
                    value={b.asignada_a ?? ''}
                    onChange={(e) => asignar(b, e.target.value)}
                  >
                    <option value="">{t('— libre —')}</option>
                    {(d.players ?? []).map((p) => (
                      <option key={p.player_tag} value={p.player_tag}>
                        {nombre[p.player_tag]}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  {/* defaultValue y guardado al salir: con value controlado
                      cada tecla repinta la tabla entera, y con onChange cada
                      tecla escribiria en la base.

                      Es textarea y no input porque lo que trae el PDF son
                      frases enteras ("Builder: Aquiles - Recommendation 1:
                      Ice Golem x2, Furnace x1...") y en una sola linea hay
                      que ir barriendo con el cursor para leerlas.

                      key con la nota: React reusa el nodo al recargar y un
                      defaultValue no se vuelve a aplicar, asi que sin esto
                      la celda seguiria mostrando lo viejo. */}
                  <textarea
                    key={b.nota ?? ''}
                    ref={autoAlto}
                    className="campo campo-nota"
                    rows={1}
                    defaultValue={b.nota ?? ''}
                    placeholder={t('contra qué defiende, qué donar…')}
                    onInput={(e) => autoAlto(e.currentTarget)}
                    onBlur={(e) => guardarNota(b, e.target.value)}
                  />
                </td>
                {/* El flex va en la caja interior, NO en el <td>. Una celda
                    con display:flex deja de ser celda de tabla y se cae del
                    calculo de altura de la fila: su borde inferior quedaba
                    19px mas arriba que el resto y la linea divisoria se veia
                    rota justo en esta columna. */}
                <td className="acciones">
                  <div className="acciones-caja">
                    <button
                      className="fantasma"
                      onClick={() => setAmpliada(b)}
                      disabled={!b.preview}
                      title={b.preview ? t('Ver la base en grande') : t('Este pack no trae imagen')}
                    >
                      {t('Ver')}
                    </button>
                    <button className="fantasma" onClick={() => copiar(b)}>
                      {copiada === b.id ? t('¡Copiado!') : t('Copiar')}
                    </button>
                    <a href={b.url} target="_blank" rel="noopener noreferrer">
                      <button className="fantasma">{t('Abrir')}</button>
                    </a>
                  </div>
                  {/* Debajo de los otros tres y en su propia fila: es la
                      accion que sale del panel hacia la gente, no una mas
                      de mirar. Apagado mientras la base no tenga dueño —
                      sin jugador no hay a quien mencionar. */}
                  <button
                    className={b.asignada_a ? 'accion boton-enviar-base' : 'fantasma boton-enviar-base'}
                    disabled={!b.asignada_a || enviando === b.id}
                    title={
                      b.asignada_a
                        ? t('Heraldo se la manda al jugador, mencionándolo')
                        : t('Asígnale la base a alguien primero')
                    }
                    onClick={() => enviarAJugador(b)}
                  >
                    {enviada === b.id
                      ? `✅ ${t('Enviada')}`
                      : enviando === b.id
                        ? t('Enviando…')
                        : `🎺 ${t('Enviar al jugador')}`}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!filtradas.length && <p className="vacio">{t('Ninguna base con esos filtros.')}</p>}

      {ampliada && (
        <div className="lupa" onClick={() => setAmpliada(null)}>
          {/* stopPropagation: tocar la imagen no debe cerrar la lupa */}
          <div className="lupa-caja" onClick={(e) => e.stopPropagation()}>
            <img src={ampliada.preview} alt="" />
            {ampliada.nota && <p className="nota-base">{ampliada.nota}</p>}
            <div className="lupa-pie">
              <span className="pill">TH{ampliada.th ?? '?'}</span>{' '}
              <span className="pill">{t(TIPOS[ampliada.tipo] ?? ampliada.tipo ?? '—')}</span>
              <span style={{ flex: 1 }} />
              <button className="fantasma" onClick={() => copiar(ampliada)}>
                {copiada === ampliada.id ? t('¡Copiado!') : t('Copiar enlace')}
              </button>
              <a href={ampliada.url} target="_blank" rel="noopener noreferrer">
                <button className="accion">{t('Abrir en el juego')}</button>
              </a>
              <button className="fantasma" onClick={() => setAmpliada(null)}>{t('Cerrar')}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
