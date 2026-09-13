'use client';

// La columna "Telegram" de la lista de jugadores: quien es en Telegram
// cada cuenta del juego, y el lapiz para atarla o soltarla desde el panel.
//
// Es lo mismo que /soy y /asignar en el grupo, pero desde aqui: para las
// cuentas que nadie ato, o para corregir una. La lista de gente sale de
// los apuntados del grupo (tg_usuarios) y de los que ya tienen alguna
// cuenta (tg_vinculos); si alguien no aparece, vale su id de Telegram.

import { useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useT } from './idioma';

/** "Pmc (@pmc_x)" o "Pmc" o "id 8319208377": como se enseña a una persona. */
export function etiquetaDe(u) {
  if (!u) return '';
  const nombre = u.nombre ?? u.tg_nombre ?? '';
  const user = u.username ? `@${u.username}` : '';
  return nombre && user ? `${nombre} (${user})` : nombre || user || `id ${u.tg_user_id}`;
}

/**
 * Las personas de Telegram conocidas: apuntadas del grupo + con cuentas
 * atadas, sin repetir, ordenadas por nombre. [{ tg_user_id, nombre, username }]
 */
export function personasDe(d) {
  const m = new Map();
  for (const u of d.tgUsuarios ?? []) m.set(u.tg_user_id, { tg_user_id: u.tg_user_id, nombre: u.nombre, username: u.username });
  for (const v of d.vinculos ?? []) {
    if (!m.has(v.tg_user_id)) m.set(v.tg_user_id, { tg_user_id: v.tg_user_id, nombre: v.tg_nombre, username: null });
  }
  return [...m.values()].sort((a, b) => etiquetaDe(a).localeCompare(etiquetaDe(b), 'es', { sensitivity: 'base' }));
}

export default function TelegramDe({ playerTag, d, recargar }) {
  const t = useT();
  const [editando, setEditando] = useState(false);
  const [elegido, setElegido] = useState('');
  const [otroId, setOtroId] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');

  const personas = useMemo(() => personasDe(d), [d]);
  const porId = useMemo(() => Object.fromEntries(personas.map((p) => [String(p.tg_user_id), p])), [personas]);
  const vinculo = (d.vinculos ?? []).find((v) => v.player_tag === playerTag) ?? null;
  const persona = vinculo ? porId[String(vinculo.tg_user_id)] ?? { tg_user_id: vinculo.tg_user_id, nombre: vinculo.tg_nombre } : null;

  async function guardar() {
    setError('');
    const id = elegido === 'otro' ? Number(otroId.replace(/\D/g, '')) : Number(elegido);
    setOcupado(true);
    try {
      // Fuera la atadura vieja de esta cuenta, si la habia.
      if (vinculo) {
        const { error: e1 } = await supabase.from('tg_vinculos').delete().eq('tg_user_id', vinculo.tg_user_id).eq('player_tag', playerTag);
        if (e1) throw e1;
      }
      if (elegido && elegido !== 'ninguno' && id) {
        // La primera cuenta que se le ata a alguien es su principal.
        const tiene = (d.vinculos ?? []).some((v) => v.tg_user_id === id && v.player_tag !== playerTag);
        const nombre = porId[String(id)]?.nombre ?? null;
        const { error: e2 } = await supabase.from('tg_vinculos').insert({ tg_user_id: id, player_tag: playerTag, tg_nombre: nombre, principal: !tiene });
        if (e2) throw e2;
      }
      setEditando(false);
      recargar?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setOcupado(false);
    }
  }

  if (!editando) {
    return (
      <span className="tg-celda">
        {persona ? <span className="pill">{etiquetaDe(persona)}</span> : <span className="sub">—</span>}
        {recargar && (
          <button
            type="button"
            className="tg-lapiz"
            title={t('Cambiar')}
            onClick={() => {
              setElegido(vinculo ? String(vinculo.tg_user_id) : '');
              setOtroId('');
              setEditando(true);
            }}
          >
            ✎
          </button>
        )}
      </span>
    );
  }

  return (
    <span className="tg-celda tg-editor">
      <select className="campo campo-corto" value={elegido} onChange={(e) => setElegido(e.target.value)} disabled={ocupado}>
        <option value="">{t('— elige —')}</option>
        <option value="ninguno">{t('Sin Telegram (quitar)')}</option>
        {personas.map((p) => (
          <option key={p.tg_user_id} value={String(p.tg_user_id)}>{etiquetaDe(p)}</option>
        ))}
        <option value="otro">{t('Otro (por id de Telegram)…')}</option>
      </select>
      {elegido === 'otro' && (
        <input className="campo campo-corto" placeholder={t('id numérico')} value={otroId} onChange={(e) => setOtroId(e.target.value)} style={{ width: 130 }} />
      )}
      <button type="button" className="accion" onClick={guardar} disabled={ocupado || !elegido || (elegido === 'otro' && !otroId.trim())}>
        {t('Guardar')}
      </button>
      <button type="button" className="fantasma" onClick={() => setEditando(false)} disabled={ocupado}>
        {t('Cancelar')}
      </button>
      {error && <span className="error" style={{ display: 'block' }}>{error}</span>}
    </span>
  );
}
