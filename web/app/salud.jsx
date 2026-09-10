'use client';

// Salud del clan: quien tira del carro y quien se cuelga.
//
// El resto del panel cuenta COMO VA LA GUERRA. Esto cuenta QUIEN esta
// respondiendo, que es lo que un lider mira todos los dias y hasta ahora
// no estaba en ningun sitio, aunque el dato llevaba guardandose desde el
// primer snapshot.
//
// La primera version pintaba de amarillo a los 22 que no donan y ya. Con
// los numeros reales delante eso no servia: mete en el mismo saco dos
// cosas que no se parecen en nada.
//
//   刺猬RH♦️   dona 0, recibe 178  -> se lleva tropas y no devuelve
//   LIO D10S  dona 0, recibe 0    -> sencillamente no esta jugando
//
// Al primero le hablas. Al segundo lo pingueas o lo sacas. Un solo color
// para los dos obliga a abrir 22 perfiles a mano, que es justo el trabajo
// que esta pantalla venia a quitar.
//
// El caso que ninguna version anterior veia: Anabolic Batman dona 270
// -esfuerzo real- pero recibe 1776. Sale verde si solo se miran
// donaciones, y es el que mas desequilibra el clan.
//
// Olympus y Cuban Pirates son clanes de trofeos: dos miembros y cero
// donaciones es como estan pensados. Medirlos con la vara de x300 los
// pintaria en rojo todos los dias y esta pantalla acabaria ignorandose
// entera, que es la unica forma de que un semaforo deje de servir.

import { useMemo, useState } from 'react';
import { useT } from './idioma';

// Cuanto hay que haber pedido para que "no devolver" signifique algo, y
// por debajo de que fraccion se considera que no devuelve. Con 100 y 0.2
// salen cinco personas de cincuenta y nueve: pocas y todas de verdad.
// Mas flojo empieza a marcar gente normal -en Clash es corriente recibir
// mas de lo que se da- y el rojo deja de avisar de nada.
const PIDE_MINIMO = 100;
const DEVUELVE_MINIMO = 0.2;

const ORDENES = [
  ['problema', 'Primero los problemas'],
  ['deuda', 'Más debe al clan'],
  ['donaciones', 'Menos donaciones'],
  ['fallados', 'Más ataques fallados'],
  ['nombre', 'Por nombre'],
];

export default function Salud({ d }) {
  const t = useT();
  const [clanSel, setClanSel] = useState('todos');
  const [orden, setOrden] = useState('problema');
  const [soloProblemas, setSoloProblemas] = useState(false);

  const clanInfo = useMemo(
    () => Object.fromEntries((d.clans ?? []).map((c) => [c.clan_tag, c])),
    [d.clans]
  );
  const nombre = useMemo(
    () => Object.fromEntries((d.players ?? []).map((p) => [p.player_tag, p.nombre_actual])),
    [d.players]
  );

  // Hay cuentas distintas con el mismo nombre -dos "Shaun" en x300, dos
  // "Devorador"-. Sin el tag al lado, la fila roja se le cuelga al hermano
  // equivocado.
  const repetidos = useMemo(() => {
    const veces = {};
    for (const p of d.players ?? []) veces[p.nombre_actual] = (veces[p.nombre_actual] ?? 0) + 1;
    return new Set(Object.keys(veces).filter((n) => veces[n] > 1));
  }, [d.players]);

  const gente = useMemo(() => {
    // Ataques de CWL: los usados contra los que le tocaban por roster, y
    // solo de rondas ya cerradas: en una ronda en curso todavia le queda
    // tiempo para atacar.
    const cerradas = new Set((d.wars ?? []).filter((w) => w.estado === 'warEnded').map((w) => w.id));
    const usados = new Map();
    for (const a of d.ataques ?? []) {
      if (!cerradas.has(a.war_id)) continue;
      usados.set(a.player_tag, (usados.get(a.player_tag) ?? 0) + 1);
    }
    const tocaban = new Map();
    for (const r of d.roster ?? []) {
      if (!cerradas.has(r.war_id)) continue;
      tocaban.set(r.player_tag, (tocaban.get(r.player_tag) ?? 0) + 1);
    }

    return (d.snaps ?? []).map((s) => {
      const clan = clanInfo[s.clan_tag];
      const deVitrina = clan?.proposito === 'trofeos';
      const dona = s.donaciones ?? 0;
      const recibe = s.donaciones_recibidas ?? 0;
      const disp = tocaban.get(s.player_tag) ?? 0;
      const uso = usados.get(s.player_tag) ?? 0;
      const fallados = Math.max(0, disp - uso);

      // Banderas en vez de un color solo: el lider necesita saber POR QUE
      // esta marcado, porque cada motivo se arregla de una forma distinta.
      const banderas = [];
      if (!deVitrina) {
        if (recibe >= PIDE_MINIMO && dona < recibe * DEVUELVE_MINIMO) {
          banderas.push({ clave: 'pide y no da', grave: true });
        } else if (dona === 0) {
          // Donar cero no dice nada por si solo. Si ademas no pidio nada y
          // no piso la CWL, es que no esta jugando; si jugo las siete
          // rondas, esta ahi y lo que falta es que suelte tropas.
          banderas.push({ clave: disp === 0 && recibe === 0 ? 'sin señales' : 'no dona', grave: false });
        }
      }
      // Un fallo suelto en siete rondas le pasa a cualquiera; dos ya es un
      // patron. Por eso solo el segundo pone la fila en rojo.
      if (fallados > 0) banderas.push({ clave: 'falló', num: fallados, grave: fallados >= 2 });

      const estado = banderas.some((b) => b.grave) ? 'mal' : banderas.length ? 'aviso' : 'ok';

      return {
        tag: s.player_tag,
        nombre: nombre[s.player_tag] ?? s.player_tag,
        duplicado: repetidos.has(nombre[s.player_tag]),
        clan: clan?.nombre ?? s.clan_tag,
        deVitrina,
        th: s.th_level,
        dona,
        recibe,
        // Lo que se ha llevado por encima de lo que ha puesto. Es el numero
        // que ordena de verdad: 270/1776 pesa mas que 0/0.
        deuda: Math.max(0, recibe - dona),
        uso,
        disp,
        fallados,
        banderas,
        estado,
      };
    });
  }, [d.snaps, d.ataques, d.roster, d.wars, clanInfo, nombre, repetidos]);

  const filtrada = useMemo(() => {
    const peso = { mal: 0, aviso: 1, ok: 2 };
    return gente
      .filter((g) => clanSel === 'todos' || g.clan === clanSel)
      .filter((g) => !soloProblemas || g.estado !== 'ok')
      .sort((a, b) => {
        if (orden === 'deuda') return b.deuda - a.deuda;
        if (orden === 'donaciones') return a.dona - b.dona;
        if (orden === 'fallados') return b.fallados - a.fallados || b.deuda - a.deuda;
        if (orden === 'nombre') return a.nombre.localeCompare(b.nombre);
        return peso[a.estado] - peso[b.estado] || b.deuda - a.deuda;
      });
  }, [gente, clanSel, soloProblemas, orden]);

  // Resumen por clan. Los de vitrina van al final y sin cifras de reproche.
  const porClan = useMemo(() => {
    const m = {};
    for (const g of gente) {
      (m[g.clan] ??= {
        clan: g.clan,
        deVitrina: g.deVitrina,
        n: 0,
        rojos: 0,
        cero: 0,
        dona: 0,
      });
      const c = m[g.clan];
      c.n += 1;
      c.dona += g.dona;
      if (g.dona === 0) c.cero += 1;
      if (g.estado === 'mal') c.rojos += 1;
    }
    return Object.values(m).sort((a, b) => a.deVitrina - b.deVitrina || b.n - a.n);
  }, [gente]);

  // Quien entro y quien se fue.
  //
  // El dia que se instalo el sistema se guardaron de golpe los 61 miembros
  // con la fecha de ese dia, y once quedaron con desde = hasta = ese mismo
  // dia por como cerro el backfill. Ninguno se fue de verdad: Devorador
  // sigue en x300 y es el que mas dona de la alianza. Publicar eso seria
  // dar una lista de bajas inventada, asi que se salta el primer dia
  // entero. No hay fecha escrita a mano: se calcula, y el dia que pase un
  // movimiento real aparece solo.
  const movimientos = useMemo(() => {
    const filas = d.memberships ?? [];
    if (!filas.length) return [];
    const primerDia = filas.reduce((a, m) => (m.desde && m.desde < a ? m.desde : a), '9999-99-99');
    return filas
      .map((m) => ({
        nombre: nombre[m.player_tag] ?? m.player_tag,
        clan: clanInfo[m.clan_tag]?.nombre ?? m.clan_tag,
        fecha: m.hasta ?? m.desde,
        se_fue: Boolean(m.hasta),
      }))
      .filter((m) => m.fecha && m.fecha > primerDia)
      .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)))
      .slice(0, 12);
  }, [d.memberships, nombre, clanInfo]);

  if (!d.snaps?.length) {
    return <p className="vacio">{t('Todavía no hay snapshot. Corre el job primero.')}</p>;
  }

  const rojos = gente.filter((g) => g.estado === 'mal').length;
  const avisos = gente.filter((g) => g.estado === 'aviso').length;

  return (
    <>
      <h2 className="sec">
        {t('Salud del clan')} · <span className="mal">{rojos}</span> {t('en rojo')} · {avisos}{' '}
        {t('para vigilar')}
      </h2>

      <div className="grid">
        {porClan.map((c) => (
          <div className="card" key={c.clan}>
            <h3 style={{ fontSize: 15 }}>
              {c.clan} {c.deVitrina && <span className="pill">{t('trofeos')}</span>}
            </h3>
            {c.deVitrina ? (
              <p className="sub">
                {c.n} {t(c.n === 1 ? 'miembro' : 'miembros')} · {t('clan de vitrina, no se le exige donar')}
              </p>
            ) : (
              <p className="sub">
                {c.n} {t(c.n === 1 ? 'miembro' : 'miembros')} · {Math.round(c.dona / (c.n || 1))} {t('donaciones de media')}
                {c.cero > 0 && (
                  <>
                    {' · '}
                    {c.cero} {t('sin donar')}
                  </>
                )}
                {c.rojos > 0 && (
                  <>
                    {' · '}
                    <strong className="mal">
                      {c.rojos} {t('en rojo')}
                    </strong>
                  </>
                )}
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="filtros">
        <select
          className="campo campo-corto"
          value={clanSel}
          onChange={(e) => setClanSel(e.target.value)}
        >
          <option value="todos">{t('Todos los clanes')}</option>
          {porClan.map((c) => (
            <option key={c.clan} value={c.clan}>
              {c.clan}
            </option>
          ))}
        </select>
        <select
          className="campo campo-corto"
          value={orden}
          onChange={(e) => setOrden(e.target.value)}
        >
          {ORDENES.map(([k, l]) => (
            <option key={k} value={k}>
              {t(l)}
            </option>
          ))}
        </select>
        <label className="fila-check" style={{ marginTop: 0 }}>
          <input
            type="checkbox"
            checked={soloProblemas}
            onChange={(e) => setSoloProblemas(e.target.checked)}
          />
          <span>
            {t('Solo los que hay que mirar')} ({rojos + avisos})
          </span>
        </label>
      </div>

      <div className="tabla-scroll">
        <table>
          <thead>
            <tr>
              <th />
              <th>{t('Jugador')}</th>
              <th>{t('Clan')}</th>
              <th className="num">TH</th>
              <th className="num">{t('Dona')}</th>
              <th className="num">{t('Recibe')}</th>
              <th className="num">{t('Ataques CWL')}</th>
              <th>{t('Qué pasa')}</th>
            </tr>
          </thead>
          <tbody>
            {filtrada.map((g) => (
              <tr key={g.tag} data-salud={g.estado}>
                <td>
                  <span className={`pill ${g.estado}`}>
                    {g.estado === 'mal' ? '🔴' : g.estado === 'aviso' ? '🟡' : '🟢'}
                  </span>
                </td>
                <td>
                  {g.nombre}
                  {g.duplicado && <span className="sub"> {g.tag}</span>}
                </td>
                <td className="sub">{g.clan}</td>
                <td className="num">{g.th ?? '—'}</td>
                <td className={g.dona === 0 && !g.deVitrina ? 'num mal' : 'num'}>{g.dona}</td>
                <td className="num sub">{g.recibe}</td>
                <td className="num">{g.disp ? `${g.uso}/${g.disp}` : '—'}</td>
                <td>
                  {g.banderas.map((b) => (
                    <span key={b.clave} className={b.grave ? 'bandera grave' : 'bandera'}>
                      {t(b.clave)}
                      {b.num ? ` ${b.num}` : ''}
                    </span>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!filtrada.length && <p className="vacio">{t('Nadie con esos filtros. Buena señal.')}</p>}

      {movimientos.length > 0 && (
        <>
          <h2 className="sec">{t('Quién entró y quién se fue')}</h2>
          <div className="tabla-scroll">
            <table>
              <thead>
                <tr>
                  <th />
                  <th>{t('Jugador')}</th>
                  <th>{t('Clan')}</th>
                  <th>{t('Cuándo')}</th>
                </tr>
              </thead>
              <tbody>
                {movimientos.map((m, i) => (
                  <tr key={`${m.nombre}-${i}`}>
                    <td>{m.se_fue ? '🚪' : '✅'}</td>
                    <td>{m.nombre}</td>
                    <td className="sub">{m.clan}</td>
                    <td className="sub">
                      {m.se_fue ? t('se fue') : t('entró')} · {String(m.fecha).slice(0, 10)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
