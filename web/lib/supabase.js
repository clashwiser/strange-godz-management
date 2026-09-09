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
  ANON || 'placeholder-anon-key'
);
