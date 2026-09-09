'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase, configurado } from '../lib/supabase';
import Alineacion from './alineacion';
import SelectorTema, { Mascota } from './temas';
import Clanes from './clanes';
import Bots from './bots';
import Bases from './bases';
import GrupoCWL from './grupo-cwl';
import Bonos from './bonos';
import Heraldo from './heraldo';
import Instalar from './instalar';
import { SelectorIdioma, useT } from './idioma';

const TABS = [
  ['resumen', 'Resumen'],
  ['alineacion', 'Lista CWL'],
  ['cwl', 'CWL Resultados'],
  ['jugadores', 'Jugadores'],
  ['mensajes', 'Mensajes'],
  ['bases', 'Bases'],
  ['bonos', 'Bonos'],
  ['bots', 'Bots'],
];

const temporadaActual = () => new Date().toISOString().slice(0, 7);
const fmt = (d) => (d ? new Date(d).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' }) : '—');

export default function Panel() {
  const t = useT();
  const [sesion, setSesion] = useState(undefined); // undefined = aun cargando
  const [tab, setTab] = useState('resumen');
  const [d, setD] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!configurado) return;
    supabase.auth.getSession().then(({ data }) => setSesion(data.session ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSesion(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const cargar = useCallback(async () => {
    setError('');
    try {
      const temporada = temporadaActual();

      const [clans, jobs, outbox, wa, seasons, alin, conf, packs, bases, bonos, plan, ligas] = await Promise.all([
        supabase.from('clans').select('*').order('orden').order('nombre'),
        supabase.from('job_runs').select('*').order('started_at', { ascending: false }).limit(60),
        supabase.from('outbox').select('*').order('creado_en', { ascending: false }).limit(30),
        supabase.from('wa_estado').select('*').eq('id', 1).maybeSingle(),
        supabase.from('cwl_seasons').select('*').eq('temporada', temporada),
        supabase.from('alineaciones').select('player_tag, clan_tag, posicion').eq('temporada', temporada),
        supabase.from('config').select('clave, valor'),
        supabase.from('base_packs').select('*').order('subido_en', { ascending: false }),
        supabase.from('bases').select('*').order('th', { ascending: false }),
        supabase.from('bonos').select('*').eq('temporada', temporada),
        supabase.from('premios_plan').select('*').order('orden'),
        // Cupos de ascenso y descenso por liga. Van en tabla y no en el
        // codigo porque Supercell los ha cambiado antes.
        supabase.from('cwl_ligas').select('*').order('orden'),
      ]);

      // Ultimo snapshot disponible; de ahi sale la foto de cada jugador.
      const { data: ultimo } = await supabase
        .from('snapshots')
        .select('fecha')
        .order('fecha', { ascending: false })
        .limit(1)
        .maybeSingle();

      let snaps = [];
      if (ultimo?.fecha) {
        const r = await supabase
          .from('snapshots')
          .select('player_tag, clan_tag, th_level, trofeos, liga, war_stars, donaciones, fecha')
          .eq('fecha', ultimo.fecha);
        snaps = r.data ?? [];
      }

      const { data: players } = await supabase.from('players').select('player_tag, nombre_actual, elegible_premios');

      const ids = (seasons.data ?? []).map((s) => s.id);
      let wars = [];
      let ataques = [];
      let roster = [];
      let grupo = [];
      if (ids.length) {
        // Todas las guerras del grupo, no solo las nuestras: son la tabla
        // de posiciones. Ver sql/015_cwl_grupo.sql.
        const gr = await supabase.from('cwl_grupo').select('*').in('season_id', ids).order('ronda');
        grupo = gr.data ?? [];
        const w = await supabase.from('cwl_wars').select('*').in('season_id', ids).order('ronda');
        wars = w.data ?? [];
        const warIds = wars.map((x) => x.id);

        // Filtrar por war_id EN LA CONSULTA, no en el navegador: Supabase
        // corta en 1000 filas por defecto, y traer el historico completo
        // empezaria a devolver datos incompletos en silencio a los pocos meses.
        if (warIds.length) {
          const [a, ro] = await Promise.all([
            supabase
              .from('cwl_attacks')
              .select('war_id, player_tag, estrellas, destruccion_pct')
              .in('war_id', warIds),
            supabase.from('cwl_roster').select('war_id, player_tag').in('war_id', warIds),
          ]);
          ataques = a.data ?? [];
          roster = ro.data ?? [];
        }
      }

      setD({
        clans: clans.data ?? [],
        jobs: jobs.data ?? [],
        outbox: outbox.data ?? [],
        wa: wa.data ?? null,
        temporada,
        // Sin esto no hay forma de saber de que clan es cada guerra: cwl_wars
        // solo guarda season_id.
        seasons: seasons.data ?? [],
        wars,
        ataques,
        roster,
        grupo,
        ligas: ligas.data ?? [],
        snaps,
        players: players ?? [],
        alineaciones: alin.data ?? [],
        config: conf.data ?? [],
        basePacks: packs.data ?? [],
        bases: bases.data ?? [],
        bonos: bonos.data ?? [],
        premiosPlan: plan.data ?? [],
        fechaSnap: ultimo?.fecha ?? null,
      });
    } catch (e) {
      setError(e.message ?? String(e));
    }
  }, []);

  useEffect(() => {
    if (sesion) cargar();
  }, [sesion, cargar]);

  // Sin Supabase esta pantalla no puede ser un callejon sin salida: siempre
  // tiene que ofrecer la vista de ejemplo, que funciona sin base de datos.
  if (!configurado) {
    return (
      <div className="wrap">
        <div className="login card" style={{ textAlign: 'center' }}>
          <Mascota ancho={150} />
          <h3>{t('Todavía no hay base de datos')}</h3>
          <p className="sub">
            {t('El panel real necesita Supabase conectado. Mientras tanto puedes recorrer todo con datos de ejemplo.')}
          </p>
          <a href="/demo" style={{ textDecoration: 'none', display: 'inline-block', marginTop: 12 }}>
            <button className="accion">{t('Ver la demo')}</button>
          </a>
          <p className="sub" style={{ marginTop: 16, fontSize: 12, opacity: 0.75 }}>
            {t('Para activarlo: define')} <code>NEXT_PUBLIC_SUPABASE_URL</code> y{' '}
            <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>.
          </p>
        </div>
      </div>
    );
  }
  if (sesion === undefined) return <div className="vacio">{t('Cargando…')}</div>;
  if (!sesion) return <Login />;

  return (
    <>
      <header className="top">
        <h1>Strange Godz Alliance · Management</h1>
        {/* Los controles van juntos en su propia caja. Antes eran hermanos
            sueltos del titulo y, cuando el titulo crecia -los temas Strange y
            Godz usan Cinzel, mas ancha que Lilita One-, se iban a una segunda
            linea y se pegaban a la IZQUIERDA. Agrupados y con margin-left
            auto quedan siempre a la derecha, envuelvan o no. */}
        <div className="acciones-top">
          <SelectorTema />
          <SelectorIdioma />
          <Instalar />
          <span className="correo">{sesion.user.email}</span>
          <button className="fantasma" onClick={() => supabase.auth.signOut()}>
            {t('Salir')}
          </button>
        </div>
      </header>

      <div className="wrap">
        <nav className="tabs">
          {TABS.map(([k, label]) => (
            <button key={k} data-on={tab === k ? '1' : '0'} onClick={() => setTab(k)}>
              {t(label)}
            </button>
          ))}
          <span style={{ flex: 1 }} />
          <button className="fantasma" onClick={cargar}>
            {t('Actualizar')}
          </button>
        </nav>

        {error && <p className="error">{t('Error: ')}{error}</p>}
        {!d && !error && <p className="vacio">{t('Cargando datos…')}</p>}

        {d && tab === 'resumen' && <Resumen d={d} recargar={cargar} />}
        {/* key: al cambiar de temporada se reinicia el estado local del tablero */}
        {d && tab === 'alineacion' && <Alineacion key={d.temporada} d={d} recargar={cargar} />}
        {d && tab === 'cwl' && (
          <>
            {/* Primero el grupo entero: es la pregunta del dia 4, "¿en que
                puesto vamos?". El detalle nuestro va debajo. */}
            <GrupoCWL d={d} />
            <CWL d={d} />
          </>
        )}
        {d && tab === 'jugadores' && <Jugadores d={d} />}
        {d && tab === 'mensajes' && <Mensajes d={d} recargar={cargar} />}
        {d && tab === 'bases' && <Bases d={d} recargar={cargar} />}
        {d && tab === 'bonos' && <Bonos d={d} recargar={cargar} />}
        {d && tab === 'bots' && <Bots d={d} recargar={cargar} />}
      </div>

      {/* Flotante sobre todo el panel: la pregunta llega cuando llega, no
          cuando estas en la pestana correcta. */}
      {d && <Heraldo d={d} nombreBot={d.config?.find((c) => c.clave === 'bot_nombre')?.valor ?? 'Heraldo'} />}
    </>
  );
}

// ---------------------------------------------------------------- Login
function Login() {
  const t = useT();
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [err, setErr] = useState('');
  const [cargando, setCargando] = useState(false);

  async function entrar(e) {
    e.preventDefault();
    setCargando(true);
    setErr('');
    const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
    if (error) setErr(error.message);
    setCargando(false);
  }

  return (
    <div className="wrap">
      <form className="login card" onSubmit={entrar}>
        <Mascota ancho={160} />
        <h3 style={{ textAlign: 'center' }}>Strange Godz Alliance</h3>
        <p className="sub" style={{ textAlign: 'center' }}>{t('Acceso solo para los líderes.')}</p>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, margin: '10px 0', flexWrap: 'wrap' }}>
          <SelectorTema />
          <SelectorIdioma />
        </div>
        <input
          type="email"
          placeholder={t('correo')}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
          required
        />
        <input
          type="password"
          placeholder={t('contraseña')}
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          autoComplete="current-password"
          required
        />
        <button className="accion" style={{ width: '100%', marginTop: 8 }} disabled={cargando}>
          {cargando ? t('Entrando…') : t('Entrar')}
        </button>
        {err && <p className="error">{err}</p>}
        {/* Tambien aca, no solo en la cabecera: en el telefono esta es la
            primera pantalla, y es el momento en que uno decide dejarla a mano.
            Despues de entrar, ya nadie va a buscar como instalarla. */}
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 14 }}>
          <Instalar />
        </div>
      </form>
    </div>
  );
}

// -------------------------------------------------------------- Resumen
export function Resumen({ d, demo = false, recargar }) {
  const t = useT();
  // Ultima corrida de cada job: asi se ve de un vistazo si algo dejo de correr.
  const ultimos = useMemo(() => {
    const m = new Map();
    for (const j of d.jobs) if (!m.has(j.job)) m.set(j.job, j);
    return [...m.values()];
  }, [d.jobs]);

  const pendientes = d.outbox.filter((m) => m.estado === 'pendiente').length;

  const miembros = d.snaps.length;

  return (
    <>
      {/* La mascota va sola arriba, no compitiendo con los clanes dentro de
          la misma grilla: mezcladas, no se entiende cual es cual. */}
      <div className="heroe">
        <Mascota ancho={168} redondo />
        <h2 className="heroe-nombre">Strange Godz Alliance</h2>
        <p className="heroe-sub">
          {d.clans.length} {d.clans.length === 1 ? t('clan') : t('clanes')}
          {miembros ? ` · ${miembros} ${t('miembros')}` : ''}
        </p>
      </div>

      <h2 className="sec">{t('Nuestros clanes')}</h2>
      <Clanes d={d} demo={demo} recargar={recargar} />

      <h2 className="sec">{t('Estado del sistema')}</h2>
      <div className="grid">
        <div className="card">
          <h3>{t('Mensajes por enviar')}</h3>
          <p className="big">{pendientes}</p>
          <p className="sub">{t('se copian desde la pestaña Mensajes')}</p>
        </div>
        <div className="card">
          <h3>{t('WhatsApp automático')}</h3>
          <p className="sub">
            {d.wa?.vinculado ? (
              <span className="pill ok">vinculado · {d.wa.numero ?? '?'}</span>
            ) : (
              <span className="pill aviso">{t('apagado')}</span>
            )}
          </p>
          <p className="sub" style={{ marginTop: 8 }}>
            {d.wa?.vinculado
              ? `último envío: ${fmt(d.wa.ultimo_ok)}`
              : t('Sin número secundario. El reporte se copia y se pega a mano.')}
          </p>
          {d.wa?.ultimo_error && <p className="error">{d.wa.ultimo_error}</p>}
        </div>
        <div className="card">
          <h3>{t('Último snapshot')}</h3>
          <p className="big" style={{ fontSize: 20 }}>{d.fechaSnap ?? '—'}</p>
          <p className="sub">{d.snaps.length} perfiles guardados</p>
        </div>
      </div>

      <h2 className="sec">{t('Últimas corridas')}</h2>
      <div className="tabla-scroll">
        <table>
          <thead>
            <tr>
              <th>Job</th>
              <th>{t('Cuándo')}</th>
              <th>{t('Estado')}</th>
              <th className="num">{t('Filas')}</th>
              <th>{t('Error')}</th>
            </tr>
          </thead>
          <tbody>
            {ultimos.map((j) => (
              <tr key={j.id}>
                <td>{j.job}</td>
                <td>{fmt(j.started_at)}</td>
                <td>
                  <span className={`pill ${j.ok === true ? 'ok' : j.ok === false ? 'mal' : 'aviso'}`}>
                    {j.ok === true ? 'ok' : j.ok === false ? 'falló' : 'corriendo'}
                  </span>
                </td>
                <td className="num">{j.filas ?? '—'}</td>
                <td style={{ color: 'var(--mal)', whiteSpace: 'normal' }}>{j.error ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!ultimos.length && <p className="vacio">{t('Todavía no corrió ningún job.')}</p>}
    </>
  );
}

// ------------------------------------------------------------------ CWL
export function CWL({ d }) {
  const t = useT();
  const nombre = useMemo(
    () => Object.fromEntries(d.players.map((p) => [p.player_tag, p.nombre_actual])),
    [d.players]
  );

  // Ataques fallados = estaba alineado y no atacó, en guerras ya cerradas.
  const fallados = useMemo(() => {
    const cerradas = new Set(d.wars.filter((w) => w.estado === 'warEnded').map((w) => w.id));
    const atacó = new Set(d.ataques.map((a) => `${a.war_id}|${a.player_tag}`));
    const cuenta = new Map();
    for (const r of d.roster) {
      if (!cerradas.has(r.war_id)) continue;
      if (atacó.has(`${r.war_id}|${r.player_tag}`)) continue;
      cuenta.set(r.player_tag, (cuenta.get(r.player_tag) ?? 0) + 1);
    }
    return [...cuenta.entries()].sort((a, b) => b[1] - a[1]);
  }, [d.wars, d.ataques, d.roster]);

  const estrellas = useMemo(() => {
    const m = new Map();
    for (const a of d.ataques) {
      const p = m.get(a.player_tag) ?? { e: 0, n: 0, dest: 0 };
      p.e += a.estrellas ?? 0;
      p.dest += Number(a.destruccion_pct ?? 0);
      p.n += 1;
      m.set(a.player_tag, p);
    }
    return [...m.entries()]
      .map(([tag, v]) => ({ tag, ...v, prom: v.n ? v.dest / v.n : 0 }))
      .sort((a, b) => b.e - a.e || b.prom - a.prom);
  }, [d.ataques]);

  // Resumen por clan. Cada temporada de CWL es de UN clan, asi que la tabla
  // de rondas mezcla los tres sin decirlo; esto los separa.
  const porClan = useMemo(() => {
    const clanDeSeason = Object.fromEntries((d.seasons ?? []).map((s) => [s.id, s.clan_tag]));
    const ligaDe = Object.fromEntries((d.seasons ?? []).map((s) => [s.id, s.liga]));
    const nombreClan = Object.fromEntries((d.clans ?? []).map((c) => [c.clan_tag, c.nombre]));
    const clanDeWar = Object.fromEntries(d.wars.map((w) => [w.id, clanDeSeason[w.season_id]]));

    const acc = {};
    const toca = (clan) =>
      (acc[clan] ??= {
        clan,
        nombre: nombreClan[clan] ?? clan,
        liga: null,
        rondas: 0,
        cerradas: 0,
        estrellas: 0,
        rival: 0,
        usados: 0,
        alineados: 0,
      });

    for (const w of d.wars) {
      const c = clanDeWar[w.id];
      if (!c) continue;
      const a = toca(c);
      a.liga ??= ligaDe[w.season_id];
      a.rondas += 1;
      if (w.estado === 'warEnded') {
        a.cerradas += 1;
        a.estrellas += w.estrellas_nuestras ?? 0;
        a.rival += w.estrellas_rival ?? 0;
      }
    }
    const cerradas = new Set(d.wars.filter((w) => w.estado === 'warEnded').map((w) => w.id));
    for (const r of d.roster) if (cerradas.has(r.war_id) && clanDeWar[r.war_id]) toca(clanDeWar[r.war_id]).alineados += 1;
    for (const x of d.ataques) if (cerradas.has(x.war_id) && clanDeWar[x.war_id]) toca(clanDeWar[x.war_id]).usados += 1;

    return Object.values(acc).sort((a, b) => b.estrellas - a.estrellas);
  }, [d.seasons, d.wars, d.roster, d.ataques, d.clans]);

  if (!d.wars.length) {
    return <p className="vacio">Sin datos de CWL para {d.temporada}. Corre el job <code>cwl:sync</code>.</p>;
  }

  return (
    <>
      <h2 className="sec">{t('Por clan')} · {t('temporada')} {d.temporada}</h2>
      <div className="tabla-scroll">
        <table>
          <thead>
            <tr>
              <th>{t('Clan')}</th>
              <th>{t('Liga')}</th>
              <th className="num">{t('Rondas')}</th>
              <th className="num">{t('Estrellas')}</th>
              <th className="num">{t('Rival')}</th>
              <th className="num">{t('Ataques')}</th>
              <th className="num">{t('Sin usar')}</th>
            </tr>
          </thead>
          <tbody>
            {porClan.map((c) => (
              <tr key={c.clan}>
                <td>{c.nombre}</td>
                <td className="sub">{c.liga ?? '—'}</td>
                <td className="num">{c.cerradas}/{c.rondas}</td>
                <td className="num">{c.estrellas}</td>
                <td className="num">{c.rival}</td>
                <td className="num">{c.usados}/{c.alineados}</td>
                <td className={c.alineados - c.usados > 0 ? 'num mal' : 'num'}>
                  {c.alineados - c.usados}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="sec">Rondas · temporada {d.temporada}</h2>
      <div className="tabla-scroll">
        <table>
          <thead>
            <tr>
              <th className="num">{t('Ronda')}</th>
              <th>{t('Rival')}</th>
              <th className="num">{t('Nosotros')}</th>
              <th className="num">{t('Ellos')}</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {d.wars.map((w) => (
              <tr key={w.id}>
                <td className="num">{w.ronda}</td>
                <td>{w.clan_rival_nombre ?? '—'}</td>
                <td className="num">{w.estrellas_nuestras ?? '—'}</td>
                <td className="num">{w.estrellas_rival ?? '—'}</td>
                <td>
                  <span className={`pill ${w.estado === 'warEnded' ? 'ok' : 'aviso'}`}>{w.estado}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="sec">{t('Tabla de estrellas')}</h2>
      <div className="tabla-scroll">
        <table>
          <thead>
            <tr>
              <th className="num">#</th>
              <th>{t('Jugador')}</th>
              <th className="num">{t('Estrellas')}</th>
              <th className="num">{t('Ataques')}</th>
              <th className="num">% destr. prom</th>
            </tr>
          </thead>
          <tbody>
            {estrellas.map((p, i) => (
              <tr key={p.tag}>
                <td className="num">{i + 1}</td>
                <td>{nombre[p.tag] ?? p.tag}</td>
                <td className="num">{p.e}</td>
                <td className="num">{p.n}</td>
                <td className="num">{p.prom.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="sec">{t('Ataques sin usar (guerras cerradas)')}</h2>
      {fallados.length ? (
        <div className="tabla-scroll">
          <table>
            <thead>
              <tr>
                <th>{t('Jugador')}</th>
                <th className="num">{t('Fallados')}</th>
              </tr>
            </thead>
            <tbody>
              {fallados.map(([tag, n]) => (
                <tr key={tag}>
                  <td>{nombre[tag] ?? tag}</td>
                  <td className="num" style={{ color: 'var(--mal)' }}>{n}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="vacio">{t('Nadie falló ataques.')} </p>
      )}
    </>
  );
}

// ------------------------------------------------------------ Jugadores
export function Jugadores({ d }) {
  const t = useT();
  const [q, setQ] = useState('');
  const nombre = useMemo(
    () => Object.fromEntries(d.players.map((p) => [p.player_tag, p.nombre_actual])),
    [d.players]
  );
  const clanDe = useMemo(
    () => Object.fromEntries(d.clans.map((c) => [c.clan_tag, `${c.nombre} (${c.escuadra})`])),
    [d.clans]
  );

  const filas = useMemo(() => {
    const t = q.trim().toLowerCase();
    return d.snaps
      .map((s) => ({ ...s, nombre: nombre[s.player_tag] ?? s.player_tag }))
      .filter((s) => !t || s.nombre.toLowerCase().includes(t) || s.player_tag.toLowerCase().includes(t))
      .sort((a, b) => (b.trofeos ?? 0) - (a.trofeos ?? 0));
  }, [d.snaps, nombre, q]);

  if (!d.snaps.length) return <p className="vacio">{t('Sin snapshots todavía. Corre')} <code>npm run snapshot</code>.</p>;

  return (
    <>
      <input
        placeholder={t('Buscar jugador…')}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        style={{
          width: '100%', maxWidth: 320, padding: '9px 12px', borderRadius: 8,
          border: '1px solid var(--borde)', background: 'var(--panel)', color: 'var(--texto)',
        }}
      />
      <p className="sub" style={{ color: 'var(--tenue)', fontSize: 13 }}>
        {filas.length} jugadores · foto del {d.fechaSnap}
      </p>
      <div className="tabla-scroll">
        <table>
          <thead>
            <tr>
              <th>{t('Jugador')}</th>
              <th>{t('Clan')}</th>
              <th className="num">TH</th>
              <th className="num">{t('Trofeos')}</th>
              <th>{t('Liga')}</th>
              <th className="num">{t('Estrellas guerra')}</th>
              <th className="num">{t('Donaciones')}</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((s) => (
              <tr key={s.player_tag}>
                <td>{s.nombre}</td>
                <td>{clanDe[s.clan_tag] ?? '—'}</td>
                <td className="num">{s.th_level ?? '—'}</td>
                <td className="num">{s.trofeos ?? '—'}</td>
                <td>{s.liga ?? '—'}</td>
                <td className="num">{s.war_stars ?? '—'}</td>
                <td className="num">{s.donaciones ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ------------------------------------------------------------- Mensajes
export function Mensajes({ d, recargar }) {
  const t = useT();
  const [copiado, setCopiado] = useState(null);

  async function copiar(m) {
    try {
      await navigator.clipboard.writeText(m.cuerpo);
      setCopiado(m.id);
      setTimeout(() => setCopiado(null), 2000);
      // Queda constancia de que ya se compartio, para no repetirlo.
      if (m.estado === 'pendiente') {
        await supabase.from('outbox').update({ estado: 'copiado', enviado_en: new Date().toISOString() }).eq('id', m.id);
        recargar();
      }
    } catch {
      setCopiado(-1);
    }
  }

  if (!d.outbox.length) return <p className="vacio">{t('No hay mensajes generados todavía.')}</p>;

  return (
    <>
      <p className="sub" style={{ color: 'var(--tenue)' }}>
        {t('Copia y pega en el grupo del clan. Al copiar, el mensaje se marca como compartido.')}
      </p>
      {d.outbox.map((m) => (
        <div className="card" key={m.id} style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <strong>{m.tipo}</strong>
            <span className={`pill ${m.estado === 'enviado' || m.estado === 'copiado' ? 'ok' : m.estado === 'fallido' ? 'mal' : 'aviso'}`}>
              {m.estado}
            </span>
            <span className="sub" style={{ color: 'var(--tenue)', fontSize: 12 }}>{fmt(m.creado_en)}</span>
            <span style={{ flex: 1 }} />
            <button className="accion" onClick={() => copiar(m)}>
              {copiado === m.id ? '¡Copiado!' : copiado === -1 ? 'Error' : 'Copiar'}
            </button>
          </div>
          <pre className="msg">{m.cuerpo}</pre>
          {m.error && <p className="error">{m.error}</p>}
        </div>
      ))}
    </>
  );
}
