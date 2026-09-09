'use client';

// Heraldo dentro del panel: una ventanita para preguntarle sin salir a
// Telegram.
//
// NO usa ningun modelo de lenguaje, y eso es una decision, no una carencia.
// Conectarlo a la API de Claude costaria entre 20 y 60 dolares al mes con
// tres personas a 20 mensajes diarios — mas que Vercel Pro, que se descarto
// justamente por eso. La restriccion del proyecto es $0 reales.
//
// A cambio responde de la BASE, que es donde estan las respuestas de verdad:
// quien no ha atacado, cuantas estrellas lleva cada uno, como va el reparto.
// No conversa, pero tampoco se inventa nada — y el 90% de lo que Carlos y
// Deibis preguntan son datos, no opiniones.
//
// Si algun dia hay presupuesto, el sitio donde enchufar un modelo es
// `responder()`: recibe el texto y devuelve la respuesta.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useT } from './idioma';

const SIN = '__sin__';

/** Quita acentos y mayusculas para comparar lo que escribio la persona. */
const plano = (s) =>
  String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export default function Heraldo({ d, nombreBot = 'Heraldo' }) {
  const t = useT();
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState('');
  const [hilo, setHilo] = useState([]);
  const finRef = useRef(null);

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
   * Aqui es donde se enchufaria un modelo el dia que haya presupuesto.
   * Hoy es un enrutador de palabras clave sobre datos que ya estan cargados,
   * asi que responde al instante y sin red.
   */
  function responder(entrada) {
    const q = plano(entrada);
    if (!q) return null;

    // Los patrones son deliberadamente laxos porque la gente no escribe
    // comandos, escribe frases: "quien no ha atacado" no casaba con "no
    // ataco" por el "ha" de en medio. Se corta en la raiz del verbo.
    if (/(falta|sin atacar|no\s+(ha\s+|han\s+)?atac|quien debe|pendiente)/.test(q)) return quienFalta();
    if (/(estrella|tabla|ranking|quien va gan|mejor)/.test(q)) return tablaEstrellas();
    if (/(premio|reparto|dinero|plata|bono|cuanto se pag)/.test(q)) return reparto();
    if (/(alineacion|lista cwl|quien juega|escuadra|quien va en)/.test(q)) return alineacionActual();

    const m = /(?:jugador|ficha|quien es)\s+(.+)/.exec(q);
    if (m) return fichaDe(m[1]);

    // Un nombre suelto tambien vale: es lo que la gente escribe de verdad.
    const suelto = (d.players ?? []).some((p) => plano(p.nombre_actual).includes(q));
    if (suelto) return fichaDe(q);

    return (
      t('No entendí. Puedo responder a:') +
      '\n' +
      AYUDA.map(([c, q2]) => `• ${c} — ${q2}`).join('\n')
    );
  }

  function enviar(e) {
    e.preventDefault();
    const pregunta = texto.trim();
    if (!pregunta) return;
    setHilo((h) => [...h, { yo: true, texto: pregunta }, { yo: false, texto: responder(pregunta) }]);
    setTexto('');
  }

  if (!abierto) {
    return (
      <button className="heraldo-burbuja" onClick={() => setAbierto(true)} title={nombreBot}>
        🛡️
      </button>
    );
  }

  return (
    <div className="heraldo">
      <div className="heraldo-cab">
        <strong>{nombreBot}</strong>
        <span className="sub">{t('responde de la base, sin inventar')}</span>
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
          <div key={i} className={m.yo ? 'heraldo-msg yo' : 'heraldo-msg'}>
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
