'use client';

// La bandeja de quien quiere entrar.
//
// El reclutamiento del clan era: alguien te ve por ahi, alguien te invita,
// y ya. Sin filtro, sin constancia, y el que no conocia a nadie no tenia
// por donde entrar.
//
// El circuito completo:
//
//   descripcion del clan -> @Strange_godz_heraldo_bot -> esta pantalla
//                        -> invitacion -> amistosa de prueba -> dentro
//
// Lo que hace que esta pantalla valga: el aspirante da su TAG y Heraldo le
// saca el perfil de la API de Supercell. Aqui no se lee lo que la persona
// dice de si misma —todo el mundo dice que ataca siempre y que dona
// mucho—; se leen los logros, que son totales de por vida y no se pueden
// maquillar. Ver web/lib/aspirante.js.
//
// El ultimo paso, la amistosa, se anota a mano a proposito: las partidas
// amistosas no aparecen en ningun endpoint de la API. Comprobado.

import { useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useT } from './idioma';
import { banderas } from '../lib/aspirante';

const ESTADOS = [
  ['pendiente', 'Esperando', '📬'],
  ['prueba', 'En prueba', '⚔️'],
  ['aceptada', 'Dentro', '✅'],
  ['rechazada', 'Rechazada', '🚪'],
];

const miles = (n) => Number(n ?? 0).toLocaleString('es-ES');

export default function Solicitudes({ d, demo = false, recargar }) {
  const t = useT();
  const [ver, setVer] = useState('abiertas');
  const [msg, setMsg] = useState('');
  const [ocupado, setOcupado] = useState(null);
  const [clanDe, setClanDe] = useState({});
  const [notaDe, setNotaDe] = useState({});

  // Solo a los clanes de guerra se recluta. Olympus y Cuban Pirates son de
  // vitrina: meter gente ahi es justo lo contrario de para lo que estan.
  const clanes = useMemo(
    () => (d.clans ?? []).filter((c) => c.proposito !== 'trofeos'),
    [d.clans]
  );

  const lista = useMemo(() => {
    const todas = (d.solicitudes ?? []).filter((s) => s.estado !== 'borrador');
    const abiertas = todas.filter((s) => s.estado === 'pendiente' || s.estado === 'prueba');
    return (ver === 'abiertas' ? abiertas : todas).sort((a, b) =>
      String(b.creado_en).localeCompare(String(a.creado_en))
    );
  }, [d.solicitudes, ver]);

  const abiertas = (d.solicitudes ?? []).filter(
    (s) => s.estado === 'pendiente' || s.estado === 'prueba'
  ).length;

  async function decidir(s, accion, extra = {}) {
    if (demo) return aviso(t('En la demo no se decide nada, pero así se ve.'));
    setOcupado(s.id);
    setMsg('');
    try {
      const { data: sesion } = await supabase.auth.getSession();
      const r = await fetch('/api/solicitud', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sesion?.session?.access_token}`,
        },
        body: JSON.stringify({
          id: s.id,
          accion,
          clanTag: clanDe[s.id] ?? null,
          nota: notaDe[s.id] ?? null,
          ...extra,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!j.ok) throw new Error(j.error ?? `error ${r.status}`);
      // avisado === false significa que la fila se guardo pero el mensaje
      // no salio. Callarselo dejaria a alguien esperando una respuesta que
      // nunca le llego.
      if (j.avisado === false) {
        aviso(t('Guardado, pero no se le pudo escribir por Telegram. Avísale tú.'), true);
      } else {
        aviso(t('Hecho.'));
      }
      recargar?.();
    } catch (e) {
      aviso(`Error: ${e.message}`, true);
    } finally {
      setOcupado(null);
    }
  }

  function aviso(texto, malo = false) {
    setMsg((malo ? 'Error: ' : '') + String(texto).replace(/^Error: /, ''));
    setTimeout(() => setMsg(''), malo ? 6000 : 4000);
  }

  return (
    <>
      <h2 className="sec">
        {t('Solicitudes')}
        {abiertas > 0 && <> · {abiertas} {t('sin decidir')}</>}
      </h2>

      <div className="aviso-historico">
        <span>📯</span>
        <p className="sub">
          {t('Para que lleguen solicitudes, pon esto en la descripción del clan dentro del juego:')}{' '}
          <code>Telegram: @Strange_godz_heraldo_bot</code>{' '}
          {t('— se busca dentro de Telegram, así que no hace falta enlace.')}
        </p>
      </div>

      <div className="filtros">
        <select className="campo campo-corto" value={ver} onChange={(e) => setVer(e.target.value)}>
          <option value="abiertas">{t('Sin decidir')}</option>
          <option value="todas">{t('Todas')}</option>
        </select>
      </div>

      {msg && <pre className={msg.startsWith('Error') ? 'msg error' : 'msg'}>{msg}</pre>}

      {!lista.length && (
        <p className="vacio">
          {ver === 'abiertas'
            ? t('Nada pendiente. Cuando alguien le escriba a Heraldo, aparece aquí.')
            : t('Todavía no ha solicitado nadie.')}
        </p>
      )}

      <div className="grid">
        {lista.map((s) => {
          const r = s.perfil;
          const est = ESTADOS.find((e) => e[0] === s.estado) ?? ESTADOS[0];
          return (
            <div className="card" key={s.id}>
              <h3 style={{ fontSize: 15 }}>
                {est[2]} {r?.nombre ?? s.tg_nombre ?? t('sin nombre')}{' '}
                <span className="pill">{t(est[1])}</span>
              </h3>

              <p className="sub" style={{ marginTop: 2 }}>
                <code>{s.player_tag ?? '—'}</code>
                {s.tg_username && <> · @{s.tg_username}</>}
                {s.creado_en && <> · {String(s.creado_en).slice(0, 10)}</>}
              </p>

              {r ? (
                <>
                  <p className="sub" style={{ marginTop: 8 }}>
                    <b>TH{r.th}</b> · {t('nivel')} {r.nivel} · {t('mejor')} {miles(r.mejorTrofeos)} 🏆
                    {r.clan && <> · {t('está en')} {r.clan.nombre}</>}
                  </p>
                  {/* Los cuatro numeros que no mienten: son de por vida y no
                      se resetean cada temporada como las donaciones. */}
                  <div className="tabla-scroll">
                    <table>
                      <tbody>
                        <tr>
                          <td>⚔️ {t('Guerra')}</td>
                          <td className="num">{miles(r.guerraVida)} ★</td>
                        </tr>
                        <tr>
                          <td>🏅 CWL</td>
                          <td className="num">{miles(r.cwlVida)} ★</td>
                        </tr>
                        <tr>
                          <td>🎁 {t('Donado de por vida')}</td>
                          <td className="num">{miles(r.donadoVida)}</td>
                        </tr>
                        <tr>
                          <td>🎮 {t('Juegos del clan')}</td>
                          <td className="num">{miles(r.juegosVida)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <p style={{ margin: '8px 0 0' }}>
                    {banderas(r).map((b) => (
                      <span key={b.txt} className={b.grave ? 'bandera grave' : 'bandera'}>
                        {b.txt}
                      </span>
                    ))}
                  </p>
                </>
              ) : (
                <p className="sub" style={{ marginTop: 8 }}>
                  {t('Sin ficha: no se pudo leer su perfil. Búscalo por el tag.')}
                </p>
              )}

              {s.respuestas?.cuenta && (
                <p className="sub" style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}>
                  💬 <i>{s.respuestas.cuenta}</i>
                </p>
              )}

              {s.estado === 'pendiente' && (
                <>
                  <select
                    className="campo"
                    value={clanDe[s.id] ?? ''}
                    onChange={(e) => setClanDe((c) => ({ ...c, [s.id]: e.target.value }))}
                  >
                    <option value="">{t('— a qué clan —')}</option>
                    {clanes.map((c) => (
                      <option key={c.clan_tag} value={c.clan_tag}>
                        {c.nombre}
                      </option>
                    ))}
                  </select>
                  <input
                    className="campo"
                    placeholder={t('Nota para los líderes (opcional)')}
                    value={notaDe[s.id] ?? ''}
                    onChange={(e) => setNotaDe((n) => ({ ...n, [s.id]: e.target.value }))}
                  />
                  <div className="grupo-pie">
                    <button
                      className={clanDe[s.id] ? 'accion' : 'fantasma'}
                      disabled={ocupado === s.id || !clanDe[s.id]}
                      onClick={() => decidir(s, 'aceptar')}
                    >
                      ✅ {t('Aceptar e invitar')}
                    </button>
                    <button
                      className="fantasma borrar"
                      disabled={ocupado === s.id}
                      onClick={() => decidir(s, 'rechazar')}
                    >
                      {t('Rechazar')}
                    </button>
                  </div>
                </>
              )}

              {s.estado === 'prueba' && (
                <>
                  <p className="sub" style={{ marginTop: 8 }}>
                    {t('Ya tiene el enlace. Rétalo a una amistosa y anota cómo atacó.')}
                  </p>
                  <div className="grupo-pie">
                    <button
                      className="accion"
                      disabled={ocupado === s.id}
                      onClick={() => decidir(s, 'confirmar', { pruebaOk: true })}
                    >
                      ✅ {t('Pasó la prueba')}
                    </button>
                    <button
                      className="fantasma borrar"
                      disabled={ocupado === s.id}
                      onClick={() => decidir(s, 'rechazar')}
                    >
                      {t('No dio la talla')}
                    </button>
                  </div>
                </>
              )}

              {s.nota && (
                <p className="sub" style={{ marginTop: 8 }}>
                  📝 {s.nota}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
