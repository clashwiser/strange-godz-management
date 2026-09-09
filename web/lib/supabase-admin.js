import { createClient } from '@supabase/supabase-js';

// SOLO servidor. Esta clave salta RLS: si alguna vez aparece en un componente
// con 'use client', queda expuesta en el navegador y se entrega la base entera.
// Sin NEXT_PUBLIC_ delante, Next.js no la incluye en el bundle del cliente.
//
// Se crea PEREZOSAMENTE, en la primera peticion: durante el build de Vercel
// las variables de entorno no estan puestas y createClient tira
// "supabaseUrl is required", tumbando el despliegue entero.
let cliente = null;

function obtener() {
  if (cliente) return cliente;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en Vercel');
  }

  cliente = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cliente;
}

// Proxy para poder seguir escribiendo `admin.from(...)` sin crear nada
// hasta que llegue la primera peticion real.
export const admin = new Proxy(
  {},
  {
    get(_t, prop) {
      const c = obtener();
      const v = c[prop];
      return typeof v === 'function' ? v.bind(c) : v;
    },
  }
);
