'use client';

// La pestaña Reclutamiento: todo lo que trae gente al clan, en un sitio.
//
//   1. Facebook: los posts que el portavoz publica cada dia en los grupos
//      (src/jobs/portavoz.js, tarea programada del escritorio a las 10:30),
//      con su enlace, su estado (publicado, pendiente de aprobacion, fallo)
//      y el engagement medido al dia siguiente.
//   2. El buzon de la Pagina de Facebook: los mensajes que llegan, que nadie
//      mira; Valquiria avisa por Telegram cuando entra uno (portavoz-anotar.js
//      buzon) y aqui se marcan como atendidos.
//   3. Las solicitudes de Valquiria por Telegram, la bandeja de siempre
//      (solicitudes.jsx).
//
// Lo pidio Cris el 21 sep 2026: "quiero que todo este respaldado en el OS".

import { useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useT } from './idioma';
import Solicitudes from './solicitudes';

const ESTADO = {
  publicado: ['✅', 'Publicado'],
  pendiente: ['⏳', 'Pendiente de aprobación'],
  rechazado: ['🚫', 'Rechazado por el grupo'],
  fallo: ['❌', 'No salió'],
};

const fecha = (d) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' }) : '—');
const hora = (d) => (d ? new Date(d).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' }) : '—');

export default function Reclutamiento({ d, recargar }) {
  const t = useT();
  const [ocupado, setOcupado] = useState(null);

  const posts = d.fbPosts ?? [];
  const mensajes = d.fbMensajes ?? [];
  const sinAtender = mensajes.filter((m) => !m.atendido).length;

  // La semana: cuantos posts salieron, cuantos esperan, y el engagement junto.
  const semana = useMemo(() => {
    const desde = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    const ultimos = posts.filter((p) => p.fecha >= desde);
    return {
      total: ultimos.length,
      publicados: ultimos.filter((p) => p.estado === 'publicado').length,
      pendientes: ultimos.filter((p) => p.estado === 'pendiente').length,
      reacciones: ultimos.reduce((s, p) => s + (p.reacciones ?? 0), 0),
      comentarios: ultimos.reduce((s, p) => s + (p.comentarios ?? 0), 0),
    };
  }, [posts]);

  async function atender(m, atendido) {
    setOcupado(m.id);
    try {
      const { error } = await supabase.from('fb_mensajes').update({ atendido }).eq('id', m.id);
      if (error) throw error;
      await recargar?.();
    } catch (e) {
      alert(`Error: ${e.message}`);
    } finally {
      setOcupado(null);
    }
  }

  return (
    <>
      <h2 className="sec">📣 {t('Facebook')}</h2>
      <p className="sub" style={{ marginTop: 2 }}>
        {t('Un post al día en los grupos de Clash, como la Página Strange Godz Alliance. Cada grupo, una vez por semana.')}
        {' '}
        {t('Últimos 7 días')}: <b>{semana.publicados}</b> {t('publicados')}
        {semana.pendientes ? <> · <b>{semana.pendientes}</b> {t('pendientes de aprobación')}</> : null}
        {' '}· <b>{semana.reacciones}</b> {t('reacciones')} · <b>{semana.comentarios}</b> {t('comentarios')}
      </p>

      {!posts.length ? (
        <p className="vacio">{t('Todavía no hay posts. El primero sale a las 10:30 con la PC encendida.')}</p>
      ) : (
        <div className="tabla-scroll">
          <table className="">
            <thead>
              <tr>
                <th>{t('Día')}</th>
                <th>{t('Grupo')}</th>
                <th>{t('Estado')}</th>
                <th>👍</th>
                <th>💬</th>
                <th>↗️</th>
                <th>{t('Medido')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {posts.map((p) => {
                const [icono, nombre] = ESTADO[p.estado] ?? ['•', p.estado];
                return (
                  <tr key={p.id}>
                    <td>{fecha(p.fecha)}</td>
                    <td>
                      {p.grupo_url ? <a href={p.grupo_url} target="_blank" rel="noreferrer">{p.grupo}</a> : p.grupo}
                    </td>
                    <td title={p.nota ?? ''}>{icono} {t(nombre)}</td>
                    <td>{p.reacciones ?? 0}</td>
                    <td>{p.comentarios ?? 0}</td>
                    <td>{p.compartidos ?? 0}</td>
                    <td className="sub">{p.revisado_en ? hora(p.revisado_en) : '—'}</td>
                    <td>
                      {p.url ? <a href={p.url} target="_blank" rel="noreferrer">{t('Ver post')}</a> : <span className="sub">{t('sin enlace aún')}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="sec" style={{ marginTop: 28 }}>
        💌 {t('Buzón de la Página')}
        {sinAtender > 0 && <> · {sinAtender} {t('sin atender')}</>}
      </h2>
      <p className="sub" style={{ marginTop: 2 }}>
        {t('Lo que escriben por Messenger a la Página. Valquiria avisa por Telegram en cuanto llega uno; se contesta desde Facebook y aquí se marca.')}
      </p>
      {!mensajes.length ? (
        <p className="vacio">{t('Nadie ha escrito al buzón todavía.')}</p>
      ) : (
        <div className="grid">
          {mensajes.map((m) => (
            <div key={m.id} className="card" style={{ opacity: m.atendido ? 0.6 : 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <b>{m.remitente}</b>
                <span className="sub">{hora(m.recibido_en)}</span>
              </div>
              <p style={{ margin: '6px 0', whiteSpace: 'pre-wrap' }}>{m.texto}</p>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {m.url && <a href={m.url} target="_blank" rel="noreferrer">{t('Abrir conversación')}</a>}
                <button className="accion" disabled={ocupado === m.id} onClick={() => atender(m, !m.atendido)}>
                  {m.atendido ? t('Marcar sin atender') : t('Ya le contesté')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 32 }}>
        <Solicitudes d={d} recargar={recargar} />
      </div>
    </>
  );
}
