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

const TIPOS = { efectivo: '$', pase_oro: 'Pase de Oro', medallas: 'Medallas' };

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
  const nombre = useMemo(
    () => Object.fromEntries((d.players ?? []).map((p) => [p.player_tag, p.nombre_actual])),
    [d.players]
  );
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
