'use client';

// Alta de un clan desde el panel.
//
// Existe para que Carlos o Deibis puedan sumar un clan a la alianza sin
// pasar por mi. Antes los clanes solo entraban editando la variable
// CLAN_TAGS en los secretos de GitHub.
//
// Se valida ANTES de guardar, y por eso hay una ruta de servidor de por
// medio: la API de Supercell exige una llave secreta y una IP autorizada.
// La llave no puede viajar al navegador y la IP de un telefono cambia sola,
// asi que /api/clan la consulta desde el servidor. Sin esa validacion, un
// tag con una letra mal escrita entraria a la base y simplemente nunca se
// sincronizaria: la pantalla mostraria un clan que para los jobs no existe.

import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { normalizarTag } from '../lib/tags';
import { useT } from './idioma';

export default function AltaClan({ demo = false, recargar, yaEstan = [] }) {
  const t = useT();
  const [abierto, setAbierto] = useState(false);
  const [entrada, setEntrada] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [hallado, setHallado] = useState(null);
  const [escuadra, setEscuadra] = useState('');
  const [tamano, setTamano] = useState('15');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  function limpiar() {
    setEntrada('');
    setHallado(null);
    setError('');
    setEscuadra('');
    setTamano('15');
  }

  async function buscar(e) {
    e?.preventDefault();
    setError('');
    setHallado(null);

    const tag = normalizarTag(entrada);
    if (!tag) {
      setError(t('Eso no parece un tag. Pega el tag del clan o su enlace de invitación.'));
      return;
    }
    if (yaEstan.includes(tag)) {
      setError(t('Ese clan ya está en la alianza.'));
      return;
    }
    if (demo) {
      setHallado({ clan_tag: tag, nombre: 'Clan de ejemplo', miembros: 30, nivel: 10, registro_publico: true });
      return;
    }

    setBuscando(true);
    try {
      // El token de sesion viaja en la cabecera: la ruta comprueba que quien
      // pregunta este en la lista blanca de lideres.
      const { data: s } = await supabase.auth.getSession();
      const res = await fetch(`/api/clan?tag=${encodeURIComponent(tag)}`, {
        headers: { Authorization: `Bearer ${s?.session?.access_token ?? ''}` },
      });
      const cuerpo = await res.json();
      if (!res.ok) throw new Error(cuerpo.error || `HTTP ${res.status}`);
      setHallado(cuerpo);
    } catch (err) {
      setError(err.message);
    } finally {
      setBuscando(false);
    }
  }

  async function anadir() {
    if (!hallado) return;
    if (demo) {
      setError(t('En la demo no se guarda.'));
      return;
    }
    setGuardando(true);
    setError('');
    try {
      const { error: err } = await supabase.from('clans').insert({
        clan_tag: hallado.clan_tag,
        nombre: hallado.nombre,
        escuadra: escuadra.trim().toUpperCase() || null,
        cwl_tamano: Number(tamano) || null,
        // Nunca principal al darlo de alta: solo puede haber uno y cambiarlo
        // es una decision aparte, no un efecto secundario de anadir.
        es_principal: false,
        orden: yaEstan.length + 1,
      });
      if (err) throw err;
      limpiar();
      setAbierto(false);
      recargar?.();
    } catch (err) {
      setError(`${t('No se pudo guardar: ')}${err.message}`);
    } finally {
      setGuardando(false);
    }
  }

  if (!abierto) {
    return (
      <button className="accion" onClick={() => setAbierto(true)} style={{ marginBottom: 14 }}>
        + {t('Añadir clan')}
      </button>
    );
  }

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h3>{t('Añadir clan')}</h3>
      <p className="sub">
        {t('Pega el tag del clan o el enlace de invitación que comparte el juego. Se comprueba contra Clash of Clans antes de guardarlo.')}
      </p>

      <form className="filtros" onSubmit={buscar} style={{ marginTop: 10 }}>
        <input
          className="campo"
          value={entrada}
          onChange={(e) => setEntrada(e.target.value)}
          placeholder="#2GC"
          autoComplete="off"
          style={{ flex: '1 1 220px' }}
        />
        <button className="fantasma" type="submit" disabled={buscando || !entrada.trim()}>
          {buscando ? t('Buscando…') : t('Buscar')}
        </button>
      </form>

      {error && <p className="error">{error}</p>}

      {hallado && (
        <div className="hallado">
          <h3 style={{ margin: '4px 0' }}>
            {hallado.nombre}{' '}
            <span className="pill">{hallado.clan_tag}</span>
          </h3>
          <p className="sub">
            {hallado.miembros} {t('miembros')} · {t('nivel')} {hallado.nivel}
            {hallado.ubicacion ? ` · ${hallado.ubicacion}` : ''}
          </p>
          {!hallado.registro_publico && (
            <p className="sub" style={{ color: 'var(--mal)' }}>
              {t('Su registro de guerra está en privado: la guerra normal de este clan no se podrá medir hasta que lo abran.')}
            </p>
          )}

          <div className="filtros" style={{ marginTop: 12 }}>
            <label className="campo-etiqueta">
              {t('Escuadra')}
              <input
                className="campo campo-corto"
                value={escuadra}
                onChange={(e) => setEscuadra(e.target.value)}
                placeholder="D"
                maxLength={2}
              />
            </label>
            <label className="campo-etiqueta">
              {t('Cupo de CWL')}
              <input
                className="campo campo-corto"
                type="number"
                min="5"
                max="50"
                value={tamano}
                onChange={(e) => setTamano(e.target.value)}
              />
            </label>
          </div>

          <div className="lupa-pie">
            <button className="fantasma" onClick={() => { limpiar(); setAbierto(false); }}>
              {t('Cancelar')}
            </button>
            <span style={{ flex: 1 }} />
            <button className="accion" onClick={anadir} disabled={guardando}>
              {guardando ? t('Guardando…') : t('Añadir a la alianza')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
