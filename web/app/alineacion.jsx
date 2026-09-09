'use client';

// Armado de alineaciones de CWL. Reemplaza los mensajes de WhatsApp donde se
// escribe a mano quien va en cada clan.
//
// El roster NO se carga a mano: sale del ultimo snapshot, que la API baja
// todos los dias. Aca solo se arrastra.
//
// Se puede mover un jugador de DOS formas, y las dos funcionan con el dedo:
//
//   Arrastrar la tarjeta     desde cualquier parte. Con raton, al instante;
//                            con el dedo, manteniendo pulsado 250 ms.
//   Desplegable de la ficha  un toque, sin gesto que pueda salir mal.
//
// Antes esto usaba la API de arrastre de HTML5 (draggable + onDrop). Esa API
// NO dispara en pantallas tactiles: en el telefono el arrastre no hacia
// absolutamente nada y solo servia el desplegable. Con eventos de puntero el
// mismo codigo sirve para los dos, que es lo que hace falta cuando los
// lideres arman la CWL desde el movil.
//
// Por que el dedo necesita pulsacion larga y el raton no: si la tarjeta
// capturase el gesto desde el primer contacto, tocar un nombre bloquearia el
// scroll de la pagina. Es el mismo bug que tenian las tarjetas de clan. Con
// la espera de 250 ms un deslizamiento rapido sigue siendo scroll, y solo un
// gesto deliberado arrastra.

import { useEffect, useMemo, useRef, useState } from 'react';
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
  // Pulsacion larga en curso. En una ref y no en estado: cambia dentro de
  // un temporizador y no debe repintar nada.
  const presion = useRef(null);
  // La copia de la tarjeta que va pegada al dedo. Tambien en una ref y
  // movida a mano por el DOM: se recoloca en cada pointermove, y hacerlo
  // por el estado de React seria repintar las siete columnas enteras
  // sesenta veces por segundo para mover una sola tarjeta.
  const fantasma = useRef(null);
  // Espejo de `arrastrando` para los manejadores de puntero. El estado de
  // React no sirve aca: entre que activar() lo pone y React repinta pasa un
  // frame, y los pointermove que caen dentro de ese hueco leerian el valor
  // viejo y se descartarian. Con raton eso es visible, porque el arrastre
  // arranca en el mismo pointerdown y los primeros movimientos se perdian.
  const agarrada = useRef(null);
  // Temporizador del desplazamiento por borde, para poder pararlo.
  const autoScroll = useRef(null);
  // Estable entre renders: hay que poder quitar el MISMO listener.
  const frenar = useRef((e) => e.preventDefault()).current;
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

  // ---- El fantasma: la tarjeta que sigue al dedo ----
  /**
   * Levanta una copia de la tarjeta y la deja pegada al puntero.
   *
   * Antes la tarjeta se quedaba clavada en su sitio y solo se iluminaba la
   * columna de destino: se veia rigido y no habia forma de saber que se
   * estaba moviendo hasta soltar. Ahora la que se mueve es la copia y el
   * hueco original queda marcado con el borde punteado.
   *
   * Es un clon del nodo y no otra ficha en JSX para que no haya dos sitios
   * que mantener cuando cambie el diseño de la tarjeta.
   */
  function crearFantasma(el, x, y) {
    const r = el.getBoundingClientRect();
    const nodo = el.cloneNode(true);
    nodo.className = 'ficha ficha-fantasma';
    nodo.style.width = `${r.width}px`;
    document.body.appendChild(nodo);
    // La tira de columnas se busca UNA vez, no en cada fotograma.
    const tira = el.closest('.columnas');
    // El ajuste por imanes pelea con el desplazamiento a mano: cada vez que
    // el bucle mueve unos pixeles, el navegador tira de vuelta a la columna
    // mas cercana y se ve a tirones.
    if (tira) tira.style.scrollSnapType = 'none';
    // dx/dy: donde agarro el dedo DENTRO de la tarjeta. Sin esto la tarjeta
    // pega un salto y se centra en el dedo al empezar a moverse.
    fantasma.current = { nodo, tira, dx: x - r.left, dy: y - r.top, puntero: { x, y } };
    moverFantasma(x, y);
  }

  function moverFantasma(x, y) {
    const f = fantasma.current;
    if (!f) return;
    f.puntero = { x, y };
    f.nodo.style.transform =
      `translate3d(${x - f.dx}px, ${y - f.dy}px, 0) scale(1.04) rotate(-2deg)`;
  }

  function quitarFantasma() {
    const f = fantasma.current;
    if (!f) return;
    if (f.tira) f.tira.style.scrollSnapType = '';
    f.nodo.remove();
    fantasma.current = null;
  }

  // ---- Desplazar solo al llegar al borde ----
  // Mientras se arrastra, el scroll de la pagina esta bloqueado a proposito.
  // Sin esto no habria forma de soltar a alguien en un clan que no quepa en
  // pantalla, y en el telefono las columnas van APILADAS: casi ningun clan
  // de destino se ve a la vez que el de origen. Es el caso normal, no el
  // raro.
  const BORDE = 70; // px de margen donde empieza a desplazarse
  const PASO = 8; // px por tic
  const TIC = 16; // ms entre tics (~60 por segundo)

  // Con setInterval y no con requestAnimationFrame: rAF solo corre cuando
  // el navegador esta pintando, y basta que el sistema decida saltarse unos
  // fotogramas -o que la pagina no se este dibujando- para que el
  // desplazamiento se pare a media arrastrada sin que nadie lo suelte. El
  // bucle dura lo que dura el gesto y se corta en soltarPresion().
  function pasoAutoScroll() {
    const f = fantasma.current;
    if (!f) return;
    const { x, y } = f.puntero;

    if (y < BORDE) window.scrollBy(0, -PASO);
    else if (y > window.innerHeight - BORDE) window.scrollBy(0, PASO);

    const tira = f.tira;
    if (tira && tira.scrollWidth > tira.clientWidth) {
      const r = tira.getBoundingClientRect();
      if (x < r.left + BORDE) tira.scrollLeft -= PASO;
      else if (x > r.right - BORDE) tira.scrollLeft += PASO;
    }

    // Recalcular aqui y no solo en pointermove: con el dedo quieto en el
    // borde, lo que se mueve es el contenido, y la columna que hay debajo
    // cambia sin que llegue ningun evento de puntero.
    setSobre(columnaEn(x, y));
  }

  // Si el componente se va con un arrastre a medias, el clon vive en
  // document.body y no lo limpiaria nadie.
  useEffect(
    () => () => {
      clearInterval(autoScroll.current);
      quitarFantasma();
    },
    []
  );

  // ---- Arrastrar con raton o dedo ----
  /**
   * Empezar a arrastrar desde CUALQUIER parte de la ficha.
   *
   * Con raton arranca al instante. Con el dedo NO puede arrancar al
   * instante, y esto es un conflicto real, no una pereza: si la ficha
   * captura el gesto desde el primer contacto, deja de poder hacerse scroll
   * — es exactamente el bug que tenian las tarjetas de clan, donde tocar
   * cualquier parte bloqueaba la pagina.
   *
   * La salida estandar es la pulsacion larga: se espera 250 ms. Si el dedo
   * se mueve mas de 10 px antes, era un scroll y se cancela. Si aguanta,
   * empieza el arrastre y a partir de ahi se bloquea el scroll a mano con
   * preventDefault, porque a esas alturas el navegador todavia no ha
   * empezado a desplazar nada.
   */
  function alAgarrar(e, tag) {
    const esRaton = e.pointerType === 'mouse';
    const el = e.currentTarget;
    const pid = e.pointerId;
    const x0 = e.clientX;
    const y0 = e.clientY;

    const activar = (x, y) => {
      // Con try: si el puntero ya se solto, setPointerCapture lanza
      // NotFoundError y sin esto se llevaria por delante todo lo que viene
      // detras — no se crearia la copia y el arrastre quedaria muerto.
      try {
        el.setPointerCapture?.(pid);
      } catch {}
      crearFantasma(el, x, y);
      agarrada.current = tag;
      setArrastrando(tag);
      // Un toquecito para avisar de que ya agarro. Sin esto el unico aviso
      // de que la pulsacion larga cumplio es visual, y el dedo suele estar
      // justo encima tapandolo.
      if (!esRaton) navigator.vibrate?.(15);
      // Solo mientras se arrastra: bloquea el desplazamiento de la pagina
      // sin quitarselo al resto del tiempo. Va como listener no pasivo
      // porque uno pasivo no puede llamar a preventDefault.
      document.addEventListener('touchmove', frenar, { passive: false });
      autoScroll.current ??= setInterval(pasoAutoScroll, TIC);
    };

    if (esRaton) return activar(x0, y0);

    presion.current = {
      tag,
      x0,
      y0,
      ultimo: { x: x0, y: y0 },
      temporizador: setTimeout(() => {
        // Desde donde esta el dedo AHORA, no desde donde toco hace 250 ms:
        // puede haberse corrido hasta 10 px y la copia saldria descuadrada.
        const { x, y } = presion.current.ultimo;
        presion.current = { ...presion.current, temporizador: null };
        activar(x, y);
      }, 250),
    };
  }

  /** Cancela la pulsacion larga si el dedo se movio: era un scroll. */
  function alTantear(e) {
    const p = presion.current;
    if (!p?.temporizador) return;
    p.ultimo = { x: e.clientX, y: e.clientY };
    if (Math.hypot(e.clientX - p.x0, e.clientY - p.y0) > 10) {
      clearTimeout(p.temporizador);
      presion.current = null;
    }
  }

  function soltarPresion() {
    if (presion.current?.temporizador) clearTimeout(presion.current.temporizador);
    presion.current = null;
    clearInterval(autoScroll.current);
    autoScroll.current = null;
    quitarFantasma();
    document.removeEventListener('touchmove', frenar, { passive: false });
  }

  /** Columna que hay debajo del puntero. elementFromPoint hace su propia
   *  prueba de impacto sobre el documento: la captura del puntero no le
   *  afecta, por eso sigue viendo lo que hay debajo. */
  const columnaEn = (x, y) =>
    document.elementFromPoint(x, y)?.closest('[data-col]')?.dataset.col ?? null;
  const columnaBajo = (e) => columnaEn(e.clientX, e.clientY);

  function alArrastrar(e) {
    if (!agarrada.current) return alTantear(e);
    // La copia primero: es lo que el ojo sigue. setSobre no repinta si la
    // columna no cambio, asi que el coste real de mover es este renglon.
    moverFantasma(e.clientX, e.clientY);
    setSobre(columnaBajo(e));
  }

  function alSoltar(e) {
    soltarPresion();
    const tag = agarrada.current;
    if (!tag) return;
    agarrada.current = null;
    // Soltar el estado ANTES de tocar el puntero. releasePointerCapture
    // lanza si la captura ya no existe -y no existe justo en el caso que
    // mas importa, el pointercancel que dispara el sistema cuando entra una
    // llamada o se cambia de app-; si lanzase aqui arriba, la tarjeta se
    // quedaria de hueco punteado y sin dueño hasta recargar la pagina.
    setArrastrando(null);
    setSobre(null);
    try {
      e.currentTarget.releasePointerCapture?.(e.pointerId);
    } catch {}
    const destino = columnaBajo(e);
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
        {t('Arrastra los nombres entre clanes. En el teléfono mantén pulsada la tarjeta y arrástrala; el desplegable también sirve.')}
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
                  title={t('Arrastra desde cualquier parte. En el teléfono, mantén pulsado.')}
                  onPointerDown={(e) => alAgarrar(e, p.tag)}
                  onPointerMove={alArrastrar}
                  onPointerUp={alSoltar}
                  onPointerCancel={alSoltar}
                >
                  {/* El asa se queda como pista visual de que la tarjeta se
                      arrastra. Ya no es la unica zona que responde. */}
                  <span className="asa asa-ficha" aria-hidden="true">
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
