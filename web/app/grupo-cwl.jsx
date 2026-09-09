'use client';

// La tabla del grupo de CWL de cada clan nuestro, con el analisis del dia.
//
// Es la pantalla que evita el trabajo mas tonto de la liga: para saber si
// x300 va a descender hay que entrar clan por clan en el juego y sumar
// estrellas a mano. Aqui estan los ocho de una vez.
//
// Las cuentas NO se hacen aqui. Salen de src/lib/cwl-analisis.js, que es el
// mismo modulo que usa el bot de Telegram: si cada lado hiciera su propia
// version acabarian dando numeros distintos del mismo dia.

import { useMemo, useState } from 'react';
import { analizar } from '../../src/lib/cwl-analisis.js';
import { mensajeDelDia } from '../../src/lib/cwl-mensajes.js';
import { useT } from './idioma';

const pct = (x) => `${Math.round(x * 100)}%`;

/** Semaforo del clan, que es lo primero que se mira. */
function estado(a, t) {
  if (a.probBajar >= 0.995) return { clase: 'mal', texto: t('Desciende') };
  if (a.enDescenso) return { clase: 'mal', texto: t('En zona de descenso') };
  if (a.probBajar >= 0.25) return { clase: 'mal', texto: `${t('Riesgo de bajar')} ${pct(a.probBajar)}` };
  if (a.probSubir >= 0.995) return { clase: 'ok', texto: t('Asciende') };
  if (a.probSubir >= 0.5) return { clase: 'ok', texto: `${t('Sube')} ${pct(a.probSubir)}` };
  if (a.probSubir > 0.02) return { clase: 'aviso', texto: `${t('Puede subir')} ${pct(a.probSubir)}` };
  return { clase: 'ok', texto: t('Se mantiene') };
}

function Grupo({ season, filas, cupo, nombreClan }) {
  const t = useT();
  const [verMensaje, setVerMensaje] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const a = useMemo(
    () =>
      analizar({
        filas,
        clanTag: season.clan_tag,
        promueven: cupo?.promueven ?? 2,
        descienden: cupo?.descienden ?? 2,
      }),
    [filas, season.clan_tag, cupo]
  );

  if (!a) return null;

  const sem = estado(a, t);
  const total = a.tabla.length;
  const perdidas = a.rondasJugadas - a.yo.ganadas;
  const clan = nombreClan ?? season.clan_tag;
  const corteSube = cupo?.promueven ?? 2;

  const mensaje = mensajeDelDia({
    clan,
    liga: season.liga,
    analisis: a,
    promueven: cupo?.promueven ?? 2,
    descienden: cupo?.descienden ?? 2,
  });

  async function copiar() {
    try {
      await navigator.clipboard.writeText(mensaje);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
    } catch {
      setVerMensaje(true);
    }
  }

  return (
    <div className="card grupo-cwl">
      <div className="grupo-cab">
        <strong>{clan}</strong>
        <span className="pill">{season.liga ?? '—'}</span>
        <span className={`pill ${sem.clase}`}>{sem.texto}</span>
        <span style={{ flex: 1 }} />
        <span className="sub">
          {t('Puesto')} {a.yo.puesto}/{total}
        </span>
      </div>

      <p className="sub grupo-resumen">
        {a.yo.estrellas}★ ({a.yo.estrellas_ataque} {t('de ataque')} + {a.yo.ganadas}×10{' '}
        {t('por victoria')}) · {a.yo.ganadas}{t('G')}-{perdidas}{t('P')} {t('en')} {a.rondasJugadas}{' '}
        {t('rondas')}
        {a.rival && (
          <>
            {' · '}
            {t('ronda')} {a.rondaActual} {t('contra')} <strong>{a.rival.nombre}</strong>
          </>
        )}
      </p>

      {/* El "que tiene que pasar", que es lo que la gente pregunta. */}
      <ul className="grupo-analisis">
        {a.margenSobreDescenso > 0 && !a.enDescenso && (
          <li>
            {t('Margen sobre el descenso')}: <strong>{a.margenSobreDescenso}★</strong>{' '}
            {t('sobre')} {a.primeroQueBaja?.nombre}
          </li>
        )}
        {a.enDescenso && (
          <li className="mal">
            {t('Ahora mismo bajamos.')}{' '}
            {a.probBajar < 0.995
              ? `${t('Todavía se puede salir: hay que pasar a')} ${
                  a.tabla.find((c) => c.puesto === a.cortePierde - 1)?.nombre ?? '—'
                }.`
              : t('Con lo que queda por jugar ya no alcanzan las cuentas.')}
          </li>
        )}
        {corteSube > 0 && a.faltanParaSubir > 0 && (
          <li>
            {t('Para subir faltan')} <strong>{a.faltanParaSubir}★</strong> ({a.ultimoQueSube?.nombre}){' '}
            {a.probSubir <= 0.02 && `— ${t('ya no da con las rondas que quedan')}`}
          </li>
        )}
        <li className="sub">
          {t('Suben')} {cupo?.promueven ?? 2} · {t('bajan')} {cupo?.descienden ?? 2}
          {a.simulado && (
            <>
              {' · '}
              {t('probabilidades simuladas con el historial de esta liga')}
            </>
          )}
        </li>
      </ul>

      <div className="tabla-scroll">
        <table className="tabla-grupo">
          <thead>
            <tr>
              <th className="num">#</th>
              <th>{t('Clan')}</th>
              <th className="num">★</th>
              <th className="num">{t('Ataque')}</th>
              <th className="num">{t('Ganadas')}</th>
              <th className="num">{t('Destrucción')}</th>
            </tr>
          </thead>
          <tbody>
            {a.tabla.map((c) => {
              // Las dos lineas que importan: la de ascenso y la de descenso.
              const sube = c.puesto <= corteSube;
              const baja = (cupo?.descienden ?? 2) > 0 && c.puesto >= a.cortePierde;
              return (
                <tr
                  key={c.clan_tag}
                  data-yo={c.clan_tag === season.clan_tag ? '1' : '0'}
                  data-zona={sube ? 'sube' : baja ? 'baja' : ''}
                >
                  <td className="num">{c.puesto}</td>
                  <td>{c.nombre}</td>
                  <td className="num">
                    <strong>{c.estrellas}</strong>
                  </td>
                  <td className="num">{c.estrellas_ataque}</td>
                  <td className="num">{c.ganadas}</td>
                  <td className="num">{c.destruccion.toFixed(0)}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="grupo-pie">
        <button className="fantasma" onClick={() => setVerMensaje((v) => !v)}>
          {verMensaje ? t('Ocultar el parte') : t('Ver el parte de hoy')}
        </button>
        <button className="fantasma" onClick={copiar}>
          {copiado ? t('¡Copiado!') : t('Copiar para WhatsApp')}
        </button>
      </div>
      {verMensaje && <pre className="msg">{mensaje}</pre>}
    </div>
  );
}

export default function GrupoCWL({ d }) {
  const t = useT();

  const nombreClan = useMemo(
    () => Object.fromEntries((d.clans ?? []).map((c) => [c.clan_tag, c.nombre])),
    [d.clans]
  );
  const cupoDe = useMemo(
    () => Object.fromEntries((d.ligas ?? []).map((l) => [l.liga, l])),
    [d.ligas]
  );
  const porSeason = useMemo(() => {
    const m = {};
    for (const f of d.grupo ?? []) (m[f.season_id] ??= []).push(f);
    return m;
  }, [d.grupo]);

  const conGrupo = (d.seasons ?? []).filter((s) => porSeason[s.id]?.length);

  if (!conGrupo.length) {
    return (
      <div className="card">
        <h3>{t('Todavía no hay tabla del grupo')}</h3>
        <p className="sub">
          {t('La baja el job cwl:sync junto con las rondas. Si la CWL ya empezó, córrelo.')}
        </p>
        <pre className="msg">npm run cwl:sync</pre>
      </div>
    );
  }

  return (
    <>
      <h2 className="sec">
        {t('Grupo de CWL')} · {t('temporada')} {d.temporada}
      </h2>
      {conGrupo.map((s) => (
        <Grupo
          key={s.id}
          season={s}
          filas={porSeason[s.id]}
          cupo={cupoDe[s.liga]}
          nombreClan={nombreClan[s.clan_tag]}
        />
      ))}
    </>
  );
}
