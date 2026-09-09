'use client';

// Panel de bots. Los ajustes viven en la tabla `config`, no en variables de
// entorno: asi los lideres los cambian desde aca sin tocar GitHub.
//
// Las CLAVES (tokens de Telegram, service_role, sesion de WhatsApp) NO se
// muestran ni se editan aca. Siguen en Secrets; esta pantalla solo dice si
// estan puestas, nunca su valor.

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

const fmt = (d) => (d ? new Date(d).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' }) : '—');

export default function Bots({ d, demo = false, recargar }) {
  const inicial = useMemo(
    () => Object.fromEntries((d.config ?? []).map((c) => [c.clave, c.valor])),
    [d.config]
  );
  const [cfg, setCfg] = useState(inicial);
  const [msg, setMsg] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => setCfg(inicial), [inicial]);

  const set = (clave, valor) => setCfg((c) => ({ ...c, [clave]: valor }));

  async function guardar() {
    setGuardando(true);
    setMsg('');
    if (demo) {
      setMsg('En la demo no se guarda, pero así queda.');
      setGuardando(false);
      setTimeout(() => setMsg(''), 2500);
      return;
    }
    try {
      // Una fila por ajuste. Se mandan solo los que cambiaron.
      const cambios = Object.entries(cfg).filter(
        ([k, v]) => JSON.stringify(v) !== JSON.stringify(inicial[k])
      );
      if (!cambios.length) {
        setMsg('No hay cambios.');
        setGuardando(false);
        return;
      }
      for (const [clave, valor] of cambios) {
        const { error } = await supabase
          .from('config')
          .update({ valor, actualizado: new Date().toISOString() })
          .eq('clave', clave);
        if (error) throw error;
      }
      setMsg(`Guardado (${cambios.length} ${cambios.length === 1 ? 'ajuste' : 'ajustes'}).`);
      recargar?.();
    } catch (e) {
      setMsg(`Error: ${e.message}`);
    } finally {
      setGuardando(false);
      setTimeout(() => setMsg(''), 3000);
    }
  }

  const jobTelegram = (d.jobs ?? []).find((j) => j.job === 'alerta_cwl');
  const jobWa = (d.jobs ?? []).find((j) => j.job === 'wa_enviar');
  const pendientes = (d.outbox ?? []).filter((m) => m.estado === 'pendiente').length;

  if (!d.config?.length) {
    return (
      <p className="vacio">
        Falta correr <code>sql/008_config.sql</code> en Supabase para crear los ajustes.
      </p>
    );
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <h2 className="sec" style={{ margin: '18px 0 8px' }}>Identidad del bot</h2>
        <span style={{ flex: 1 }} />
        <button className="accion" onClick={guardar} disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>
      {msg && <p className={msg.startsWith('Error') ? 'error' : 'sub'}>{msg}</p>}

      <div className="grid">
        <div className="card">
          <h3>Nombre</h3>
          <p className="sub">Con este nombre firma sus avisos.</p>
          <input
            className="campo"
            value={cfg.bot_nombre ?? ''}
            onChange={(e) => set('bot_nombre', e.target.value)}
          />
        </div>
        <div className="card">
          <h3>Firma</h3>
          <p className="sub">Línea final de cada mensaje al clan.</p>
          <input
            className="campo"
            value={cfg.bot_firma ?? ''}
            onChange={(e) => set('bot_firma', e.target.value)}
          />
        </div>
        <div className="card">
          <h3>Umbrales de aviso</h3>
          <p className="sub">Horas antes del cierre en que avisa. Separadas por coma.</p>
          <input
            className="campo"
            value={(cfg.alerta_umbrales ?? []).join(', ')}
            onChange={(e) =>
              set(
                'alerta_umbrales',
                e.target.value
                  .split(',')
                  .map((x) => Number(x.trim()))
                  .filter((n) => Number.isFinite(n) && n > 0)
              )
            }
          />
        </div>
      </div>

      <h2 className="sec">Qué avisa</h2>
      <div className="grid">
        <Interruptor
          titulo="Ataques de CWL sin usar"
          nota="Lo más valioso: avisa antes de perder la guerra."
          valor={cfg.alerta_cwl}
          alCambiar={(v) => set('alerta_cwl', v)}
        />
        <Interruptor
          titulo="Ataques de guerra normal"
          nota="Necesita que /currentwar responda. Correr el probe primero."
          valor={cfg.alerta_guerra}
          alCambiar={(v) => set('alerta_guerra', v)}
        />
        <Interruptor
          titulo="Resumen de Raid Weekend"
          nota="Los ~24 ataques mensuales que hoy no mide nadie."
          valor={cfg.alerta_raids}
          alCambiar={(v) => set('alerta_raids', v)}
        />
        <Interruptor
          titulo="Reporte mensual de premios"
          nota="La tabla de ganadores, el día 1."
          valor={cfg.reporte_mensual}
          alCambiar={(v) => set('reporte_mensual', v)}
        />
      </div>

      <h2 className="sec">Por dónde avisa</h2>
      <div className="grid">
        <div className="card">
          <h3>
            Telegram{' '}
            <span className={`pill ${cfg.telegram_activo ? 'ok' : 'aviso'}`}>
              {cfg.telegram_activo ? 'activo' : 'apagado'}
            </span>
          </h3>
          <p className="sub">
            Gratis, sin límites y sin riesgo de baneo. Lleva lo que no puede fallar.
          </p>
          <p className="sub" style={{ marginTop: 8 }}>
            Última alerta:{' '}
            {jobTelegram ? (
              <>
                {fmt(jobTelegram.started_at)}{' '}
                <span className={`pill ${jobTelegram.ok ? 'ok' : 'mal'}`}>
                  {jobTelegram.ok ? 'ok' : 'falló'}
                </span>
              </>
            ) : (
              'todavía no corrió'
            )}
          </p>
          <label className="fila-check">
            <input
              type="checkbox"
              checked={Boolean(cfg.telegram_activo)}
              onChange={(e) => set('telegram_activo', e.target.checked)}
            />
            <span>Mandar avisos por Telegram</span>
          </label>
        </div>

        <div className="card">
          <h3>
            WhatsApp{' '}
            <span className={`pill ${d.wa?.vinculado ? 'ok' : 'aviso'}`}>
              {d.wa?.vinculado ? 'vinculado' : 'sin vincular'}
            </span>
          </h3>
          <p className="sub">
            {d.wa?.vinculado
              ? `Número ${d.wa.numero ?? '?'} · último envío ${fmt(d.wa.ultimo_ok)}`
              : 'Necesita un número secundario. Nunca el personal: la sesión guardada da acceso completo a ese WhatsApp.'}
          </p>
          {d.wa?.ultimo_error && <p className="error">{d.wa.ultimo_error}</p>}
          {jobWa && !jobWa.ok && <p className="error">Última corrida: {jobWa.error}</p>}
          <label className="fila-check">
            <input
              type="checkbox"
              checked={Boolean(cfg.whatsapp_activo)}
              disabled={!d.wa?.vinculado}
              onChange={(e) => set('whatsapp_activo', e.target.checked)}
            />
            <span>
              Mandar avisos por WhatsApp
              {!d.wa?.vinculado && ' (hay que vincular primero)'}
            </span>
          </label>
        </div>

        <div className="card">
          <h3>Bandeja de salida</h3>
          <p className="big">{pendientes}</p>
          <p className="sub">
            mensajes por enviar. Si ningún canal está activo, se copian a mano desde la pestaña
            Mensajes — nunca se pierden.
          </p>
        </div>
      </div>

      <h2 className="sec">Comandos de Telegram</h2>
      <div className="tabla-scroll">
        <table>
          <thead>
            <tr>
              <th>Comando</th>
              <th>Qué devuelve</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['/faltan', 'Quién no ha atacado en la CWL en curso, con horas restantes'],
              ['/estrellas', 'Tabla de estrellas de la temporada'],
              ['/resumen', 'Estado de los clanes, último snapshot y jobs'],
              ['/jugador <nombre>', 'Ficha con deltas de trofeos y estrellas'],
              ['/reporte', 'Último mensaje generado, listo para pegar'],
            ].map(([c, q]) => (
              <tr key={c}>
                <td style={{ fontFamily: 'ui-monospace, Consolas, monospace' }}>{c}</td>
                <td style={{ whiteSpace: 'normal' }}>{q}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Interruptor({ titulo, nota, valor, alCambiar }) {
  return (
    <div className="card">
      <h3>
        {titulo} <span className={`pill ${valor ? 'ok' : 'aviso'}`}>{valor ? 'sí' : 'no'}</span>
      </h3>
      <p className="sub">{nota}</p>
      <label className="fila-check">
        <input type="checkbox" checked={Boolean(valor)} onChange={(e) => alCambiar(e.target.checked)} />
        <span>Activado</span>
      </label>
    </div>
  );
}
