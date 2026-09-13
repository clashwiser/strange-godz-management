/** @type {import('next').NextConfig} */
export default {
  reactStrictMode: true,
  // El cartel de los premios (api/cartel) lee del disco sus fuentes y su
  // fondo: hay que decirle a Vercel que los meta en el paquete de la funcion.
  outputFileTracingIncludes: {
    '/api/cartel': ['./app/api/cartel/*.woff', './app/api/cartel/*.jpg'],
    '/api/cartel/route': ['./app/api/cartel/*.woff', './app/api/cartel/*.jpg'],
  },
};
