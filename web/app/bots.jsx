'use client';

// Panel de bots. Dos personajes, cada uno con su oficio:
//
//   Heraldo    @Strange_godz_heraldo_bot   anuncia: avisos, partes, bases,
//                                          estrellas, la bienvenida
//   Valquiria  @Valqui_bot                 elige: recibe a los que quieren
//                                          entrar, mira como pelearon y se
//                                          los pasa a los lideres
//
// Lo que un lider necesita de esta pantalla y antes no tenia: saber si los
// bots ESTAN BIEN sin abrir una terminal -webhook, si estan en el grupo,
// errores- y poder arreglar lo basico desde aqui: probarlos, reinstalar
// el webhook, publicar los comandos. Ver web/app/api/bots/route.js.
//
// Los ajustes viven en la tabla `config`, no en variables de entorno: asi
// los lideres los cambian desde aca sin tocar GitHub.
//
// Las CLAVES (tokens, service_role, sesion de WhatsApp) NO se muestran ni
// se editan aca. Siguen en Vercel; esta pantalla solo dice si estan
// puestas, nunca su valor.

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useT } from './idioma';

const fmt = (d) => (d ? new Date(d).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' }) : '—');

// Lo que la demo enseña cuando no hay Telegram al que preguntar.
const SALUD_DEMO = {
  bots: {
    heraldo: { clave: 'heraldo', configurado: true, usuario: 'Strange_godz_heraldo_bot', nombre: 'Heraldo', oyeTodo: true, enGrupo: true, esAdmin: false, webhook: { ok: true, pendientes: 0, ultimoError: null } },
    recluta: { clave: 'recluta', configurado: true, usuario: 'Valqui_bot', nombre: 'Valquiria', oyeTodo: true, enGrupo: true, esAdmin: false, webhook: { ok: true, pendientes: 0, ultimoError: null } },
  },
  actividad: { solicitudesPendientes: 3, solicitudesTotal: 7, aceptadas: 2, vinculados: 18, basesHoy: 4, outboxPendientes: 1 },
  ia: { configurada: true, motor: 'openai', modelo: 'openai/gpt-oss-120b', hoy: 37, fallos: 0, tope: 300 },
};

const FICHAS = {
  heraldo: {
    imagen: '/heraldo.png',
    oficio: 'Anuncia. Avisos de guerra y CWL, partes diarios, bases del pack, estrellas, premios y la bienvenida a quien entra al grupo.',
    donde: 'En el grupo. Contesta si lo nombran o le responden; los comandos con / siempre.',
  },
  recluta: {
    imagen: '/valquiria.png',
    oficio: 'Elige. Recibe en privado a quien quiere entrar, le pide el tag, mira cómo ha peleado y se lo pasa a los líderes. Presenta en el grupo a los que eligió.',
    donde: 'En privado (@Valqui_bot) para reclutar. En el grupo solo si la nombran.',
  },
};

export default function Bots({ d, demo = false, recargar }) {
  const t = useT();
  const inicial = useMemo(
    () => Object.fromEntries((d.config ?? []).map((c) => [c.clave, c.valor])),
    [d.config]
  );
  const [cfg, setCfg] = useState(inicial);
  const [msg, setMsg] = useState('');
  const [guardando, setGuardando] = useState(false);

  // Salud de los bots, preguntada a Telegram al abrir la pestaña.
  const [salud, setSalud] = useState(demo ? SALUD_DEMO : null);
  const [cargando, setCargando] = useState(!demo);
  const [ocupado, setOcupado] = useState(null);

  useEffect(() => setCfg(inicial), [inicial]);

  async function conSesion(metodo, cuerpo) {
    const { data: sesion } = await supabase.auth.getSession();
    const r = await fetch('/api/bots', {
      method: metodo,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sesion?.session?.access_token}`,
      },
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    });
    const j = await r.json().catch(() => ({}));
    if (!j.ok && metodo === 'GET') throw new Error(j.error ?? `error ${r.status}`);
    return j;
  }

  async function cargarSalud() {
    if (demo) return;
    setCargando(true);
    try {
      setSalud(await conSesion('GET'));
    } catch (e) {
      setMsg(`Error: ${e.message}`);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargarSalud();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function mandar(bot, accion) {
    if (demo) return aviso(t('En la demo no se toca a los bots, pero así se ve.'));
    setOcupado(`${bot}:${accion}`);
    try {
      const j = await conSesion('POST', { bot, accion });
      if (!j.ok) throw new Error(j.error ?? 'falló');
      aviso(
        accion === 'probar'
          ? t('Mensaje de prueba enviado al grupo.')
          : accion === 'webhook'
            ? t('Webhook reinstalado.')
            : `${t('Comandos publicados')} (${j.cuantos ?? 0}).`
      );
      if (accion !== 'probar') await cargarSalud();
    } catch (e) {
      aviso(`Error: ${e.message}`, true);
    } finally {
      setOcupado(null);
    }
  }

  const set = (clave, valor) => setCfg((c) => ({ ...c, [clave]: valor }));

  async function guardar() {
    setGuardando(true);
    setMsg('');
    if (demo) {
      aviso(t('En la demo no se guarda, pero así queda.'));
      setGuardando(false);
      return;
    }
    try {
      // Una fila por ajuste. Se mandan solo los que cambiaron.
      const cambios = Object.entries(cfg).filter(
        ([k, v]) => JSON.stringify(v) !== JSON.stringify(inicial[k])
      );
      if (!cambios.length) {
        aviso(t('No hay cambios.'));
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
      aviso(`${t('Guardado')} (${cambios.length} ${cambios.length === 1 ? t('ajuste') : t('ajustes')}).`);
      recargar?.();
    } catch (e) {
      aviso(`Error: ${e.message}`, true);
    } finally {
      setGuardando(false);
    }
  }

  function aviso(texto, malo = false) {
    setMsg((malo ? 'Error: ' : '') + String(texto).replace(/^Error: /, ''));
    setTimeout(() => setMsg(''), malo ? 6000 : 3500);
  }

  const jobTelegram = (d.jobs ?? []).find((j) => j.job === 'alerta_cwl');
  const jobWa = (d.jobs ?? []).find((j) => j.job === 'wa_enviar');
  const pendientes = (d.outbox ?? []).filter((m) => m.estado === 'pendiente').length;
  const act = salud?.actividad;

  if (!d.config?.length) {
    return (
      <p className="vacio">
        {t('Falta correr')} <code>sql/008_config.sql</code> {t('en Supabase para crear los ajustes.')}
      </p>
    );
  }

  return (
    <>
      {msg && <pre className={msg.startsWith('Error') ? 'msg error' : 'msg'}>{msg}</pre>}

      {/* ---------- Los dos bots ---------- */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <h2 className="sec" style={{ margin: '18px 0 8px' }}>{t('Los bots')}</h2>
        <span style={{ flex: 1 }} />
        {!demo && (
          <button className="fantasma" onClick={cargarSalud} disabled={cargando}>
            {cargando ? t('Preguntando a Telegram…') : t('Volver a comprobar')}
          </button>
        )}
      </div>

      <div className="grid bots-grid">
        {['heraldo', 'recluta'].map((clave) => (
          <TarjetaBot
            key={clave}
            clave={clave}
            ficha={FICHAS[clave]}
            salud={salud?.bots?.[clave]}
            cargando={cargando}
            ocupado={ocupado}
            mandar={mandar}
          />
        ))}
      </div>

      {/* ---------- Actividad ---------- */}
      <h2 className="sec">{t('Actividad')}</h2>
      <div className="grid">
        <div className="card">
          <h3>{t('Solicitudes sin decidir')}</h3>
          <p className="big">{act ? act.solicitudesPendientes : '…'}</p>
          <p className="sub">
            {act ? `${act.solicitudesTotal} ${t('en total')} · ${act.aceptadas} ${t('dentro')}` : ' '}{' '}
            {t('— se deciden en la pestaña Solicitudes.')}
          </p>
        </div>
        <div className="card">
          <h3>{t('Jugadores que Heraldo reconoce')}</h3>
          <p className="big">{act ? act.vinculados : '…'}</p>
          <p className="sub">
            {t('Se presentaron con /soy. Solo a ellos les vibra el teléfono cuando se les menciona.')}
          </p>
        </div>
        <div className="card">
          <h3>{t('Bases dadas hoy')}</h3>
          <p className="big">{act ? `${act.basesHoy} / 10` : '…'}</p>
          <p className="sub">{t('Tope de diez por día para el grupo, una por persona.')}</p>
        </div>
        <div className="card">
          <h3>
            {t('IA de respaldo')}{' '}
            {salud?.ia && (
              <span className={`pill ${salud.ia.configurada ? 'ok' : 'aviso'}`}>
                {salud.ia.configurada ? t('con llave') : t('sin llave')}
              </span>
            )}
          </h3>
          <p className="big">{salud?.ia ? `${salud.ia.hoy} / ${salud.ia.tope}` : '…'}</p>
          {salud?.ia?.configurada && (
            <p className="sub" style={{ marginTop: 0 }}>
              {salud.ia.motor === 'openai' ? t('motor compatible OpenAI') : 'Gemini'} · <code>{salud.ia.modelo ?? '?'}</code>
            </p>
          )}
          <p className="sub">
            {t('preguntas a la IA hoy. Solo entra cuando el cerebro de frases no sabe; sin llave o al tope, vuelven las frases.')}
            {salud?.ia?.fallos > 0 && <> · <span className="mal">{salud.ia.fallos} {t('fallos')}</span></>}
            {salud?.ia && !salud.ia.configurada && (
              <> · {t('Falta la llave en Vercel:')} <code>IA_LLAVE</code> + <code>IA_URL</code> (Mistral, Groq…) {t('o')} <code>GEMINI_API_KEY</code>.</>
            )}
          </p>
        </div>
        <div className="card">
          <h3>{t('Bandeja de salida')}</h3>
          <p className="big">{act ? act.outboxPendientes : pendientes}</p>
          <p className="sub">
            {t('mensajes por enviar. Si ningún canal está activo, se copian a mano desde la pestaña Mensajes — nunca se pierden.')}
          </p>
        </div>
      </div>

      {/* ---------- Identidad ---------- */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <h2 className="sec" style={{ margin: '18px 0 8px' }}>{t('Cómo firma Heraldo')}</h2>
        <span style={{ flex: 1 }} />
        <button className="accion" onClick={guardar} disabled={guardando}>
          {guardando ? t('Guardando…') : t('Guardar cambios')}
        </button>
      </div>

      <div className="grid">
        <div className="card">
          <h3>{t('Nombre')}</h3>
          <p className="sub">{t('Con este nombre firma sus avisos.')}</p>
          <input className="campo" value={cfg.bot_nombre ?? ''} onChange={(e) => set('bot_nombre', e.target.value)} />
        </div>
        <div className="card">
          <h3>{t('Firma')}</h3>
          <p className="sub">{t('Línea final de cada mensaje al clan.')}</p>
          <input className="campo" value={cfg.bot_firma ?? ''} onChange={(e) => set('bot_firma', e.target.value)} />
        </div>
        <div className="card">
          <h3>{t('Umbrales de aviso')}</h3>
          <p className="sub">{t('Horas antes del cierre en que avisa. Separadas por coma.')}</p>
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

      {/* ---------- Que avisa ---------- */}
      <h2 className="sec">{t('Qué avisa')}</h2>
      <div className="grid">
        <Interruptor
          titulo={t('Ataques de CWL sin usar')}
          nota={t('Lo más valioso: avisa antes de perder la guerra.')}
          valor={cfg.alerta_cwl}
          alCambiar={(v) => set('alerta_cwl', v)}
        />
        <Interruptor
          titulo={t('Ataques de guerra normal')}
          nota={t('Necesita que /currentwar responda. Correr el probe primero.')}
          valor={cfg.alerta_guerra}
          alCambiar={(v) => set('alerta_guerra', v)}
        />
        <Interruptor
          titulo={t('Resumen de Raid Weekend')}
          nota={t('Los ~24 ataques mensuales que hoy no mide nadie.')}
          valor={cfg.alerta_raids}
          alCambiar={(v) => set('alerta_raids', v)}
        />
        <Interruptor
          titulo={t('Reporte mensual de premios')}
          nota={t('La tabla de ganadores, el día 1.')}
          valor={cfg.reporte_mensual}
          alCambiar={(v) => set('reporte_mensual', v)}
        />
      </div>

      {/* ---------- Por donde avisa ---------- */}
      <h2 className="sec">{t('Por dónde avisa')}</h2>
      <div className="grid">
        <div className="card">
          <h3>
            Telegram{' '}
            <span className={`pill ${cfg.telegram_activo ? 'ok' : 'aviso'}`}>
              {cfg.telegram_activo ? 'activo' : 'apagado'}
            </span>
          </h3>
          <p className="sub">
            {t('Gratis, sin límites y sin riesgo de baneo. Lleva lo que no puede fallar.')}
          </p>
          <p className="sub" style={{ marginTop: 8 }}>
            {t('Última alerta')}:{' '}
            {jobTelegram ? (
              <>
                {fmt(jobTelegram.started_at)}{' '}
                <span className={`pill ${jobTelegram.ok ? 'ok' : 'mal'}`}>
                  {jobTelegram.ok ? 'ok' : 'falló'}
                </span>
              </>
            ) : (
              t('todavía no corrió')
            )}
          </p>
          <label className="fila-check">
            <input
              type="checkbox"
              checked={Boolean(cfg.telegram_activo)}
              onChange={(e) => set('telegram_activo', e.target.checked)}
            />
            <span>{t('Mandar avisos por Telegram')}</span>
          </label>
        </div>

        <div className="card">
          <h3>
            WhatsApp{' '}
            <span className={`pill ${d.wa?.vinculado ? 'ok' : 'aviso'}`}>
              {d.wa?.vinculado ? t('vinculado') : t('sin vincular')}
            </span>
          </h3>
          <p className="sub">
            {d.wa?.vinculado
              ? `Número ${d.wa.numero ?? '?'} · último envío ${fmt(d.wa.ultimo_ok)}`
              : t('Necesita un número secundario. Nunca el personal: la sesión guardada da acceso completo a ese WhatsApp.')}
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
              {t('Mandar avisos por WhatsApp')}
              {!d.wa?.vinculado && ' ' + t('(hay que vincular primero)')}
            </span>
          </label>
        </div>
      </div>

      {/* ---------- Que entienden ---------- */}
      <h2 className="sec">{t('Qué entiende Heraldo')}</h2>
      <p className="sub" style={{ marginTop: 0 }}>
        {t('Los comandos con / funcionan siempre. Sin barra, contesta si lo nombran ("Heraldo…") o le responden a un mensaje suyo.')}
      </p>
      <div className="tabla-scroll">
        <table>
          <thead>
            <tr>
              <th>{t('Comando')}</th>
              <th>{t('O dicho como la gente habla')}</th>
              <th>{t('Qué devuelve')}</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['/yo', '"cuánto llevo", "cómo voy"', t('Tus estrellas y ataques de esta CWL')],
              ['/miclan', '"pa qué clan voy yo"', t('A qué clan te toca ir esta CWL')],
              ['/cobro', '"cuánto voy a cobrar"', t('En qué puesto vas del reparto')],
              ['/base [th] [guerra|aldea]', '"me pasas una base"', t('Una base del pack con su mini. Una por persona al día, diez por grupo')],
              ['/soy <nombre>', '"yo soy Fulano"', t('Te ata a tu cuenta del juego: desde entonces te menciona y te vibra el teléfono')],
              ['/faltan', '"quién falta por atacar"', t('Quién no ha atacado en la CWL en curso, con horas restantes')],
              ['/estrellas', '"la tabla"', t('Tabla de estrellas de la temporada')],
              ['/jugador <nombre>', '"quién es Fulano"', t('Ficha con deltas de trofeos y estrellas')],
              ['/resumen', '"cómo vamos"', t('Estado de los clanes, último snapshot y jobs')],
              ['/reporte', '—', t('Último mensaje generado. Solo líderes: puede llevar quién cobra cuánto')],
              ['—', '"tírame un chiste", "te pones de pinga"…', t('Charla: 130 frases de cerebro. Es para retención, no para información')],
            ].map(([c, h, q]) => (
              <tr key={c + h}>
                <td style={{ fontFamily: 'ui-monospace, Consolas, monospace', whiteSpace: 'nowrap' }}>{c}</td>
                <td className="sub" style={{ whiteSpace: 'normal' }}>{h}</td>
                <td style={{ whiteSpace: 'normal' }}>{q}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="sec">{t('Qué entiende Valquiria')}</h2>
      <p className="sub" style={{ marginTop: 0 }}>
        {t('En privado lleva la conversación de ingreso entera. En el grupo solo contesta si la nombran ("Valquiria…", "Valqui…"). Nunca atiende comandos con /: esos son de Heraldo.')}
      </p>
      <div className="tabla-scroll">
        <table>
          <thead>
            <tr>
              <th>{t('Le dicen')}</th>
              <th>{t('Qué hace')}</th>
            </tr>
          </thead>
          <tbody>
            {[
              [t('"hola" en privado'), t('Empieza la solicitud: pide el tag, lee el perfil real de Supercell, confirma, pregunta de dónde sale y avisa a los líderes')],
              ['"¿cómo entra mi amigo?"', t('Explica que le escriba en privado a @Valqui_bot')],
              ['"¿cuántos hay esperando?"', t('Cuántas solicitudes hay sin decidir')],
              ['"¿quién eres?"', t('Se presenta')],
              [t('piropos, insultos, preguntas por Heraldo'), t('Contesta con personalidad y las manda a su sitio')],
              [t('cualquier cosa de bases, estrellas o guerra'), t('Lo manda a Heraldo, que es de quien es')],
              [t('entra al grupo alguien que ella eligió'), t('Lo presenta: nombre, TH, y que viene a probarse en amistosa')],
            ].map(([c, q]) => (
              <tr key={c}>
                <td style={{ whiteSpace: 'normal' }}>{c}</td>
                <td style={{ whiteSpace: 'normal' }}>{q}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function TarjetaBot({ clave, ficha, salud, cargando, ocupado, mandar }) {
  const t = useT();
  const s = salud;
  const listo = s && !s.error;
  const Pill = ({ ok, si, no, dudoso }) => (
    <span className={`pill ${dudoso ? 'aviso' : ok ? 'ok' : 'mal'}`}>{dudoso ? '…' : ok ? si : no}</span>
  );

  return (
    <div className="card bot-card">
      <div className="bot-cab">
        <img src={ficha.imagen} alt="" width="84" height="84" />
        <div>
          <h3 style={{ margin: 0, fontSize: 17 }}>{s?.nombre ?? (clave === 'heraldo' ? 'Heraldo' : 'Valquiria')}</h3>
          <p className="sub" style={{ margin: '2px 0 0' }}>
            @{s?.usuario ?? (clave === 'heraldo' ? 'Strange_godz_heraldo_bot' : 'Valqui_bot')}
          </p>
        </div>
      </div>

      <p className="sub" style={{ marginTop: 10 }}>{ficha.oficio}</p>
      <p className="sub">{ficha.donde}</p>

      {s?.error && <p className="error">{s.error}</p>}

      <div className="bot-estado">
        <div>
          <span className="sub">{t('Webhook')}</span>{' '}
          <Pill dudoso={cargando || !listo} ok={listo && s.webhook?.ok} si={t('conectado')} no={t('roto')} />
        </div>
        <div>
          <span className="sub">{t('En el grupo')}</span>{' '}
          <Pill dudoso={cargando || !listo} ok={listo && s.enGrupo} si={s?.esAdmin ? t('sí, admin') : t('sí')} no={t('no')} />
        </div>
        <div>
          <span className="sub">{t('Oye')}</span>{' '}
          <span className="pill">{cargando || !listo ? '…' : s.oyeTodo ? t('todo el chat') : t('solo si le hablan')}</span>
        </div>
        {listo && s.webhook?.pendientes > 0 && (
          <div>
            <span className="sub">{t('Sin procesar')}</span> <span className="pill aviso">{s.webhook.pendientes}</span>
          </div>
        )}
      </div>

      {listo && s.webhook?.ultimoError && (
        <p className="error" style={{ marginTop: 6 }}>
          {t('Último error de Telegram')}: {s.webhook.ultimoError} ({fmt(s.webhook.ultimoErrorEn)})
        </p>
      )}
      {listo && !s.webhook?.ok && (
        <p className="sub" style={{ color: 'var(--mal)' }}>
          {t('El webhook no apunta a este sitio. Reinstálalo con el botón.')}
        </p>
      )}

      <div className="grupo-pie">
        <button className="fantasma" disabled={Boolean(ocupado)} onClick={() => mandar(clave, 'probar')}>
          {ocupado === `${clave}:probar` ? '…' : t('Probar en el grupo')}
        </button>
        <button className="fantasma" disabled={Boolean(ocupado)} onClick={() => mandar(clave, 'webhook')}>
          {ocupado === `${clave}:webhook` ? '…' : t('Reinstalar webhook')}
        </button>
        {clave === 'heraldo' && (
          <button className="fantasma" disabled={Boolean(ocupado)} onClick={() => mandar(clave, 'comandos')}>
            {ocupado === `${clave}:comandos` ? '…' : t('Publicar comandos')}
          </button>
        )}
      </div>
    </div>
  );
}

function Interruptor({ titulo, nota, valor, alCambiar }) {
  const t = useT();
  return (
    <div className="card">
      <h3>
        {titulo} <span className={`pill ${valor ? 'ok' : 'aviso'}`}>{valor ? t('sí') : t('no')}</span>
      </h3>
      <p className="sub">{nota}</p>
      <label className="fila-check">
        <input type="checkbox" checked={Boolean(valor)} onChange={(e) => alCambiar(e.target.checked)} />
        <span>{t('Activado')}</span>
      </label>
    </div>
  );
}
