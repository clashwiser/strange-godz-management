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
import { Info } from './info';

const BOTS = [
  ['ambos', 'Los dos'],
  ['heraldo', 'Heraldo'],
  ['valquiria', 'Valquiria'],
];

export default function Entrenar({ d, memoriaInicial = '', recargar, aviso }) {
  const t = useT();
  const todas = d.lecciones ?? [];
  const lecciones = todas.filter((l) => !l.propuesta);
  const propuestas = todas.filter((l) => l.propuesta);
  const [nueva, setNueva] = useState({ bot: 'ambos', cuando: '', respuesta: '' });
  const [edicion, setEdicion] = useState({}); // id -> { cuando, respuesta }

  async function aprobar(l) {
    const e = edicion[l.id] ?? {};
    const cuando = String(e.cuando ?? '').trim();
    const respuesta = String(e.respuesta ?? (l.respuesta === '(por decidir)' ? '' : l.respuesta)).trim();
    if (cuando.length < 2 || !respuesta) return aviso(t('Escribe qué frase la dispara y qué debe responder.'), true);
    await cambiar(l.id, { cuando, respuesta, activa: true, propuesta: false });
    aviso(t('Lección aprobada: ya la usa.'));
  }
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
      <h2 className="sec">{t('Entrenar a los bots')} <Info clave="lecciones" /></h2>
      <p className="sub" style={{ marginTop: 0 }}>
        {t(
          'Lo que enseñes aquí lo aplican antes que su cerebro de frases y que la IA. Tarda un minuto en entrar en vigor.'
        )}
      </p>

      <div className="grid">
        {/* ---- Nueva leccion ---- */}
        <form className="card" onSubmit={guardarLeccion}>
          <h3>{t('Nueva lección')} <Info clave="lecciones" /></h3>
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
          <h3>{t('Probar')} <Info clave="probar" /></h3>
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
          <h3>{t('Lo que deben saber')} <Info clave="memoriaLideres" /></h3>
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

      {/* ---- Lo que el cerebro propone ---- */}
      {propuestas.length > 0 && (
        <div className="card" style={{ marginTop: 12 }}>
          <h3>
            🧠 {t('Propuestas del cerebro')} <span className="pill aviso">{propuestas.length}</span> <Info clave="propuestas" />
          </h3>
          <p className="sub" style={{ marginTop: 0 }}>
            {t('Alguien corrigió a un bot en el grupo contestando a un mensaje suyo. Completa qué frase la dispara y qué debe responder, y apruébala; o descártala.')}
          </p>
          {propuestas.map((l) => (
            <div key={l.id} style={{ borderTop: '1px solid rgba(0,0,0,.1)', padding: '10px 0' }}>
              <p className="sub" style={{ margin: 0 }}>
                <b>{nombreBot(l.bot)}</b> {t('dijo')}: “{String(l.contexto ?? '').slice(0, 300)}”
                {l.propuesta_por && <> · {t('lo corrigió')} <b>{l.propuesta_por}</b></>}
              </p>
              <div style={{ display: 'grid', gap: 8, gridTemplateColumns: '1fr 1fr', marginTop: 8 }}>
                <input
                  className="campo"
                  style={{ marginTop: 0 }}
                  placeholder={t('Cuando digan… (la frase que la dispara)')}
                  value={edicion[l.id]?.cuando ?? ''}
                  onChange={(e) => setEdicion((x) => ({ ...x, [l.id]: { ...(x[l.id] ?? {}), cuando: e.target.value } }))}
                />
                <textarea
                  className="campo"
                  style={{ marginTop: 0, minHeight: 60 }}
                  placeholder={t('Responde…')}
                  value={edicion[l.id]?.respuesta ?? (l.respuesta === '(por decidir)' ? '' : l.respuesta)}
                  onChange={(e) => setEdicion((x) => ({ ...x, [l.id]: { ...(x[l.id] ?? {}), respuesta: e.target.value } }))}
                />
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button className="accion" onClick={() => aprobar(l)}>✓ {t('Aprobar')}</button>
                <button className="fantasma" onClick={() => borrar(l.id)}>✕ {t('Descartar')}</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ---- De donde sale el meta ---- */}
      <FuentesDelMeta d={d} recargar={recargar} aviso={aviso} />

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

// ---------------------------------------------------------------------
// De donde saca la IA el meta del juego. Ver web/lib/meta-fuentes.js: los
// canales de YouTube de confianza (la API oficial, con nuestra llave),
// los feeds de Blueprint, y los dominios a los que se limita la busqueda
// web. El digesto lo rehace /api/meta cada seis horas o con el boton.
// ---------------------------------------------------------------------
function FuentesDelMeta({ d, recargar, aviso }) {
  const t = useT();
  const cfg = useMemo(() => Object.fromEntries((d.config ?? []).map((c) => [c.clave, c.valor])), [d.config]);
  const aLineas = (v) => (Array.isArray(v) ? v : []);
  const inicial = useMemo(
    () => ({
      canales: aLineas(cfg.meta_canales).map((c) => `${c.nombre ?? ''} | ${c.id ?? ''}`).join('\n'),
      feeds: aLineas(cfg.meta_feeds).join('\n'),
      webs: aLineas(cfg.meta_webs).join('\n'),
    }),
    [cfg.meta_canales, cfg.meta_feeds, cfg.meta_webs]
  );
  const [f, setF] = useState(inicial);
  const [ocupado, setOcupado] = useState(false);
  const [resultado, setResultado] = useState(null);
  const digesto = cfg.meta_digest;
  const cambiado = f.canales !== inicial.canales || f.feeds !== inicial.feeds || f.webs !== inicial.webs;

  async function guardar() {
    const canales = f.canales
      .split('\n')
      .map((l) => l.split('|').map((x) => x.trim()))
      .filter(([n, id]) => n && /^UC[\w-]{22}$/.test(id ?? ''))
      .map(([nombre, id]) => ({ nombre, id }));
    const feeds = f.feeds.split('\n').map((x) => x.trim()).filter((x) => /^https?:\/\//.test(x));
    const webs = f.webs.split('\n').map((x) => x.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '')).filter(Boolean);
    setOcupado(true);
    try {
      for (const [clave, valor] of [['meta_canales', canales], ['meta_feeds', feeds], ['meta_webs', webs]]) {
        const { error } = await supabase.from('config').update({ valor, actualizado: new Date().toISOString() }).eq('clave', clave);
        if (error) throw error;
      }
      aviso(`${t('Fuentes guardadas')}: ${canales.length} ${t('canales')}, ${feeds.length} feeds, ${webs.length} webs.`);
      recargar?.();
    } catch (e) {
      aviso(`Error: ${e.message}`, true);
    } finally {
      setOcupado(false);
    }
  }

  async function actualizar() {
    setOcupado(true);
    setResultado(null);
    try {
      const { data: sesion } = await supabase.auth.getSession();
      const r = await fetch('/api/meta', { method: 'POST', headers: { Authorization: `Bearer ${sesion?.session?.access_token}` } });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error ?? r.status);
      setResultado(j);
      aviso(`${t('Digesto actualizado')}: ${j.videos} videos, ${j.articulos} ${t('artículos')}.`);
      recargar?.();
    } catch (e) {
      aviso(`Error: ${e.message}`, true);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <>
      <h2 className="sec">{t('De dónde sale el meta')} <Info clave="fuentes" /></h2>
      <p className="sub" style={{ marginTop: 0 }}>
        {t(
          'Cuando preguntan por ejércitos, la IA lee primero lo último de estos canales (títulos y enlaces de ejército de sus videos, por la API de YouTube) y los artículos de estos feeds; la búsqueda web se limita a estas webs. Se renueva solo cada seis horas.'
        )}
      </p>
      <div className="grid">
        <div className="card">
          <h3>{t('Canales de YouTube')}</h3>
          <p className="sub">{t('Uno por línea: Nombre | id del canal (empieza por UC). Applesauce, ShocK, Habibi, Ace, TK, Blueprint, iTzu vienen de serie.')}</p>
          <textarea className="campo" rows={8} value={f.canales} onChange={(e) => setF((x) => ({ ...x, canales: e.target.value }))} spellCheck={false} />
        </div>
        <div className="card">
          <h3>{t('Feeds de artículos')}</h3>
          <p className="sub">{t('Atom o RSS, una URL por línea. Los blogs de Blueprint (TH18, TH17, Leyenda) vienen de serie.')}</p>
          <textarea className="campo" rows={4} value={f.feeds} onChange={(e) => setF((x) => ({ ...x, feeds: e.target.value }))} spellCheck={false} />
          <h3 style={{ marginTop: 10 }}>{t('Webs para buscar')}</h3>
          <p className="sub">{t('Un dominio por línea. Solo en estas busca la IA cuando la pregunta es de meta.')}</p>
          <textarea className="campo" rows={3} value={f.webs} onChange={(e) => setF((x) => ({ ...x, webs: e.target.value }))} spellCheck={false} />
        </div>
        <div className="card">
          <h3>{t('El digesto')} <Info clave="meta" /></h3>
          {digesto?.actualizado ? (
            <p className="sub">
              {t('Último')}: {new Date(digesto.actualizado).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' })} · {digesto.videos} videos · {digesto.articulos} {t('artículos')}
              {digesto.errores?.length > 0 && <> · <span className="mal">{digesto.errores.length} {t('errores')}</span></>}
            </p>
          ) : (
            <p className="sub">{t('Todavía no se ha hecho ninguno.')}</p>
          )}
          {resultado && (
            <p className="sub">
              {t('Ahora')}: {resultado.videos} videos, {resultado.articulos} {t('artículos')}, {resultado.chars} {t('caracteres')}, {Math.round(resultado.ms / 100) / 10} s
              {resultado.errores?.length > 0 && <> · {resultado.errores.join(' · ')}</>}
            </p>
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
            <button className="accion" onClick={actualizar} disabled={ocupado}>
              {ocupado ? t('Trabajando…') : t('Actualizar el digesto ahora')}
            </button>
            <button className="accion" onClick={guardar} disabled={ocupado || !cambiado}>
              {t('Guardar fuentes')}
            </button>
          </div>
          {digesto?.texto && (
            <details style={{ marginTop: 10 }}>
              <summary className="sub">{t('Ver lo que lee la IA')}</summary>
              <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, maxHeight: 320, overflow: 'auto' }}>{digesto.texto}</pre>
            </details>
          )}
        </div>
      </div>
    </>
  );
}
