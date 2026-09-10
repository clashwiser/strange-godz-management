// La conversacion con quien quiere entrar.
//
// Esta aqui y no dentro de un webhook porque la usan DOS bots:
//
//   @Strange_godz_heraldo_bot   el de siempre, por si alguien le escribe
//   el bot de reclutar          nombre corto, es el que va en la
//                               descripcion del clan
//
// Uno solo, el largo, obligaba a teclear 24 caracteres desde la pantalla
// del juego. Dos bots con dos copias de esta conversacion es la forma
// segura de que en tres meses digan cosas distintas. Asi que la
// conversacion es una y cada webhook solo pone su token para contestar.
//
// Lo que NO cambia con el bot: quien avisa a los lideres y quien pregunta
// si alguien es de casa. Eso lo hace siempre Heraldo, porque es el que
// esta dentro del grupo -getChatAdministrators y getChatMember solo
// funcionan desde dentro- y porque los lideres ya hablan con el.
//
// El estado va en la tabla y no en memoria: Vercel apaga la funcion entre
// mensaje y mensaje, asi que cualquier cosa guardada en una variable se
// pierde antes de que la persona termine de escribir la siguiente linea.

import { leerTag, resumir, ficha } from './aspirante';
import { pedirPerfil } from './coc-perfil';

const HERALDO = process.env.TELEGRAM_BOT_TOKEN;
const SITIO = (process.env.SITIO_URL || 'https://strange-godz-management.vercel.app').replace(/\/$/, '');

/** El grupo de la comunidad: el id negativo de la lista blanca. */
const GRUPO = (process.env.TELEGRAM_CHAT_ID || '')
  .split(',')
  .map((s) => s.trim())
  .find((x) => x.startsWith('-'));

export const esc = (s) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Cada bot habla como quien es. La conversacion es la misma -los pasos,
// las comprobaciones, lo que se guarda-; lo que cambia es la voz.
//
// Valquiria no ruega: elige. Es la que mira como peleaste y decide si
// vales para el ejercito de los dioses, y esa actitud es la correcta para
// un clan que quiere calidad. Heraldo, en cambio, es el que da los partes
// y anota en el pergamino. Ver web/public/valquiria.png.
// Valquiria es mujer y cubana: dulce en la boca -mi cielo, mi vida, mi
// corazon- y firme en lo que dice. Las ternuras van variando de frase en
// frase a proposito: la misma catorce veces seguidas es lo que hace que un
// bot suene a bot.
//
// Y un detalle que se vio al probarla: Valquiria NO esta en el grupo, ahi
// esta Heraldo. Decirle a alguien de casa "escribeme en el grupo" era
// mandarlo a una puerta que ella no atiende.
const VOZ = {
  recluta: {
    deCasa:
      'Tú ya eres de casa, mi cielo. Aquí solo atiendo a los que quieren entrar; ' +
      'para lo demás tienes a Heraldo en el grupo.',
    saludo:
      `⚔️ <b>¡Alto ahí, guerrero!</b>\n\n` +
      `Soy <b>Valquiria</b>, mi vida. Yo elijo quién entra al ejército de <b>Strange Godz</b>, ` +
      `y no lo decido por lo que me cuentes: lo decido por cómo peleaste.\n\n` +
      `Pásame tu <b>tag de jugador</b>. Está en el juego, debajo de tu nombre, y empieza con #.\n\n` +
      `Algo así: <code>#9VLQ0CR99</code>`,
    yaAceptado: '✅ Ya estás elegido, mi corazón. Si perdiste el enlace, dímelo y te lo mando otra vez.',
    cerrada: 'Tu solicitud está cerrada por ahora, mi cielo. Gracias por escribirme.',
    esperando: 'Ya te tengo anotado, mi vida. Paciencia, que los líderes no viven aquí dentro. ⚔️',
    noTag:
      `Eso no es un tag, mi cielo.\n\n` +
      `Ábrelo en el juego: toca tu nombre arriba a la izquierda y ahí sale, debajo, empezando con #. ` +
      `Cópialo y pégamelo tal cual.`,
    sinPerfil: (tag) =>
      `No pude ver tu perfil con <code>${tag}</code>, mi corazón, pero te anoto igual.\n\n` +
      `Una cosa más y te dejo: cuéntame en un mensaje de dónde sales, ` +
      `a qué hora sueles jugar y por qué quieres entrar.`,
    encontrado: 'Te encontré, mi cielo ⚔️',
    eresTu: '¿Eres tú? Dime <b>sí</b> o <b>no</b>.',
    otroTag: 'Está bien, mi vida. Pásame el tag bueno y empezamos otra vez.',
    noEntendi: 'No te entendí, cariño. ¿Ese eres tú? Dime <b>sí</b> o <b>no</b>.',
    ultima:
      `Bien, mi corazón. Una cosa más y te dejo:\n\n` +
      `Cuéntame en un mensaje <b>de dónde sales, a qué hora sueles jugar y por qué quieres entrar</b>.`,
    listo:
      `⚔️ <b>Anotado, mi cielo.</b> Ya sé cómo peleas.\n\n` +
      `Ahora lo miran los líderes. Si te eligen te escribo por aquí con la puerta del clan.\n\n` +
      `Y para que no te pille de sorpresa: cuando entres se te reta a una <b>amistosa</b>. ` +
      `No es un examen, mi vida; es para saber en qué guerra ponerte.`,
  },
  heraldo: {
    deCasa:
      'Tú ya eres de casa, mi hermano. Escríbeme en el grupo, que aquí solo atiendo a los que quieren entrar.',
    saludo:
      `📯 <b>¡Alto ahí, forastero!</b>\n\n` +
      `Soy Heraldo, el que lleva la lista de la alianza <b>Strange Godz</b>. ` +
      `Si quieres entrar a uno de nuestros clanes esto son dos minutos.\n\n` +
      `Lo primero: pásame tu <b>tag de jugador</b>. Está en el juego, debajo de tu nombre, y empieza con #.\n\n` +
      `Algo así: <code>#9VLQ0CR99</code>`,
    yaAceptado: '✅ Ya estás aceptado, socio. Si perdiste el enlace, dímelo.',
    cerrada: 'Tu solicitud está cerrada por ahora, mi hermano. Gracias por el interés.',
    esperando: 'Ya tengo tu solicitud anotada, socio. Ten paciencia, que los líderes no viven aquí dentro. 📜',
    noTag:
      `Eso no me parece un tag, mi hermano.\n\n` +
      `Ábrelo en el juego: toca tu nombre arriba a la izquierda y ahí sale, debajo, empezando con #. ` +
      `Cópialo y pégamelo tal cual.`,
    sinPerfil: (tag) =>
      `No pude sacar tu perfil con <code>${tag}</code>, pero lo anoto igual.\n\n` +
      `Última cosa y te dejo tranquilo: cuéntame en un mensaje de dónde sales, ` +
      `a qué hora sueles jugar y por qué quieres entrar.`,
    encontrado: 'Te encontré 📜',
    eresTu: '¿Eres tú? Responde <b>sí</b> o <b>no</b>.',
    otroTag: 'Pues nada, pásame el tag bueno y volvemos a empezar.',
    noEntendi: 'No te entendí, socio. ¿Ese eres tú? Dime <b>sí</b> o <b>no</b>.',
    ultima:
      `Perfecto. Última cosa y te dejo tranquilo:\n\n` +
      `Cuéntame en un mensaje <b>de dónde sales, a qué hora sueles jugar y por qué quieres entrar</b>.`,
    listo:
      `📯 <b>Listo.</b> Tu solicitud queda anotada en mi pergamino.\n\n` +
      `Ahora la miran los líderes. Si te aceptan te escribo por aquí con el enlace del clan.\n\n` +
      `Te adelanto una cosa para que no te pille de sorpresa: cuando entres se te reta a una ` +
      `<b>amistosa</b> para ver cómo atacas. No es para suspenderte, es para saber dónde ponerte.`,
  },
};

const SI = /\b(si|sí|yo|ese soy|soy yo|correcto|exacto|claro|dale|afirmativo|ok|okey|asi es|así es)\b/i;
const NO = /\b(no|nel|negativo|equivocado|ese no|otro)\b/i;

/** Lo pregunta Heraldo, que es el que esta en el grupo. Falla cerrado. */
async function esAdminDelGrupo(uid) {
  if (!HERALDO || !GRUPO || !uid) return false;
  try {
    const r = await fetch(
      `https://api.telegram.org/bot${HERALDO}/getChatMember?chat_id=${GRUPO}&user_id=${uid}`
    );
    const j = await r.json();
    return ['creator', 'administrator'].includes(j?.result?.status);
  } catch {
    return false;
  }
}

/**
 * Manda un mensaje con el token que se le diga. Devuelve true si salio.
 * Sin reintentos ni fotos: aqui todo es texto.
 */
export async function decirCon(token, chatId, texto) {
  if (!token) return false;
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: texto,
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
      }),
    });
    return r.ok;
  } catch {
    return false;
  }
}

/**
 * Manda un video corto con el texto de pie. Es sendAnimation y no
 * sendVideo a proposito: un MP4 sin sonido Telegram lo trata como GIF,
 * arranca solo y se repite, que es lo que quiere una mascota que saluda.
 *
 * Si Telegram no puede con el video -la URL todavia no esta publicada, o
 * pesa de mas- sale el texto solo. Perder la bienvenida entera por la
 * imagen seria absurdo.
 */
export async function decirConVideo(token, chatId, urlVideo, pie) {
  if (!token) return false;
  if (urlVideo && pie.length <= 1024) {
    try {
      const r = await fetch(`https://api.telegram.org/bot${token}/sendAnimation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, animation: urlVideo, caption: pie, parse_mode: 'HTML' }),
      });
      if (r.ok) return true;
    } catch {
      /* al texto */
    }
  }
  return decirCon(token, chatId, pie);
}

/**
 * Un mensaje de alguien de fuera. Devuelve el texto a contestar, o null
 * para no contestar nada. El que llama lo manda con SU token.
 *
 * @param {object} admin  cliente de Supabase con service_role
 * @param {object} msg    el message de Telegram
 * @param {string} texto  lo que escribio, ya recortado
 * @param {'heraldo'|'recluta'} via  por que bot entro; decide con cual
 *                        se le contesta despues, al aceptarlo o no
 */
export async function flujoSolicitud(admin, msg, texto, via) {
  const uid = msg.from?.id;
  if (!uid) return null;
  const v = VOZ[via] ?? VOZ.heraldo;

  const { data: sol } = await admin
    .from('solicitudes')
    .select('*')
    .eq('tg_user_id', uid)
    .maybeSingle();

  // Primera vez que escribe.
  if (!sol) {
    // Los de casa no solicitan nada. Se comprueba solo aqui y no en cada
    // mensaje: es una llamada a Telegram, y repetirla en cada linea de la
    // conversacion es gastarla veinte veces para la misma respuesta.
    const { data: atado } = await admin
      .from('tg_vinculos')
      .select('player_tag')
      .eq('tg_user_id', uid)
      .maybeSingle();
    if (atado || (await esAdminDelGrupo(uid))) return v.deCasa;

    await admin.from('solicitudes').insert({
      tg_user_id: uid,
      tg_nombre: msg.from?.first_name ?? null,
      tg_username: msg.from?.username ?? null,
      paso: 'tag',
      estado: 'borrador',
      via,
    });
    return v.saludo;
  }

  // Freno de mano. Sin esto, quien se ponga a machacar el teclado dispara
  // una consulta a Supercell por cada linea.
  if (Date.now() - new Date(sol.actualizado_en).getTime() < 1200) return null;

  const guardar = (parche) =>
    admin
      .from('solicitudes')
      .update({ ...parche, actualizado_en: new Date().toISOString() })
      .eq('tg_user_id', uid);

  // Ya la mandó: no se le vuelve a preguntar nada.
  if (sol.paso === 'listo') {
    if (sol.estado === 'aceptada') return v.yaAceptado;
    if (sol.estado === 'rechazada') return v.cerrada;
    return v.esperando;
  }

  if (sol.paso === 'tag') {
    const tag = leerTag(texto);
    if (!tag) return v.noTag;

    const perfil = await pedirPerfil(tag);
    if (!perfil) {
      // Puede ser un tag mal copiado o que la llave de Clash no esté
      // puesta. Se guarda igual y que siga: dejar a alguien plantado a
      // mitad es peor que una ficha incompleta que el líder mira a mano.
      await guardar({ player_tag: tag, paso: 'cuenta' });
      return v.sinPerfil(esc(tag));
    }

    const r = resumir(perfil);
    await guardar({ player_tag: r.tag, perfil: r, paso: 'confirmar' });
    return (
      `${v.encontrado}\n\n` +
      `<b>${esc(r.nombre)}</b> · TH${r.th}\n` +
      (r.clan ? `Ahora mismo en <b>${esc(r.clan.nombre)}</b>\n` : `Sin clan ahora mismo\n`) +
      `\n${v.eresTu}`
    );
  }

  if (sol.paso === 'confirmar') {
    if (NO.test(texto)) {
      await guardar({ paso: 'tag', player_tag: null, perfil: null });
      return v.otroTag;
    }
    if (!SI.test(texto)) return v.noEntendi;
    await guardar({ paso: 'cuenta' });
    return v.ultima;
  }

  if (sol.paso === 'cuenta') {
    // Se corta a 600: es una presentacion, no una carta, y sin tope
    // cualquiera puede llenar la tabla desde el telefono.
    const cuenta = texto.slice(0, 600);
    await guardar({
      paso: 'listo',
      estado: 'pendiente',
      respuestas: { ...(sol.respuestas ?? {}), cuenta },
      creado_en: new Date().toISOString(),
    });

    // Que no se caiga la respuesta al aspirante si falla el aviso.
    try {
      await avisarLideres({ ...sol, respuestas: { cuenta } });
    } catch {
      /* el lider la vera igual en el panel */
    }

    return v.listo;
  }

  return null;
}

/**
 * Avisa por privado a los líderes de que hay alguien esperando.
 *
 * Lo manda HERALDO aunque la solicitud haya entrado por el otro bot: los
 * lideres ya hablan con Heraldo, y para saber quien es lider hay que
 * preguntarle al grupo, donde solo esta Heraldo.
 *
 * Quien es líder lo dice Telegram con getChatAdministrators, no una lista
 * en una variable de entorno que hay que acordarse de tocar.
 *
 * Solo llega a quien le haya dado alguna vez a "Empezar" a Heraldo:
 * Telegram no deja escribirle primero a nadie. Al que no lo haya hecho, el
 * envio falla con 403 y se salta sin ruido — la solicitud sigue en el
 * panel, que es donde de verdad se decide.
 */
async function avisarLideres(sol) {
  if (!HERALDO || !GRUPO) return;
  const res = await fetch(
    `https://api.telegram.org/bot${HERALDO}/getChatAdministrators?chat_id=${GRUPO}`
  );
  const j = await res.json();
  const admins = (j?.result ?? []).filter((a) => !a.user?.is_bot);
  if (!admins.length) return;

  const r = sol.perfil;
  const quien = sol.tg_username ? `@${sol.tg_username}` : sol.tg_nombre || 'sin nombre';
  const aviso =
    `📬 <b>SOLICITUD NUEVA</b>\n\n` +
    (r ? `${ficha(r, esc)}\n\n` : `Tag: <code>${esc(sol.player_tag ?? '?')}</code> (sin ficha)\n\n`) +
    `💬 <i>${esc(sol.respuestas?.cuenta ?? '')}</i>\n\n` +
    `Telegram: ${esc(quien)}\n\n` +
    `Decide en el panel: ${SITIO}`;

  for (const a of admins) {
    await decirCon(HERALDO, a.user.id, aviso);
  }
}
