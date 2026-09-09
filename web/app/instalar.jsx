'use client';

// Boton "Descargar app": deja el panel en la pantalla de inicio del telefono,
// con su icono y sin barra de direcciones.
//
// No hay nada que descargar en realidad, y ese es el punto: no es una app de
// tienda, es la misma web instalada como aplicacion (PWA). Se actualiza sola
// con cada despliegue, no hay que aprobar nada en Google ni en Apple, y no
// ocupa espacio.
//
// El camino NO es igual en los dos telefonos, y ahi esta toda la complejidad:
//
//   Android / Chrome  el navegador dispara 'beforeinstallprompt', lo guardamos
//                     y el boton abre el instalador nativo. Un clic.
//   iPhone / Safari   Apple no implementa ese evento. La unica via es
//                     Compartir > Anadir a pantalla de inicio, a mano. Lo
//                     unico que podemos hacer es explicarlo bien.
//
// Por eso el boton cambia de comportamiento segun el telefono en vez de
// prometer lo mismo a todos.

import { useEffect, useState } from 'react';

/** iPhone/iPad. El iPad con iPadOS 13+ miente y dice ser un Mac: se lo
 *  reconoce porque un Mac de verdad no tiene pantalla tactil. */
function esIOS() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

/** Ya abierta como app: no tiene sentido ofrecer instalarla otra vez. */
function yaInstalada() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
}

export default function Instalar({ className = 'fantasma' }) {
  const [evento, setEvento] = useState(null);
  const [instalada, setInstalada] = useState(false);
  const [ayuda, setAyuda] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    setIos(esIOS());
    setInstalada(yaInstalada());

    // Sin service worker registrado, Chrome ni siquiera dispara el evento de
    // instalacion. El de este proyecto no cachea nada; ver public/sw.js.
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Un fallo aca solo significa que no se podra instalar en Android.
        // El panel funciona igual, asi que no se le muestra nada al usuario.
      });
    }

    const alPoder = (e) => {
      // Sin esto Chrome muestra su propio cartel cuando quiere. Lo guardamos
      // para dispararlo cuando el usuario toque el boton, no antes.
      e.preventDefault();
      setEvento(e);
    };
    const alInstalar = () => {
      setInstalada(true);
      setEvento(null);
    };

    window.addEventListener('beforeinstallprompt', alPoder);
    window.addEventListener('appinstalled', alInstalar);
    return () => {
      window.removeEventListener('beforeinstallprompt', alPoder);
      window.removeEventListener('appinstalled', alInstalar);
    };
  }, []);

  if (instalada) return null;

  async function instalar() {
    if (!evento) {
      setAyuda(true);
      return;
    }
    evento.prompt();
    const { outcome } = await evento.userChoice;
    // El evento se consume: si lo rechaza, Chrome no lo vuelve a dar en esta
    // carga. Se limpia para que el boton pase a mostrar las instrucciones.
    setEvento(null);
    if (outcome !== 'accepted') setAyuda(true);
  }

  return (
    <>
      <button className={className} onClick={instalar} title="Instalar el panel en el teléfono">
        Descargar app
      </button>

      {ayuda && (
        <div className="lupa" onClick={() => setAyuda(false)}>
          <div
            className="lupa-caja"
            style={{ maxWidth: 460, padding: 20 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0 }}>Instalarla a mano</h3>

            {ios ? (
              <>
                <p className="sub">
                  En iPhone y iPad, Apple no permite que una web se instale sola. Son tres toques
                  y queda igual que una app.
                </p>
                <ol className="pasos">
                  <li>
                    Abrí esta página en <b>Safari</b>. Desde Chrome o desde el navegador de
                    WhatsApp no aparece la opción.
                  </li>
                  <li>
                    Tocá <b>Compartir</b>, el cuadrito con la flecha hacia arriba.
                  </li>
                  <li>
                    Bajá y elegí <b>Añadir a pantalla de inicio</b>.
                  </li>
                </ol>
              </>
            ) : (
              <>
                <p className="sub">
                  Tu navegador no ofreció instalarla. Suele pasar cuando la página se abre dentro
                  de otra app —WhatsApp, Instagram— en vez del navegador.
                </p>
                <ol className="pasos">
                  <li>
                    Abrila en <b>Chrome</b>. Si estás dentro de WhatsApp, usá <b>⋮</b> →{' '}
                    <b>Abrir en el navegador</b>.
                  </li>
                  <li>
                    Tocá <b>⋮</b> arriba a la derecha.
                  </li>
                  <li>
                    Elegí <b>Instalar aplicación</b> o <b>Añadir a pantalla principal</b>.
                  </li>
                </ol>
              </>
            )}

            <p className="sub" style={{ fontSize: 12, opacity: 0.8 }}>
              No se descarga nada ni ocupa espacio: queda el icono en la pantalla de inicio y
              abre sin la barra de direcciones. Se actualiza sola.
            </p>

            <div className="lupa-pie">
              <span style={{ flex: 1 }} />
              <button className="accion" onClick={() => setAyuda(false)}>
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
