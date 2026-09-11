'use client';

// Bonos: el reparto del mes y las medallas de CWL.
//
// Dos partes:
//   1. La tabla de premios, editable, con el presupuesto arriba. Hoy esto se
//      acuerda por WhatsApp y se recuerda de memoria.
//   2. Las medallas bonus de CWL, para marcar a quien ya se le dieron.
//
// El boton de publicar manda la tabla al outbox: de ahi la levanta Telegram.
// La idea es publicarla ANTES de que empiece el mes — la gente se esfuerza
// por lo que sabe que existe.

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useT } from './idioma';
import { tablaPuntos, PUNTOS_CASTILLO } from '../lib/castillos';
import { PUNTOS_FC, FC_MINIMO, FC_ESTRELLAS } from '../lib/retos';

const TIPOS = { efectivo: '$', pase_oro: 'Pase de Oro', medallas: 'Medallas', pase_evento: 'Pase de evento' };

const mesSiguiente = (mes) => {
  const [a, m] = mes.split('-').map(Number);
  const d = new Date(Date.UTC(a, m, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
};

export default function Bonos({ d, demo = false, recargar }) {
  const t = useT();
  const [mes, setMes] = useState(d.temporada);
  const [filas, setFilas] = useState([]);
  const [presupuesto, setPresupuesto] = useState(80);
  const [msg, setMsg] = useState('');
  const [ocupado, setOcupado] = useState(false);
  // Ids que el usuario quito. No se borran hasta Guardar: asi un clic
  // accidental se deshace recargando la pagina.
  const [borrados, setBorrados] = useState([]);

  const cfg = useMemo(
    () => Object.fromEntries((d.config ?? []).map((c) => [c.clave, c.valor])),
    [d.config]
  );

  const nombre = useMemo(
    () => Object.fromEntries((d.players ?? []).map((p) => [p.player_tag, p.nombre_actual])),
    [d.players]
  );

  useEffect(() => {
    setFilas((d.premiosPlan ?? []).filter((p) => p.mes === mes).sort((a, b) => a.orden - b.orden));
    setBorrados([]);
  }, [d.premiosPlan, mes]);

  useEffect(() => {
    setPresupuesto(Number(cfg.presupuesto_mensual ?? 80));
  }, [cfg.presupuesto_mensual]);

  const asignado = filas.filter((f) => f.activo).reduce((s, f) => s + Number(f.monto_usd || 0), 0);
  const resto = presupuesto - asignado;

  const cambiar = (i, campo, valor) =>
    setFilas((f) => f.map((x, j) => (j === i ? { ...x, [campo]: valor } : x)));

  function quitar(i) {
    const f = filas[i];
    if (f.id) setBorrados((b) => [...b, f.id]);
    setFilas((fs) => fs.filter((_, j) => j !== i));
  }

  function agregar() {
    setFilas((f) => [
      ...f,
      { id: null, mes, orden: f.length, titulo: '', criterio: '', monto_usd: 0, tipo: 'efectivo', activo: true },
    ]);
  }

  async function guardar() {
    if (demo) return aviso(t('En la demo no se guarda, pero así queda.'));
    const vacias = filas.filter((f) => !f.titulo.trim());
    if (vacias.length) return aviso(t('Hay premios sin título.'), true);

    setOcupado(true);
    try {
      if (borrados.length) {
        const { error } = await supabase.from('premios_plan').delete().in('id', borrados);
        if (error) throw error;
      }

      const payload = filas.map((f, i) => ({
        ...(f.id ? { id: f.id } : {}),
        mes,
        orden: i,
        titulo: f.titulo.trim(),
        criterio: f.criterio || null,
        monto_usd: Number(f.monto_usd) || 0,
        tipo: f.tipo,
        activo: f.activo,
      }));
      const { error } = await supabase.from('premios_plan').upsert(payload, { onConflict: 'mes,titulo' });
      if (error) throw error;

      if (Number(cfg.presupuesto_mensual) !== presupuesto) {
        const { error: e2 } = await supabase
          .from('config')
          .update({ valor: presupuesto, actualizado: new Date().toISOString() })
          .eq('clave', 'presupuesto_mensual');
        if (e2) throw e2;
      }
      const quitados = borrados.length;
      setBorrados([]);
      aviso(quitados ? `${t('Guardado.')} ${quitados} ${t('premio(s) eliminado(s).')}` : t('Guardado.'));
      recargar?.();
    } catch (e) {
      aviso(`Error: ${e.message}`, true);
    } finally {
      setOcupado(false);
    }
  }

  function textoMensaje() {
    const activos = filas.filter((f) => f.activo && f.titulo.trim());
    if (!activos.length) return null;
    const lineas = activos.map((f) => {
      const premio = f.tipo === 'efectivo' ? `$${Number(f.monto_usd)}` : TIPOS[f.tipo];
      return `• *${f.titulo}* — ${premio}${f.criterio ? `\n   _${f.criterio}_` : ''}`;
    });
    const firma = cfg.bot_firma ? `\n\n${cfg.bot_firma}` : '';
    return (
      `🏆 *PREMIOS DE ${mes}*\n\n` +
      lineas.join('\n') +
      `\n\nBolsa del mes: *$${asignado}*` +
      `\n\n_Se paga el día 5 del mes siguiente, a quien siga en el clan._${firma}`
    );
  }

  // ---- Felicitar al que se lo ganó ----
  //
  // Publicar la tabla de premios dice QUE se reparte. Esto dice A QUIEN, y
  // es la mitad que faltaba: el mes cerraba sin que nadie anunciara al
  // ganador, y un premio que no se celebra en publico no tira de nadie el
  // mes siguiente.
  //
  // Va al outbox y NO se manda solo, a proposito: desde la pestaña Mensajes
  // se retoca -un apodo, una coña- y de ahi sale con el boton de Heraldo.

  /** Quien puede ganar: los del ultimo snapshot, que son los que estan hoy. */
  const candidatos = useMemo(() => {
    const clanNombre = Object.fromEntries((d.clans ?? []).map((c) => [c.clan_tag, c.nombre]));
    return (d.snaps ?? [])
      .map((s) => ({
        tag: s.player_tag,
        nombre: nombre[s.player_tag] ?? s.player_tag,
        clan: clanNombre[s.clan_tag] ?? null,
      }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [d.snaps, d.clans, nombre]);

  // Por fila, no uno solo: se pueden preparar los tres puestos de una tirada
  // sin que elegir el segundo borre el primero.
  const [ganador, setGanador] = useState({});

  // El que va ganando los puntos del mes (castillos + retos), para
  // sugerirlo en el premio de los puntos con un clic. Solo si se sabe quien
  // es en el juego (/soy): sin tag no se le puede felicitar ni pagar.
  const liderPuntos = useMemo(() => {
    const filas = [...(d.castillos ?? []), ...(d.retos ?? [])];
    const top = tablaPuntos(filas)[0];
    if (!top) return null;
    const tag = filas.find((f) => f.nombre === top.nombre && f.player_tag)?.player_tag ?? null;
    return { ...top, tag, candidato: tag ? candidatos.find((c) => c.tag === tag) : null };
  }, [d.castillos, d.retos, candidatos]);
  const esDePuntos = (f) => /punto/i.test(`${f.titulo ?? ''} ${f.criterio ?? ''}`);
  const claveFila = (f, i) => f.id ?? `n${i}`;

  function textoFelicitacion(f, jugador) {
    const premio =
      f.tipo === 'efectivo'
        ? `$${Number(f.monto_usd)}`
        : f.tipo === 'pase_oro'
          ? 'un Pase de Oro'
          : f.tipo === 'pase_evento'
            ? 'el Pase de evento'
            : 'las Medallas de CWL';
    const donde = jugador.clan ? ` en el clan *${jugador.clan}*` : '';
    const firma = cfg.bot_firma ? `\n\n${cfg.bot_firma}` : '';
    return (
      `🏆 *${jugador.nombre}*\n\n` +
      `¡Felicidades por tu performance en *${f.titulo.trim()}*${donde}!\n\n` +
      `Te ganaste *${premio}*.\n\n` +
      `Escríbele a Cris o a Carlos para reclamar tu premio lo antes posible.\n\n` +
      `¡Felicidades de nuevo! 🎉${firma}`
    );
  }

  async function felicitar(f, i) {
    const tag = ganador[claveFila(f, i)];
    const jugador = candidatos.find((c) => c.tag === tag);
    if (!jugador) return aviso(t('Elige primero al jugador que se lo ganó.'), true);
    if (!f.titulo.trim()) return aviso(t('Ese premio no tiene título todavía.'), true);

    const cuerpo = textoFelicitacion(f, jugador);
    if (demo) return aviso('En la demo no se encola. Así se vería:\n\n' + cuerpo);

    setOcupado(true);
    try {
      const { error } = await supabase.from('outbox').insert({
        tipo: 'felicitacion',
        cuerpo,
        // Con la marca de tiempo a proposito: si se genera dos veces es
        // porque se quiere corregir algo, no por error.
        clave_dedupe: `felicitacion:${mes}:${tag}:${Date.now()}`,
      });
      if (error) throw error;
      aviso(`${t('Mensaje listo en la pestaña Mensajes para')} ${jugador.nombre}.`);
      recargar?.();
    } catch (e) {
      aviso(`Error: ${e.message}`, true);
    } finally {
      setOcupado(false);
    }
  }

  async function publicar() {
    const cuerpo = textoMensaje();
    if (!cuerpo) return aviso(t('No hay premios activos que publicar.'), true);
    if (demo) return aviso('En la demo no se envía. Así se vería:\n\n' + cuerpo);

    setOcupado(true);
    try {
      const { error } = await supabase.from('outbox').insert({
        tipo: 'premios_del_mes',
        cuerpo,
        clave_dedupe: `premios:${mes}:${Date.now()}`,
      });
      if (error) throw error;
      aviso(t('Encolado. Sale por Telegram en la próxima corrida, y está en la pestaña Mensajes para copiar.'));
      recargar?.();
    } catch (e) {
      aviso(`Error: ${e.message}`, true);
    } finally {
      setOcupado(false);
    }
  }

  function aviso(texto, malo = false) {
    setMsg((malo ? 'Error: ' : '') + texto.replace(/^Error: /, ''));
    setTimeout(() => setMsg(''), malo ? 5000 : 6000);
  }

  // ---- Medallas de CWL ----
  const clanDe = useMemo(
    () => Object.fromEntries((d.snaps ?? []).map((s) => [s.player_tag, s.clan_tag])),
    [d.snaps]
  );
  const medallas = useMemo(() => {
    const est = new Map();
    for (const a of d.ataques ?? []) est.set(a.player_tag, (est.get(a.player_tag) ?? 0) + (a.estrellas ?? 0));
    const puestos = new Map((d.bonos ?? []).map((b) => [`${b.clan_tag}|${b.player_tag}`, b]));
    return [...est.entries()]
      .map(([tag, estrellas]) => ({
        player_tag: tag,
        nombre: nombre[tag] ?? tag,
        estrellas,
        clan_tag: clanDe[tag] ?? null,
        bono: puestos.get(`${clanDe[tag]}|${tag}`) ?? null,
      }))
      .sort((a, b) => b.estrellas - a.estrellas);
  }, [d.ataques, d.bonos, nombre, clanDe]);

  async function marcar(fila, entregado) {
    if (demo) return aviso(t('En la demo no se guarda.'));
    if (!fila.clan_tag) return aviso(t('Ese jugador no tiene clan en el último snapshot.'), true);
    try {
      const { error } = await supabase.from('bonos').upsert(
        {
          temporada: d.temporada,
          clan_tag: fila.clan_tag,
          player_tag: fila.player_tag,
          tipo: 'medallas_cwl',
          entregado,
          entregado_en: entregado ? new Date().toISOString() : null,
        },
        { onConflict: 'temporada,clan_tag,player_tag,tipo' }
      );
      if (error) throw error;
      recargar?.();
    } catch (e) {
      aviso(`Error: ${e.message}`, true);
    }
  }

  return (
    <>
      <div className="filtros" style={{ marginTop: 14 }}>
        <select className="campo campo-corto" value={mes} onChange={(e) => setMes(e.target.value)}>
          <option value={d.temporada}>Este mes ({d.temporada})</option>
          <option value={mesSiguiente(d.temporada)}>
            Próximo mes ({mesSiguiente(d.temporada)})
          </option>
        </select>
        <span style={{ flex: 1 }} />
        <button className="fantasma" onClick={agregar}>+ {t('Premio')}</button>
        <button className="fantasma" onClick={guardar} disabled={ocupado}>{t('Guardar')}</button>
        <button className="accion" onClick={publicar} disabled={ocupado}>
          {t('Publicar por Telegram')}
        </button>
      </div>

      {msg && <pre className={msg.startsWith('Error') ? 'msg error' : 'msg'}>{msg}</pre>}
      {borrados.length > 0 && (
        <p className="sub" style={{ color: 'var(--mal)', fontWeight: 600 }}>
          {borrados.length} premio(s) quitado(s) — se borran al guardar. {t('Recarga para deshacer.')}
        </p>
      )}

      <div className="grid">
        <div className="card">
          <h3>{t('Presupuesto')}</h3>
          <p className="sub">{t('Tope que se reparte cada mes.')}</p>
          <input
            className="campo"
            type="number"
            min="0"
            value={presupuesto}
            onChange={(e) => setPresupuesto(Number(e.target.value))}
          />
        </div>
        <div className="card">
          <h3>{t('Asignado')}</h3>
          <p className="big">${asignado}</p>
          <p className="sub">{filas.filter((f) => f.activo).length} premios activos</p>
        </div>
        <div className="card">
          <h3>{resto < 0 ? t('Te pasaste') : t('Queda')}</h3>
          <p className="big" style={resto < 0 ? { color: 'var(--mal)' } : undefined}>
            ${Math.abs(resto)}
          </p>
          <p className="sub">
            {resto < 0
              ? t('La suma supera el presupuesto.')
              : resto === 0
                ? t('Justo en el tope.')
                : t('Sin asignar.')}
          </p>
        </div>
      </div>

      <h2 className="sec">Premios de {mes}</h2>
      <div className="tabla-scroll">
        <table>
          <thead>
            <tr>
              <th>{t('Premio')}</th>
              <th>{t('Cómo se gana')}</th>
              <th className="num">{t('Monto')}</th>
              <th>{t('Tipo')}</th>
              <th>{t('Activo')}</th>
              <th>{t('Se lo ganó')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f, i) => (
              <tr key={f.id ?? `n${i}`}>
                <td>
                  <input
                    className="campo campo-corto"
                    style={{ marginTop: 0 }}
                    value={f.titulo}
                    placeholder={t('Liga A 1º')}
                    onChange={(e) => cambiar(i, 'titulo', e.target.value)}
                  />
                </td>
                <td style={{ whiteSpace: 'normal', minWidth: 230 }}>
                  <input
                    className="campo"
                    style={{ marginTop: 0 }}
                    value={f.criterio ?? ''}
                    placeholder={t('Más estrellas en CWL')}
                    onChange={(e) => cambiar(i, 'criterio', e.target.value)}
                  />
                </td>
                <td className="num">
                  <input
                    className="campo"
                    style={{ marginTop: 0, width: 84, textAlign: 'right' }}
                    type="number"
                    min="0"
                    value={f.monto_usd}
                    onChange={(e) => cambiar(i, 'monto_usd', e.target.value)}
                  />
                </td>
                <td>
                  <select
                    className="campo campo-corto"
                    style={{ marginTop: 0, minWidth: 130 }}
                    value={f.tipo}
                    onChange={(e) => cambiar(i, 'tipo', e.target.value)}
                  >
                    <option value="efectivo">{t('Efectivo')}</option>
                    <option value="pase_oro">{t('Pase de Oro')}</option>
                    <option value="pase_evento">{t('Pase de evento')}</option>
                    <option value="medallas">{t('Medallas')}</option>
                  </select>
                </td>
                <td>
                  <label className="fila-check" style={{ marginTop: 0 }}>
                    <input
                      type="checkbox"
                      checked={Boolean(f.activo)}
                      onChange={(e) => cambiar(i, 'activo', e.target.checked)}
                    />
                    <span>{f.activo ? 'sí' : 'no'}</span>
                  </label>
                </td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <select
                    className="campo campo-corto"
                    style={{ marginTop: 0, minWidth: 150 }}
                    value={ganador[claveFila(f, i)] ?? ''}
                    onChange={(e) =>
                      setGanador((g) => ({ ...g, [claveFila(f, i)]: e.target.value }))
                    }
                  >
                    <option value="">{t('— elige jugador —')}</option>
                    {candidatos.map((c) => (
                      <option key={c.tag} value={c.tag}>
                        {c.nombre}
                      </option>
                    ))}
                  </select>
                  {esDePuntos(f) && liderPuntos && (
                    <div className="sub" style={{ marginTop: 4 }}>
                      🏅 {t('Va ganando')}: <b>{liderPuntos.candidato?.nombre ?? liderPuntos.nombre}</b> ({liderPuntos.puntos} pts)
                      {liderPuntos.candidato ? (
                        <button
                          className="fantasma"
                          style={{ marginLeft: 6 }}
                          onClick={() => setGanador((g) => ({ ...g, [claveFila(f, i)]: liderPuntos.tag }))}
                        >
                          {t('Usar')}
                        </button>
                      ) : (
                        <> · {t('sin /soy')}</>
                      )}
                    </div>
                  )}
                  {/* Gris hasta que hay a quien felicitar, verde en cuanto lo
                      hay: el mismo gesto que el boton de mandarle la base a
                      un jugador, para no tener que aprenderse dos. */}
                  <button
                    className={ganador[claveFila(f, i)] ? 'accion' : 'fantasma'}
                    style={{ marginLeft: 6 }}
                    disabled={ocupado || !ganador[claveFila(f, i)]}
                    onClick={() => felicitar(f, i)}
                    title={t('Crea el mensaje de felicitación en la pestaña Mensajes')}
                  >
                    🎉 {t('Felicitar')}
                  </button>
                </td>
                <td>
                  <button
                    className="fantasma borrar"
                    onClick={() => quitar(i)}
                    title={t('Quitar este premio (se confirma al guardar)')}
                    aria-label={`Quitar ${f.titulo || 'premio'}`}
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!filas.length && (
        <p className="vacio">
          {t('Sin premios para')} {mes}. {t('Pulsa')} <b>+ {t('Premio')}</b> {t('para armar el reparto.')}
        </p>
      )}

      {/* Los puntos de disciplina: castillos de guerra donados y avisados. */}
      <PuntosCastillo d={d} recargar={recargar} />

      <h2 className="sec">Medallas de CWL · {d.temporada}</h2>
      {!medallas.length ? (
        <p className="vacio">
          {t('Sin datos de CWL todavía. Corre')} <code>cwl:sync</code>.
        </p>
      ) : (
        <>
          <p className="sub" style={{ color: 'var(--barra-texto)', marginTop: 0 }}>
            {t('Ordenado por estrellas, que es el criterio que ya usan. Marca a quién se las diste.')}
          </p>
          <div className="tabla-scroll">
            <table>
              <thead>
                <tr>
                  <th className="num">#</th>
                  <th>{t('Jugador')}</th>
                  <th>{t('Clan')}</th>
                  <th className="num">{t('Estrellas')}</th>
                  <th>{t('Entregado')}</th>
                </tr>
              </thead>
              <tbody>
                {medallas.map((b, i) => (
                  <tr key={b.player_tag}>
                    <td className="num">{i + 1}</td>
                    <td>{b.nombre}</td>
                    <td>{(d.clans ?? []).find((c) => c.clan_tag === b.clan_tag)?.nombre ?? '—'}</td>
                    <td className="num">{b.estrellas}</td>
                    <td>
                      <label className="fila-check" style={{ marginTop: 0 }}>
                        <input
                          type="checkbox"
                          checked={Boolean(b.bono?.entregado)}
                          onChange={(e) => marcar(b, e.target.checked)}
                        />
                        <span>{b.bono?.entregado ? 'sí' : 'pendiente'}</span>
                      </label>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}


// ---------------------------------------------------------------------
// Puntos de disciplina: cada "ya doné mi castillo" que anotaron los bots
// (web/lib/castillos.js). Los que llegan con una captura del mapa de
// guerra los verifica Heraldo con la IA (castillo-foto.js); los demas los
// confirma o los quita un lider aqui, o contestando ✅ en Telegram. La
// tabla del mes es la que decide el premio de los puntos.
// ---------------------------------------------------------------------
function PuntosCastillo({ d, recargar }) {
  const t = useT();
  const filas = d.castillos ?? [];
  const retos = d.retos ?? [];
  const tabla = useMemo(() => tablaPuntos([...filas, ...retos]), [filas, retos]);
  const pendientes = filas.filter((f) => !f.verificado);
  const [ocupado, setOcupado] = useState(null);
  const fmt = (x) => new Date(x).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' });

  async function confirmar(f) {
    setOcupado(f.id);
    const { data: sesion } = await supabase.auth.getSession();
    const { error } = await supabase
      .from('castillos')
      .update({ verificado: true, puntos: PUNTOS_CASTILLO, verificado_por: sesion?.session?.user?.email ?? 'lider' })
      .eq('id', f.id);
    setOcupado(null);
    if (error) alert(error.message);
    else recargar?.();
  }

  async function quitar(f) {
    if (!confirm(`${t('¿Quitar el castillo de')} ${f.nombre}?`)) return;
    setOcupado(f.id);
    const { error } = await supabase.from('castillos').delete().eq('id', f.id);
    setOcupado(null);
    if (error) alert(error.message);
    else recargar?.();
  }

  async function quitarReto(r) {
    if (!confirm(`${t('¿Quitar el reto de')} ${r.nombre} (${r.puntos} pts)?`)) return;
    setOcupado(`r${r.id}`);
    const { error } = await supabase.from('retos').delete().eq('id', r.id);
    setOcupado(null);
    if (error) alert(error.message);
    else recargar?.();
  }

  return (
    <>
      <h2 className="sec">{t('Puntos del mes')} · {d.temporada}</h2>
      <p className="sub" style={{ marginTop: 0 }}>
        <b>{t('Tarea')}</b>: {t('cada castillo de guerra donado y avisado a los bots (/castillo o "@Heraldo ya doné mi castillo") vale')} {PUNTOS_CASTILLO} {t('puntos. Si el aviso trae una captura del mapa de guerra, Heraldo la lee con la IA, la cruza con la API (quién está debajo de quién y contra qué clan) y confirma solo. Sin captura, o si no cuadra, lo confirma un líder: contestando ✅ al aviso en Telegram, o aquí.')}
        {' '}
        <b>{t('Reto')}</b>: {FC_MINIMO} {t('desafíos amistosos con')} {FC_ESTRELLAS}⭐ {t('o más en una captura del chat del clan mandada con /fc en el pie valen')} {PUNTOS_FC} {t('puntos, una vez al día; Heraldo los cuenta y cruza el nombre del atacante con el /soy. Un líder quita cualquiera contestando ❌ en Telegram, o aquí. El que más puntos tenga al cerrar el mes se lleva el premio.')}
      </p>
      <div className="grid">
        <div className="card">
          <h3>{t('Tabla del mes')}</h3>
          {!tabla.length ? (
            <p className="sub">{t('Nadie tiene puntos todavía.')}</p>
          ) : (
            <ol style={{ paddingLeft: 22, margin: '6px 0' }}>
              {tabla.slice(0, 20).map((p) => (
                <li key={p.nombre}>
                  <b>{p.nombre}</b> — {p.puntos} pts
                  {p.castillos > 0 && <> · {p.castillos} {p.castillos === 1 ? t('castillo') : t('castillos')}</>}
                  {p.fc > 0 && <> · {p.fc} FC</>}
                </li>
              ))}
            </ol>
          )}
        </div>
        <div className="card">
          <h3>
            {t('Por confirmar')} {pendientes.length > 0 && <span className="pill aviso">{pendientes.length}</span>}
          </h3>
          {!pendientes.length ? (
            <p className="sub">{t('Nada pendiente.')}</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {pendientes.map((f) => (
                <li key={f.id} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', padding: '6px 0', borderBottom: '1px solid rgba(0,0,0,.08)' }}>
                  <span style={{ flex: 1 }}>
                    <b>{f.nombre}</b> <span className="sub">{fmt(f.creado_en)}</span>
                    {!f.player_tag && <span className="sub"> · {t('sin /soy')}</span>}
                    {f.nota && <span className="sub"> · {f.nota}</span>}
                  </span>
                  <button className="accion" onClick={() => confirmar(f)} disabled={ocupado === f.id}>
                    ✓ +{PUNTOS_CASTILLO}
                  </button>
                  <button className="fantasma" onClick={() => quitar(f)} disabled={ocupado === f.id} title={t('Quitar')}>
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="card">
          <h3>{t('Retos del mes')}</h3>
          {!retos.length ? (
            <p className="sub">{t('Ningún reto todavía.')}</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {retos.map((r) => (
                <li key={r.id} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', padding: '6px 0', borderBottom: '1px solid rgba(0,0,0,.08)' }}>
                  <span style={{ flex: 1 }}>
                    <b>{r.nombre}</b> — {r.tipo === 'fc' ? t('desafíos amistosos') : r.tipo} · +{r.puntos} <span className="sub">{fmt(r.creado_en)}</span>
                    {r.nota && <span className="sub"> · {r.nota}</span>}
                  </span>
                  <button className="fantasma" onClick={() => quitarReto(r)} disabled={ocupado === `r${r.id}`} title={t('Quitar')}>
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
