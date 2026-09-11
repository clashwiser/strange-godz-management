'use client';

// Entrenar a los bots, desde la pestaña Bots.
//
// Carlos y Deibis no tocan codigo. Lo que necesitan es poder decirle a
// un bot "a esto contesta asi" cuando lo ven contestar mal, y contarle
// cosas del clan que no estan en ningun sitio -que los premios los
// reparte Cris, que la CWL se juega el dia 1-. Eso es lo que hay aqui:
//
//   Lecciones      "cuando digan X, responde Y". Los bots las miran ANTES
//                  que su cerebro de frases y que la IA. Con probador: lo
//                  que el lider ve al probar es lo que pasa despues,
//                  porque es la misma funcion (web/lib/lecciones.js).
//   Lo que saben   texto libre que entra en las instrucciones de la IA.
//
// Los interruptores de comportamiento estan en bots.jsx con los demas.
// Escribe directo en Supabase con la sesion del lider: las politicas RLS
// de sql/024_entrenar.sql son las que mandan.

import { useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { elegirLeccion, aplicarLeccion } from '../lib/lecciones';
import { useT } from './idioma';

const BOTS = [
  ['ambos', 'Los dos'],
  ['heraldo', 'Heraldo'],
  ['valquiria', 'Valquiria'],
];

export default function Entrenar({ d, memoriaInicial = '', recargar, aviso }) {
  const t = useT();
  const lecciones = d.lecciones ?? [];
  const [nueva, setNueva] = useState({ bot: 'ambos', cuando: '', respuesta: '' });
  const [prueba, setPrueba] = useState('');
  const [memoria, setMemoria] = useState(memoriaInicial);
  const [ocupado, setOcupado] = useState(false);

  // El probador: la misma funcion que usan los webhooks.
  const resultado = useMemo(() => {
    if (!prueba.trim()) return null;
    const todas = nueva.cuando.trim() && nueva.respuesta.trim() ? [...lecciones, { ...nueva, id: 'nueva' }] : lecciones;
    return {
      heraldo: elegirLeccion(todas, prueba, 'heraldo'),
      valquiria: elegirLeccion(todas, prueba, 'valquiria'),
    };
  }, [prueba, lecciones, nueva]);

  async function guardarLeccion(e) {
    e.preventDefault();
    const cuando = nueva.cuando.trim();
    const respuesta = nueva.respuesta.trim();
    if (cuando.length < 2 || !respuesta) return;
    setOcupado(true);
    try {
      const { data: sesion } = await supabase.auth.getSession();
      const { error } = await supabase.from('lecciones').insert({
        bot: nueva.bot,
        cuando,
        respuesta,
        creado_por: sesion?.session?.user?.email ?? null,
      });
      if (error) throw error;
      setNueva({ bot: 'ambos', cuando: '', respuesta: '' });
      aviso(t('Lección guardada. Los bots la aplican en un minuto.'));
      recargar?.();
    } catch (err) {
      aviso(`Error: ${err.message}`, true);
    } finally {
      setOcupado(false);
    }
  }

  async function cambiar(id, cambios) {
    const { error } = await supabase
      .from('lecciones')
      .update({ ...cambios, actualizado_en: new Date().toISOString() })
      .eq('id', id);
    if (error) aviso(`Error: ${error.message}`, true);
    else recargar?.();
  }

  async function borrar(id) {
    if (!confirm(t('¿Borrar esta lección?'))) return;
    const { error } = await supabase.from('lecciones').delete().eq('id', id);
    if (error) aviso(`Error: ${error.message}`, true);
    else recargar?.();
  }

  async function guardarMemoria() {
    setOcupado(true);
    try {
      const { error } = await supabase
        .from('config')
        .update({ valor: memoria.trim(), actualizado: new Date().toISOString() })
        .eq('clave', 'bots_memoria');
      if (error) throw error;
      aviso(t('Guardado. La IA lo tiene en cuenta en un minuto.'));
      recargar?.();
    } catch (err) {
      aviso(`Error: ${err.message}`, true);
    } finally {
      setOcupado(false);
    }
  }

  const nombreBot = (b) => BOTS.find(([k]) => k === b)?.[1] ?? b;

  return (
    <>
      <h2 className="sec">{t('Entrenar a los bots')}</h2>
      <p className="sub" style={{ marginTop: 0 }}>
        {t(
          'Lo que enseñes aquí lo aplican antes que su cerebro de frases y que la IA. Tarda un minuto en entrar en vigor.'
        )}
      </p>

      <div className="grid">
        {/* ---- Nueva leccion ---- */}
        <form className="card" onSubmit={guardarLeccion}>
          <h3>{t('Nueva lección')}</h3>
          <p className="sub">
            {t('Cuando alguien diga algo parecido a esto (sin importar tildes ni el orden), el bot contesta eso.')}
          </p>
          <label className="sub">{t('Cuando digan…')}</label>
          <input
            className="campo"
            value={nueva.cuando}
            maxLength={200}
            placeholder={t('cómo entro al clan')}
            onChange={(e) => setNueva((n) => ({ ...n, cuando: e.target.value }))}
          />
          <label className="sub">{t('Responde…')}</label>
          <textarea
            className="campo"
            rows={3}
            value={nueva.respuesta}
            maxLength={1500}
            placeholder={t('Escríbele a @Valqui_bot, {nombre}, que ella te hace la entrevista.')}
            onChange={(e) => setNueva((n) => ({ ...n, respuesta: e.target.value }))}
          />
          <p className="sub">{t('{nombre} se cambia por el nombre de quien pregunta.')}</p>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <select className="campo" style={{ width: 'auto' }} value={nueva.bot} onChange={(e) => setNueva((n) => ({ ...n, bot: e.target.value }))}>
              {BOTS.map(([k, v]) => (
                <option key={k} value={k}>
                  {t(v)}
                </option>
              ))}
            </select>
            <span style={{ flex: 1 }} />
            <button className="accion" type="submit" disabled={ocupado || nueva.cuando.trim().length < 2 || !nueva.respuesta.trim()}>
              {t('Enseñar')}
            </button>
          </div>
        </form>

        {/* ---- Probador ---- */}
        <div className="card">
          <h3>{t('Probar')}</h3>
          <p className="sub">{t('Escribe lo que diría alguien en el grupo y mira qué lección saltaría (incluida la que estás escribiendo).')}</p>
          <input className="campo" value={prueba} placeholder={t('Heraldo, ¿cómo entro al clan?')} onChange={(e) => setPrueba(e.target.value)} />
          {resultado && (
            <div className="sub" style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}>
              {['heraldo', 'valquiria'].map((b) => (
                <div key={b} style={{ marginBottom: 6 }}>
                  <b>{nombreBot(b)}:</b>{' '}
                  {resultado[b] ? (
                    <>
                      {aplicarLeccion(resultado[b], 'Cris')}
                      <span className="pill ok" style={{ marginLeft: 6 }}>
                        {resultado[b].id === 'nueva' ? t('la nueva') : `#${resultado[b].id}`}
                      </span>
                    </>
                  ) : (
                    <i>{t('ninguna lección; contestaría con su cerebro o la IA')}</i>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ---- Lo que saben ---- */}
        <div className="card">
          <h3>{t('Lo que deben saber')}</h3>
          <p className="sub">
            {t(
              'Cosas del clan que la IA no puede saber sola: quién reparte los premios, cuándo se juega la CWL, reglas de la casa. Entra en sus instrucciones tal cual.'
            )}
          </p>
          <textarea
            className="campo"
            rows={6}
            maxLength={2000}
            value={memoria}
            placeholder={t('Los premios los reparte Cris el día 1. La CWL se juega del 1 al 10. En x300 se exige TH17.')}
            onChange={(e) => setMemoria(e.target.value)}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="sub">{memoria.length} / 2000</span>
            <span style={{ flex: 1 }} />
            <button className="accion" onClick={guardarMemoria} disabled={ocupado || memoria.trim() === (memoriaInicial ?? '').trim()}>
              {t('Guardar')}
            </button>
          </div>
        </div>
      </div>

      {/* ---- Las lecciones que hay ---- */}
      {lecciones.length > 0 && (
        <div className="tabla-scroll" style={{ marginTop: 12 }}>
          <table>
            <thead>
              <tr>
                <th>{t('Bot')}</th>
                <th>{t('Cuando digan…')}</th>
                <th>{t('Responde…')}</th>
                <th>{t('Usada')}</th>
                <th>{t('Activa')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {lecciones.map((l) => (
                <tr key={l.id} style={l.activa ? undefined : { opacity: 0.5 }}>
                  <td>{nombreBot(l.bot)}</td>
                  <td>{l.cuando}</td>
                  <td style={{ whiteSpace: 'pre-wrap', maxWidth: 420 }}>{l.respuesta}</td>
                  <td>{l.veces ?? 0}</td>
                  <td>
                    <input type="checkbox" checked={Boolean(l.activa)} onChange={(e) => cambiar(l.id, { activa: e.target.checked })} />
                  </td>
                  <td>
                    <button className="fantasma" onClick={() => borrar(l.id)} title={t('Borrar')}>
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
