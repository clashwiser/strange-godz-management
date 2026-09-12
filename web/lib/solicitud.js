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

import {
  leerTag,
  resumir,
  ficha,
  PLENO,
  CLANES,
  PRUEBA,
  banderasRespuestas,
  resumenRespuestas,
} from './aspirante.js';
import { pedirPerfil } from './coc-perfil.js';
import { entenderValquiria, cuantosEsperan } from './charla-valquiria.js';
import { pensar, thDe } from './pensar.js';
import { esPreguntaDelJuego } from './conocimiento.js';
import { leccionPara, reglasDelClan } from './entrenamiento.js';

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
      `y no me fijo en las estrellas: me fijo en cómo peleas. Te hago cuatro preguntas y te pido que me lo enseñes. Tres minutos.\n\n` +
      `Lo primero: pásame tu <b>tag de jugador</b>. Está en el juego, debajo de tu nombre, y empieza con #.\n\n` +
      `Algo así: <code>#9VLQ0CR99</code>`,
    yaAceptado: '✅ Ya estás elegido, mi corazón. Si perdiste el enlace, dímelo y te lo mando otra vez.',
    cerrada: 'Tu solicitud está cerrada por ahora, mi cielo. Gracias por escribirme.',
    esperando: 'Ya te tengo anotado, mi vida. Paciencia, que los líderes no viven aquí dentro. ⚔️',
    noTag:
      `Eso no es un tag, mi cielo.\n\n` +
      `Ábrelo en el juego: toca tu nombre arriba a la izquierda y ahí sale, debajo, empezando con #. ` +
      `Cópialo y pégamelo tal cual.`,
    sinPerfil: (tag) => `No pude ver tu perfil con <code>${tag}</code>, mi corazón, pero te anoto igual y seguimos.`,
    encontrado: 'Te encontré, mi cielo ⚔️',
    eresTu: '¿Eres tú? Dime <b>sí</b> o <b>no</b>.',
    otroTag: 'Está bien, mi vida. Pásame el tag bueno y empezamos otra vez.',
    noEntendi: 'No te entendí, cariño. ¿Ese eres tú? Dime <b>sí</b> o <b>no</b>.',
    tocaBoton: 'Tócame uno de los botones, mi cielo, que así es más rápido.',
    pleno: `🎯 Primera, mi corazón: <b>¿con qué frecuencia haces tres estrellas en guerra?</b> Sé sincero, que se nota después.`,
    ejercito: `🪖 <b>¿Con qué ejército atacas normalmente en guerra?</b> Con una línea me vale, mi cielo: "dragones y globos", "hydra", "super archers"…`,
    heroe: (nombre) =>
      `🦸 Rápido, mi vida, sin mirar: <b>¿a qué nivel tienes tu ${nombre}?</b> Solo el número.`,
    heroeBien: 'Eso es, mi cielo. Se nota que la cuenta es tuya. ✅',
    heroeMal: 'Mmm. No es lo que veo yo, mi vida. Sigamos, que ya lo miran los líderes.',
    soloNumero: 'Solo el número, mi corazón. ¿A qué nivel lo tienes?',
    clanes: `🏰 <b>¿En cuántos clanes has estado en los últimos seis meses?</b>`,
    prueba:
      `🎬 Y ahora lo que de verdad me importa, mi cielo: <b>quiero verte atacar.</b>\n\n` +
      `Mándame un video de un ataque tuyo, o si prefieres, te retamos en amistosa cuando entres. Tú eliges.`,
    mandaVideo:
      `📹 Dale, mi vida. Mándame aquí el video de un ataque tuyo de guerra o de liga, el que más orgullo te dé. ` +
      `Si al final no lo tienes a mano, escribe <b>reto</b> y pasamos a la amistosa.`,
    esperoVideo: 'Sigo esperando el video, mi cielo. Mándalo aquí mismo, o escribe <b>reto</b> si prefieres la amistosa.',
    videoRecibido: '🎬 Recibido, mi corazón. Se lo paso a los líderes tal cual.',
    ultima:
      `Bien, mi corazón. Una cosa más y te dejo:\n\n` +
      `Cuéntame en un mensaje <b>de dónde sales, a qué hora sueles jugar y por qué quieres entrar</b>.`,
    reglas: (resumen, url) =>
      `📜 Ya casi, mi cielo. Antes de anotarte, léete las normas de la casa; aquí se juega en serio.\n\n${resumen}\n\n` +
      `Completas: ${url}\n\nSi las aceptas, toca el botón <b>He leído y acepto las normas</b> aquí debajo (o escríbeme <b>acepto</b>).`,
    reglasNo: (url) => `Sin aceptar las normas no sigo, mi cielo. Léelas aquí: ${url} y, si estás de acuerdo, toca el botón o dime <b>acepto</b>.`,
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
    sinPerfil: (tag) => `No pude sacar tu perfil con <code>${tag}</code>, pero lo anoto igual y seguimos.`,
    encontrado: 'Te encontré 📜',
    eresTu: '¿Eres tú? Responde <b>sí</b> o <b>no</b>.',
    otroTag: 'Pues nada, pásame el tag bueno y volvemos a empezar.',
    noEntendi: 'No te entendí, socio. ¿Ese eres tú? Dime <b>sí</b> o <b>no</b>.',
    tocaBoton: 'Dale a uno de los botones, mi hermano, que es más rápido.',
    pleno: `🎯 Primera: <b>¿con qué frecuencia haces tres estrellas en guerra?</b> Sé sincero, que después se nota.`,
    ejercito: `🪖 <b>¿Con qué ejército atacas normalmente en guerra?</b> Con una línea vale: "dragones y globos", "hydra", "super archers"…`,
    heroe: (nombre) => `🦸 Rápido, sin mirar: <b>¿a qué nivel tienes tu ${nombre}?</b> Solo el número.`,
    heroeBien: 'Correcto. Se nota que la cuenta es tuya. ✅',
    heroeMal: 'Mmm. No es lo que veo yo. Sigamos, que ya lo miran los líderes.',
    soloNumero: 'Solo el número, mi hermano. ¿A qué nivel lo tienes?',
    clanes: `🏰 <b>¿En cuántos clanes has estado en los últimos seis meses?</b>`,
    prueba:
      `🎬 Y ahora lo que de verdad importa: <b>queremos verte atacar.</b>\n\n` +
      `Mándame un video de un ataque tuyo, o si prefieres, te retamos en amistosa cuando entres. Tú eliges.`,
    mandaVideo:
      `📹 Dale. Mándame aquí el video de un ataque tuyo de guerra o de liga, el que más orgullo te dé. ` +
      `Si no lo tienes a mano, escribe <b>reto</b> y pasamos a la amistosa.`,
    esperoVideo: 'Sigo esperando el video, socio. Mándalo aquí mismo, o escribe <b>reto</b> si prefieres la amistosa.',
    videoRecibido: '🎬 Recibido. Se lo paso a los líderes tal cual.',
    ultima:
      `Perfecto. Última cosa y te dejo tranquilo:\n\n` +
      `Cuéntame en un mensaje <b>de dónde sales, a qué hora sueles jugar y por qué quieres entrar</b>.`,
    reglas: (resumen, url) =>
      `📜 Ya casi. Antes de anotarte, lee las normas de la casa; aquí se juega en serio.\n\n${resumen}\n\n` +
      `Completas: ${url}\n\nSi las aceptas, dale al botón <b>He leído y acepto las normas</b> aquí debajo (o escríbeme <b>acepto</b>).`,
    reglasNo: (url) => `Sin aceptar las normas no sigo, mi hermano. Léelas aquí: ${url} y, si estás de acuerdo, dale al botón o dime <b>acepto</b>.`,
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
export async function esAdminDelGrupo(uid) {
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
 *
 * Acepta texto suelto o {texto, teclado}: el teclado son botones que
 * aparecen debajo del cuadro de escribir y se van al tocar uno. Es lo que
 * hace que "¿con que frecuencia haces pleno?" se conteste con un toque y
 * no escribiendo "el 75 por ciento mas o menos". Sin teclado, se quita el
 * que hubiera, para que no se quede colgado de la pregunta anterior.
 */
/**
 * "Escribiendo..." en el chat durante unos segundos. Se manda antes de
 * preguntarle a la IA: con busqueda web son varios segundos, y un grupo en
 * silencio despues de nombrar al bot parece un bot roto. Nunca falla hacia
 * fuera; es cosmetica.
 */
export async function escribiendo(token, chatId) {
  if (!token || !chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendChatAction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, action: 'typing' }),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    /* cosmetica */
  }
}

export async function decirCon(token, chatId, respuesta) {
  if (!token || !respuesta) return false;
  const { texto, teclado, botones } = typeof respuesta === 'string' ? { texto: respuesta } : respuesta;
  // Dos clases de botones: el teclado de respuesta (teclado: abajo, en vez
  // del teclado del telefono; al tocarlo manda ese texto) y los botones EN
  // el mensaje (botones: inline_keyboard; con callback_data o con url).
  // Telegram solo admite uno de los dos por mensaje.
  const markup = botones
    ? { inline_keyboard: botones }
    : teclado
      ? { keyboard: teclado.map((fila) => fila.map((t) => ({ text: t }))), one_time_keyboard: true, resize_keyboard: true }
      : { remove_keyboard: true };
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: texto,
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
        reply_markup: markup,
      }),
    });
    if (!r.ok) return false;
    // El id del mensaje mandado: para que un lider pueda contestarlo y el
    // bot sepa a que se refiere (castillos.js).
    const j = await r.json().catch(() => null);
    return j?.result?.message_id ?? true;
  } catch {
    return false;
  }
}

/**
 * Reenvia un mensaje -el video del aspirante- a otro chat. No se vuelve a
 * subir nada: Telegram lo copia de un chat a otro, sin tope de tamaño.
 */
export async function reenviarCon(token, aChat, deChat, messageId) {
  if (!token) return false;
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/forwardMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: aChat, from_chat_id: deChat, message_id: messageId }),
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
 * Un mensaje de alguien de fuera. Devuelve lo que hay que contestar -un
 * texto, o {texto, teclado} con botones- o null para no contestar nada.
 * El que llama lo manda con SU token.
 *
 * La entrevista, paso a paso. Cada uno es un toque o una linea:
 *
 *   tag        pasame tu tag -> ficha de Supercell
 *   confirmar  ¿eres tu?
 *   pleno      ¿con que frecuencia haces tres estrellas?     (botones)
 *   ejercito   ¿con que ejercito atacas en guerra?           (texto)
 *   heroe      ¿a que nivel tienes tu {heroe al azar}?       (numero)
 *   clanes     ¿en cuantos clanes has estado en 6 meses?     (botones)
 *   prueba     ¿video de un ataque, o reto al entrar?        (botones)
 *   video      (solo si eligio video) esperando el archivo
 *   cuenta     de donde sales, a que hora juegas, por que
 *   listo      avisados los lideres
 *
 * Por que no basta con el perfil: las estrellas engañan en los dos
 * sentidos. Una cuenta nueva tiene pocas y puede ser un jugador bueno; una
 * cuenta comprada tiene muchas y detras puede no haber nadie que sepa
 * atacar. De ahi las tres cosas que el perfil no cuenta:
 *
 *   - el ejercito, para ver si cuadra con su TH (un TH16 que "ataca con
 *     gigantes" es cuenta comprada o novato)
 *   - el nivel de un heroe, comparado con la API y cronometrado: el dueño
 *     de verdad lo sabe sin mirar
 *   - verlo atacar, en video o en amistosa al entrar
 *
 * @param {object} admin  cliente de Supabase con service_role
 * @param {object} msg    el message de Telegram entero (puede traer video)
 * @param {string} texto  lo que escribio, ya recortado ('' si mando archivo)
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
    if (!texto) return null;
    // Los de casa no solicitan nada. Se comprueba solo aqui y no en cada
    // mensaje: es una llamada a Telegram, y repetirla en cada linea de la
    // conversacion es gastarla veinte veces para la misma respuesta.
    const { data: atado } = await admin
      .from('tg_vinculos')
      .select('player_tag')
      .eq('tg_user_id', uid)
      .limit(1)
      .maybeSingle();
    if (atado || (await esAdminDelGrupo(uid))) {
      // Los de casa no solicitan, pero con Valquiria pueden hablar: tiene
      // cerebro para eso. Con Heraldo en privado no, que lo suyo es el grupo.
      if (via !== 'recluta') return v.deCasa;
      // Primero lo que le enseñaron los lideres desde la pestaña Bots.
      const enseñado = await leccionPara(admin, 'valquiria', texto, msg.from?.first_name);
      if (enseñado) return esc(enseñado);
      const leido = entenderValquiria(texto);
      if (leido?.tipo === 'esperando') {
        const { count } = await admin
          .from('solicitudes')
          .select('*', { count: 'exact', head: true })
          .in('estado', ['pendiente', 'prueba']);
        return cuantosEsperan(count ?? 0);
      }
      // Pregunta del juego: IA con busqueda web, antes que la frase. Lo
      // que ninguna frase entiende: IA sin web. Si la IA no puede, la frase.
      const buscar = esPreguntaDelJuego(texto);
      if (buscar || leido?.categoria === 'no entiendo') {
        await escribiendo(process.env.RECLUTA_BOT_TOKEN, uid);
        const th = buscar ? await thDe(admin, uid) : null;
        return (await pensar(admin, 'valquiria', texto, msg.from?.first_name, { buscar, th })) ?? leido?.texto ?? v.deCasa;
      }
      return leido?.texto ?? v.deCasa;
    }

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
  const haceMs = Date.now() - new Date(sol.actualizado_en).getTime();
  if (haceMs < 1200) return null;

  const resp = sol.respuestas ?? {};
  const guardar = (parche) =>
    admin
      .from('solicitudes')
      .update({ ...parche, actualizado_en: new Date().toISOString() })
      .eq('tg_user_id', uid);
  const responder = (parche) => guardar({ respuestas: { ...resp, ...parche } });

  // Ya la mandó: no se le vuelve a preguntar nada.
  if (sol.paso === 'listo') {
    if (sol.estado === 'aceptada') return v.yaAceptado;
    if (sol.estado === 'rechazada') return v.cerrada;
    return v.esperando;
  }

  // Un video solo se espera en su paso. Fuera de el, un archivo suelto se
  // ignora y se repite la pregunta que toca.
  const video = msg.video ?? msg.video_note ?? (msg.document?.mime_type?.startsWith('video/') ? msg.document : null);
  if (!texto && !video) return null;

  if (sol.paso === 'tag') {
    const tag = leerTag(texto);
    if (!tag) return v.noTag;

    const perfil = await pedirPerfil(tag);
    if (!perfil) {
      // Puede ser un tag mal copiado o que la llave de Clash no esté
      // puesta. Se guarda igual y que siga: dejar a alguien plantado a
      // mitad es peor que una ficha incompleta que el líder mira a mano.
      await guardar({ player_tag: tag, paso: 'pleno' });
      return { texto: v.sinPerfil(esc(tag)) + '\n\n' + v.pleno, teclado: tecladoDe(PLENO) };
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
    await guardar({ paso: 'pleno' });
    return { texto: v.pleno, teclado: tecladoDe(PLENO) };
  }

  if (sol.paso === 'pleno') {
    const clave = claveDe(PLENO, texto);
    if (!clave) return { texto: v.tocaBoton, teclado: tecladoDe(PLENO) };
    await guardar({ paso: 'ejercito', respuestas: { ...resp, pleno: clave } });
    return v.ejercito;
  }

  if (sol.paso === 'ejercito') {
    // Una palabra ya vale ("dragones"); se corta a 160 para que no cuele
    // una carta.
    const ejercito = texto.slice(0, 160);
    const heroe = elegirHeroe(sol.perfil);
    if (!heroe) {
      // Sin ficha o sin heroes -una cuenta muy nueva- no hay pregunta
      // trampa que hacer. Se salta.
      await guardar({ paso: 'clanes', respuestas: { ...resp, ejercito } });
      return { texto: v.clanes, teclado: tecladoDe(CLANES) };
    }
    await guardar({
      paso: 'heroe',
      respuestas: { ...resp, ejercito, heroe: { nombre: heroe.nombre, real: heroe.nivel } },
    });
    return v.heroe(heroe.nombre);
  }

  if (sol.paso === 'heroe') {
    const dijo = Number((texto.match(/\d+/) || [])[0]);
    if (!Number.isFinite(dijo)) return v.soloNumero;
    // Cronometrado desde que se hizo la pregunta: actualizado_en es el
    // momento en que se guardo el paso anterior. El dueño contesta en
    // segundos; el que tiene que abrir el juego a mirar, en minutos.
    const segundos = Math.round(haceMs / 1000);
    const h = resp.heroe ?? {};
    const acierta = Math.abs(dijo - Number(h.real)) <= 1;
    await guardar({
      paso: 'clanes',
      respuestas: { ...resp, heroe: { ...h, dijo, segundos, acierta } },
    });
    return { texto: (acierta ? v.heroeBien : v.heroeMal) + '\n\n' + v.clanes, teclado: tecladoDe(CLANES) };
  }

  if (sol.paso === 'clanes') {
    const clave = claveDe(CLANES, texto);
    if (!clave) return { texto: v.tocaBoton, teclado: tecladoDe(CLANES) };
    await guardar({ paso: 'prueba', respuestas: { ...resp, clanes: clave } });
    return { texto: v.prueba, teclado: tecladoDe(PRUEBA) };
  }

  if (sol.paso === 'prueba') {
    const clave = claveDe(PRUEBA, texto);
    if (!clave) return { texto: v.tocaBoton, teclado: tecladoDe(PRUEBA) };
    if (clave === 'video') {
      await guardar({ paso: 'video', respuestas: { ...resp, prueba: 'video' } });
      return v.mandaVideo;
    }
    await guardar({ paso: 'cuenta', respuestas: { ...resp, prueba: 'reto' } });
    return v.ultima;
  }

  if (sol.paso === 'video') {
    if (!video) {
      // Se arrepintio, o no sabe mandarlo: con "reto" o "no" pasa a la
      // amistosa y sigue. Cualquier otra cosa, se le recuerda que se
      // espera un video.
      if (/\b(reto|amistosa|no|paso|luego|despues|después)\b/i.test(texto)) {
        await guardar({ paso: 'cuenta', respuestas: { ...resp, prueba: 'reto' } });
        return v.ultima;
      }
      return v.esperoVideo;
    }
    await guardar({
      paso: 'cuenta',
      respuestas: {
        ...resp,
        video: {
          file_id: video.file_id,
          file_unique_id: video.file_unique_id,
          message_id: msg.message_id,
          chat_id: msg.chat.id,
          duracion: video.duration ?? null,
          bytes: video.file_size ?? null,
        },
      },
    });
    return v.videoRecibido + '\n\n' + v.ultima;
  }

  if (sol.paso === 'cuenta') {
    // Se corta a 600: es una presentacion, no una carta, y sin tope
    // cualquiera puede llenar la tabla desde el telefono.
    const cuenta = texto.slice(0, 600);
    const respuestas = { ...resp, cuenta };
    // Antes de cerrar, las normas: se leen y se aceptan. Es lo que pidio
    // Cris: nadie entra sin haberlas visto.
    await guardar({ paso: 'reglas', respuestas });
    const r = await reglasDelClan(admin);
    const resumen = r.resumen || r.texto.slice(0, 2500) || 'Las normas están en el enlace.';
    // Los botones van EN el mensaje (inline): el teclado de respuesta de
    // antes no siempre se veia en el telefono y la gente tocaba la frase en
    // negrita creyendo que era un enlace. Ver atenderBoton.
    return { texto: v.reglas(esc(resumen), `${SITIO}/reglas`), botones: botonesNormas(`${SITIO}/reglas`) };
  }

  if (sol.paso === 'reglas') {
    const acepta = /\b(acepto|aceptar|acepta|aceptado|acepta[dt]as?|le[ií]d[oa]|si|sí|ok|dale|de acuerdo|claro|vale|yes)\b/i.test(texto);
    if (!acepta) return { texto: v.reglasNo(`${SITIO}/reglas`), botones: botonesNormas(`${SITIO}/reglas`) };
    await guardar({ paso: 'listo', estado: 'pendiente', acepto_normas: true, creado_en: new Date().toISOString() });

    // Que no se caiga la respuesta al aspirante si falla el aviso.
    try {
      await avisarLideres({ ...sol, acepto_normas: true }, via);
    } catch {
      /* el lider la vera igual en el panel */
    }

    return v.listo;
  }

  return null;
}

/** Botones de una fila por opcion: en el telefono se leen mejor asi. */
const tecladoDe = (opciones) => opciones.map(([, etiqueta]) => [etiqueta]);

/** Lo que se toca en el mensaje de las normas: leerlas enteras, y aceptarlas. */
export const ACEPTO_NORMAS = 'acepto_normas';
const botonesNormas = (url) => [
  [{ text: '📖 Leer las normas completas', url }],
  [{ text: '✅ He leído y acepto las normas', callback_data: ACEPTO_NORMAS }],
];

/**
 * Un boton tocado en un mensaje del bot (callback_query). Hoy solo hay
 * uno: aceptar las normas en la entrevista. Se contesta el callback (que
 * el telefono deje de "cargar"), se quitan los botones del mensaje ya
 * tocado, y se sigue la conversacion como si hubiera escrito "acepto".
 * El que llama manda la respuesta con SU token.
 */
export async function atenderBoton(admin, token, cq, via) {
  const chatId = cq?.message?.chat?.id;
  const api = (metodo, cuerpo) =>
    fetch(`https://api.telegram.org/bot${token}/${metodo}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
      signal: AbortSignal.timeout(5000),
    }).catch(() => null);
  await api('answerCallbackQuery', { callback_query_id: cq.id });
  if (!chatId || cq.data !== ACEPTO_NORMAS) return;
  if (cq.message.chat.type !== 'private') return;
  await api('editMessageReplyMarkup', { chat_id: chatId, message_id: cq.message.message_id, reply_markup: { inline_keyboard: [] } });
  // El mensaje "es" del que toco el boton, no del bot que lo mando.
  const msg = { ...cq.message, from: cq.from, text: 'acepto' };
  const r = await flujoSolicitud(admin, msg, 'acepto', via);
  if (r) await decirCon(token, chatId, r);
}

/** Que boton toco. Acepta tambien la clave escrita ("75") por si teclea. */
function claveDe(opciones, texto) {
  const t = String(texto ?? '').trim().toLowerCase();
  const fila = opciones.find(([k, etiqueta]) => etiqueta.toLowerCase() === t || k === t);
  return fila ? fila[0] : null;
}

/** Un heroe al azar de los que tiene, para la pregunta trampa. */
function elegirHeroe(perfil) {
  const lista = perfil?.heroes ?? [];
  if (!lista.length) return null;
  return lista[Math.floor(Math.random() * lista.length)];
}

/**
 * Avisa por privado a los líderes de que hay alguien esperando.
 *
 * Lo manda HERALDO aunque la solicitud haya entrado por el otro bot: los
 * lideres ya hablan con Heraldo, y para saber quien es lider hay que
 * preguntarle al grupo, donde esta Heraldo.
 *
 * El video, en cambio, lo reenvia el bot que lo recibio: un file_id solo
 * lo puede usar el bot al que se lo mandaron. Le llega a los lideres que
 * hayan abierto alguna vez ese bot; a los demas, la solicitud les sale
 * igual en el panel.
 *
 * Quien es líder lo dice Telegram con getChatAdministrators, no una lista
 * en una variable de entorno que hay que acordarse de tocar.
 */
async function avisarLideres(sol, via) {
  if (!HERALDO || !GRUPO) return;
  const res = await fetch(
    `https://api.telegram.org/bot${HERALDO}/getChatAdministrators?chat_id=${GRUPO}`
  );
  const j = await res.json();
  const admins = (j?.result ?? []).filter((a) => !a.user?.is_bot);
  if (!admins.length) return;

  const r = sol.perfil;
  const resp = sol.respuestas ?? {};
  const quien = sol.tg_username ? `@${sol.tg_username}` : sol.tg_nombre || 'sin nombre';
  const banderas = banderasRespuestas(resp);
  const aviso =
    `📬 <b>SOLICITUD NUEVA</b>\n\n` +
    (r ? `${ficha(r, esc)}\n\n` : `Tag: <code>${esc(sol.player_tag ?? '?')}</code> (sin ficha)\n\n`) +
    resumenRespuestas(resp).map(esc).join('\n') +
    (banderas.length ? `\n${banderas.map((b) => `${b.grave ? '🔴' : '🟡'} ${esc(b.txt)}`).join('\n')}` : '') +
    `\n\n💬 <i>${esc(resp.cuenta ?? '')}</i>\n\n` +
    `Telegram: ${esc(quien)}\n\n` +
    `Decide en el panel: ${SITIO}`;

  const tokenVideo = via === 'recluta' ? process.env.RECLUTA_BOT_TOKEN : HERALDO;
  for (const a of admins) {
    await decirCon(HERALDO, a.user.id, aviso);
    if (resp.video?.message_id) {
      await reenviarCon(tokenVideo, a.user.id, resp.video.chat_id, resp.video.message_id);
    }
  }
}
