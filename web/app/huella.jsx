'use client';

// Entrar con la huella del telefono en vez de con contrasena.
//
// Lo que hay detras es un passkey (WebAuthn), no una contrasena guardada:
// la llave privada se crea DENTRO del telefono y no sale de ahi nunca. Del
// lado del servidor solo queda la llave publica, que no sirve para entrar.
// Por eso esto es a la vez mas comodo y mas seguro que la contrasena.
//
// El PIN no hay que inventarlo: cuando el dedo no lee -mojado, o el lector
// del Fold en el lateral-, Android y iOS ofrecen solos el PIN o el patron
// del aparato. Un PIN propio de la app seria un codigo mas que recordar y
// mas debil que el del sistema.
//
// Un passkey es POR APARATO. Cada lider registra el suyo en su telefono, y
// si alguno cambia de equipo entra con el enlace por correo y registra el
// nuevo.

import { useCallback, useEffect, useState } from 'react';
import { supabase, hayHuella } from '../lib/supabase';
import { useT } from './idioma';

/** Lee la lista de passkeys de la cuenta. */
function useHuellas() {
  const [lista, setLista] = useState(null); // null = todavia no se sabe
  const [soportado, setSoportado] = useState(false);

  const cargar = useCallback(async () => {
    if (!hayHuella()) return setLista([]);
    try {
      const { data, error } = await supabase.auth.passkey.list();
      if (error) throw error;
      setLista(data ?? []);
    } catch {
      // Si la funcion no esta habilitada en el proyecto, esto falla y no
      // pasa nada: se sigue entrando con correo y contrasena.
      setLista([]);
    }
  }, []);

  useEffect(() => {
    setSoportado(hayHuella());
    cargar();
  }, [cargar]);

  return { lista, soportado, recargar: cargar };
}

/**
 * El empujon de la cabecera. Solo sale mientras la cuenta NO tenga ninguna
 * huella registrada; en cuanto hay una, desaparece y no estorba mas.
 *
 * Va en la cabecera y no escondido en una pestana porque si no lo ve nadie,
 * nadie lo activa y se sigue escribiendo la contrasena todos los dias.
 */
export function AvisoHuella() {
  const t = useT();
  const { lista, soportado, recargar } = useHuellas();
  const [ocupado, setOcupado] = useState(false);
  const [msg, setMsg] = useState('');

  if (!soportado || lista === null || lista.length > 0) return null;

  async function registrar() {
    setOcupado(true);
    setMsg('');
    try {
      const { error } = await supabase.auth.registerPasskey();
      if (error) throw error;
      await recargar();
    } catch (e) {
      const m = String(e?.message ?? e);
      // Cancelar el dialogo del sistema no es un error que reportar.
      if (!/abort|cancel|NotAllowed/i.test(m)) setMsg(m);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <>
      <button className="accion boton-huella-chico" onClick={registrar} disabled={ocupado}>
        👆 {ocupado ? t('Registrando…') : t('Activar huella')}
      </button>
      {msg && <span className="error" style={{ margin: 0 }}>{msg}</span>}
    </>
  );
}

/** Gestion completa: que aparatos tienen huella y quitar los que sobren. */
export function GestorHuellas() {
  const t = useT();
  const { lista, soportado, recargar } = useHuellas();
  const [ocupado, setOcupado] = useState(false);
  const [msg, setMsg] = useState('');

  async function registrar() {
    setOcupado(true);
    setMsg('');
    try {
      const { error } = await supabase.auth.registerPasskey();
      if (error) throw error;
      await recargar();
      setMsg(t('Listo. Ya puedes entrar con la huella en este aparato.'));
    } catch (e) {
      const m = String(e?.message ?? e);
      if (!/abort|cancel|NotAllowed/i.test(m)) setMsg(m);
    } finally {
      setOcupado(false);
    }
  }

  async function quitar(id) {
    setOcupado(true);
    setMsg('');
    try {
      const { error } = await supabase.auth.passkey.delete({ passkeyId: id });
      if (error) throw error;
      await recargar();
    } catch (e) {
      setMsg(String(e?.message ?? e));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="card">
      <h3>👆 {t('Entrar con huella o PIN')}</h3>
      <p className="sub">
        {t('La llave se crea dentro del teléfono y no sale de ahí: no hay contraseña que se pueda robar. Si el dedo no lee, el teléfono te pide su propio PIN.')}
      </p>

      {!soportado ? (
        <p className="sub">
          {t('Este navegador no lo soporta. Ábrelo desde el teléfono, con la app instalada.')}
        </p>
      ) : (
        <>
          {lista?.length ? (
            <div className="tabla-scroll">
              <table>
                <thead>
                  <tr>
                    <th>{t('Aparato')}</th>
                    <th>{t('Registrado')}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {lista.map((p) => (
                    <tr key={p.id}>
                      <td>{p.friendly_name || p.friendlyName || t('Aparato sin nombre')}</td>
                      <td className="sub">{(p.created_at ?? '').slice(0, 10) || '—'}</td>
                      <td className="acciones">
                        <div className="acciones-caja">
                          <button className="fantasma" onClick={() => quitar(p.id)} disabled={ocupado}>
                            {t('Quitar')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="vacio">{t('Todavía no hay ningún aparato registrado.')}</p>
          )}

          <button className="accion" onClick={registrar} disabled={ocupado} style={{ marginTop: 12 }}>
            {ocupado ? t('Registrando…') : t('Registrar este aparato')}
          </button>
          <p className="sub" style={{ marginTop: 8 }}>
            {t('Hazlo una vez en cada teléfono desde el que entres.')}
          </p>
        </>
      )}

      {msg && <p className="error">{msg}</p>}
    </div>
  );
}
