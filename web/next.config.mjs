/** @type {import('next').NextConfig} */
export default {
  reactStrictMode: true,
  // sharp (recortar la ventana de donacion en castillo-foto.js) es nativo:
  // no se empaqueta con webpack, se carga de node_modules en la funcion.
  serverExternalPackages: ['sharp'],
  // El cartel de los premios (api/cartel) lee del disco sus fuentes y su
  // fondo: hay que decirle a Vercel que los meta en el paquete de la funcion.
  outputFileTracingIncludes: {
    '/api/cartel': ['./app/api/cartel/*.woff', './app/api/cartel/*.jpg'],
    '/api/cartel/route': ['./app/api/cartel/*.woff', './app/api/cartel/*.jpg'],
    // sharp se importa con webpackIgnore (ver castillo-foto.js), asi que el
    // rastreo no lo ve: se mete a mano en las funciones que leen fotos.
    '/api/telegram/route': ['./node_modules/sharp/**/*', './node_modules/@img/**/*'],
    '/api/recluta/route': ['./node_modules/sharp/**/*', './node_modules/@img/**/*'],
  },
};
