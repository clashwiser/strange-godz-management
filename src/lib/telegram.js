// Notificaciones por Telegram. Gratis, sin limites relevantes, soporta
// grupos y no depende de ninguna PC encendida.
//
// Setup: hablarle a @BotFather -> /newbot -> guarda el token.
// Crear un grupo con los 3 lideres, meter al bot, y sacar el chat_id con:
//   https://api.telegram.org/bot<TOKEN>/getUpdates

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

export const telegramConfigurado = Boolean(TOKEN && CHAT_ID);

/**
 * Traduce el formato de WhatsApp al HTML de Telegram.
 *
 * Los mensajes se escriben una sola vez con marcas de WhatsApp (*negrita*,
 * _cursiva_, triple acento grave para monoespaciado) porque el clan vive
 * ahi. Telegram no las entiende y mostraria los asteriscos tal cual.
 *
 * Escapa ANTES de formatear. Al reves, un jugador llamado "<Rey>" hace que
 * Telegram responda 400 "can't parse entities" y el aviso se pierda entero
 * y sin ruido: avisar() traga el error para no tumbar el job. Hoy ningun
 * nombre tiene esos caracteres, pero en Clash la gente se renombra cuando
 * quiere y esto solo se notaria el dia que la alerta hiciera falta.
 */
export function aHtmlTelegram(texto) {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Partir por el delimitador de bloque deja los trozos alternados: los
  // indices pares quedan fuera del bloque y los impares dentro. Dentro no
  // se interpreta negrita ni cursiva, igual que en WhatsApp.
  return texto
    .split('```')
    .map((parte, i) =>
      i % 2 === 1
        ? `<pre>${esc(parte)}</pre>`
        : esc(parte)
            .replace(/\*([^*\n]+)\*/g, '<b>$1</b>')
            .replace(/_([^_\n]+)_/g, '<i>$1</i>')
    )
    .join('');
}

// El sitio publicado. De aqui salen las imagenes de Heraldo: Telegram las
// descarga solas si le pasas la URL, asi que no hay que subir nada.
const SITIO = (process.env.SITIO_URL || 'https://strange-godz-management.vercel.app').replace(/\/$/, '');

// Un pie de foto de Telegram tope a 1024 caracteres. Los partes rondan los
// 500, pero uno largo -siete clanes en zona de descenso- podria pasarse, y
// entonces sendPhoto falla ENTERO y el aviso no llega. Se comprueba antes.
const TOPE_PIE = 1024;

/**
 * Manda un mensaje. Si Telegram no esta configurado, lo escribe en el log
 * y sigue: nunca debe tumbar un job de ingesta por un fallo de aviso.
 *
 * Con `pose`, va con Heraldo EN VIDEO -cinco segundos leyendo, tocando la
 * corneta o dando la alarma- y el texto de pie. Es lo que hace que el
 * parte se lea como algo que dice alguien y no como otra notificacion mas
 * del monton.
 *
 * Es sendAnimation y no sendVideo a proposito: un MP4 sin sonido Telegram
 * lo trata como GIF, arranca solo y se repite. La escalera de respaldo es
 * video -> foto -> texto: un despliegue a medias, o un pie de mas de 1024
 * caracteres, nunca se lleva por delante el aviso.
 */
export async function avisar(texto, { silencioso = false, pose = null, menciones = [] } = {}) {
  if (!telegramConfigurado) {
    console.log('[telegram] no configurado, mensaje no enviado:\n' + texto);
    return false;
  }
  let html = aHtmlTelegram(texto);

  // Menciones al final, DESPUES de convertir. aHtmlTelegram escapa < y >,
  // asi que un enlace metido en el texto de origen saldria como texto
  // literal. Va aparte y en crudo.
  //
  // El formato tg://user?id= funciona aunque la persona no tenga @usuario
  // puesto, que es lo normal, y le hace sonar el telefono de verdad. Sin
  // esto el aviso es una lista de nombres que nadie lee: el que no ataco
  // es justo el que no esta mirando el grupo.
  if (menciones.length) {
    const enlaces = menciones
      .map((m) => `<a href="tg://user?id=${m.id}">${aHtmlTelegram(m.nombre).replace(/<[^>]*>/g, '')}</a>`)
      .join(' ');
    html += `

👉 ${enlaces}`;
  }
  // Con Heraldo delante solo si el pie cabe; si no, texto y no se pierde nada.
  const conPose = Boolean(pose) && html.length <= TOPE_PIE;

  // La escalera: video, foto, texto. Cada peldaño solo se prueba si el
  // anterior fallo, y el ultimo no puede fallar por la imagen.
  const intentos = conPose
    ? [
        ['sendAnimation', { animation: `${SITIO}/heraldo-${pose}.mp4`, caption: html }],
        ['sendPhoto', { photo: `${SITIO}/heraldo-${pose}.jpg`, caption: html }],
        ['sendMessage', { text: html }],
      ]
    : [['sendMessage', { text: html }]];

  for (const [metodo, cuerpo] of intentos) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${TOKEN}/${metodo}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: CHAT_ID,
          parse_mode: 'HTML',
          disable_notification: silencioso,
          ...cuerpo,
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (res.ok) return true;
      const detalle = await res.text().catch(() => '');
      console.error(`[telegram] ${metodo} error`, res.status, detalle);
    } catch (err) {
      console.error(`[telegram] ${metodo} fallo:`, err);
    }
    if (metodo !== 'sendMessage') console.error('[telegram] reintento con el siguiente peldaño');
  }
  return false;
}
