'use client';

// El Cerebro: la pestaña donde el sistema se mira a si mismo.
//
// Tres cosas, en este orden, porque es el orden en que un lider las
// necesita:
//
//   1. Como esta. Cada pieza que puede fallar -Vercel, Supabase, la API
//      de Clash, la IA, los dos bots, los jobs, los datos- con su semaforo,
//      y una nota de 0 a 100 que resume todo. El cerebro pone cara: en
//      forma o sobrecargado.
//   2. Que sabe. Cuanta memoria tiene: lecciones, glosario, normas, meta,
//      jugadores, vinculos. Lo que hay detras de cada respuesta.
//   3. Entrenarlo. Las lecciones, lo que deben saber, las fuentes del meta.
//      Antes vivia en Bots; aqui es donde se aprende.
//
// Y un sitio para preguntarle. La pregunta va a la misma IA del panel con
// el estado leido ahora mismo delante: "¿como estas?" se contesta con
// cifras, no con una frase hecha (web/app/api/cerebro/route.js).

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useT } from './idioma';
import Entrenar from './entrenar';

const hace = (h) => (h == null ? '—' : h < 1 ? 'hace menos de 1 h' : h < 48 ? `hace ${h} h` : `hace ${Math.round(h / 24)} d`);

/** Con que cara esta el cerebro segun la nota. */
function animo(pct) {
  if (pct == null) return { clave: 'pensando', titulo: 'Pensando…', imagen: '/cerebro-sano.jpg' };
  if (pct >= 85) return { clave: 'sano', titulo: 'En forma', imagen: '/cerebro-sano.jpg' };
  if (pct >= 60) return { clave: 'atento', titulo: 'Atento', imagen: '/cerebro-sano.jpg' };
  return { clave: 'sobrecargado', titulo: 'Sobrecargado', imagen: '/cerebro-sobrecargado.jpg' };
}

export default function Cerebro({ d, recargar }) {
  const t = useT();
  const [v, setV] = useState(null); // /api/cerebro
  const [b, setB] = useState(null); // /api/bots
  const [cargando, setCargando] = useState(true);
  const [msg, setMsg] = useState('');
  const [pregunta, setPregunta] = useState('');
  const [charla, setCharla] = useState([]); // [{ quien, texto }]
  const [pensando, setPensando] = useState(false);

  const inicial = useMemo(() => Object.fromEntries((d.config ?? []).map((c) => [c.clave, c.valor])), [d.config]);

  function aviso(texto, malo = false) {
    setMsg((malo ? 'Error: ' : '') + String(texto).replace(/^Error: /, ''));
    setTimeout(() => setMsg(''), malo ? 6000 : 3500);
  }

  async function conSesion(ruta, cuerpo) {
    const { data: sesion } = await supabase.auth.getSession();
    const r = await fetch(ruta, {
      method: cuerpo ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sesion?.session?.access_token}` },
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    });
    return await r.json().catch(() => ({}));
  }

  async function mirar() {
    setCargando(true);
    try {
      const [vit, bots] = await Promise.all([conSesion('/api/cerebro'), conSesion('/api/bots')]);
      if (!vit.ok) throw new Error(vit.error ?? 'el cerebro no contestó');
      setV(vit);
      setB(bots.ok ? bots : null);
    } catch (e) {
      aviso(e.message, true);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    mirar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- La nota: lo de /api/cerebro mas los bots de /api/bots ----
  const piezas = useMemo(() => {
    if (!v) return [];
    const lista = [];
    const pon = (clave, titulo, ok, detalle, sub = '', peso = 0) => lista.push({ clave, titulo, ok, detalle, sub, peso });
    const p = Object.fromEntries((v.salud?.partes ?? []).map((x) => [x.clave, x]));

    pon('vercel', 'Vercel', true, v.version ? `${t('desplegado')} ${v.version}` : t('en local'), v.region ? `${t('región')} ${v.region}` : '', 10);
    pon('supabase', 'Supabase', v.supabase?.ok, v.supabase?.ok ? `${v.supabase.ms} ms` : v.supabase?.error, t('la base de datos'), 15);
    pon('clash', 'API de Clash', v.clash?.ok, v.clash?.ok ? `${v.clash.ms} ms` : v.clash?.error, v.clash?.clan ? `${v.clash.clan} · ${v.clash.miembros} ${t('miembros')}` : t('por el proxy de RoyaleAPI'), 15);
    pon('ia', 'IA (Groq)', v.ia?.ok && v.ia?.configurada, v.ia?.ok ? (v.ia.configurada ? v.ia.texto : t('sin llave')) : v.ia?.error, v.ia?.vision ? `${t('visión')}: ${v.ia.vision}` : t('sin modelo de visión'), 10);

    const h = b?.bots?.heraldo;
    const va = b?.bots?.recluta;
    const okBot = (x) => Boolean(x && !x.error && x.webhook?.ok && !x.webhook?.ultimoError);
    const detBot = (x) => (!x ? t('sin datos') : x.error ? x.error : x.webhook?.ok ? (x.webhook.ultimoError ? `${t('último error')}: ${x.webhook.ultimoError}` : t('webhook conectado')) : t('webhook mal apuntado'));
    pon('heraldo', 'Heraldo', okBot(h), detBot(h), h?.usuario ? `@${h.usuario} · ${h.enGrupo ? t('en el grupo') : t('fuera del grupo')} · ${h.webhook?.pendientes ?? 0} ${t('pendientes')}` : '', 10);
    pon('valquiria', 'Valquiria', okBot(va), detBot(va), va?.usuario ? `@${va.usuario} · ${va.enGrupo ? t('en el grupo') : t('fuera del grupo')} · ${va.webhook?.pendientes ?? 0} ${t('pendientes')}` : '', 5);

    pon('jobs', t('Jobs (GitHub Actions)'), p.jobs?.bien, p.jobs?.detalle, t('los robots de fondo: sincronizar, avisar, cerrar el mes'), 15);
    pon('snapshot', t('Datos de los jugadores'), p.snapshot?.bien, v.snapshot?.fecha ? `${t('último snapshot')} ${v.snapshot.fecha}` : t('sin snapshots'), hace(v.snapshot?.hace), 10);
    pon('meta', t('Digesto del meta'), p.meta?.bien, v.meta ? `${v.meta.videos ?? '?'} ${t('videos')} · ${v.meta.articulos ?? '?'} ${t('artículos')}` : t('sin digesto'), v.meta ? hace(v.meta.hace) : '', 5);
    pon('outbox', t('Bandeja de salida'), p.outbox?.bien, `${v.outbox ?? '?'} ${t('pendientes')}`, t('avisos por mandar'), 5);
    if (b?.ia) {
      const tope = b.ia.tope ?? 300;
      pon('cuota', t('Cuota de IA hoy'), (b.ia.hoy ?? 0) < tope * 0.9, `${b.ia.hoy ?? 0} / ${tope} ${t('llamadas')}`, `${b.ia.fallos ?? 0} ${t('fallos')}`, 0);
    }
    return lista;
  }, [v, b, t]);

  const nota = useMemo(() => {
    const conPeso = piezas.filter((x) => x.peso > 0);
    const total = conPeso.reduce((s, x) => s + x.peso, 0);
    const suma = conPeso.reduce((s, x) => s + (x.ok ? x.peso : 0), 0);
    return total ? Math.round((100 * suma) / total) : null;
  }, [piezas]);
  const cara = animo(cargando && !v ? null : nota);
  const fallan = piezas.filter((x) => x.peso > 0 && !x.ok);

  // ---- Lo que sabe ----
  const m = v?.memoria;
  const saberes = m
    ? [
        [t('Jugadores que conoce'), m.jugadores, t('activos en los clanes')],
        [t('Clanes'), m.clanes, t('de la alianza')],
        [t('Vinculados con /soy'), m.vinculados, t('Telegram ↔ juego')],
        [t('Lecciones'), m.lecciones.total, `${m.lecciones.heraldo} Heraldo · ${m.lecciones.valquiria} Valquiria`],
        [t('Glosario del juego'), m.glosario, t('tropas, hechizos, héroes, defensas')],
        [t('Normas'), m.reglas.palabras ? `${m.reglas.palabras} ${t('palabras')}` : '—', m.reglas.fecha ? `${t('actualizadas el')} ${m.reglas.fecha}` : t('sin publicar')],
        [t('Lo que deben saber'), m.memoriaLideres ? `${m.memoriaLideres} ${t('caracteres')}` : '—', t('escrito por los líderes')],
        [t('Fuentes del meta'), m.canales ?? '—', t('canales de YouTube') + (v.meta ? ` · ${t('digesto de')} ${(v.meta.caracteres / 1000).toFixed(1)}k` : '')],
        [t('Bases en el pack'), m.bases, t('para repartir')],
        [t('Solicitudes'), `${m.solicitudes.pendientes} ${t('pendientes')}`, `${m.solicitudes.aceptadas} ${t('aceptadas')}`],
        [t('Puntos del mes'), `${v.puntos?.castillos ?? 0} ${t('castillos')} · ${v.puntos?.retos ?? 0} FC`, v.puntos?.castillosPendientes ? `${v.puntos.castillosPendientes} ${t('por confirmar')}` : t('nada por confirmar')],
      ]
    : [];

  // ---- Preguntarle ----
  function resumenParaLaIA() {
    if (!v) return '';
    const lineas = [];
    lineas.push(`Salud general: ${nota ?? '?'}/100 (${cara.titulo}). Fecha: ${v.hoy}. Versión desplegada: ${v.version ?? 'local'}.`);
    for (const x of piezas) lineas.push(`- ${x.titulo}: ${x.ok ? 'OK' : 'FALLA'} · ${x.detalle}${x.sub ? ` · ${x.sub}` : ''}`);
    for (const j of v.jobs ?? []) lineas.push(`- job ${j.job}: ${j.ok === false ? `ERROR ${j.error ?? ''}` : j.ok ? 'ok' : 'en curso'} ${hace(j.hace)}${j.filas != null ? ` · ${j.filas} filas` : ''}`);
    for (const [k, val, sub] of saberes) lineas.push(`- ${k}: ${val}${sub ? ` (${sub})` : ''}`);
    if (b?.actividad) lineas.push(`- Actividad: ${b.actividad.solicitudesPendientes} solicitudes pendientes, ${b.actividad.basesHoy} bases pedidas hoy, ${b.actividad.outboxPendientes} avisos pendientes.`);
    return lineas.join('\n').slice(0, 4000);
  }

  async function preguntar(e) {
    e?.preventDefault?.();
    const q = pregunta.trim();
    if (!q || pensando) return;
    setPregunta('');
    setCharla((c) => [...c, { quien: 'tú', texto: q }]);
    setPensando(true);
    try {
      const j = await conSesion('/api/asistente', { pregunta: q, contexto: resumenParaLaIA() });
      setCharla((c) => [...c, { quien: 'cerebro', texto: j?.respuesta || t('Ahora mismo no puedo pensar (sin IA o tope del día). Mira los semáforos de arriba.') }]);
    } catch {
      setCharla((c) => [...c, { quien: 'cerebro', texto: t('No pude contestar.') }]);
    } finally {
      setPensando(false);
    }
  }

  const sugerencias = [t('¿Cómo estás?'), t('¿Qué falla ahora mismo?'), t('¿Qué sabes de las normas?'), t('¿Qué jobs corrieron hoy?')];

  return (
    <>
      {msg && <p className={msg.startsWith('Error') ? 'error' : 'aviso'}>{msg}</p>}

      {/* ---------- Cabecera: la cara y la nota ---------- */}
      <div className={`cerebro-cabecera ${cara.clave}`}>
        <img src={cara.imagen} alt="" className="cerebro-cara" />
        <div className="cerebro-nota">
          <h2 className="sec" style={{ marginTop: 0 }}>{t('Cerebro del sistema')}</h2>
          <div className="cerebro-gauge" aria-label={`${nota ?? '?'} / 100`}>
            <div className="cerebro-gauge-barra" style={{ width: `${nota ?? 0}%` }} />
          </div>
          <p className="cerebro-titulo">
            <b>{nota == null ? '…' : `${nota} / 100`}</b> · {t(cara.titulo)}
          </p>
          <p className="sub" style={{ marginTop: 4 }}>
            {cargando && !v
              ? t('Mirando cada pieza…')
              : fallan.length
                ? `${t('Falla')}: ${fallan.map((x) => x.titulo).join(', ')}.`
                : t('Todo responde. Vercel, la base, la API de Clash, la IA, los bots y los jobs.')}
            {v?.version && ` · ${t('versión')} ${v.version}`}
          </p>
          <button className="fantasma" onClick={mirar} disabled={cargando} style={{ marginTop: 8 }}>
            {cargando ? t('Mirando…') : `🔄 ${t('Volver a mirar')}`}
          </button>
        </div>
      </div>

      {/* ---------- Signos vitales ---------- */}
      <h2 className="sec">{t('Signos vitales')}</h2>
      <div className="grid">
        {piezas.map((x) => (
          <div className="card" key={x.clave}>
            <h3>
              {x.titulo} <span className={`pill ${x.ok ? 'ok' : x.peso ? 'mal' : 'aviso'}`}>{x.ok ? 'OK' : x.peso ? t('FALLA') : t('OJO')}</span>
            </h3>
            <p style={{ margin: '6px 0 0' }}>{x.detalle}</p>
            {x.sub && <p className="sub">{x.sub}</p>}
          </div>
        ))}
        {!piezas.length && !cargando && <p className="vacio">{t('Sin datos. ¿Hay sesión?')}</p>}
      </div>

      {/* ---------- Jobs ---------- */}
      {v?.jobs?.length > 0 && (
        <>
          <h2 className="sec">{t('Los jobs')}</h2>
          <div className="card" style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>{t('Job')}</th>
                  <th>{t('Última vez')}</th>
                  <th>{t('Resultado')}</th>
                  <th>{t('Filas')}</th>
                </tr>
              </thead>
              <tbody>
                {v.jobs.map((j) => (
                  <tr key={j.job}>
                    <td><code>{j.job}</code></td>
                    <td>{hace(j.hace)}</td>
                    <td>{j.ok === false ? <span className="pill mal">{t('error')}</span> : j.ok ? <span className="pill ok">ok</span> : <span className="pill">{t('en curso')}</span>}{j.error && <span className="sub"> · {String(j.error).slice(0, 120)}</span>}</td>
                    <td>{j.filas ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ---------- Lo que sabe ---------- */}
      <h2 className="sec">{t('Lo que sabe')}</h2>
      <div className="grid">
        {saberes.map(([k, val, sub]) => (
          <div className="card" key={k}>
            <h3>{k}</h3>
            <p className="big">{val}</p>
            <p className="sub">{sub}</p>
          </div>
        ))}
      </div>

      {/* ---------- Preguntarle ---------- */}
      <h2 className="sec">{t('Pregúntale al cerebro')}</h2>
      <div className="card cerebro-charla">
        <p className="sub" style={{ marginTop: 0 }}>
          {t('Contesta con lo que acaba de leer arriba: cómo está cada pieza, qué sabe, qué falla. Es la misma IA del panel, con el estado del sistema delante.')}
        </p>
        <div className="cerebro-sugerencias">
          {sugerencias.map((s) => (
            <button key={s} className="fantasma" onClick={() => setPregunta(s)} disabled={pensando}>
              {s}
            </button>
          ))}
        </div>
        {charla.length > 0 && (
          <div className="cerebro-hilo">
            {charla.map((c, i) => (
              <div key={i} className={`cerebro-msg ${c.quien === 'tú' ? 'mio' : 'suyo'}`}>
                {c.quien === 'cerebro' && <img src="/cerebro-sano.jpg" alt="" />}
                <div>{c.texto}</div>
              </div>
            ))}
            {pensando && <div className="cerebro-msg suyo"><img src="/cerebro-sano.jpg" alt="" /><div>{t('Pensando…')}</div></div>}
          </div>
        )}
        <form onSubmit={preguntar} style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <input className="campo" style={{ flex: 1, marginTop: 0 }} value={pregunta} onChange={(e) => setPregunta(e.target.value)} placeholder={t('Pregúntale algo…')} disabled={pensando} />
          <button className="accion" type="submit" disabled={pensando || !pregunta.trim()}>{t('Preguntar')}</button>
        </form>
      </div>

      {/* ---------- Entrenar ---------- */}
      <Entrenar d={d} memoriaInicial={String(inicial.bots_memoria ?? '')} recargar={recargar} aviso={aviso} />
    </>
  );
}
