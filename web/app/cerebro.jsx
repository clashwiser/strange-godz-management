'use client';

// El Cerebro: la pestaña donde el sistema se mira a si mismo. El punto
// focal del OS.
//
// La escena: el barbaro de Clash con la cabeza abierta y un cerebro
// digital dentro, enchufado con cables al OS. Es un experimento: ese
// cerebro es el que mueve el sistema. Debajo de la cabeza, una pantalla
// negra, plana, que baja todo lo que haga falta: ahi se escriben, con
// letra de terminal, los signos vitales y la charla con el cerebro.
//
// La imagen de arriba la genero Nano Banana (web/public/cerebro-lab.jpg,
// 16:9, recortada donde empieza la pantalla); la pantalla la pone el CSS,
// asi tiene la altura que pidan los datos. Si hay video en bucle de la
// cabeza (Kling, mismo primer y ultimo fotograma, web/public/cerebro-lab.mp4)
// se usa solo; si no, la imagen.
//
// Toda la pestaña va dentro de .lab-mundo: un mundo aparte, oscuro, con
// cables por los bordes por los que pasa electricidad. NO cambia con los
// temas del panel: es el laboratorio, siempre.
//
// La medida vive en web/lib/cerebro.js (/api/cerebro). La pestaña no
// calcula nada: pinta, cuenta hacia arriba, y explica cada cosa con una
// "i" (info.jsx), porque "digesto" o "webhook" no le dicen nada a nadie.

import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useT } from './idioma';
import { Info } from './info';
import Entrenar from './entrenar';

const TITULO_ANIMO = { sano: 'EN FORMA', atento: 'ATENTO', sobrecargado: 'SOBRECARGADO', pensando: 'PENSANDO' };

// Para la demo publica: un estado creible sin llamar a nada.
const DEMO = {
  ok: true, version: 'demo', region: 'iad1', hoy: new Date().toLocaleDateString('en-CA'), nota: 100, animo: 'sano', fallan: [],
  piezas: [
    { clave: 'vercel', titulo: 'Vercel', ok: true, detalle: 'desplegado demo', sub: 'región iad1', peso: 10 },
    { clave: 'supabase', titulo: 'Supabase', ok: true, detalle: '84 ms', sub: 'la base de datos', peso: 15 },
    { clave: 'clash', titulo: 'API de Clash', ok: true, detalle: '412 ms', sub: 'x300 · 32 miembros', peso: 15 },
    { clave: 'ia', titulo: 'IA (Groq)', ok: true, detalle: 'openai/gpt-oss-120b', sub: 'visión: qwen/qwen3.8-27b', peso: 10 },
    { clave: 'heraldo', titulo: 'Heraldo', ok: true, detalle: 'webhook conectado', sub: '@Strange_godz_heraldo_bot · en el grupo · 0 pendientes', peso: 10 },
    { clave: 'valquiria', titulo: 'Valquiria', ok: true, detalle: 'webhook conectado', sub: '@Valqui_bot · en el grupo · 0 pendientes', peso: 5 },
    { clave: 'jobs', titulo: 'Jobs (GitHub Actions)', ok: true, detalle: '5 jobs, todos bien', sub: '', peso: 15 },
    { clave: 'snapshot', titulo: 'Datos de los jugadores', ok: true, detalle: 'último snapshot hoy', sub: 'hace 6 h', peso: 10 },
    { clave: 'meta', titulo: 'Digesto del meta', ok: true, detalle: '24 videos · 6 artículos', sub: 'hace 3 h', peso: 5 },
    { clave: 'outbox', titulo: 'Bandeja de salida', ok: true, detalle: '3 pendientes', sub: '', peso: 5 },
    { clave: 'cuota', titulo: 'Cuota de IA hoy', ok: true, detalle: '37 / 300 llamadas', sub: '1 fallos', peso: 0 },
  ],
  jobs: [
    { job: 'wars-sync', ok: true, filas: 30, hace: 2 }, { job: 'cwl-sync', ok: true, filas: 45, hace: 5 }, { job: 'raids-sync', ok: true, filas: 60, hace: 20 },
    { job: 'meta', ok: true, filas: 1, hace: 3 }, { job: 'cerebro-latido', ok: true, filas: 11, hace: 1 },
  ],
  memoria: { lecciones: { total: 7, heraldo: 6, valquiria: 4, propuestas: 1 }, glosario: 246, reglas: { fecha: '2026-09-11', palabras: 1324 }, memoriaLideres: 640, canales: 8, vinculados: 21, jugadores: 96, clanes: 5, bases: 38, solicitudes: { pendientes: 2, aceptadas: 9 } },
  puntos: { mes: '2026-09', castillos: 11, castillosPendientes: 1, retos: 6 },
  meta: { hace: 3, videos: 24, articulos: 6, caracteres: 7100 },
  bitacora: [
    { id: 1, creado_en: new Date().toISOString(), bot: 'heraldo', modo: 'buscar', nombre: 'Reyniel', texto: 'El ejército de moda para TH18 este mes es el Super Bowler Spam de Habibi…' },
    { id: 2, creado_en: new Date().toISOString(), bot: 'heraldo', modo: 'foto:fc', nombre: 'YHLQMDLG', texto: 'Reto cumplido: 7 desafíos amistosos con 2⭐ o más. +5 puntos este mes.' },
  ],
  latido: { nota: 100, hora: new Date().toISOString() },
  resumen: '',
};

/** Un numero que sube desde cero hasta su valor: los datos "llegan". */
function Contador({ valor, duracion = 900 }) {
  const n = typeof valor === 'number' ? valor : Number(String(valor ?? '').replace(/[^\d.]/g, ''));
  const esNumero = Number.isFinite(n) && String(valor ?? '') !== '' && /^[\d.,\s]+$/.test(String(valor));
  const [v, setV] = useState(esNumero ? 0 : valor);
  useEffect(() => {
    if (!esNumero) return setV(valor);
    let raf;
    const t0 = performance.now();
    const paso = (t) => {
      const p = Math.min(1, (t - t0) / duracion);
      const e = 1 - Math.pow(1 - p, 3);
      setV(Math.round(n * e));
      if (p < 1) raf = requestAnimationFrame(paso);
    };
    raf = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(raf);
  }, [n, esNumero, valor, duracion]);
  return <>{esNumero ? Number(v).toLocaleString('es') : v}</>;
}

/** Los cables por los bordes, con la electricidad corriendo. */
function Cables() {
  const lados = [
    { d: 'M 3 0 C 9 15, -3 30, 4 45 S -2 75, 3 100', dur: 3.2 },
    { d: 'M 7 0 C 1 20, 11 40, 5 60 S 10 88, 6 100', dur: 4.1 },
  ];
  return (
    <>
      <svg className="lab-cables izq" viewBox="0 0 12 100" preserveAspectRatio="none" aria-hidden="true">
        {lados.map((c, i) => (
          <g key={i}>
            <path className="cable" d={c.d} />
            <path className="cable-luz" d={c.d} style={{ animationDuration: `${c.dur}s`, animationDelay: `${i * 0.7}s` }} />
          </g>
        ))}
      </svg>
      <svg className="lab-cables der" viewBox="0 0 12 100" preserveAspectRatio="none" aria-hidden="true">
        {lados.map((c, i) => (
          <g key={i}>
            <path className="cable" d={c.d} />
            <path className="cable-luz" d={c.d} style={{ animationDuration: `${c.dur + 0.6}s`, animationDelay: `${i * 0.9 + 0.4}s` }} />
          </g>
        ))}
      </svg>
    </>
  );
}

export default function Cerebro({ d, recargar, demo = false }) {
  const t = useT();
  const [v, setV] = useState(demo ? DEMO : null);
  const [cargando, setCargando] = useState(!demo);
  const [msg, setMsg] = useState('');
  const [pregunta, setPregunta] = useState('');
  const [terminal, setTerminal] = useState([]); // la charla, debajo de los vitales
  const [pensando, setPensando] = useState(false);
  const [guia, setGuia] = useState(false);
  const finRef = useRef(null);

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
    if (demo) return aviso(t('En la demo el cerebro no mira nada; así se ve.'));
    setCargando(true);
    try {
      const vit = await conSesion('/api/cerebro');
      if (!vit.ok) throw new Error(vit.error ?? t('el cerebro no contestó'));
      setV(vit);
    } catch (e) {
      aviso(e.message, true);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    if (!demo) mirar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (terminal.length) finRef.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  }, [terminal]);

  const nota = v?.nota ?? null;
  const animo = v?.animo ?? 'pensando';
  const hace = (h) => (h == null ? '—' : h < 1 ? t('hace menos de 1 h') : h < 48 ? t('hace {x} h').replace('{x}', h) : t('hace {x} d').replace('{x}', Math.round(h / 24)));

  // ---- Las lineas de la pantalla ----
  const lineas = useMemo(() => {
    if (!v) return cargando ? [`> CEREBRO x300 · ${t('arrancando…')}`, `> ${t('midiendo Vercel, Supabase, Clash, IA, bots, jobs…')}`] : [`> ${t('sin datos. ¿hay sesión?')}`];
    const barra = nota == null ? '' : '█'.repeat(Math.round(nota / 10)) + '░'.repeat(10 - Math.round(nota / 10));
    const l = [];
    l.push(`> CEREBRO x300 · ${v.hoy} · ${v.version ? `v ${v.version}` : 'local'}${v.region ? ` · ${v.region}` : ''}`);
    l.push(`> ${t('SALUD')} ${nota ?? '?'}/100 ${barra} ${t(TITULO_ANIMO[animo] ?? '')}`);
    if (v.fallan?.length) l.push(`> ${t('FALLA')}: ${v.fallan.map((x) => t(x)).join(', ').toUpperCase()}`);
    for (const p of v.piezas ?? []) {
      const nombre = t(p.titulo).toUpperCase().replace(' (GITHUB ACTIONS)', '').replace(' (GROQ)', ' GROQ');
      const estado = p.ok ? 'OK ' : p.peso ? t('MAL') : t('OJO');
      l.push(`> ${(nombre + ' ').padEnd(24, '.')} ${estado}  ${t(p.detalle)}${p.sub ? ` · ${t(p.sub)}` : ''}`);
    }
    const m = v.memoria;
    if (m) l.push(`> ${(t('MEMORIA') + ' ').padEnd(24, '.')} ${m.jugadores} ${t('jugadores')} · ${m.vinculados} /soy · ${m.lecciones.total} ${t('lecciones')}${m.lecciones.propuestas ? ` (+${m.lecciones.propuestas} ${t('propuestas')})` : ''} · ${t('glosario')} ${m.glosario} · ${t('normas')} ${m.reglas.fecha ?? '—'}`);
    if (v.puntos) l.push(`> ${(`${t('PUNTOS')} ${v.puntos.mes} `).padEnd(24, '.')} ${v.puntos.castillos} ${t('castillos')} · ${v.puntos.retos} FC${v.puntos.castillosPendientes ? ` · ${v.puntos.castillosPendientes} ${t('por confirmar')}` : ''}`);
    if (v.latido?.hora) l.push(`> ${(t('ÚLTIMO LATIDO') + ' ').padEnd(24, '.')} ${new Date(v.latido.hora).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' })} · ${v.latido.nota ?? '?'}/100`);
    if (v.bitacora?.length) l.push(`> ${(t('BITÁCORA') + ' ').padEnd(24, '.')} ${v.bitacora.length} ${t('respuestas recientes')} · ${t('última')} ${new Date(v.bitacora[0].creado_en).toLocaleTimeString('es', { timeStyle: 'short' })}`);
    return l;
  }, [v, cargando, nota, animo, t]);

  // ---- Preguntar, o mandar ----
  //
  // Antes de la IA, ordenes que se ejecutan de verdad: reinstalar un
  // webhook, publicar los comandos, renovar el digesto del meta, mandar
  // una prueba al grupo, volver a mirar. Lo demas va a la IA del panel
  // con el estado delante.
  async function ejecutarOrden(q) {
    const s = q.toLowerCase();
    if (/webhook/.test(s)) {
      const bots = /valqui/.test(s) ? ['recluta'] : /heraldo/.test(s) ? ['heraldo'] : ['heraldo', 'recluta'];
      const salidas = [];
      for (const bot of bots) {
        const j = await conSesion('/api/bots', { bot, accion: 'webhook' });
        salidas.push(`${bot === 'recluta' ? 'Valquiria' : 'Heraldo'}: ${j.ok ? t('webhook reinstalado ✓') : `${t('no pude')} (${j.error ?? '?'})`}`);
      }
      await mirar();
      return salidas.join(' · ');
    }
    if (/comandos|commands/.test(s)) {
      const j = await conSesion('/api/bots', { bot: 'heraldo', accion: 'comandos' });
      return j.ok ? `${t('comandos publicados en Telegram')} (${j.cuantos ?? '?'}) ✓` : `${t('no pude')} (${j.error ?? '?'})`;
    }
    if (/digest|(actualiza|renueva|refresca|rehaz|regenera|update|refresh).*meta/.test(s)) {
      const j = await conSesion('/api/meta', {});
      await mirar();
      return j.ok ? `${t('digesto del meta renovado ✓')} (${j.digesto?.videos ?? '?'} ${t('videos')}, ${j.digesto?.articulos ?? '?'} ${t('artículos')})` : `${t('no pude')} (${j.error ?? '?'})`;
    }
    if (/mensaje de prueba|manda una prueba|prueba al grupo|test message/.test(s)) {
      const j = await conSesion('/api/bots', { bot: 'heraldo', accion: 'probar' });
      return j.ok ? t('mensaje de prueba mandado al grupo ✓') : `${t('no pude')} (${j.error ?? '?'})`;
    }
    if (/^(vuelve a mirar|mira otra vez|mide|refresca|actual[ií]za(te)?|reload|look again|refresh)\b/.test(s)) {
      await mirar();
      return t('medido otra vez ✓');
    }
    return null;
  }

  async function preguntar(e) {
    e?.preventDefault?.();
    const q = pregunta.trim();
    if (!q || pensando) return;
    setPregunta('');
    setTerminal((c) => [...c, { quien: 'tú', texto: q }]);
    setPensando(true);
    try {
      let texto = null;
      if (!demo) texto = await ejecutarOrden(q);
      if (texto == null) {
        const j = demo
          ? { respuesta: `${t('SALUD')} ${nota}/100, ${t(TITULO_ANIMO[animo])}. Vercel, Supabase, la API de Clash, la IA y los dos bots responden; los 5 jobs corrieron bien. Sé 246 tropas y defensas del glosario, 7 lecciones de los líderes y las normas del 11 de septiembre. (Demo: aquí contestaría la IA con el estado real.)` }
          : await conSesion('/api/asistente', { pregunta: q, contexto: v?.resumen ?? '' });
        texto = j?.respuesta || t('Ahora mismo no puedo pensar (sin IA o tope del día). Mira los vitales de arriba.');
      }
      setTerminal((c) => [...c, { quien: 'cerebro', texto }]);
    } catch {
      setTerminal((c) => [...c, { quien: 'cerebro', texto: t('No pude contestar.') }]);
    } finally {
      setPensando(false);
    }
  }

  const sugerencias = [t('¿Cómo estás?'), t('¿Qué falla ahora mismo?'), t('¿Qué jobs corrieron hoy?'), t('reinstala el webhook'), t('actualiza el digesto')];

  const m = v?.memoria;
  const saberes = m
    ? [
        ['jugadores', t('Jugadores que conoce'), m.jugadores, t('activos en los clanes')],
        ['clanes', t('Clanes'), m.clanes, t('de la alianza')],
        ['vinculados', t('Vinculados con /soy'), m.vinculados, t('Telegram ↔ juego')],
        ['lecciones', t('Lecciones'), m.lecciones.total, `${m.lecciones.heraldo} Heraldo · ${m.lecciones.valquiria} Valquiria${m.lecciones.propuestas ? ` · ${m.lecciones.propuestas} ${t('propuestas')}` : ''}`],
        ['glosario', t('Glosario del juego'), m.glosario, t('tropas, hechizos, héroes, defensas')],
        ['normas', t('Normas'), m.reglas.palabras || '—', `${t('palabras')}${m.reglas.fecha ? ` · ${t('actualizadas el')} ${m.reglas.fecha}` : ` · ${t('sin publicar')}`}`],
        ['memoriaLideres', t('Lo que deben saber'), m.memoriaLideres || '—', t('caracteres escritos por los líderes')],
        ['fuentes', t('Fuentes del meta'), m.canales ?? '—', t('canales de YouTube') + (v.meta ? ` · ${t('digesto de')} ${(v.meta.caracteres / 1000).toFixed(1)}k` : '')],
        ['bases', t('Bases en el pack'), m.bases, t('para repartir')],
        ['solicitudes', t('Solicitudes'), m.solicitudes.pendientes, `${t('pendientes')} · ${m.solicitudes.aceptadas} ${t('aceptadas')}`],
        ['puntos', t('Puntos del mes'), (v.puntos?.castillos ?? 0) + (v.puntos?.retos ?? 0), `${v.puntos?.castillos ?? 0} ${t('castillos')} · ${v.puntos?.retos ?? 0} FC${v.puntos?.castillosPendientes ? ` · ${v.puntos.castillosPendientes} ${t('por confirmar')}` : ''}`],
      ]
    : [];

  return (
    <div className="lab-mundo">
      <link href="https://fonts.googleapis.com/css2?family=VT323&display=swap" rel="stylesheet" />
      <Cables />
      <div className="lab-contenido">
        {msg && <p className={msg.startsWith('Error') ? 'error' : 'aviso'}>{msg}</p>}

        {/* ---------- La escena: la cabeza arriba, la pantalla debajo ---------- */}
        <div className={`lab ${animo}`}>
          <div className="lab-cabeza">
            <video className="lab-fondo" autoPlay muted loop playsInline poster="/cerebro-lab.jpg">
              <source src="/cerebro-lab.mp4" type="video/mp4" />
            </video>
            <div className="lab-glitch" aria-hidden="true" />
            <div className="lab-nota" aria-hidden="true">
              <span className="lab-nota-num">{nota == null ? '…' : <Contador valor={nota} duracion={1400} />}</span>
              <span className="lab-nota-txt">/100 · {t(TITULO_ANIMO[animo] ?? '')}</span>
            </div>
            <div className="lab-info-escena">
              <Info clave="cerebro" />
            </div>
          </div>

          {/* La pantalla negra, plana, hacia abajo: los vitales y la charla. */}
          <div className="lab-pantalla">
            <div className="lab-terminal">
              {lineas.map((l, i) => (
                <div key={i} className={`lab-linea${/ MAL |BAD /.test(l) || /^> (FALLA|FAILING)/.test(l) ? ' mal' : ''}`} style={{ animationDelay: `${i * 45}ms` }}>{l}</div>
              ))}
              {terminal.map((c, i) => (
                <div key={`c${i}`} className={`lab-linea ${c.quien === 'tú' ? 'mia' : 'suya'}`}>{c.quien === 'tú' ? `$ ${c.texto}` : c.texto}</div>
              ))}
              {pensando ? <div className="lab-linea suya">…</div> : <div className="lab-linea cursor">_</div>}
              <div ref={finRef} />
            </div>
            <form onSubmit={preguntar} className="lab-prompt">
              <span>&gt;</span>
              <input value={pregunta} onChange={(e) => setPregunta(e.target.value)} placeholder={t('pregúntale o dale una orden…')} disabled={pensando} />
              <button type="submit" disabled={pensando || !pregunta.trim()}>{t('ENTER')}</button>
              <Info clave="preguntar" />
            </form>
            <div className="lab-sugerencias">
              {sugerencias.map((s) => (
                <button key={s} type="button" onClick={() => setPregunta(s)} disabled={pensando}>{s}</button>
              ))}
              <button type="button" onClick={mirar} disabled={cargando}>{cargando ? t('midiendo…') : t('volver a mirar')}</button>
              <button type="button" onClick={() => setGuia((g) => !g)} aria-expanded={guia}>{guia ? t('cerrar la guía') : t('¿qué es cada cosa?')}</button>
            </div>
            {guia && (
              <div className="lab-guia">
                {[
                  ['vercel', 'Vercel'], ['supabase', 'Supabase'], ['clash', 'API de Clash'], ['ia', 'IA (Groq)'], ['heraldo', 'Heraldo'], ['valquiria', 'Valquiria'],
                  ['jobs', 'Jobs'], ['snapshot', 'Datos de los jugadores'], ['meta', 'Digesto del meta'], ['outbox', 'Bandeja de salida'], ['cuota', 'Cuota de IA'], ['latido', 'Último latido'], ['bitacora', 'Bitácora'],
                ].map(([k, nombre]) => (
                  <div key={k} className="lab-guia-fila">
                    <b>{t(nombre)}</b> <Info clave={k} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ---------- Lo que sabe ---------- */}
        <h2 className="sec">{t('Lo que sabe')}</h2>
        <div className="grid">
          {saberes.map(([k, titulo, val, sub], i) => (
            <div className="card" key={k} style={{ animationDelay: `${i * 70}ms` }}>
              <h3>
                {titulo} <Info clave={k} />
              </h3>
              <p className="big"><Contador valor={val} /></p>
              <p className="sub">{sub}</p>
            </div>
          ))}
        </div>

        {/* ---------- Bitacora ---------- */}
        {v?.bitacora?.length > 0 && (
          <>
            <h2 className="sec">
              {t('Bitácora: lo último que contestó')} <Info clave="bitacora" />
            </h2>
            <div className="card">
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {v.bitacora.slice(0, 15).map((b) => (
                  <li key={b.id} className="lab-bit">
                    <span className="sub">{new Date(b.creado_en).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' })} · {b.bot} · {b.modo}{b.nombre ? ` · ${t('a')} ${b.nombre}` : ''}</span>
                    <div style={{ whiteSpace: 'pre-wrap' }}>{String(b.texto).slice(0, 400)}</div>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}

        {/* ---------- Jobs ---------- */}
        {v?.jobs?.length > 0 && (
          <>
            <h2 className="sec">
              {t('Los jobs')} <Info clave="jobs" />
            </h2>
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

        {/* ---------- Entrenar ---------- */}
        {!demo && <Entrenar d={d} memoriaInicial={String(inicial.bots_memoria ?? '')} recargar={recargar} aviso={aviso} />}
      </div>
    </div>
  );
}
