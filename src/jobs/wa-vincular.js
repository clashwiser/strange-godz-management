// Vinculacion del bot de WhatsApp. Se corre UNA VEZ, en local, desde la PC.
// Despues la sesion queda guardada en Supabase y GitHub Actions la usa sola.
//
//   npm run wa:vincular
//
// Con WA_NUMERO en el .env pide un codigo de 8 letras (mas comodo que el QR):
// en WhatsApp del numero secundario -> Dispositivos vinculados ->
// Vincular con numero de telefono -> escribir el codigo.
//
// IMPORTANTE: usar un numero SECUNDARIO. Baileys no es oficial y el numero
// se puede banear.

import qrcode from 'qrcode-terminal';
import { conectar, desconectar, marcarEstado } from '../lib/whatsapp.js';
import { db, chk } from '../lib/db.js';

const NUMERO = (process.env.WA_NUMERO || '').replace(/[^0-9]/g, '');

let pedido = false;

console.log('Conectando a WhatsApp...\n');

const sock = await conectar({
  timeoutMs: 180000, // 3 minutos: hay que darle tiempo a la persona
  onQR: async (qr) => {
    if (NUMERO && !pedido) {
      pedido = true;
      // Baileys necesita un instante tras el primer QR antes de aceptar
      // la peticion de codigo.
      setTimeout(async () => {
        try {
          const codigo = await sock.requestPairingCode(NUMERO);
          console.log('\n==========================================');
          console.log(`  CODIGO DE VINCULACION:  ${codigo}`);
          console.log('==========================================');
          console.log('  WhatsApp > Dispositivos vinculados >');
          console.log('  Vincular con numero de telefono\n');
        } catch (err) {
          console.error('No se pudo pedir el codigo:', err.message);
          console.log('Usa el QR de arriba.');
        }
      }, 2500);
      return;
    }
    console.log('Escanea este QR desde WhatsApp > Dispositivos vinculados:\n');
    qrcode.generate(qr, { small: true });
  },
});

const numero = sock.user?.id?.split(':')[0] ?? null;
console.log(`\nVinculado como: ${sock.user?.name ?? '?'} (${numero})\n`);

// Listar los grupos para que elijas el del clan.
console.log('Buscando grupos...');
const grupos = await sock.groupFetchAllParticipating();
const lista = Object.values(grupos).map((g) => ({ jid: g.id, nombre: g.subject, miembros: g.participants?.length ?? 0 }));

if (!lista.length) {
  console.log('No aparecen grupos. Agrega el numero al grupo del clan y vuelve a correr esto.');
} else {
  console.log('\n=== Grupos disponibles ===');
  for (const g of lista.sort((a, b) => b.miembros - a.miembros)) {
    console.log(`  ${g.jid}\n    "${g.nombre}"  (${g.miembros} miembros)`);
  }
  console.log('\nCopia el JID del grupo del clan y guardalo con:');
  console.log('  WA_GRUPO_JID=<el jid>  npm run wa:grupo');
}

await marcarEstado({ vinculado: true, numero, ultimo_ok: new Date().toISOString(), ultimo_error: null });

// Si pasaron el JID por entorno, lo dejamos guardado de una.
if (process.env.WA_GRUPO_JID) {
  chk(
    await db.from('wa_estado').update({ grupo_jid: process.env.WA_GRUPO_JID }).eq('id', 1),
    'guardar grupo_jid'
  );
  console.log(`\nGrupo guardado: ${process.env.WA_GRUPO_JID}`);
}

console.log('\nListo. La sesion quedo en Supabase (tabla wa_auth).');
console.log('GitHub Actions ya puede mandar mensajes sin tu PC.');

await desconectar(sock);
process.exit(0);
