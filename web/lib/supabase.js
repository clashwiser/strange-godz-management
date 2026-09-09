'use client';

import { createClient } from '@supabase/supabase-js';

// La clave anon puede vivir en el navegador sin riesgo: con RLS activo, quien
// no este en dashboard_users no recibe ni una fila. La service_role NUNCA
// llega aca; esa solo existe en GitHub Secrets.
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Sin placeholder el build se cae al prerenderizar, porque createClient exige
// una URL valida y en tiempo de build las variables pueden no estar puestas.
export const configurado = Boolean(URL && ANON);

export const supabase = createClient(
  URL || 'https://placeholder.supabase.co',
  ANON || 'placeholder-anon-key',
  {
    auth: {
      // Entrar con la huella del telefono. Hay que pedirlo explicitamente:
      // en supabase-js los passkeys van detras de esta bandera mientras la
      // funcion siga en beta.
      //
      // Un passkey NO es una contrasena guardada: la llave privada vive en
      // el telefono y nunca sale de ahi, asi que no hay nada que robar de
      // nuestro lado. Y el "PIN" no hay que inventarlo — cuando el dedo no
      // lee, Android y iOS ofrecen solos el PIN o el patron del aparato.
      experimental: { passkey: true },
    },
  }
);

/**
 * Si este aparato puede guardar un passkey.
 *
 * Falso en un navegador viejo y tambien en http:// que no sea localhost:
 * WebAuthn exige contexto seguro. Sin esta comprobacion, el boton de la
 * huella aparece y al tocarlo no pasa nada.
 */
export const hayHuella = () =>
  typeof window !== 'undefined' &&
  Boolean(window.PublicKeyCredential) &&
  window.isSecureContext;
