// Cifrado de las copias de seguridad.
//
// El repo es PUBLICO, y la copia se guarda dentro del repo. Asi que va
// cifrada con una frase que solo esta en GitHub Secrets (y en el gestor de
// contraseñas de los lideres). Sin la frase, el archivo es ruido.
//
// AES-256-GCM con la llave sacada de la frase por scrypt. GCM autentica:
// si el archivo se corrompe o alguien lo toca, descifrar falla en vez de
// devolver basura. Todo con el crypto de Node, sin dependencias: lo mismo
// que cifra en GitHub Actions descifra en la PC de cualquier lider.
//
// Formato del archivo: "SGB1" + sal(16) + iv(12) + etiqueta(16) + datos.

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';

const MAGIA = Buffer.from('SGB1');

const llaveDe = (frase, sal) => scryptSync(String(frase), sal, 32, { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });

/** JSON -> gzip -> AES-256-GCM. Devuelve el Buffer listo para escribir. */
export function cifrar(objeto, frase) {
  if (!frase || String(frase).length < 12) throw new Error('la frase de la copia tiene que tener al menos 12 caracteres');
  const sal = randomBytes(16);
  const iv = randomBytes(12);
  const cifrador = createCipheriv('aes-256-gcm', llaveDe(frase, sal), iv);
  const datos = Buffer.concat([cifrador.update(gzipSync(Buffer.from(JSON.stringify(objeto), 'utf8'))), cifrador.final()]);
  return Buffer.concat([MAGIA, sal, iv, cifrador.getAuthTag(), datos]);
}

/** El camino de vuelta. Tira si la frase es otra o el archivo esta tocado. */
export function descifrar(buffer, frase) {
  if (!buffer.subarray(0, 4).equals(MAGIA)) throw new Error('eso no es una copia de Strange Godz (falta la cabecera)');
  const sal = buffer.subarray(4, 20);
  const iv = buffer.subarray(20, 32);
  const etiqueta = buffer.subarray(32, 48);
  const datos = buffer.subarray(48);
  const descifrador = createDecipheriv('aes-256-gcm', llaveDe(frase, sal), iv);
  descifrador.setAuthTag(etiqueta);
  let plano;
  try {
    plano = Buffer.concat([descifrador.update(datos), descifrador.final()]);
  } catch {
    throw new Error('no se pudo descifrar: la frase no es esa, o el archivo esta dañado');
  }
  return JSON.parse(gunzipSync(plano).toString('utf8'));
}
