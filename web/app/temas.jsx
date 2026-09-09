'use client';

// Selector de tema. Solo cambia un atributo en <html>; toda la paleta vive
// en variables CSS, asi que no hay que tocar ningun componente.

import { useEffect, useState } from 'react';

export const TEMAS = [
  { id: 'clash',   nombre: 'Clash theme',    clase: 't-clash' },
  { id: 'strange', nombre: 'Strange theme',  clase: 't-strange' },
  { id: 'godz',    nombre: 'Godz theme',     clase: 't-godz' },
  { id: 'futbol',  nombre: 'Football theme', clase: 't-futbol' },
];

export const TEMA_POR_DEFECTO = 'clash';
const EVENTO = 'sga-tema-cambio';

/** Script que corre ANTES del primer pintado, para que no parpadee el tema. */
export const guionAntiParpadeo = `(function(){try{var t=localStorage.getItem('sga-tema');document.documentElement.dataset.tema=t||'${TEMA_POR_DEFECTO}'}catch(e){document.documentElement.dataset.tema='${TEMA_POR_DEFECTO}'}})()`;

/**
 * Devuelve el tema activo y se re-renderiza cuando cambia.
 * Sin el evento, la mascota se quedaria con la imagen del tema anterior:
 * cambiar un atributo del DOM no avisa a React por si solo.
 */
export function useTema() {
  const [tema, setTema] = useState(TEMA_POR_DEFECTO);
  useEffect(() => {
    setTema(document.documentElement.dataset.tema || TEMA_POR_DEFECTO);
    const alCambiar = (e) => setTema(e.detail);
    window.addEventListener(EVENTO, alCambiar);
    return () => window.removeEventListener(EVENTO, alCambiar);
  }, []);
  return tema;
}

export default function SelectorTema() {
  const tema = useTema();

  function elegir(id) {
    document.documentElement.dataset.tema = id;
    try {
      localStorage.setItem('sga-tema', id);
    } catch {
      // Navegacion privada o cookies bloqueadas: vale para esta visita.
    }
    window.dispatchEvent(new CustomEvent(EVENTO, { detail: id }));
  }

  const activo = TEMAS.find((t) => t.id === tema);

  return (
    <div className="temas-caja">
      <div className="temas" role="group" aria-label="Tema de color">
        {TEMAS.map((t) => (
          <button
            key={t.id}
            className={t.clase}
            onClick={() => elegir(t.id)}
            aria-pressed={tema === t.id}
            aria-label={`Tema ${t.nombre}`}
            title={t.nombre}
          />
        ))}
      </div>
      {/* El nombre del tema activo: los circulos solos no dicen cual es cual. */}
      <span className="tema-nombre">{activo?.nombre}</span>
    </div>
  );
}

// Los cuatro llevan anillo propio horneado en la imagen, asi que se muestran
// enteros: recortarlos en circulo les cortaria el aro.
const EMBLEMAS = new Set(['clash', 'strange', 'godz', 'futbol']);

/** Mascota del tema activo. Personajes originales, no de Supercell. */
export function Mascota({ ancho = 210, redondo = false }) {
  const tema = useTema();
  const esEmblema = EMBLEMAS.has(tema);
  const clase = esEmblema ? 'mascota mascota-emblema' : redondo ? 'mascota mascota-redonda' : 'mascota';
  return (
    <img
      className={clase}
      src={`/mascotas/${tema}.webp`}
      alt=""
      width={ancho}
      height={ancho}
      style={{ maxWidth: ancho }}
    />
  );
}
