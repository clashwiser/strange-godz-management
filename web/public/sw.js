// Service worker minimo, a proposito.
//
// Existe por un solo motivo: Chrome no ofrece instalar una web como app si no
// hay un service worker registrado con un manejador de 'fetch'. Sin este
// archivo, el boton "Descargar app" no tendria nada que disparar en Android.
//
// NO cachea nada, y eso es deliberado. Este panel decide reparto de dinero:
// una version guardada mostrando estrellas o premios viejos es peor que no
// tener app. Todo pasa derecho a la red, igual que en el navegador. Lo que
// gana el usuario es el icono en la pantalla de inicio y la ventana sin barra
// de direcciones, no funcionar sin internet.
//
// Si algun dia se quiere modo offline, hay que decidir primero que datos
// pueden quedar viejos sin causar un error de reparto.

self.addEventListener('install', () => {
  // Toma el control sin esperar a que se cierren las pestanas viejas.
  self.skipWaiting();
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(self.clients.claim());
});

// Pasarela transparente. Sin respondWith, el navegador resuelve la peticion
// como siempre; el manejador existe solo para cumplir el requisito.
self.addEventListener('fetch', () => {});
