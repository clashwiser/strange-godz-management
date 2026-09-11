'use client';

// La pestaña Reglas: las normas del clan, editables por los lideres.
//
// Lo que se guarda aqui es lo que leen los bots (para contestar en el
// grupo cuando alguien pregunta), lo que Valquiria manda a quien quiere
// entrar, y lo que se ve en /reglas. Un solo texto, en Markdown sencillo:
// titulos con #, listas con -, negrita con **. Al lado se ve como queda.
//
// Escribe directo en config con la sesion del lider (RLS: puede_editar).

import { useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { markdownAHtml } from '../lib/reglas';
import { useT } from './idioma';

const SITIO = typeof window !== 'undefined' ? window.location.origin : '';

export default function ReglasTab({ d, recargar }) {
  const t = useT();
  const cfg = useMemo(() => Object.fromEntries((d.config ?? []).map((c) => [c.clave, c.valor])), [d.config]);
  const inicial = { reglas: String(cfg.reglas ?? ''), resumen: String(cfg.reglas_resumen ?? '') };
  const [reglas, setReglas] = useState(inicial.reglas);
  const [resumen, setResumen] = useState(inicial.resumen);
  const [vista, setVista] = useState(false);
  const [msg, setMsg] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const cambiado = reglas !== inicial.reglas || resumen !== inicial.resumen;
  const html = useMemo(() => markdownAHtml(reglas), [reglas]);

  function aviso(texto, malo = false) {
    setMsg((malo ? 'Error: ' : '') + String(texto).replace(/^Error: /, ''));
    setTimeout(() => setMsg(''), malo ? 6000 : 3500);
  }

  async function guardar() {
    setOcupado(true);
    try {
      const hoy = new Date().toISOString().slice(0, 10);
      for (const [clave, valor] of [
        ['reglas', reglas.trim()],
        ['reglas_resumen', resumen.trim()],
        ['reglas_fecha', hoy],
      ]) {
        const { error } = await supabase.from('config').update({ valor, actualizado: new Date().toISOString() }).eq('clave', clave);
        if (error) throw error;
      }
      aviso(t('Normas guardadas. Los bots las usan en un minuto.'));
      recargar?.();
    } catch (e) {
      aviso(`Error: ${e.message}`, true);
    } finally {
      setOcupado(false);
    }
  }

  // El resumen y el enlace, al grupo, por Heraldo. Primero a la bandeja
  // (queda registro) y de ahi a Telegram con /api/enviar.
  async function mandarAlGrupo() {
    if (!confirm(t('¿Mandar el resumen de las normas al grupo de Telegram ahora?'))) return;
    setOcupado(true);
    try {
      const cuerpo = `${resumen.trim()}\n\n📖 Normas completas: ${SITIO}/reglas`;
      const { data, error } = await supabase
        .from('outbox')
        .insert({ tipo: 'reglas', cuerpo, destino: 'grupo_clan', clave_dedupe: `reglas:${Date.now()}` })
        .select('id')
        .single();
      if (error) throw error;
      const { data: sesion } = await supabase.auth.getSession();
      const r = await fetch('/api/enviar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sesion?.session?.access_token}` },
        body: JSON.stringify({ id: data.id }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error ?? r.status);
      aviso(t('Mandado al grupo.'));
      recargar?.();
    } catch (e) {
      aviso(`Error: ${e.message}`, true);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <h2 className="sec" style={{ margin: '18px 0 8px' }}>{t('Normas del clan')}</h2>
        <span style={{ flex: 1 }} />
        {msg && <span className="sub">{msg}</span>}
        <a className="fantasma" href="/reglas" target="_blank" rel="noreferrer">
          {t('Ver la página pública')} ↗
        </a>
        <button className="fantasma" onClick={() => setVista((v) => !v)}>
          {vista ? t('Editar') : t('Vista previa')}
        </button>
        <button className="accion" onClick={guardar} disabled={ocupado || !cambiado}>
          {ocupado ? t('Guardando…') : t('Guardar normas')}
        </button>
      </div>
      <p className="sub" style={{ marginTop: 0 }}>
        {t(
          'Lo que guardes aquí es lo que Valquiria hace leer y aceptar antes de entrar, lo que Heraldo contesta cuando preguntan por las normas en el grupo, y lo que se ve en la página pública. Markdown sencillo: # título, - lista, **negrita**.'
        )}
        {cfg.reglas_fecha && <> · {t('Última edición')}: {String(cfg.reglas_fecha)}</>}
      </p>

      <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)' }}>
        <div className="card">
          <h3>{t('Normas completas')}</h3>
          {vista ? (
            <div className="reglas-vista reglas-hoja" dangerouslySetInnerHTML={{ __html: html }} />
          ) : (
            <textarea className="campo reglas-editor" value={reglas} onChange={(e) => setReglas(e.target.value)} spellCheck={false} />
          )}
          <p className="sub">{reglas.length.toLocaleString('es')} {t('caracteres')}</p>
        </div>
        <div className="card">
          <h3>{t('Resumen para Telegram')}</h3>
          <p className="sub">{t('Lo que manda Valquiria en la entrevista y Heraldo en el grupo, con el enlace a las completas. Que quepa en un mensaje.')}</p>
          <textarea className="campo" rows={16} value={resumen} maxLength={3500} onChange={(e) => setResumen(e.target.value)} />
          <p className="sub">{resumen.length} / 3500</p>
          <button className="accion" onClick={mandarAlGrupo} disabled={ocupado || cambiado} title={cambiado ? t('Guarda primero') : ''}>
            {t('Mandar el resumen al grupo')}
          </button>
          {cambiado && <p className="sub">{t('Guarda primero para mandar la versión nueva.')}</p>}
        </div>
      </div>
    </>
  );
}
