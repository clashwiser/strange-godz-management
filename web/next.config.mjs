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
    // sharp ya se importa normal en castillo-foto.js y el rastreo lo ve
    // solo; esto queda de refuerzo. Con el import invisible de antes NO
    // bastaba: en Vercel faltaba ("Cannot find package 'sharp'", 16 oct 2026).
    '/api/telegram/route': ['./node_modules/sharp/**/*', './node_modules/@img/**/*'],
    '/api/recluta/route': ['./node_modules/sharp/**/*', './node_modules/@img/**/*'],
  },
};
