// Las reglas de los desafios amistosos (FC), sin nada mas.
//
// Aparte de retos.js para que el panel (Bonos) las pueda leer sin traerse
// detras la lectura de fotos: retos.js importa castillo-foto.js, y ese usa
// sharp, que es nativo y no puede ir al navegador. Antes, para esquivarlo,
// sharp se cargaba con un import invisible para Vercel, y en Vercel nunca
// llego a estar: el recorte de la ventana fallo siempre (16 oct 2026).

export const PUNTOS_FC = 5; // por captura valida
export const FC_MINIMO = 5; // desafios por captura
export const FC_ESTRELLAS = 2; // estrellas minimas para que cuente
export const FC_CAPTURAS_DIA = 1; // capturas validas al dia por persona
