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
  // Copia local por TEMPORADA para que la UI responda al instante sin
  // esperar a la base. Antes era un solo mapa, el del mes en curso, y por
  // eso no se podia armar la lista de octubre en septiembre: la pantalla no
  // tenia donde guardar mas de un mes a la vez.
  const [porTemp, setPorTemp] = useState(() => {
    const m = {};
    for (const a of d.alineaciones ?? []) m[a.player_tag] = a.clan_tag;
    return { [d.temporada]: m };
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

  // ---- Alineaciones de meses anteriores ----
  // Armar las siete listas desde cero cada mes es el trabajo mas pesado de
  // toda la CWL, y de un mes al siguiente cambian cuatro o cinco nombres.
  // Con esto se mira lo que se hizo el mes pasado y se copia como punto de
  // partida.
  const [temporadas, setTemporadas] = useState([]);
  const [verTemporada, setVerTemporada] = useState(d.temporada);
  const [confirmar, setConfirmar] = useState(false);

  // El mes que viene. Se ofrece SIEMPRE aunque no exista todavia en la base:
  // armar la CWL del mes siguiente con calma es justo lo que hay que poder
  // hacer, y esperar al dia 1 para empezar es lo que obliga a improvisar.
  const siguiente = useMemo(() => {
    const [a, m] = d.temporada.split('-').map(Number);
    const f = new Date(Date.UTC(a, m, 1));
    return f.toISOString().slice(0, 7);
  }, [d.temporada]);

  // Un mes ya cerrado se mira y no se toca. El actual y los futuros se
  // editan: comparar cadenas 'YYYY-MM' ordena bien sin parsear fechas.
  const editable = verTemporada >= d.temporada;
  const esActual = verTemporada === d.temporada;
  const esFutura = verTemporada > d.temporada;

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

  const asigVista = porTemp[verTemporada] ?? {};

  const enColumna = (clanTag) =>
    candidatos.filter((p) => (asigVista[p.tag] ?? SIN) === clanTag);

  // Que temporadas hay guardadas. Una consulta y ya: son una fila por
  // jugador y mes, unos cientos en total.
  useEffect(() => {
    if (demo) {
      return setTemporadas(
        [...new Set([siguiente, d.temporada, ...Object.keys(d.alineacionesPrevias ?? {})])]
          .sort()
          .reverse()
      );
    }
    (async () => {
      const { data, error } = await supabase
        .from('alineaciones')
        .select('temporada')
        .order('temporada', { ascending: false });
      if (error) return;
      const unicas = [
        ...new Set([siguiente, d.temporada, ...(data ?? []).map((r) => r.temporada)]),
      ];
      setTemporadas(unicas.sort().reverse());
    })();
  }, [demo, d.temporada, siguiente]);

  // La alineacion de una temporada vieja se trae solo cuando se mira, y una
  // sola vez.
  useEffect(() => {
    if (porTemp[verTemporada]) return;
    if (demo) {
      const filas = d.alineacionesPrevias?.[verTemporada] ?? [];
      return setPorTemp((h) => ({
        ...h,
        [verTemporada]: Object.fromEntries(filas.map((r) => [r.player_tag, r.clan_tag])),
      }));
    }
    (async () => {
      const { data, error } = await supabase
        .from('alineaciones')
        .select('player_tag, clan_tag')
        .eq('temporada', verTemporada);
      if (error) return setMsg(`No se pudo cargar ${verTemporada}: ${error.message}`);
      setPorTemp((h) => ({
        ...h,
        [verTemporada]: Object.fromEntries((data ?? []).map((r) => [r.player_tag, r.clan_tag])),
      }));
    })();
  }, [verTemporada, demo]);

  /**
   * Copia la alineacion que se esta mirando a la temporada en curso.
   *
   * Pisa lo que haya: la gracia es arrancar el mes con la lista del mes
   * pasado ya puesta y solo corregir los cambios. Por eso pide confirmacion
   * cuando ya hay algo asignado — si no, un toque mal dado borra el trabajo
   * de una tarde.
   */
  async function copiarAlineacion(destinoTemp) {
    const origen = asigVista;
    const filas = Object.entries(origen)
      .filter(([tag, clan]) => clan && clan !== SIN && snap[tag])
      .map(([tag, clan]) => ({
        temporada: destinoTemp,
        player_tag: tag,
        clan_tag: clan,
        actualizado: new Date().toISOString(),
      }));

    if (!filas.length) {
      setMsg(t('Esa temporada no tiene a nadie asignado que siga en la alianza.'));
      return;
    }

    setGuardando(true);
    setMsg('');
    try {
      if (!demo) {
        const { error } = await supabase
          .from('alineaciones')
          .upsert(filas, { onConflict: 'temporada,player_tag' });
        if (error) throw error;
      }
      setPorTemp((h) => ({
        ...h,
        [destinoTemp]: Object.fromEntries(filas.map((f) => [f.player_tag, f.clan_tag])),
      }));
      const desde = verTemporada;
      setVerTemporada(destinoTemp);
      setConfirmar(false);
      setMsg(
        `${t('Copiada la alineación de')} ${desde} ${t('a')} ${destinoTemp}: ${filas.length} ${t('jugadores')}. ${t('Ahora edita lo que haga falta.')}`
      );
    } catch (e) {
      setMsg(`No se pudo copiar: ${e.message}`);
    } finally {
      setGuardando(false);
    }
  }

  async function mover(tag, destino) {
    if (!editable) return;
    const previo = asigVista[tag] ?? SIN;
    if (previo === destino) return;

    const temp = verTemporada;
    setPorTemp((h) => ({ ...h, [temp]: { ...(h[temp] ?? {}), [tag]: destino } }));
    setMsg('');
    if (demo) return;

    try {
      if (destino === SIN) {
        const { error } = await supabase
          .from('alineaciones')
          .delete()
          .eq('temporada', temp)
          .eq('player_tag', tag);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('alineaciones').upsert(
          { temporada: temp, player_tag: tag, clan_tag: destino, actualizado: new Date().toISOString() },
          { onConflict: 'temporada,player_tag' }
        );
        if (error) throw error;
      }
    } catch (e) {
      // Revertir: si la base rechazo, la pantalla no puede mentir.
      setPorTemp((h) => ({ ...h, [temp]: { ...(h[temp] ?? {}), [tag]: previo } }));
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

  /**
   * Un mensaje POR CLAN, no uno con todo dentro.
   *
   * El mensaje sirve para que la gente se mude al clan que le toca, y para
   * eso hace falta el enlace. Un solo mensaje con los tres clanes y los tres
   * enlaces obliga a cada uno a buscar su nombre en una lista de cuarenta y
   * cinco y despues acertar con el enlace correcto. Separados, cada quien
   * recibe el suyo y toca un solo boton.
   *
   * Ademas asi se pueden mandar por separado: el clan que ya esta armado
   * sale hoy y el que falta espera.
   */
  async function generarMensaje() {
    setGuardando(true);
    setMsg('');
    try {
      const conGente = columnas
        .filter((c) => c.clan_tag !== SIN)
        .map((c) => ({ clan: c, lista: enColumna(c.clan_tag) }))
        .filter(({ lista }) => lista.length);

      if (!conGente.length) {
        setMsg('No hay nadie asignado todavía.');
        return;
      }

      // El enlace lo arma el propio juego a partir del tag: no hay que
      // guardarlo en ningun sitio ni mantenerlo.
      const enlaceDe = (tag) =>
        `https://link.clashofclans.com/es?action=OpenClanProfile&tag=${encodeURIComponent(tag)}`;

      const mensajes = conGente.map(({ clan, lista }) => {
        const filas = lista.map((p, i) => `${String(i + 1).padStart(2)}. ${p.nombre}`).join('\n');
        return {
          clan: clan.nombre,
          cuerpo:
            `📋 *CWL ${verTemporada} · ${clan.nombre}*\n` +
            `${lista.length}/${clan.cwl_tamano ?? 15} puestos\n\n` +
            '```' + filas + '```\n\n' +
            `👉 Entra aquí: ${enlaceDe(clan.clan_tag)}\n\n` +
            `_Múdate antes de que empiece la liga. Si no puedes jugar, avisa ANTES del día de batalla._`,
        };
      });

      if (demo) {
        setMsg(
          `Se generarían ${mensajes.length} mensajes, uno por clan:\n\n` +
            mensajes.map((m) => m.cuerpo).join('\n\n———\n\n')
        );
        return;
      }

      const sello = Date.now();
      const { error } = await supabase.from('outbox').insert(
        mensajes.map((m, i) => ({
          tipo: 'alineacion_cwl',
          cuerpo: m.cuerpo,
          // El indice va en la clave: sin el, los tres mensajes del mismo
          // segundo chocarian en el indice unico de clave_dedupe y solo
          // entraria uno.
          clave_dedupe: `alineacion:${verTemporada}:${sello}:${i}`,
        }))
      );
      if (error) throw error;

      setMsg(
        `${mensajes.length} ${mensajes.length === 1 ? 'mensaje generado' : 'mensajes generados'} ` +
          `(${mensajes.map((m) => m.clan).join(', ')}). Están en la pestaña Mensajes.`
      );
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
        <h2 className="sec" style={{ margin: 0 }}>{t('Alineación')}</h2>
        <select
          className="campo campo-corto"
          style={{ marginTop: 0 }}
          value={verTemporada}
          onChange={(e) => {
            setVerTemporada(e.target.value);
            setConfirmar(false);
            setMsg('');
          }}
          aria-label={t('Temporada')}
        >
          {temporadas.map((s) => (
            <option key={s} value={s}>
              {s}
              {s === d.temporada ? ` · ${t('en curso')}` : ''}
            </option>
          ))}
        </select>
        <span style={{ flex: 1 }} />
        {editable && (
          <button className="accion" onClick={generarMensaje} disabled={guardando}>
            {guardando ? t('Generando…') : t('Generar mensaje')}
          </button>
        )}
      </div>

      {editable ? (
        <>
          <p className="sub" style={{ color: 'var(--tenue)', fontSize: 13, marginTop: 0 }}>
            {t('Arrastra los nombres entre clanes. En el teléfono mantén pulsada la tarjeta y arrástrala; el desplegable también sirve.')}
          </p>
          {esFutura && (
            // Planear el mes que viene con calma es lo que evita armar las
            // siete listas a las corridas el dia 1.
            <div className="aviso-historico">
              <span>
                {t('Estás planeando')} <strong>{verTemporada}</strong>.{' '}
                {t('Se guarda igual que el mes en curso; puedes seguir editándolo hasta que empiece.')}
              </span>
              <span style={{ flex: 1 }} />
              <button
                className="fantasma"
                disabled={guardando || !Object.keys(porTemp[d.temporada] ?? {}).length}
                onClick={() => {
                  setVerTemporada(d.temporada);
                  setConfirmar(false);
                }}
              >
                {t('Ver')} {d.temporada}
              </button>
            </div>
          )}
        </>
      ) : (
        // Barra del mes cerrado: se mira, no se toca, y desde aqui se copia
        // al mes en curso o al siguiente.
        <div className="aviso-historico">
          <span>
            {t('Estás viendo')} <strong>{verTemporada}</strong>. {t('Los meses cerrados no se editan.')}
          </span>
          <span style={{ flex: 1 }} />
          {confirmar ? (
            <>
              <span className="sub">
                {t('Esto reemplaza la alineación de')} {confirmar}.
              </span>
              <button className="accion" onClick={() => copiarAlineacion(confirmar)} disabled={guardando}>
                {guardando ? t('Copiando…') : t('Sí, copiar')}
              </button>
              <button className="fantasma" onClick={() => setConfirmar(false)}>
                {t('Cancelar')}
              </button>
            </>
          ) : (
            // Dos destinos: el mes en curso y el que viene. Copiar a octubre
            // en septiembre es justo el caso de "planear desde ahora".
            [d.temporada, siguiente].map((destino) => (
              <button
                key={destino}
                className="accion"
                disabled={guardando}
                onClick={() =>
                  // Sin nadie asignado todavia no hay nada que perder, asi
                  // que no se molesta con la confirmacion.
                  Object.keys(porTemp[destino] ?? {}).length
                    ? setConfirmar(destino)
                    : copiarAlineacion(destino)
                }
              >
                {t('Copiar a')} {destino}
              </button>
            ))
          )}
        </div>
      )}
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
                  data-solo-mirar={editable ? '0' : '1'}
                  title={
                    editable
                      ? t('Arrastra desde cualquier parte. En el teléfono, mantén pulsado.')
                      : t('Los meses cerrados no se editan.')
                  }
                  onPointerDown={editable ? (e) => alAgarrar(e, p.tag) : undefined}
                  onPointerMove={editable ? alArrastrar : undefined}
                  onPointerUp={editable ? alSoltar : undefined}
                  onPointerCancel={editable ? alSoltar : undefined}
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
                    disabled={!editable}
                    value={asigVista[p.tag] ?? SIN}
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
