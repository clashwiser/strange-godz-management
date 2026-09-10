// Registra (o consulta) el webhook de un bot en Telegram. Se corre una
// vez por bot, despues de desplegar el website en Vercel.
//
// Hay dos bots y cada uno tiene su webhook:
//
//   Heraldo (el de siempre)
//     WEBHOOK_URL=https://tu-app.vercel.app/api/telegram npm run tg:webhook
//
//   El de reclutar (nombre corto, va en la descripcion del clan)
//     BOT=recluta WEBHOOK_URL=https://tu-app.vercel.app/api/recluta npm run tg:webhook
//
// Sin WEBHOOK_URL solo muestra el estado actual, sin tocar nada.

const RECLUTA = process.env.BOT === 'recluta';

const TOKEN = RECLUTA ? process.env.RECLUTA_BOT_TOKEN : process.env.TELEGRAM_BOT_TOKEN;
const SECRETO = RECLUTA ? process.env.RECLUTA_SECRET_TOKEN : process.env.TELEGRAM_SECRET_TOKEN;
const URL_WEBHOOK = process.env.WEBHOOK_URL;
const RUTA = RECLUTA ? '/api/recluta' : '/api/telegram';
const NOMBRE_TOKEN = RECLUTA ? 'RECLUTA_BOT_TOKEN' : 'TELEGRAM_BOT_TOKEN';
const NOMBRE_SECRETO = RECLUTA ? 'RECLUTA_SECRET_TOKEN' : 'TELEGRAM_SECRET_TOKEN';

if (!TOKEN) {
  console.error(`Falta ${NOMBRE_TOKEN}`);
  process.exit(1);
}

const api = async (metodo, cuerpo) => {
  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/${metodo}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo ?? {}),
  });
  return res.json();
};

const yo = await api('getMe');
if (!yo.ok) {
  console.error('Token invalido:', yo.description);
  process.exit(1);
}
console.log(`Bot: @${yo.result.username} (${yo.result.first_name})${RECLUTA ? ' — reclutar' : ''}`);

if (!URL_WEBHOOK) {
  const info = await api('getWebhookInfo');
  console.log('\nEstado actual del webhook:');
  console.log(JSON.stringify(info.result, null, 2));
  console.log('\nPara registrarlo:');
  console.log(`  ${RECLUTA ? 'BOT=recluta ' : ''}WEBHOOK_URL=https://tu-app.vercel.app${RUTA} npm run tg:webhook`);
  process.exit(0);
}

// Un descuido facil: registrar el bot de reclutar apuntando a la ruta de
// Heraldo, o al reves. El secreto no casaria y todo devolveria 401 sin
// decir por que.
if (!URL_WEBHOOK.endsWith(RUTA)) {
  console.error(`\nEsa URL no termina en ${RUTA}. Para este bot el webhook es ...${RUTA}`);
  process.exit(1);
}

if (!SECRETO) {
  console.error(`\nFalta ${NOMBRE_SECRETO}.`);
  console.error('Sin el, cualquiera que adivine la URL puede inyectar mensajes falsos.');
  console.error('Genera uno: node -e "console.log(crypto.randomUUID())"');
  console.error('Y ponlo en Vercel con el mismo nombre, o el webhook devolvera 401.');
  process.exit(1);
}

const r = await api('setWebhook', {
  url: URL_WEBHOOK,
  secret_token: SECRETO,
  allowed_updates: ['message', 'edited_message'],
  drop_pending_updates: true,
});

if (!r.ok) {
  console.error('Fallo al registrar:', r.description);
  process.exit(1);
}

console.log(`\nWebhook registrado en ${URL_WEBHOOK}`);

const info = await api('getWebhookInfo');
console.log(`  pendientes: ${info.result.pending_update_count}`);
console.log(`  ultimo error: ${info.result.last_error_message ?? 'ninguno'}`);
console.log(RECLUTA ? '\nEscribele "hola" al bot en privado para probar.' : '\nEscribile /ayuda al bot para probar.');
