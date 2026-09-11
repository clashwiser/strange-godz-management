'use client';

// Heraldo dentro del panel: una ventanita para preguntarle sin salir a
// Telegram.
//
// Los DATOS los contesta de la base, aqui mismo, sin red: quien no ha
// atacado, cuantas estrellas lleva cada uno, como va el reparto. Es lo que
// mas preguntan Carlos y Deibis, y asi no se inventa nada.
//
// Lo demas va a /api/asistente: el cerebro de frases de Heraldo y, detras,
// la misma IA gratis que usa en Telegram (web/lib/pensar.js), sabiendo que
// esta en el panel. Las preguntas del juego -que ejercito, que trae la
// actualizacion- van con busqueda web. Durante meses no hubo modelo aqui
// porque la restriccion es $0 reales; Groq lo dio gratis con limite.

import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useT } from './idioma';
import { esPreguntaDelJuego } from '../lib/conocimiento';

const SIN = '__sin__';

/** Quita acentos y mayusculas para comparar lo que escribio la persona. */
const plano = (s) =>
  String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** "Buenos días", "Buenas tardes" o "Buenas noches" segun la hora local. */
function saludoDelDia(h = new Date().getHours()) {
  if (h >= 6 && h < 12) return 'Buenos días';
  if (h >= 12 && h < 20) return 'Buenas tardes';
  return 'Buenas noches';
}

const SALUDO = /^(hola|holaa+|buenas|buenos dias|buenas tardes|buenas noches|buen dia|hey|ey|oye|que bola|que tal|saludos|hi|hello)\b/;

export default function Heraldo({ d, nombreBot = 'Cerebro' }) {
  const t = useT();
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState('');
  const [hilo, setHilo] = useState([]);
  const finRef = useRef(null);

  // Quien esta al otro lado: su nombre en dashboard_users (Cris, Carlos,
  // Deibis). Cada uno puede leer su propia fila (sql/002_rls.sql). Si no
  // hay fila, lo que va antes de la arroba del correo.
  const [usuario, setUsuario] = useState(null);
  // El estado del sistema, para que conteste "¿como estas?" con datos. Se
  // pide una vez, al abrir, y solo si hay sesion (la ruta es de lideres).
  const [estado, setEstado] = useState('');
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const { data: sesion } = await supabase.auth.getSession();
        const u = sesion?.session?.user;
        if (!u) return;
        const { data: fila } = await supabase.from('dashboard_users').select('nombre').eq('user_id', u.id).maybeSingle();
        if (vivo) setUsuario(fila?.nombre || u.email?.split('@')[0] || null);
      } catch {
        /* sin nombre, saluda sin el */
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);

  // Al abrir, saluda el: con el nombre y la hora del dia. Una vez por
  // conversacion.
  function abrir() {
    setAbierto(true);
    setHilo((h) =>
      h.length
        ? h
        : [{ yo: false, texto: `🧠 ${saludoDelDia()}${usuario ? `, ${usuario}` : ''}. ${t('Soy el cerebro del OS. ¿Qué necesitas?')}` }]
    );
    if (!estado) {
      (async () => {
        try {
          const { data: sesion } = await supabase.auth.getSession();
          if (!sesion?.session) return;
          const r = await fetch('/api/cerebro', { headers: { Authorization: `Bearer ${sesion.session.access_token}` } });
          const j = await r.json().catch(() => ({}));
          if (j?.ok && j.resumen) setEstado(j.resumen);
        } catch {
          /* sin estado, contesta igual */
        }
      })();
    }
  }

  const nombre = useMemo(
    () => Object.fromEntries((d.players ?? []).map((p) => [p.player_tag, p.nombre_actual])),
    [d.players]
  );
  const clanNombre = useMemo(
    () => Object.fromEntries((d.clans ?? []).map((c) => [c.clan_tag, c.nombre])),
    [d.clans]
  );

  useEffect(() => {
    if (abierto) finRef.current?.scrollIntoView({ block: 'end' });
  }, [hilo, abierto]);

  // ---- Las respuestas, todas sacadas de lo que ya esta cargado ----

  function quienFalta() {
    const cerradas = new Set(d.wars.filter((w) => w.estado === 'warEnded').map((w) => w.id));
    const atacó = new Set(d.ataques.map((a) => `${a.war_id}|${a.player_tag}`));
    const cuenta = new Map();
    for (const r of d.roster) {
      if (!cerradas.has(r.war_id) || atacó.has(`${r.war_id}|${r.player_tag}`)) continue;
      cuenta.set(r.player_tag, (cuenta.get(r.player_tag) ?? 0) + 1);
    }
    if (!cuenta.size) return t('Nadie falló ataques en las rondas cerradas.');
    return (
      t('Ataques sin usar en rondas cerradas:') +
      '\n' +
      [...cuenta.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([tag, n]) => `• ${nombre[tag] ?? tag} — ${n}`)
        .join('\n')
    );
  }

  function tablaEstrellas(limite = 8) {
    const m = new Map();
    for (const a of d.ataques) {
      const p = m.get(a.player_tag) ?? { e: 0, n: 0 };
      p.e += a.estrellas ?? 0;
      p.n += 1;
      m.set(a.player_tag, p);
    }
    if (!m.size) return t('Todavía no hay ataques de CWL guardados.');
    return (
      t('Estrellas de la temporada:') +
      '\n' +
      [...m.entries()]
        .sort((a, b) => b[1].e - a[1].e)
        .slice(0, limite)
        .map(([tag, v], i) => `${i + 1}. ${nombre[tag] ?? tag} — ${v.e}★ en ${v.n}`)
        .join('\n')
    );
  }

  function fichaDe(consulta) {
    const q = plano(consulta);
    const hallado = (d.players ?? []).filter((p) => plano(p.nombre_actual).includes(q));
    if (!hallado.length) return t('No encuentro a nadie con ese nombre.');
    if (hallado.length > 5) return t('Ese nombre coincide con demasiados. Sé más específico.');

    return hallado
      .map((p) => {
        const s = (d.snaps ?? []).find((x) => x.player_tag === p.player_tag);
        const mios = d.ataques.filter((a) => a.player_tag === p.player_tag);
        const est = mios.reduce((a, x) => a + (x.estrellas ?? 0), 0);
        return (
          `${p.nombre_actual}  ${p.player_tag}\n` +
          (s ? `  ${clanNombre[s.clan_tag] ?? s.clan_tag} · TH${s.th_level} · ${s.trofeos}🏆 · ${s.liga ?? '—'}\n` : '') +
          `  ${t('CWL')}: ${est}★ ${t('en')} ${mios.length} ${t('ataques')}`
        );
      })
      .join('\n\n');
  }

  function reparto() {
    const plan = (d.premiosPlan ?? []).filter((p) => p.activo !== false);
    if (!plan.length) return t('No hay premios cargados para este mes.');
    const total = plan.reduce((a, p) => a + Number(p.monto_usd ?? 0), 0);
    return (
      t('Premios de este mes:') +
      '\n' +
      plan.map((p) => `• ${p.titulo} — $${p.monto_usd}`).join('\n') +
      `\n\n${t('Total')}: $${total}`
    );
  }

  function alineacionActual() {
    const porClan = {};
    for (const a of d.alineaciones ?? []) (porClan[a.clan_tag] ??= []).push(a.player_tag);
    const ent = Object.entries(porClan);
    if (!ent.length) return t('Todavía no hay nadie asignado a la CWL.');
    return ent
      .map(([clan, tags]) => `${clanNombre[clan] ?? clan} (${tags.length})\n` + tags.map((x) => `  ${nombre[x] ?? x}`).join('\n'))
      .join('\n\n');
  }

  const AYUDA = [
    ['faltan', t('quién no ha atacado')],
    ['estrellas', t('tabla de estrellas')],
    ['jugador <nombre>', t('ficha de alguien')],
    ['premios', t('el reparto del mes')],
    ['alineación', t('quién va en cada clan')],
  ];

  /**
   * Lo que se contesta de la base, al instante y sin red: un enrutador de
   * palabras clave sobre datos que ya estan cargados. Devuelve null si no
   * es un dato, y entonces se pregunta al servidor.
   */
  function responder(entrada) {
    const q = plano(entrada).trim();
    if (!q) return null;

    // Un saludo se contesta aqui, con nombre, al instante. Va ANTES de la
    // ficha por nombre suelto: hay un jugador del clan que se llama "hola",
    // y "hola" devolvia su ficha con el tag.
    if (SALUDO.test(q) && q.length <= 24) {
      return `${saludoDelDia()}${usuario ? `, ${usuario}` : ''}. ${t('¿Cómo te puedo ayudar?')}`;
    }

    // Los patrones son deliberadamente laxos porque la gente no escribe
    // comandos, escribe frases: "quien no ha atacado" no casaba con "no
    // ataco" por el "ha" de en medio. Se corta en la raiz del verbo.
    if (/(falta|sin atacar|no\s+(ha\s+|han\s+)?atac|quien debe|pendiente)/.test(q)) return quienFalta();
    // "mejor" a secas no: "cual es el mejor ejercito" no pide la tabla.
    if (/(estrella|tabla|ranking|quien va gan|quien (es|va) (el )?mejor|los mejores)/.test(q)) return tablaEstrellas();
    if (/(premio|reparto|dinero|plata|bono|cuanto se pag)/.test(q)) return reparto();
    if (/(alineacion|lista cwl|quien juega|escuadra|quien va en)/.test(q)) return alineacionActual();

    const m = /(?:jugador|ficha|quien es)\s+(.+)/.exec(q);
    if (m) return fichaDe(m[1]);

    // Un nombre suelto tambien vale: es lo que la gente escribe de verdad.
    // Pero solo si parece un nombre -corto, sin signos de pregunta- y casa
    // con el principio de un nombre real: "hola" o "que" no son consultas.
    const pareceNombre = q.length >= 4 && q.length <= 30 && !/[?¿]/.test(q) && q.split(' ').length <= 3;
    const suelto = pareceNombre && (d.players ?? []).some((p) => plano(p.nombre_actual).startsWith(q));
    if (suelto) return fichaDe(q);

    // Nada de la base: que lo intente el servidor (frases, y luego la IA).
    return null;
  }

  const sinRespuesta = () =>
    t('No entendí. Puedo responder a:') + '\n' + AYUDA.map(([c, q2]) => `• ${c} — ${q2}`).join('\n');

  /** Lo que la base no sabe: frases de Heraldo y, detras, la IA. */
  async function preguntarAlServidor(pregunta) {
    try {
      const { data: sesion } = await supabase.auth.getSession();
      const r = await fetch('/api/asistente', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sesion?.session?.access_token}` },
        // Con el estado del sistema delante, salvo si preguntan por el
        // juego: ahi hace falta el digesto y la web, no los vitales.
        body: JSON.stringify({ pregunta, contexto: esPreguntaDelJuego(pregunta) ? '' : estado }),
      });
      const j = await r.json().catch(() => ({}));
      return j?.respuesta || sinRespuesta();
    } catch {
      return sinRespuesta();
    }
  }

  async function enviar(e) {
    e.preventDefault();
    const pregunta = texto.trim();
    if (!pregunta) return;
    setTexto('');
    const local = responder(pregunta);
    if (local) {
      setHilo((h) => [...h, { yo: true, texto: pregunta }, { yo: false, texto: local }]);
      return;
    }
    // Mientras piensa, un mensaje de espera que despues se cambia por la
    // respuesta: con busqueda web son varios segundos.
    const id = Date.now();
    setHilo((h) => [...h, { yo: true, texto: pregunta }, { yo: false, id, texto: t('Déjame ver…'), pensando: true }]);
    const respuesta = await preguntarAlServidor(pregunta);
    setHilo((h) => h.map((m) => (m.id === id ? { yo: false, texto: respuesta } : m)));
  }

  if (!abierto) {
    return (
      <button className="heraldo-burbuja cerebro-burbuja" onClick={abrir} title={nombreBot}>
        {/* El cerebro del OS: el mismo bucle de 15 s del laboratorio,
            recortado a la cabeza (parpadea, sube las cejas, el cerebro
            late), con un anillo de electricidad (CSS). 268 KB. */}
        <span className="cerebro-anillo" aria-hidden="true" />
        <VideoQueArranca src="/cerebro-mini.mp4" poster="/cerebro-mini.jpg" tamano={84} />
      </button>
    );
  }

  return (
    <div className="heraldo cerebro-panel">
      <div className="heraldo-cab">
        {/* Video y no imagen, pero SOLO aca dentro: este nodo existe nada mas
            con el panel abierto, asi que el clip no se descarga hasta que
            alguien va a mirarlo. En la burbuja iria animandose todo el rato
            en una esquina, gastando datos de gente que paga el megabyte.

            poster: mientras carga se ve la imagen fija en vez de un hueco
            negro. Y si el video no carga -o el navegador no lo reproduce
            solo-, lo que queda es la imagen, que es exactamente lo que
            habia antes. */}
        <span className="cerebro-cara-cab" aria-hidden="true">
          <span className="cerebro-anillo" />
          <video className="cerebro-mini" src="/cerebro-mini.mp4" poster="/cerebro-mini.jpg" autoPlay loop muted playsInline preload="none" />
        </span>
        <strong>🧠 {nombreBot}</strong>
        <span className="sub">{t('los datos, de la base; lo demás, con IA')}</span>
        <span style={{ flex: 1 }} />
        <button className="fantasma" onClick={() => setAbierto(false)}>
          ✕
        </button>
      </div>

      <div className="heraldo-hilo">
        {!hilo.length && (
          <div className="heraldo-msg">
            {t('Pregúntame. Por ejemplo:')}
            {'\n'}
            {AYUDA.map(([c, q]) => `• ${c} — ${q}`).join('\n')}
          </div>
        )}
        {hilo.map((m, i) => (
          <div key={m.id ?? i} className={`heraldo-msg${m.yo ? ' yo' : ''}${m.pensando ? ' pensando' : ''}`}>
            {m.texto}
          </div>
        ))}
        <div ref={finRef} />
      </div>

      <form className="heraldo-pie" onSubmit={enviar}>
        <input
          className="campo"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={t('¿quién no ha atacado?')}
          autoComplete="off"
        />
        <button className="accion" type="submit">
          {t('Enviar')}
        </button>
      </form>
    </div>
  );
}

/**
 * Un video en bucle, mudo, que arranca solo. `autoPlay` a secas no basta:
 * en la burbuja el video existe desde que carga la pagina, sin que nadie
 * haya tocado nada, y el navegador lo deja en pausa aunque este mudo. Se
 * le pide play() al montar y, si lo niega, otra vez al primer toque en la
 * pagina. Dentro del chat no hacia falta porque el chat se abre con un
 * clic, que ya cuenta como gesto.
 */
function VideoQueArranca({ src, poster, tamano }) {
  const ref = useRef(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.muted = true;
    const intentar = () => v.play().catch(() => {});
    intentar();
    const alTocar = () => {
      intentar();
      document.removeEventListener('pointerdown', alTocar);
    };
    document.addEventListener('pointerdown', alTocar);
    return () => document.removeEventListener('pointerdown', alTocar);
  }, []);
  return (
    <video
      ref={ref}
      className="heraldo-cara heraldo-video"
      src={src}
      poster={poster}
      width={tamano}
      height={tamano}
      autoPlay
      loop
      muted
      playsInline
      preload="auto"
      aria-hidden="true"
    />
  );
}
