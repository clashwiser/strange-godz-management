// Da de alta a un lider en el panel.
//
//   npm run lider:alta -- carlosperez030205@gmail.com Carlos
//
// NO crea la cuenta de acceso: eso se hace en Supabase (Authentication ->
// Users -> Add user) y es deliberado, porque crear cuentas y manejar
// contrasenas de otra persona no es algo que deba hacer un script -ni yo-
// por su cuenta. Esto es el paso de DESPUES.
//
// Que hace falta este paso: tener cuenta en Supabase no da acceso a nada.
// Todas las tablas estan detras de RLS con es_lider_autorizado(), que mira
// dashboard_users. Sin esta fila, el lider entra y ve el panel VACIO, sin
// un solo error que explique por que — que es la peor forma de fallar.
//
// Enlaza ademas con su fila de `owners`, que es de donde salen los premios.

import { db, chk } from '../lib/db.js';

const correo = (process.argv[2] || '').trim().toLowerCase();
const nombre = (process.argv[3] || '').trim();
const soloLectura = process.argv.includes('--solo-lectura');

if (!correo || !nombre) {
  console.error('Uso: npm run lider:alta -- <correo> <Nombre> [--solo-lectura]');
  console.error('El <Nombre> tiene que coincidir con el de la tabla owners.');
  process.exit(1);
}

// La lista de usuarios de auth solo la puede leer la service_role, que es la
// que usa db.js. Nunca llega al navegador.
const { data: lista, error: errAuth } = await db.auth.admin.listUsers({ perPage: 200 });
if (errAuth) {
  console.error('No se pudo leer los usuarios:', errAuth.message);
  process.exit(1);
}

const usuario = (lista?.users ?? []).find((u) => (u.email || '').toLowerCase() === correo);
if (!usuario) {
  console.error(`No existe ninguna cuenta con ${correo}.`);
  console.error('Creala primero en Supabase: Authentication -> Users -> Add user.');
  console.error('Con "Auto Confirm User" marcado y SIN contrasena ya alcanza: se entra');
  console.error('con el enlace por correo y desde dentro se registra la huella.');
  process.exit(1);
}

const owner = chk(
  await db.from('owners').select('id, nombre').ilike('nombre', nombre).maybeSingle(),
  'buscar owner'
);
if (!owner) {
  console.error(`No hay ningun owner llamado "${nombre}". Los que hay:`);
  const todos = chk(await db.from('owners').select('nombre').order('id'), 'listar owners');
  console.error('  ' + todos.map((o) => o.nombre).join(', '));
  process.exit(1);
}

chk(
  await db.from('dashboard_users').upsert(
    {
      user_id: usuario.id,
      nombre: owner.nombre,
      owner_id: owner.id,
      puede_editar: !soloLectura,
    },
    { onConflict: 'user_id' }
  ),
  'dar de alta'
);

console.log(`${owner.nombre} <${correo}> ya entra al panel.`);
console.log(`  owner #${owner.id} · ${soloLectura ? 'solo lectura' : 'puede editar'}`);
console.log('  Que haga: abrir el panel, escribir su correo, "Mándame un enlace al correo",');
console.log('  y una vez dentro tocar "Activar huella". Despues ya entra con el dedo.');
process.exit(0);
