// Registra (o consulta) el webhook del bot en Telegram. Se corre una vez,
// despues de desplegar el website en Vercel.
//
//   WEBHOOK_URL=https://tu-app.vercel.app/api/telegram npm run tg:webhook
//
// Sin WEBHOOK_URL solo muestra el estado actual, sin tocar nada.

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const URL_WEBHOOK = process.env.WEBHOOK_URL;
const SECRETO = process.env.TELEGRAM_SECRET_TOKEN;

if (!TOKEN) {
  console.error('Falta TELEGRAM_BOT_TOKEN');
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
console.log(`Bot: @${yo.result.username} (${yo.result.first_name})`);

if (!URL_WEBHOOK) {
  const info = await api('getWebhookInfo');
  console.log('\nEstado actual del webhook:');
  console.log(JSON.stringify(info.result, null, 2));
  console.log('\nPara registrarlo:');
  console.log('  WEBHOOK_URL=https://tu-app.vercel.app/api/telegram npm run tg:webhook');
  process.exit(0);
}

if (!SECRETO) {
  console.error('\nFalta TELEGRAM_SECRET_TOKEN.');
  console.error('Sin el, cualquiera que adivine la URL puede inyectar mensajes falsos.');
  console.error('Genera uno: node -e "console.log(crypto.randomUUID())"');
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
console.log('\nEscribile /ayuda al bot para probar.');
