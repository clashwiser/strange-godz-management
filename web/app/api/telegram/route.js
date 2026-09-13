// Webhook del bot de Telegram, alojado en Vercel.
//
// Telegram hace POST aca cada vez que alguien le escribe al bot. Al vivir en
// la misma app que ya esta desplegada, sale gratis y responde al instante:
// no hace falta polling ni un servidor encendido.
//
// Variables en Vercel (NINGUNA con NEXT_PUBLIC_):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
//   TELEGRAM_BOT_TOKEN, TELEGRAM_SECRET_TOKEN, TELEGRAM_CHAT_ID

import { admin } from '../../../lib/supabase-admin';
import { charlar, cierreBase, bienvenida } from '../../../lib/charla';
import { flujoSolicitud, decirCon, escribiendo, esAdminDelGrupo, atenderBoton } from '../../../lib/solicitud';
import { pensar, thDe } from '../../../lib/pensar';
import { esPreguntaDelJuego } from '../../../lib/conocimiento';
import { leccionPara, reglasDelClan, ajusteWeb } from '../../../lib/entrenamiento';
import { pideLasReglas, mensajeReglas } from '../../../lib/reglas';
import { avisaCastillo, anotarCastillo, tablaPuntos, temporadaDe, confirmaCastillo, rechazaCastillo, decidirCastillo, recordarMensaje } from '../../../lib/castillos';
import { fotoDe } from '../../../lib/castillo-foto';
import { decidirReto, PUNTOS_FC, FC_MINIMO, FC_ESTRELLAS } from '../../../lib/retos';
import { atenderFoto, botNombrado } from '../../../lib/fotos';
import { esCorreccion, proponerLeccion } from '../../../lib/correcciones';
import { tagsDe, cuentasDe } from '../../../lib/vinculos';
import { plano as planoNombre } from '../../../lib/nombres';
import { pedirPerfil } from '../../../lib/coc-perfil';
import { ordenSoy, contestarSoy as contestarSoyLib, atenderBotonSoy } from '../../../lib/soy';
import { ordenAsignar, atenderBotonAsignar, anotarUsuario } from '../../../lib/asignar';
import { guerrasAbiertas } from '../../../lib/castillo-foto';
import { guerrasDeLaAlianza, textoGuerrasHeraldo } from '../../../lib/guerras';
import { chatsPermitidos, migracionDe, anotarMigracion, AVISO_MIGRACION } from '../../../lib/grupo';
import { avisarALideres } from '../../../lib/bots-salud';

export const dynamic = 'force-dynamic';
// Vercel corta las funciones a los 10 segundos por defecto. Con la IA de
// respaldo detras, una respuesta puede tardar mas que eso y la funcion
// moria a mitad: la llamada a Gemini se contaba, la respuesta nunca
// llegaba al grupo y Telegram veia un 500. Treinta segundos es el margen;
// pensar() se rinde mucho antes.
// Y con las fotos, mas: bajar la captura, leerla (15 s de tope por
// modelo, con un segundo intento si el primero se cuelga) y contestar.
export const maxDuration = 60;

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
// Su propio id de usuario: la parte del token antes de los dos puntos.
// Para saber si un mensaje es respuesta a EL y no a Valquiria.
const MI_ID = Number((TOKEN || '').split(':')[0]) || 0;
// Y el de Valquiria, para saber si una foto contesta a un mensaje SUYO.
const VALQUIRIA_ID = Number((process.env.RECLUTA_BOT_TOKEN || '').split(':')[0]) || 0;
const SECRETO = process.env.TELEGRAM_SECRET_TOKEN;
// Lista blanca de chats. Sin esto, cualquiera que encuentre al bot consulta
// los datos del clan.
const PERMITIDOS = (process.env.TELEGRAM_CHAT_ID || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const esc = (s) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const temporadaActual = () => new Date().toISOString().slice(0, 7);

// El propio sitio. De aqui salen las miniaturas de las bases, que Telegram
// descarga solo con pasarle la URL.
const SITIO = (process.env.SITIO_URL || 'https://strange-godz-management.vercel.app').replace(/\/$/, '');

/**
 * Manda la respuesta. Si el comando devolvio {foto, pie} va como imagen con
 * el texto de pie: una base sin ver la mini obliga a abrir el enlace en el
 * juego solo para saber si sirve.
 */
async function responder(chatId, respuesta) {
  const conFoto = respuesta && typeof respuesta === 'object' && respuesta.foto;
  // {texto, botones}: botones dentro del mensaje (inline_keyboard), como
  // los del /soy. Lo que se toca llega como callback_query.
  const conBotones = respuesta && typeof respuesta === 'object' && respuesta.texto;
  const cuerpo = conFoto
    ? { chat_id: chatId, photo: respuesta.foto, caption: respuesta.pie, parse_mode: 'HTML' }
    : {
        chat_id: chatId,
        text: conBotones ? respuesta.texto : String(respuesta),
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
        ...(conBotones && respuesta.botones ? { reply_markup: { inline_keyboard: respuesta.botones } } : {}),
      };

  const res = await fetch(
    `https://api.telegram.org/bot${TOKEN}/${conFoto ? 'sendPhoto' : 'sendMessage'}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
    }
  );

  // Si falla la foto -miniatura no publicada todavia- se manda el texto, que
  // lleva el enlace. Perder la respuesta entera por la imagen seria absurdo.
  if (!res.ok && conFoto) {
    return await responder(chatId, respuesta.pie);
  }
  // El id del mensaje mandado, para poder reconocer una respuesta a el.
  const j = await res.json().catch(() => null);
  return j?.result?.message_id ?? null;
}

export async function POST(request) {
  // Falla CERRADO. Antes esta comprobacion iba como "if (SECRETO && ...)":
  // si la variable no estaba puesta, se saltaba entera y el endpoint quedaba
  // abierto a cualquiera que adivinara la URL. Se vio en el primer despliegue
  // a Vercel, hecho a proposito sin variables: devolvia 200 en vez de 401.
  //
  // Una app a medio configurar tiene que ser inerte, no permisiva.
  if (!SECRETO || !TOKEN || !PERMITIDOS.length) {
    return new Response('webhook sin configurar', { status: 503 });
  }

  // Telegram reenvia el secreto en cada peticion. Sin esta comprobacion,
  // cualquiera que adivine la URL puede inyectar mensajes falsos.
  if (request.headers.get('x-telegram-bot-api-secret-token') !== SECRETO) {
    return new Response('no', { status: 401 });
  }

  let update;
  try {
    update = await request.json();
  } catch {
    return Response.json({ ok: true });
  }

  // Un boton tocado en un mensaje suyo: los del /soy (elegir clan, nombre,
  // "las dos") o el de aceptar las normas (en privado).
  if (update.callback_query) {
    const cq = update.callback_query;
    try {
      await atenderCallback(cq);
    } catch (e) {
      console.error(`[boton] ${e.message}`);
    }
    return Response.json({ ok: true });
  }

  const msg = update.message ?? update.edited_message;
  const chatId = msg?.chat?.id;
  const texto = (msg?.text || '').trim();

  if (!chatId) return Response.json({ ok: true });
  return await atenderMensaje(request, update, msg, chatId, texto);
}

/** Un boton tocado en un mensaje de Heraldo, por su prefijo. */
async function atenderCallback(cq) {
  if (String(cq.data ?? '').startsWith('soy:')) {
      const tg = (metodo, cuerpo) =>
        fetch(`https://api.telegram.org/bot${TOKEN}/${metodo}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(cuerpo),
          signal: AbortSignal.timeout(8000),
        })
          .then((r) => r.json())
          .catch(() => ({ ok: false }));
      await atenderBotonSoy(admin, cq, { tg, esc });
  } else if (String(cq.data ?? '').startsWith('base:')) {
    await atenderBotonBase(cq);
  } else if (String(cq.data ?? '').startsWith('asg:')) {
    const tg = (metodo, cuerpo) =>
      fetch(`https://api.telegram.org/bot${TOKEN}/${metodo}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cuerpo),
        signal: AbortSignal.timeout(8000),
      })
        .then((r) => r.json())
        .catch(() => ({ ok: false }));
    await atenderBotonAsignar(admin, cq, { tg, esc });
  } else {
    await atenderBoton(admin, TOKEN, cq, 'heraldo');
  }
}

/** Un mensaje (texto, foto, aviso de servicio). Lo de siempre. */
async function atenderMensaje(request, update, msg, chatId, texto) {
  // Los chats permitidos AHORA: los del env, mas el grupo si cambio de id
  // (Telegram lo convierte en supergrupo y le cambia el id; ver grupo.js).
  const permitidos = await chatsPermitidos(admin);
  const migracion = migracionDe(msg, permitidos);
  if (migracion) {
    await anotarMigracion(admin, migracion.nuevo);
    console.log(`[grupo] migrado: ${migracion.viejo} -> ${migracion.nuevo}`);
    await avisarALideres(AVISO_MIGRACION(migracion.nuevo), { grupo: migracion.nuevo });
    return Response.json({ ok: true });
  }

  // Sin "PERMITIDOS.length &&": la lista vacia ya se rechaza arriba con 503,
  // asi que aca un chat que no este en la lista blanca siempre se corta.
  if (!permitidos.includes(String(chatId))) {
    // La rendija: un desconocido, EN PRIVADO, solo puede pedir entrar. Ni
    // un comando, ni un dato del clan, ni una base. Ver flujoSolicitud.
    // Sin exigir texto: en el paso del video llega un archivo, y la
    // conversacion es la que sabe si lo esta esperando. Las respuestas con
    // botones ({texto, teclado}) salen por decirCon, que las entiende.
    if (msg.chat?.type === 'private') {
      // Los de casa (presentados con /soy) pueden pedir aqui lo suyo: la
      // base (que se entrega en privado a proposito), sus stats, su clan.
      const deCasa = texto && (await tagsDe(admin, msg.from?.id).catch(() => [])).length > 0;
      if (deCasa) {
        const quien = { id: msg.from?.id ?? chatId, nombre: msg.from?.first_name || msg.from?.username || null };
        let comando = null;
        let arg = '';
        if (texto.startsWith('/')) {
          const [crudo, ...resto] = texto.split(/\s+/);
          comando = crudo.slice(1).split('@')[0].toLowerCase();
          if (!comando && resto.length) comando = resto.shift().toLowerCase();
          arg = resto.join(' ');
        } else {
          const leido = entender(texto);
          if (leido && !['buscar', 'pensar'].includes(leido.comando)) ({ comando, arg } = leido);
        }
        if (comando && EN_PRIVADO.has(comando)) {
          try {
            const r = await ejecutar(comando, arg, quien, chatId, msg);
            if (r !== null) await responder(chatId, r);
          } catch (e) {
            await responder(chatId, `⚠️ Error: <code>${esc(e.message)}</code>`);
          }
          return Response.json({ ok: true });
        }
      }
      const r = await flujoSolicitud(admin, msg, texto, 'heraldo');
      if (r) await decirCon(TOKEN, chatId, r);
      return Response.json({ ok: true });
    }
    // En un grupo ajeno, ni eso. Y solo si escribieron algo: los avisos de
    // servicio -alguien entro, alguien salio- no llevan texto, y
    // contestarlos seria ponerse a hablar solo en casa de otro.
    if (texto) {
      await responder(chatId, `Este bot es privado.\nTu chat id es <code>${chatId}</code>.`);
    }
    return Response.json({ ok: true });
  }

  // Alguien acaba de entrar al grupo. Va antes de exigir texto porque este
  // aviso no trae ninguno: viene en new_chat_members.
  //
  // La bienvenida la da Valquiria -es la que elige quien entra, asi que es
  // la que recibe-. Heraldo solo la da si ella no esta configurada: dos
  // saludos seguidos es ruido, y ninguno es peor.
  if (msg.new_chat_members?.length) {
    if (!process.env.RECLUTA_BOT_TOKEN) await darBienvenida(chatId, msg.new_chat_members);
    return Response.json({ ok: true });
  }

  // Una foto. Lo que es -el castillo, los desafios amistosos, una prueba
  // de un administrador- lo decide fotos.js por lo que diga el pie, como
  // lo diga. Contesta el bot al que le hablan: si nombran a Valquiria (y
  // ella esta encendida en el grupo), Heraldo se calla y contesta ella;
  // si nombran a Heraldo o a ninguno, el. Nunca los dos.
  const foto = fotoDe(msg);
  if (foto) {
    const pie = (msg.caption || '').trim();
    const quienFoto = { id: msg.from?.id ?? chatId, nombre: esc(msg.from?.first_name || msg.from?.username || 'socio') };
    const deBot = msg.reply_to_message?.from?.is_bot ? msg.reply_to_message : null;
    const paraElla = botNombrado(pie) === 'valquiria' || (deBot && deBot.from.id === VALQUIRIA_ID && botNombrado(pie) !== 'heraldo');
    if (paraElla && VALQUIRIA_ID && (await ajusteWeb(admin, 'valquiria_grupo', true))) return Response.json({ ok: true });

    const r = await atenderFoto(admin, {
      token: TOKEN,
      msg,
      quien: quienFoto,
      esAdmin: () => esAdminDelGrupo(quienFoto.id),
      aUnBot: deBot?.message_id ?? null,
    });
    if (r) {
      await escribiendo(TOKEN, chatId);
      const idMensaje = await responder(chatId, r.texto);
      if (r.despues) await r.despues(idMensaje);
    }
    return Response.json({ ok: true });
  }

  if (!texto) return Response.json({ ok: true });

  // Quien pregunta. El id numerico no cambia aunque se cambie el @usuario,
  // y es lo que usa el cupo diario de bases.
  const quien = {
    id: msg.from?.id ?? chatId,
    nombre: msg.from?.first_name || msg.from?.username || null,
  };
  // Se apunta quien escribe (id, @usuario, nombre): es lo que permite que
  // un lider diga "/asignar @fulano Drakon" (asignar.js).
  anotarUsuario(admin, msg.from);

  let comando;
  let arg;

  if (texto.startsWith('/')) {
    // "/jugador@x300bot Cris" -> comando "jugador", argumento "Cris"
    const [crudo, ...resto] = texto.split(/\s+/);
    comando = crudo.slice(1).split('@')[0].toLowerCase();
    // "/ soy Drakon": el telefono mete un espacio despues de la barra.
    if (!comando && resto.length) comando = resto.shift().toLowerCase();
    arg = resto.join(' ');
  } else {
    // Sin barra: nadie escribe comandos, la gente pregunta.
    //
    // Pero solo si nos estan hablando A NOSOTROS. Con el modo privacidad
    // QUITADO -que es lo que hace falta para que funcione sin @- Telegram
    // nos entrega TODO lo que se escriba en el grupo, y "aldea" o "base"
    // son palabras normales en una conversacion de Clash: "voy a mejorar mi
    // aldea" acabaria gastandole a alguien su base del dia sin que la
    // pidiera.
    //
    // Un lider contesta ✅ o ❌ al aviso de castillo de alguien (lo mando
    // Heraldo o Valquiria, da igual: los dos guardan el id del mensaje).
    // Solo administradores del grupo: es lo que da o quita los puntos.
    const respondeA = msg.reply_to_message;
    if (respondeA?.from?.is_bot && (confirmaCastillo(texto) || rechazaCastillo(texto))) {
      if (await esAdminDelGrupo(quien.id)) {
        const decision = { mensajeBotId: respondeA.message_id, confirmar: confirmaCastillo(texto), lider: esc(quien.nombre ?? 'un líder') };
        const r = (await decidirCastillo(admin, decision)) ?? (await decidirReto(admin, decision));
        if (r) {
          await responder(chatId, r);
          return Response.json({ ok: true });
        }
      }
    }

    // Una correccion a un bot ("no, Heraldo, eso esta mal", contestando a
    // un mensaje suyo): el cerebro la anota como leccion propuesta y los
    // lideres la aprueban en Cerebro > Entrenar. Vale para los dos bots;
    // lo anota Heraldo, que es el que oye todo.
    if (respondeA?.from?.is_bot && respondeA.text && esCorreccion(texto)) {
      const r = await proponerLeccion(admin, {
        bot: respondeA.from.id === VALQUIRIA_ID ? 'valquiria' : 'heraldo',
        dijo: respondeA.text,
        correccion: texto,
        quien: esc(quien.nombre ?? 'alguien'),
      });
      if (r) {
        await responder(chatId, r);
        return Response.json({ ok: true });
      }
    }

    // La respuesta a "¿cual de los dos eres?" (de /soy): "las dos", "la
    // primera", "1", o el nombre entero. Sin nombrar al bot, que asi es
    // como contesta la gente ("Soy ambos"). Solo si ese alguien tiene un
    // /soy a medias, y de hace menos de media hora.
    if (texto.length <= 60) {
      const r = await contestarSoy(texto, quien);
      if (r) {
        await responder(chatId, r);
        return Response.json({ ok: true });
      }
    }

    // Cuenta como dirigido a nosotros: que nombren a Heraldo, que usen el
    // @usuario, o que respondan a un mensaje SUYO. Suyo y no "de un bot":
    // con Valquiria en el mismo grupo, responderle a ella le llegaba
    // tambien a Heraldo y contestaban los dos.
    const respondeAlBot = msg.reply_to_message?.from?.id === MI_ID;
    const nombrado = /heraldo/i.test(texto);
    if (!respondeAlBot && !nombrado) return Response.json({ ok: true });

    // Lo que los lideres le enseñaron desde la pestaña Bots va antes que
    // todo: es su forma de corregirlo sin tocar codigo.
    const enseñado = await leccionPara(admin, 'heraldo', texto, quien.nombre);
    if (enseñado) {
      await responder(chatId, esc(enseñado));
      return Response.json({ ok: true });
    }

    const leido = entender(texto);
    if (!leido) return Response.json({ ok: true });
    ({ comando, arg } = leido);
  }

  try {
    // null = el comando ya contesto por su cuenta (el castillo, que
    // necesita el id del mensaje que manda).
    const r = await ejecutar(comando, arg, quien, chatId, msg);
    if (r !== null) await responder(chatId, r);
  } catch (e) {
    await responder(chatId, `⚠️ Error: <code>${esc(e.message)}</code>`);
  }

  return Response.json({ ok: true });
}

/**
 * Traduce una frase suelta a un comando.
 *
 *   "@Heraldo me puedes dar una base buena para guerra"  ->  base, "guerra"
 *
 * A proposito NO es un modelo de lenguaje: costaria dinero todos los meses
 * y aqui hay cinco intenciones contadas. Los patrones son laxos porque la
 * gente escribe como habla, sin tildes y con faltas.
 */
export function entender(texto) {
  const q = texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/@\w+/g, ' ');

  // La base va primero: es lo que mas se pide, y "guerra" aparece tambien
  // en las frases de las otras intenciones.
  if (/\b(base|bases|dise|layout|aldeas?)\b/.test(q)) return { comando: 'base', arg: q };
  if (/(falta|sin atacar|no\s+(ha\s+|han\s+)?atac|quien debe|pendiente)/.test(q))
    return { comando: 'faltan', arg: '' };
  // "mejor" a secas no: "cual es el mejor ejercito" no pide la tabla.
  if (/(estrella|tabla|ranking|quien va gan|quien (es|va) (el )?mejor|los mejores|mejores del clan)/.test(q))
    return { comando: 'estrellas', arg: '' };
  // "¿Estamos en guerra?": la guerra de AHORA, clan por clan, con las horas.
  if (/(estamos en guerra|hay guerra|en guerra\b|guerra ahora|tenemos guerra|guerra hoy|cuando (es|empieza|termina|acaba|cierra) la guerra|(estado|como va|como vamos en) (de )?la guerra|contra quien|quien es el rival|dia de (preparacion|batalla)|hay liga|estamos en liga)/.test(q))
    return { comando: 'guerra', arg: '' };
  if (/(resumen|como vamos|estado|situacion)/.test(q)) return { comando: 'resumen', arg: '' };

  // "pa que clan voy yo", "a donde me toca", "en que clan estoy"
  if (/\b(pa que clan|para que clan|que clan voy|donde me toca|donde juego|en que clan|mi clan|a que clan)\b/.test(q))
    return { comando: 'miclan', arg: '' };

  // "cuanto llevo", "como voy yo", "mis estrellas"
  if (/(cuanto llevo|como voy|mis estrellas|mis stats|mis estadisticas|mis ataques|como ando|mis numeros)/.test(q))
    return { comando: 'yo', arg: '' };
  // Los premios del mes (el plan); lo personal ("que premio me toca") es /cobro.
  if (/(premios|bonus|bonos|reparto del mes|que se gana|cuanto (se )?paga|que hay de premio)/.test(q) && !/(me toca|voy a|cuanto gano|mi premio|mi bonus)/.test(q))
    return { comando: 'premios', arg: '' };
  // "cuanto voy a cobrar", "que premio me toca"
  if (/(cuanto (voy a )?cobr|que premio|voy a ganar|me toca (algo|premio|dinero)|cuanto gano)/.test(q))
    return { comando: 'cobro', arg: '' };

  // "yo soy Anabolic Batman" — antes que la ficha de jugador, que usa
  // "quien es" y se lo comeria.
  const soy = /\b(?:yo soy|me llamo|soy)\s+(.{2,40})$/.exec(q);
  if (soy) return { comando: 'soy', arg: soy[1].trim() };

  const m = /(?:jugador|ficha|quien es|como va)\s+(.+)/.exec(q);
  if (m) return { comando: 'jugador', arg: m[1].trim() };

  // "Ya doné mi castillo": puntos de disciplina. Y "las normas": el
  // resumen con el enlace. Los dos antes que la IA y que las frases.
  if (avisaCastillo(q)) return { comando: 'castillo', arg: texto };
  if (pideLasReglas(q)) return { comando: 'reglas', arg: '' };

  // Una pregunta de conocimiento del juego -que ejercito, que trae la
  // actualizacion- va a la IA con busqueda web, ANTES de las frases: la
  // frase de "el mejor ejercito es el que practicas" esta bien como
  // chiste, pero el que pregunta quiere la respuesta. Va con el texto
  // original, con tildes, que es lo que la IA lee mejor.
  if (esPreguntaDelJuego(q)) return { comando: 'buscar', arg: texto };

  // Charla: va DESPUES de los datos -si alguien pide una base, se le da la
  // base, no un chiste- y ANTES del "no entendi". Es lo que hace que
  // conteste como uno del grupo cuando le tiran un cabo.
  const suelta = charlar(q);
  if (suelta) return { comando: 'decir', arg: suelta };

  // Si nos hablaron y no se entiende, lo intenta la IA; y si tampoco, la
  // ayuda: en un grupo, un bot que ignora una mencion parece roto.
  if (/(ayuda|que sabes|que puedes)/.test(q)) return { comando: 'ayuda', arg: '' };
  // Aqui solo se llega si le hablaron a Heraldo -lo nombraron o le
  // respondieron-, asi que lo que quede es para la IA.
  return { comando: 'pensar', arg: texto };
}

// Telegram reintenta si no recibe 200; responder rapido evita duplicados.
export async function GET() {
  // Que esta configurado y que no, sin soltar ni un valor. Sirve para
  // saber desde fuera por que algo no funciona: la primera vez que
  // alguien pidio entrar, las fichas llegaron vacias porque COC_TOKEN
  // nunca habia hecho falta en la web y no estaba en Vercel.
  return Response.json({
    ok: true,
    bot: 'x300',
    // El commit desplegado, para saber desde fuera si Vercel ya publico
    // lo ultimo (Vercel lo pone en el entorno; en local no esta).
    version: (process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 7) || null,
    configurado: {
      telegram: Boolean(TOKEN && SECRETO),
      chats: PERMITIDOS.length,
      supabase: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
      // Sin esto las solicitudes llegan sin ficha del jugador.
      clash: Boolean(process.env.COC_TOKEN),
    },
  });
}

// ------------------------------------------------- Solicitudes de ingreso
//
// La puerta estrecha. Al bot le puede escribir CUALQUIERA -basta con
// buscar su @usuario en Telegram-, y por eso hay lista blanca: un
// desconocido no puede preguntar quien no ha atacado ni pedir bases.
//
// Pero un clan cerrado del todo no crece. Aqui se abre una rendija y solo
// una: un desconocido, en privado, puede rellenar una solicitud. Nada
// mas. Ningun comando, ningun dato del clan, ninguna base.
//
// La conversacion en si vive en web/lib/solicitud.js, porque la comparte
// con el bot de reclutar -el del nombre corto, que es el que va en la
// descripcion del clan-. Aqui solo se le pone el token de Heraldo.

// --------------------------------------------------------- Bienvenida
/**
 * Saluda a quien acaba de entrar al grupo.
 *
 * Los dos primeros minutos deciden si alguien se queda o mira y se va, y
 * hasta ahora entrar aqui era entrar a un cuarto en silencio.
 *
 * Tres detalles que no son adorno:
 *
 * - Se filtran los bots. Cuando alguien AÑADE a Heraldo a un grupo, el
 *   propio Heraldo llega en new_chat_members: sin este filtro se daria la
 *   bienvenida a si mismo el dia que lo metan en otro chat.
 * - Si entran varios de golpe -pasa cuando se comparte el enlace- va UN
 *   mensaje con todos, no uno por cabeza.
 * - La mencion es tg://user?id=N y no @usuario: la mitad del clan no tiene
 *   @usuario puesto, y asi igual le vibra el telefono.
 */
async function darBienvenida(chatId, nuevos) {
  const gente = (nuevos || []).filter((u) => u && !u.is_bot);
  if (!gente.length) return;

  const nombra = (u) =>
    `<a href="tg://user?id=${u.id}">${esc(u.first_name || u.username || 'el nuevo')}</a>`;
  const quien =
    gente.length > 1
      ? `${gente.slice(0, -1).map(nombra).join(', ')} y ${nombra(gente[gente.length - 1])}`
      : nombra(gente[0]);

  await responder(chatId, bienvenida(gente.length > 1).replace('{quien}', quien));
}

// ------------------------------------------------------------- Comandos
async function ejecutar(comando, arg, quien = { id: 0, nombre: null }, chatId = null, msg = null) {
  switch (comando) {
    case 'start':
    case 'ayuda':
    case 'help':
      return (
        `<b>x300 · bot de líderes</b>\n\n` +
        `/resumen — estado de los 3 clanes y de los jobs\n` +
        `/guerra — qué clanes están en guerra ahora y cuánto falta\n` +
        `/faltan — quién no ha atacado en la guerra de ahora\n` +
        `/estrellas — tabla de estrellas de la CWL, por clan\n` +
        `/bonus — los premios (bonos) de este mes\n` +
        `/jugador &lt;nombre&gt; — ficha de un jugador\n` +
        `/yo — tus estrellas y ataques de esta CWL
` +
        `/cobro — en qué puesto vas del reparto
` +
        `/miclan — a qué clan te toca ir esta CWL
` +
        `/soy — quién eres en el juego: solo te sale la lista para tocar tu nombre; o /soy TuNombre, o /soy #TuTag (una vez por cuenta)\n` +
        `/asignar — (líderes) contesta al mensaje de alguien y dime quién es: /asignar Nombre, /asignar #Tag, o a secas para elegir de la lista
` +
        `/base [th] [guerra|cwl|aldea] — una base del pack, con su mini (una cada 3 días)\n` +
        `/reporte — último mensaje generado, para pegar en WhatsApp\n` +
        `/puntos — la tabla de puntos del mes\n\n` +
        `<b>Con foto</b> (el comando va en el pie de la captura):\n` +
        `/castillo + captura del mapa de guerra → +5 si el castillo de abajo está lleno\n` +
        `/fc + captura del chat con 5 desafíos amistosos de 2⭐ o más → +5, una vez al día\n` +
        `También vale mencionarme: "@Heraldo ya doné mi castillo", "@Heraldo mis fc"`
      );

    // Charla suelta: la frase ya viene elegida, aca solo se dice.
    case 'decir':
      return arg;

    // Nada caso en el cerebro de frases: se le pregunta a la IA con la voz
    // de Heraldo. Sin llave o con el tope del dia gastado, la ayuda.
    // Las normas del clan, de la pestaña Reglas: el resumen y el enlace.
    case 'reglas':
    case 'normas': {
      const r = await reglasDelClan(admin);
      if (!r.resumen && !r.texto) return 'Los líderes todavía no publicaron las normas en el panel.';
      return mensajeReglas({ resumen: r.resumen || r.texto.slice(0, 3000), url: `${SITIO}/reglas`, fecha: r.fecha, esc });
    }

    // "Ya doné mi castillo": se anota y queda a la espera de que un lider
    // lo confirme contestando al mensaje del bot. Ver web/lib/castillos.js.
    case 'castillo': {
      const r = await anotarCastillo(admin, { tgId: quien.id, nombre: esc(quien.nombre ?? 'socio'), texto: arg });
      const idMensaje = await responder(chatId, r.texto);
      if (!r.existente) await recordarMensaje(admin, r.id, idMensaje);
      return null;
    }

    // "/fc" sin foto: se explica como va. Con foto no llega aqui: el pie
    // con /fc lo atiende fotos.js.
    case 'fc':
      return (
        `🏹 El reto de los desafíos amistosos: ${FC_MINIMO} con ${FC_ESTRELLAS}⭐ o más en una sola captura del chat del clan, una vez al día, +${PUNTOS_FC} puntos. ` +
        `Manda la captura como foto con <code>/fc</code> en el pie y la leo yo.`
      );

    // La tabla de puntos del mes.
    case 'puntos': {
      const [{ data: castillos }, { data: retos }] = await Promise.all([
        admin.from('castillos').select('tg_user_id, nombre, verificado, puntos').eq('temporada', temporadaDe()),
        admin.from('retos').select('tg_user_id, nombre, verificado, puntos, tipo').eq('temporada', temporadaDe()),
      ]);
      const tabla = tablaPuntos([...(castillos ?? []), ...(retos ?? [])]);
      if (!tabla.length) {
        return `Todavía nadie tiene puntos este mes. Dan puntos el castillo de guerra donado y avisado con la captura (<code>/castillo</code>) y el reto de los desafíos amistosos (la captura del chat con 5, pie "fc").`;
      }
      const desglose = (p) => [p.castillos ? `${p.castillos} ${p.castillos === 1 ? 'castillo' : 'castillos'}` : null, p.fc ? `${p.fc} FC` : null].filter(Boolean).join(' · ');
      return (
        `🏅 <b>Puntos del mes · ${temporadaDe()}</b>\n\n` +
        tabla.slice(0, 15).map((p, i) => `${i + 1}. ${esc(p.nombre)} — ${p.puntos} pts (${desglose(p)})`).join('\n')
      );
    }

    case 'pensar': {
      await escribiendo(TOKEN, chatId);
      const r = await pensar(admin, 'heraldo', arg, quien.nombre);
      return r ?? (await ejecutar('ayuda', '', quien, chatId));
    }

    // Pregunta de conocimiento del juego: IA con busqueda web, con el TH
    // del que pregunta si se presento. Mientras busca, "escribiendo...":
    // son varios segundos y un grupo en silencio parece un bot roto. Si
    // la IA no puede, la frase del cerebro; y si tampoco, la ayuda.
    case 'buscar': {
      await escribiendo(TOKEN, chatId);
      const th = await thDe(admin, quien.id);
      const r = await pensar(admin, 'heraldo', arg, quien.nombre, { buscar: true, th });
      return r ?? charlar(plano(arg)) ?? (await ejecutar('ayuda', '', quien, chatId));
    }

    case 'resumen':
      return await cmdResumen();
    case 'faltan':
      return await cmdFaltan();
    case 'guerra':
      return await cmdGuerra(quien);
    case 'estrellas':
      return await cmdEstrellas();
    case 'premios':
    case 'bonus':
    case 'bonos':
      return await cmdPremios();
    case 'jugador':
      return await cmdJugador(arg);
    case 'base':
    case 'bases':
      return await cmdBase(arg, quien, chatId);
    case 'soy':
      return await cmdSoy(arg, quien);
    case 'asignar':
    case 'asigna': {
      // Solo administradores del grupo: es decir quien es quien por otro.
      if (!(await esAdminDelGrupo(quien.id))) return 'Eso es de los líderes, mi hermano. Tú preséntate con /soy.';
      return await ordenAsignar(admin, { arg, msg, quien, esc });
    }
    case 'miclan':
      return await cmdMiClan(quien);
    case 'yo':
    case 'mislastats':
      return await cmdYo(quien);
    case 'cobro':
      return await cmdCobro(quien);
    case 'reporte':
      // Vuelca el ultimo mensaje generado, y ahi puede ir el cierre del mes
      // con quien cobra cuanto. En un grupo con el clan entero eso son
      // cuentas de los lideres a la vista de todos.
      if (!(await esLider(chatId, quien.id))) {
        return 'Eso es de los líderes, mi hermano. Prueba /resumen o /estrellas.';
      }
      return await cmdReporte();
    default: {
      // "/DE strange~❤️" contestando a "¿cual de los dos eres?": el
      // telefono le puso la barra al nombre. Si casa con un candidato, vale.
      const r = await contestarSoy(`${comando} ${arg}`.trim(), quien);
      if (r) return r;
      return `No conozco <code>/${esc(comando)}</code>. Prueba /ayuda.`;
    }
  }
}

async function cmdResumen() {
  const [{ data: clans }, { data: snapUlt }, { data: jobs }, { data: pend }] = await Promise.all([
    admin.from('clans').select('clan_tag, nombre, escuadra').order('escuadra'),
    admin.from('snapshots').select('fecha').order('fecha', { ascending: false }).limit(1),
    admin.from('job_runs').select('job, started_at, ok, filas, error').order('started_at', { ascending: false }).limit(40),
    admin.from('outbox').select('id').eq('estado', 'pendiente'),
  ]);

  const fecha = snapUlt?.[0]?.fecha ?? null;
  let conteo = [];
  if (fecha) {
    const { data } = await admin.from('snapshots').select('clan_tag').eq('fecha', fecha);
    conteo = data ?? [];
  }

  const lineas = (clans ?? []).map((c) => {
    const n = conteo.filter((s) => s.clan_tag === c.clan_tag).length;
    return `  ${esc(c.nombre)} (${c.escuadra}): ${n} miembros`;
  });

  const vistos = new Set();
  const ultimos = [];
  for (const j of jobs ?? []) {
    if (vistos.has(j.job)) continue;
    vistos.add(j.job);
    ultimos.push(`  ${j.ok === true ? '✅' : j.ok === false ? '❌' : '⏳'} ${j.job}${j.error ? ` — ${esc(j.error.slice(0, 60))}` : ''}`);
  }

  return (
    `<b>Resumen x300</b>\n\n` +
    (lineas.length ? lineas.join('\n') : '  (sin clanes cargados)') +
    `\n\n<b>Último snapshot:</b> ${fecha ?? '—'}\n` +
    `<b>Mensajes por enviar:</b> ${pend?.length ?? 0}\n\n` +
    `<b>Jobs</b>\n${ultimos.join('\n') || '  (ninguno todavía)'}`
  );
}

/**
 * "¿Estamos en guerra?": la guerra de AHORA de cada clan, por la API, con
 * las horas que faltan; y a quien pregunta, si esta en una de esas guerras,
 * el recordatorio del castillo (que son puntos).
 */
async function cmdGuerra(quien) {
  const guerras = await guerrasDeLaAlianza(admin, guerrasAbiertas);
  const mio = await tagsDe(admin, quien.id);
  let castilloHoy = false;
  if (mio.length) {
    const { data: c } = await admin
      .from('castillos')
      .select('id')
      .eq('tg_user_id', quien.id)
      .gte('creado_en', `${diaCuba()}T00:00:00-04:00`)
      .limit(1)
      .maybeSingle();
    castilloHoy = Boolean(c);
  }
  return textoGuerrasHeraldo(guerras, { esc, mio, castilloHoy });
}

async function cmdFaltan() {
  const { data: seasons } = await admin
    .from('cwl_seasons')
    .select('id, clan_tag')
    .eq('temporada', temporadaActual());

  const { data: wars } = seasons?.length
    ? await admin
        .from('cwl_wars')
        .select('id, ronda, estado, end_time, season_id')
        .in('season_id', seasons.map((s) => s.id))
        .eq('estado', 'inWar')
    : { data: [] };

  // Sin ronda de liga en batalla: la guerra normal, por la API, en vivo.
  if (!wars?.length) return await faltanEnGuerraNormal();

  const ids = wars.map((w) => w.id);
  const [{ data: roster }, { data: ataques }, { data: players }] = await Promise.all([
    admin.from('cwl_roster').select('war_id, player_tag, posicion_mapa').in('war_id', ids),
    admin.from('cwl_attacks').select('war_id, player_tag').in('war_id', ids),
    admin.from('players').select('player_tag, nombre_actual'),
  ]);

  const nombre = Object.fromEntries((players ?? []).map((p) => [p.player_tag, p.nombre_actual]));
  const atacó = new Set((ataques ?? []).map((a) => `${a.war_id}|${a.player_tag}`));
  const clanDe = Object.fromEntries(seasons.map((s) => [s.id, s.clan_tag]));

  const bloques = [];
  for (const w of wars) {
    const faltan = (roster ?? [])
      .filter((r) => r.war_id === w.id && !atacó.has(`${w.id}|${r.player_tag}`))
      .sort((a, b) => (a.posicion_mapa ?? 99) - (b.posicion_mapa ?? 99));
    if (!faltan.length) continue;

    const horas = w.end_time ? (new Date(w.end_time) - Date.now()) / 3600000 : null;
    bloques.push(
      `<b>${esc(clanDe[w.season_id] ?? '?')} · ronda ${w.ronda}</b>` +
        (horas !== null ? ` — cierra en ${horas.toFixed(1)}h` : '') +
        `\n<pre>${faltan.map((r) => `#${String(r.posicion_mapa).padStart(2)} ${esc(nombre[r.player_tag] ?? r.player_tag)}`).join('\n')}</pre>`
    );
  }

  return bloques.length ? `⚔️ <b>SIN ATACAR</b>\n\n${bloques.join('\n')}` : '✅ Todos atacaron.';
}

/** Quien falta por atacar en las guerras normales abiertas (API, en vivo). */
async function faltanEnGuerraNormal() {
  const guerras = await guerrasDeLaAlianza(admin, guerrasAbiertas);
  const activas = guerras.filter((g) => g.estado === 'preparation' || g.estado === 'inWar');
  if (!activas.length) return '⚔️ Ahora mismo ningún clan está en guerra, así que nadie falta por atacar.';
  const bloques = [];
  for (const g of activas) {
    if (g.estado === 'preparation') {
      bloques.push(`🛡 <b>${esc(g.clan)}</b> contra ${esc(g.rival)}: día de preparación, la batalla empieza en ${enCuantoTexto(g.empieza)}. Nadie tiene que atacar todavía.`);
      continue;
    }
    if (!g.faltan.length) {
      bloques.push(`✅ <b>${esc(g.clan)}</b> contra ${esc(g.rival)}: todos atacaron.`);
      continue;
    }
    bloques.push(
      `⚔️ <b>${esc(g.clan)}</b> contra ${esc(g.rival)} — cierra en ${enCuantoTexto(g.termina)}\n` +
        `<pre>${g.faltan.map((m) => `${esc(m.nombre)}${m.restantes > 1 ? ` (${m.restantes})` : ''}`).join('\n')}</pre>`
    );
  }
  return `<b>SIN ATACAR</b>\n\n${bloques.join('\n\n')}`;
}

/** "5 h" o "40 min" desde ahora. */
const enCuantoTexto = (iso) => {
  const min = Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 60_000));
  return min >= 60 ? `${Math.round(min / 60)} h` : `${min} min`;
};

/**
 * La tabla de estrellas de la CWL del mes, POR CLAN: los premios son por
 * clan (1º, 2º, 3º de cada uno), asi que la tabla se lee por clan. Carlos
 * lo pidio asi el 12 sep 2026.
 */
async function cmdEstrellas() {
  const { data: seasons } = await admin
    .from('cwl_seasons')
    .select('id, clan_tag')
    .eq('temporada', temporadaActual());
  if (!seasons?.length) return 'No hay CWL registrada para este mes.';

  const { data: wars } = await admin.from('cwl_wars').select('id, season_id').in('season_id', seasons.map((x) => x.id));
  if (!wars?.length) return 'Todavía no hay rondas guardadas.';

  const [{ data: ataques }, { data: players }, { data: clans }] = await Promise.all([
    admin.from('cwl_attacks').select('war_id, player_tag, estrellas, destruccion_pct').in('war_id', wars.map((w) => w.id)),
    admin.from('players').select('player_tag, nombre_actual'),
    admin.from('clans').select('clan_tag, nombre, escuadra').order('escuadra'),
  ]);

  const nombre = Object.fromEntries((players ?? []).map((p) => [p.player_tag, p.nombre_actual]));
  const clanDeSeason = Object.fromEntries(seasons.map((x) => [x.id, x.clan_tag]));
  const clanDeWar = Object.fromEntries(wars.map((w) => [w.id, clanDeSeason[w.season_id]]));
  const nombreClan = Object.fromEntries((clans ?? []).map((c) => [c.clan_tag, c.nombre]));

  // Por clan y jugador.
  const porClan = new Map();
  for (const a of ataques ?? []) {
    const clan = clanDeWar[a.war_id] ?? '?';
    if (!porClan.has(clan)) porClan.set(clan, new Map());
    const m = porClan.get(clan);
    const v = m.get(a.player_tag) ?? { e: 0, n: 0, d: 0 };
    v.e += a.estrellas ?? 0;
    v.d += Number(a.destruccion_pct ?? 0);
    v.n += 1;
    m.set(a.player_tag, v);
  }
  if (!porClan.size) return 'Todavía no hay ataques registrados.';

  const orden = (clans ?? []).map((c) => c.clan_tag).filter((t) => porClan.has(t)).concat([...porClan.keys()].filter((t) => !(clans ?? []).some((c) => c.clan_tag === t)));
  const bloques = orden.map((clan) => {
    const tabla = [...porClan.get(clan).entries()]
      .map(([tag, v]) => ({ nombre: nombre[tag] ?? tag, ...v, prom: v.n ? v.d / v.n : 0 }))
      .sort((a, b) => b.e - a.e || b.prom - a.prom)
      .slice(0, 15)
      .map((p, i) => `${String(i + 1).padStart(2)}. ${p.e}★ ${p.prom.toFixed(0).padStart(3)}%  ${p.nombre}`);
    return `<b>${esc(nombreClan[clan] ?? clan)}</b>\n<pre>${esc(tabla.join('\n'))}</pre>`;
  });
  return `⭐ <b>Estrellas · ${temporadaActual()}</b> (por clan)\n\n${bloques.join('\n\n')}`;
}

/**
 * /premios: el plan de premios del mes, tal como esta en la pestaña Bonos.
 * "¿Cuáles son los premios de esta temporada?" se contesta con esto, no
 * mandando a nadie a /reporte.
 */
async function cmdPremios() {
  const mes = temporadaActual();
  const { data: premios } = await admin.from('premios_plan').select('titulo, criterio, monto_usd, tipo').eq('mes', mes).eq('activo', true).order('orden');
  if (!premios?.length) return `Los líderes todavía no publicaron los premios de ${mes}.`;
  const TIPOS = { efectivo: null, pase_oro: 'Pase de Oro', medallas: 'Medallas', pase_evento: 'Pase de evento' };
  const lineas = premios.map((p) => {
    const premio = p.tipo === 'efectivo' || !TIPOS[p.tipo] ? `$${Number(p.monto_usd)}` : TIPOS[p.tipo];
    return `• <b>${esc(p.titulo)}</b> — ${premio}${p.criterio ? `\n   <i>${esc(p.criterio)}</i>` : ''}`;
  });
  return `🏆 <b>BONOS DE ${mes}</b> · ${premios.length} premios\n\n${lineas.join('\n')}\n\nSe entregan al cerrar el mes. Cómo vas tú: /cobro.`;
}

async function cmdJugador(arg) {
  if (!arg) return 'Usa: <code>/jugador Cris</code>';

  const { data: encontrados } = await admin
    .from('players')
    .select('player_tag, nombre_actual')
    .ilike('nombre_actual', `%${arg}%`)
    .limit(5);

  if (!encontrados?.length) return `No encontré a nadie con "${esc(arg)}".`;
  if (encontrados.length > 1) {
    return `Hay varios:\n<pre>${esc(encontrados.map((p) => p.nombre_actual).join('\n'))}</pre>`;
  }

  const p = encontrados[0];
  const { data: snaps } = await admin
    .from('snapshots')
    .select('fecha, th_level, trofeos, liga, war_stars, donaciones')
    .eq('player_tag', p.player_tag)
    .order('fecha', { ascending: false })
    .limit(30);

  if (!snaps?.length) return `${esc(p.nombre_actual)}: sin snapshots todavía.`;

  const hoy = snaps[0];
  const viejo = snaps[snaps.length - 1];
  const dTrofeos = (hoy.trofeos ?? 0) - (viejo.trofeos ?? 0);
  const dEstrellas = (hoy.war_stars ?? 0) - (viejo.war_stars ?? 0);

  return (
    `<b>${esc(p.nombre_actual)}</b> <code>${esc(p.player_tag)}</code>\n\n` +
    `TH${hoy.th_level ?? '?'} · ${hoy.liga ?? 'sin liga'}\n` +
    `Trofeos: ${hoy.trofeos ?? '—'} (${dTrofeos >= 0 ? '+' : ''}${dTrofeos} en ${snaps.length}d)\n` +
    `Estrellas de guerra: ${hoy.war_stars ?? '—'} (+${dEstrellas} en ${snaps.length}d)\n` +
    `Donaciones: ${hoy.donaciones ?? '—'}`
  );
}

async function cmdReporte() {
  const { data } = await admin
    .from('outbox')
    .select('tipo, cuerpo, estado, creado_en')
    .order('creado_en', { ascending: false })
    .limit(1);

  if (!data?.length) return 'No hay mensajes generados todavía.';
  const m = data[0];
  return `<b>${esc(m.tipo)}</b> · ${esc(m.estado)}\n\n<pre>${esc(m.cuerpo)}</pre>`;
}

// ---------------------------------------------------------- Bases
// El pack es contenido PAGADO. Soltar los diecisiete enlaces de golpe es
// regalarlo: basta con que alguien reenvie el mensaje. Va de una en una:
// una base cada CADA_DIAS dias por persona (antes era una al dia y Cris lo
// subio a tres el 12 sep 2026: "que no lo agarren como relajo"). Ver
// sql/016_base_pedidos.sql.

const CADA_DIAS = 3;
// Tope de TODO el grupo por dia. El pack trae unas 32 bases y en el grupo
// esta el clan entero: con una por cabeza, cuarenta personas lo vacian en
// una tarde. Esto reparte el pack a lo largo del mes en vez de quemarlo el
// dia que llega.
const CUPO_GRUPO = 10;
/** Lo que un miembro puede pedirle a Heraldo en privado. */
const EN_PRIVADO = new Set(['base', 'bases', 'yo', 'mislastats', 'miclan', 'cobro', 'guerra', 'faltan', 'estrellas', 'premios', 'bonus', 'bonos', 'puntos', 'soy', 'asignar', 'asigna', 'ayuda', 'help', 'start', 'reglas', 'resumen']);

/** El dia de hoy en Cuba, que es donde vive la gente que pide. */
const diaCuba = () =>
  new Date().toLocaleDateString('en-CA', { timeZone: 'America/Havana' });
/** "2026-09-12" + 3 -> "2026-09-15". Dias enteros, sin horas ni zonas. */
const sumarDias = (dia, n) => {
  const [a, m, d] = dia.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d + n)).toISOString().slice(0, 10);
};
const diasEntre = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
/** "2026-09-15" -> "15/9". */
const fechaCorta = (dia) => `${Number(dia.slice(8, 10))}/${Number(dia.slice(5, 7))}`;

/**
 * Una base al azar, con su miniatura y con lo que hay que donarle al
 * castillo.
 *
 * Evita repetir: primero busca entre las que esa persona NO ha pedido nunca.
 * Solo si ya las pidio todas vuelve a entrar en el saco completo — asi el
 * que pide dos al dia durante una semana ve catorce distintas, no la misma
 * tres veces.
 */
/**
 * /base: una base del pack para UNA cuenta del juego.
 *
 * Carlos tiene seis cuentas y pidio seis bases: el limite (una cada tres
 * dias) es por cuenta, no por persona, y la base va del ayuntamiento de esa
 * cuenta. Con varias cuentas y sin decir cual, salen botones para elegir.
 * Sin /soy, va por persona, como antes.
 *
 * La base se manda EN PRIVADO: el pack es pagado y en el grupo la copia
 * cualquiera. En el grupo solo queda "te la mande por privado". Si nunca
 * abrio el chat con Heraldo, Telegram no deja mandarsela: se le dice.
 *
 * @param {object} quien   { id, nombre }
 * @param {number} chatId  donde lo pidio (privado si es igual a quien.id)
 */
async function cmdBase(arg, quien, chatId = null) {
  const texto = (arg || '').toLowerCase();
  const conPrefijo = /(?:th|ayuntamiento)\s*(\d{1,2})/.exec(texto);
  const suelto = /\b(\d{1,2})\b/.exec(texto);
  const candidato = Number(conPrefijo?.[1] ?? suelto?.[1]);
  const thPedido = candidato >= 6 && candidato <= 20 ? candidato : null;
  const tipo = /guerra|war|cwl|wb/.test(texto) ? 'WB' : /aldea|home|hv/.test(texto) ? 'HV' : null;

  // Sus cuentas, con el ayuntamiento de cada una (del ultimo snapshot; si
  // no hay, del juego).
  const cuentas = await cuentasConTH(quien.id);
  let cuenta = null;
  if (cuentas.length === 1) {
    cuenta = cuentas[0];
  } else if (cuentas.length > 1) {
    // "¿Para cual?": por nombre en la frase, por ayuntamiento, o botones.
    const resto = texto.replace(/(?:th|ayuntamiento)\s*\d{1,2}|\b\d{1,2}\b|guerra|war|cwl|wb|aldea|home|hv|base|bases|dame|una|para|la|de|mi|cuenta/g, ' ').trim();
    const porNombre = resto.length >= 2 ? cuentas.filter((c) => planoNombre(c.nombre).includes(planoNombre(resto)) || planoNombre(resto).includes(planoNombre(c.nombre))) : [];
    if (porNombre.length === 1) cuenta = porNombre[0];
    else if (thPedido && cuentas.filter((c) => c.th === thPedido).length === 1) cuenta = cuentas.find((c) => c.th === thPedido);
    else {
      return {
        texto: `¿Para cuál cuenta, ${esc(quien.nombre ?? 'mi hermano')}? Toca una${tipo ? ` (base de ${tipo === 'WB' ? 'guerra' : 'aldea'})` : ''}:`,
        botones: [
          ...cuentas.map((c) => [{ text: `${c.nombre}${c.th ? ` · TH${c.th}` : ''}`.slice(0, 40), callback_data: `base:${c.tag}:${tipo ?? '-'}:${quien.id}` }]),
          [{ text: '✖️ Cerrar', callback_data: `base:x:-:${quien.id}` }],
        ],
      };
    }
  }
  return await darBase({ quien, chatId, cuenta, th: thPedido ?? cuenta?.th ?? null, tipo });
}

/** Las cuentas de esta persona con su ayuntamiento: [{ tag, nombre, th }]. */
async function cuentasConTH(tgId) {
  const tags = await tagsDe(admin, tgId);
  if (!tags.length) return [];
  const [{ data: players }, { data: snaps }] = await Promise.all([
    admin.from('players').select('player_tag, nombre_actual').in('player_tag', tags),
    admin.from('snapshots').select('player_tag, th_level, fecha').in('player_tag', tags).order('fecha', { ascending: false }).limit(tags.length * 3),
  ]);
  const nombre = Object.fromEntries((players ?? []).map((p) => [p.player_tag, p.nombre_actual]));
  const th = {};
  for (const sn of snaps ?? []) if (th[sn.player_tag] == null && sn.th_level) th[sn.player_tag] = sn.th_level;
  const cuentas = [];
  for (const tag of tags) {
    let nivel = th[tag] ?? null;
    if (!nivel) nivel = (await pedirPerfil(tag))?.townHallLevel ?? null;
    cuentas.push({ tag, nombre: nombre[tag] ?? tag, th: nivel });
  }
  return cuentas;
}

/**
 * Elige la base, la anota y la manda en privado. Devuelve lo que se
 * contesta DONDE se pidio.
 */
async function darBase({ quien, chatId, cuenta, th, tipo }) {
  const hoy = diaCuba();
  const enPrivado = chatId != null && String(chatId) === String(quien.id);
  const quienEs = cuenta ? `<b>${esc(cuenta.nombre)}</b>` : null;

  // Su ultima base PARA ESTA CUENTA: si fue hace menos de CADA_DIAS dias, no toca.
  let q = admin.from('base_pedidos').select('dia').eq('tg_user_id', quien.id).order('dia', { ascending: false }).limit(1);
  q = cuenta ? q.eq('player_tag', cuenta.tag) : q.is('player_tag', null);
  const { data: ultima, error: errCupo } = await q.maybeSingle();
  if (errCupo) throw errCupo;
  const llevaHoy = ultima?.dia === hoy ? 1 : 0;
  const proxima = ultima ? sumarDias(ultima.dia, CADA_DIAS) : null;
  const leToca = !proxima || proxima <= hoy;

  // El tope del grupo se mira ANTES que el personal: si el pack ya se
  // repartio hoy, da igual que a esta persona le quede la suya.
  const { count: delGrupoHoy } = await admin.from('base_pedidos').select('id', { count: 'exact', head: true }).eq('dia', hoy);
  if ((delGrupoHoy ?? 0) >= CUPO_GRUPO && (llevaHoy ?? 0) === 0) {
    return (
      `📜 Hoy ya se repartieron las <b>${CUPO_GRUPO} bases del día</b> entre todos, mi hermano.\n\n` +
      `Mañana hay ${CUPO_GRUPO} más. Pídela temprano.`
    );
  }
  if (!leToca) {
    const faltan = diasEntre(hoy, proxima);
    return (
      `📜 Es <b>una base cada ${CADA_DIAS} días</b> por cuenta, pipo: ${quienEs ? `la de ${quienEs}` : 'la tuya'} fue el ${fechaCorta(ultima.dia)}.\n\n` +
      `${faltan === 1 ? 'Mañana' : `El ${fechaCorta(proxima)}`} puedes pedir otra. Mientras, usa la que tienes.` +
      (cuenta ? `\n\nSi es para otra cuenta tuya, dime <code>/base</code> y elígela.` : '')
    );
  }

  let qb = admin.from('bases').select('id, url, th, tipo, etiqueta, nota, preview');
  if (th) qb = qb.eq('th', th);
  if (tipo) qb = qb.eq('tipo', tipo);
  const { data: todas, error } = await qb;
  if (error) throw error;
  if (!todas?.length) {
    const filtro = [th ? `TH${th}` : null, tipo === 'WB' ? 'de guerra' : tipo === 'HV' ? 'de aldea' : null].filter(Boolean).join(' ');
    return `No tengo ninguna base ${esc(filtro)} en el pack.\nPrueba <code>/base</code> a secas.`;
  }

  // Las que esta cuenta ya vio, para no repetirselas mientras haya nuevas.
  let qv = admin.from('base_pedidos').select('base_id').eq('tg_user_id', quien.id);
  qv = cuenta ? qv.eq('player_tag', cuenta.tag) : qv;
  const { data: vistas } = await qv;
  const yaVio = new Set((vistas ?? []).map((v) => v.base_id));
  const nuevas = todas.filter((b) => !yaVio.has(b.id));
  const saco = nuevas.length ? nuevas : todas;
  const base = saco[Math.floor(Math.random() * saco.length)];

  const pie =
    `🏰 <b>TH${base.th ?? '?'} · ${base.tipo === 'WB' ? 'guerra' : 'aldea'}</b>` +
    (cuenta ? ` · para ${quienEs}` : '') +
    (base.etiqueta ? ` · ${esc(base.etiqueta)}` : '') +
    (base.nota ? `\n\n🛡 <i>${esc(base.nota)}</i>` : '') +
    `\n\n<a href="${esc(base.url)}">Abrir en el juego</a>` +
    `\n\n${cierreBase()}`;
  const entrega = base.preview ? { foto: `${SITIO}${base.preview}`, pie } : pie;

  // En privado se entrega ahi mismo; desde el grupo, se manda al privado y
  // en el grupo queda solo la constancia. Si Telegram no deja (nunca abrio
  // el chat), no se anota nada y se le dice que lo abra.
  if (!enPrivado) {
    const idPrivado = await responder(quien.id, entrega);
    if (!idPrivado) {
      return (
        `📩 Te la mando por privado, ${esc(quien.nombre ?? 'mi hermano')}, que el pack es pagado y aquí la copia cualquiera. ` +
        `Pero todavía no me has abierto el chat: entra en @Strange_godz_heraldo_bot, toca <b>Start</b> y pídemela otra vez.`
      );
    }
  }
  await admin.from('base_pedidos').insert({ tg_user_id: quien.id, tg_nombre: quien.nombre ?? null, base_id: base.id, dia: hoy, player_tag: cuenta?.tag ?? null });
  if (enPrivado) return entrega;
  return `📩 Te mandé por privado la base <b>TH${base.th ?? '?'} · ${base.tipo === 'WB' ? 'guerra' : 'aldea'}</b>${cuenta ? ` para ${quienEs}` : ''}. Móntala y no la compartas: el pack es pagado.`;
}

/** Un boton "base:<tag>:<tipo>:<uid>" tocado: la base para esa cuenta. */
async function atenderBotonBase(cq) {
  const [, tag, tipoCrudo, uidCrudo] = String(cq.data ?? '').split(':');
  const uid = Number(uidCrudo);
  const chatId = cq.message?.chat?.id;
  const tg = (metodo, cuerpo) =>
    fetch(`https://api.telegram.org/bot${TOKEN}/${metodo}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo), signal: AbortSignal.timeout(8000) })
      .then((r) => r.json())
      .catch(() => ({ ok: false }));
  if (uid !== cq.from?.id) {
    await tg('answerCallbackQuery', { callback_query_id: cq.id, text: 'Ese menú es de otra persona, asere. Escribe /base y te sale el tuyo.' });
    return;
  }
  await tg('answerCallbackQuery', { callback_query_id: cq.id });
  const editar = (texto, botones = null) =>
    tg('editMessageText', { chat_id: chatId, message_id: cq.message?.message_id, text: texto, parse_mode: 'HTML', link_preview_options: { is_disabled: true }, reply_markup: { inline_keyboard: botones ?? [] } });
  if (tag === 'x') return await editar('Listo. Cuando quieras, /base.');
  const quien = { id: uid, nombre: cq.from.first_name || cq.from.username || null };
  const cuenta = (await cuentasConTH(uid)).find((c) => c.tag === tag);
  if (!cuenta) return await editar('Esa cuenta ya no está atada a ti. Escribe /base otra vez.');
  const r = await darBase({ quien, chatId, cuenta, th: cuenta.th ?? null, tipo: tipoCrudo === '-' ? null : tipoCrudo });
  // En privado la base ya salio como mensaje aparte (foto); el menu se cierra.
  if (typeof r === 'object' && r?.foto) {
    await responder(chatId, r);
    return await editar(`Ahí va la de <b>${esc(cuenta.nombre)}</b>.`);
  }
  await editar(typeof r === 'string' ? r : r?.pie ?? r?.texto ?? 'Listo.');
}

/**
 * Si esta persona manda en el grupo.
 *
 * Se lo preguntamos a Telegram en vez de llevar una lista de ids en una
 * variable de entorno: la lista habria que sacarla a mano, mantenerla a
 * mano, y se quedaria vieja el dia que cambie un lider. Quien es admin del
 * grupo ya lo sabe Telegram y se actualiza solo.
 *
 * Falla CERRADO: si la consulta se cae, no es lider. Un fallo de red no
 * puede acabar enseñandole a sesenta personas quien cobra cuanto.
 */
async function esLider(chatId, userId) {
  if (!chatId || !userId) return false;
  try {
    const r = await fetch(
      `https://api.telegram.org/bot${TOKEN}/getChatMember?chat_id=${chatId}&user_id=${userId}`
    );
    const j = await r.json();
    return ['creator', 'administrator'].includes(j?.result?.status);
  } catch {
    return false;
  }
}

// ------------------------------------------------- Quien soy / mi clan
//
// Heraldo lo sabe todo del clan menos quien le esta hablando. Para
// contestar "¿pa que clan voy yo?" hay que atar la cuenta de Telegram con
// la de Clash, y eso no se adivina: el nombre de Telegram y el del juego
// casi nunca coinciden. Se ata una vez y ya. Ver sql/017_tg_vinculos.sql.

/** Quita tildes y mayusculas para comparar nombres escritos a la carrera. */
const plano = (s) =>
  String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

/**
 * "Heraldo yo soy Anabolic Batman": quien es en el juego. Todo vive en
 * soy.js (por nombre, por tag, o eligiendo de la lista con botones).
 */
const cmdSoy = (arg, quien) => ordenSoy(admin, arg, quien, esc);
const contestarSoy = (texto, quien) => contestarSoyLib(admin, texto, quien, esc);

/**
 * "¿Pa que clan voy yo?" — la alineacion de CWL de quien pregunta, con el
 * enlace para entrar al clan.
 */
async function cmdMiClan(quien) {
  const tags = await jugadoresDe(quien);
  if (!tags.length) {
    return (
      `Todavía no sé quién eres en el juego, mi hermano.\n\n` +
      `Dime <code>/soy TuNombreDelJuego</code> y te reconozco para siempre.`
    );
  }
  // Con varias cuentas, una respuesta por cuenta, con su nombre delante.
  if (tags.length > 1) {
    const { data: players } = await admin.from('players').select('player_tag, nombre_actual').in('player_tag', tags);
    const nombre = Object.fromEntries((players ?? []).map((p) => [p.player_tag, p.nombre_actual]));
    const partes = [];
    for (const tag of tags) partes.push(`👤 <b>${esc(nombre[tag] ?? tag)}</b>\n${await miClanDe(tag)}`);
    return partes.join('\n\n');
  }
  return await miClanDe(tags[0]);
}

async function miClanDe(playerTag) {
  const temporada = temporadaActual();
  const { data: alin } = await admin
    .from('alineaciones')
    .select('clan_tag')
    .eq('temporada', temporada)
    .eq('player_tag', playerTag)
    .maybeSingle();

  if (!alin) {
    return (
      `Todavía no estás puesto en ninguna lista de ${temporada}, asere.\n` +
      `Los líderes la arman en el panel. Pregúntales.`
    );
  }

  const { data: clan } = await admin
    .from('clans')
    .select('nombre, clan_tag, escuadra')
    .eq('clan_tag', alin.clan_tag)
    .maybeSingle();

  const nombre = clan?.nombre ?? alin.clan_tag;
  // El enlace de clan lo arma el propio juego a partir del tag; no hay que
  // guardarlo en ningun sitio.
  const enlace = `https://link.clashofclans.com/en?action=OpenClanProfile&tag=${encodeURIComponent(alin.clan_tag)}`;

  return (
    `🛡 Este mes vas para <b>${esc(nombre)}</b>` +
    (clan?.escuadra ? ` (escuadra ${esc(clan.escuadra)})` : '') +
    `\n<code>${esc(alin.clan_tag)}</code>\n\n` +
    `<a href="${enlace}">Entrar al clan</a>\n\n` +
    `Múdate antes de que empiece la liga, que después no entras.`
  );
}

// ---------------------------------------------- Lo mio: stats y premio
//
// Se calcula EN VIVO desde los ataques, no desde monthly_stats. Esa tabla
// la escribe el cierre del mes y entre corrida y corrida se queda vieja; a
// quien pregunta "¿cuanto llevo?" en mitad de la CWL hay que darle lo de
// ahora mismo, no lo del dia 1.
//
// Un jugador compite dentro de SU clan: los premios son 1er y 2do de cada
// clan por estrellas de CWL. Ver premios_plan.

/** Tabla del mes por jugador, en vivo. Devuelve un Map por player_tag. */
async function tablaDelMes() {
  const temporada = temporadaActual();

  const { data: seasons } = await admin
    .from('cwl_seasons')
    .select('id, clan_tag')
    .eq('temporada', temporada);
  if (!seasons?.length) return null;

  const clanDeSeason = Object.fromEntries(seasons.map((s) => [s.id, s.clan_tag]));
  const { data: wars } = await admin
    .from('cwl_wars')
    .select('id, season_id, estado')
    .in('season_id', seasons.map((s) => s.id));
  if (!wars?.length) return null;

  const clanDeWar = Object.fromEntries(wars.map((w) => [w.id, clanDeSeason[w.season_id]]));
  // Solo rondas CERRADAS: contar la que esta en curso mueve la tabla cada
  // vez que alguien ataca, y el que pregunta dos veces seguidas ve numeros
  // distintos sin entender por que.
  const cerradas = wars.filter((w) => w.estado === 'warEnded').map((w) => w.id);
  if (!cerradas.length) return null;

  const [{ data: ataques }, { data: roster }, { data: players }] = await Promise.all([
    admin
      .from('cwl_attacks')
      .select('war_id, player_tag, estrellas, destruccion_pct')
      .in('war_id', cerradas),
    admin.from('cwl_roster').select('war_id, player_tag').in('war_id', cerradas),
    admin.from('players').select('player_tag, nombre_actual, elegible_premios'),
  ]);

  const info = Object.fromEntries((players ?? []).map((p) => [p.player_tag, p]));
  const m = new Map();
  const toca = (tag, warId) => {
    if (!m.has(tag)) {
      m.set(tag, {
        tag,
        nombre: info[tag]?.nombre_actual ?? tag,
        elegible: info[tag]?.elegible_premios !== false,
        clan: clanDeWar[warId],
        estrellas: 0,
        usados: 0,
        disponibles: 0,
        destruccion: 0,
      });
    }
    return m.get(tag);
  };

  // El roster manda para "cuantos ataques TENIA": alineado en 5 de 7 rondas
  // son 5 ataques, no 7. Medirlo sobre 7 lo castigaria por decisiones de los
  // lideres y no suyas.
  for (const r of roster ?? []) toca(r.player_tag, r.war_id).disponibles += 1;
  for (const a of ataques ?? []) {
    const j = toca(a.player_tag, a.war_id);
    j.estrellas += a.estrellas ?? 0;
    j.destruccion += Number(a.destruccion_pct ?? 0);
    j.usados += 1;
  }

  for (const j of m.values()) j.prom = j.usados ? j.destruccion / j.usados : 0;
  return m;
}

/** Los de un clan, ordenados como ordena el premio. */
const rankearClan = (tabla, clan) =>
  [...tabla.values()]
    .filter((j) => j.clan === clan && j.elegible)
    .sort((a, b) => b.estrellas - a.estrellas || b.usados - a.usados || b.prom - a.prom);

/** Las cuentas atadas a esta persona (la principal primero), o []. */
const jugadoresDe = (quien) => tagsDe(admin, quien.id);

const PIDE_VINCULO =
  'Todavía no sé quién eres en el juego, mi hermano.\n\n' +
  'Dime <code>/soy TuNombreDelJuego</code> y te reconozco para siempre.';

/** "¿Cuánto llevo?" Con varias cuentas, lo de cada una. */
async function cmdYo(quien) {
  const tags = await jugadoresDe(quien);
  if (!tags.length) return PIDE_VINCULO;
  const tabla = await tablaDelMes();
  const partes = [];
  for (const tag of tags) partes.push(await yoDe(tag, tabla));
  return partes.join('\n\n');
}

async function yoDe(tag, tabla) {
  const yo = tabla?.get(tag);
  if (!yo) return 'Todavía no apareces en ninguna ronda cerrada de esta CWL, asere.';

  const clasificacion = rankearClan(tabla, yo.clan);
  const puesto = clasificacion.findIndex((j) => j.tag === tag) + 1;
  const fallados = Math.max(0, yo.disponibles - yo.usados);

  const { data: clan } = await admin
    .from('clans')
    .select('nombre')
    .eq('clan_tag', yo.clan)
    .maybeSingle();

  return (
    `📊 <b>${esc(yo.nombre)}</b> · ${esc(clan?.nombre ?? yo.clan)}\n\n` +
    `⭐ <b>${yo.estrellas} estrellas</b> en ${yo.usados} ataques\n` +
    `💥 ${yo.prom.toFixed(1)}% de destrucción promedio\n` +
    (fallados
      ? `🔴 <b>${fallados}</b> ${fallados === 1 ? 'ataque sin usar' : 'ataques sin usar'}\n`
      : `🟢 Cero ataques sin usar. Así se hace.\n`) +
    (puesto
      ? `\n🏅 Vas <b>${puesto}º de ${clasificacion.length}</b> en tu clan.`
      : '\nNo compites por premio (líder).')
  );
}

/** "¿Cuánto voy a cobrar?" Con varias cuentas, lo de cada una. */
async function cmdCobro(quien) {
  const tags = await jugadoresDe(quien);
  if (!tags.length) return PIDE_VINCULO;
  const tabla = await tablaDelMes();
  const partes = [];
  for (const tag of tags) partes.push(await cobroDe(tag, tabla));
  return partes.join('\n\n');
}

async function cobroDe(tag, tabla) {
  const yo = tabla?.get(tag);
  if (!yo) return 'Todavía no apareces en ninguna ronda cerrada de esta CWL, asere.';
  if (!yo.elegible) {
    return 'Tú no compites por premio, mi hermano: los líderes no cobran del reparto. 🛡';
  }

  const clasificacion = rankearClan(tabla, yo.clan);
  const puesto = clasificacion.findIndex((j) => j.tag === tag) + 1;

  const { data: clan } = await admin
    .from('clans')
    .select('nombre')
    .eq('clan_tag', yo.clan)
    .maybeSingle();
  const nombreClan = clan?.nombre ?? yo.clan;

  // Los premios de CWL se llaman "<clan> · 1er lugar" / "2do lugar".
  const { data: premios } = await admin
    .from('premios_plan')
    .select('titulo, monto_usd, orden')
    .eq('mes', temporadaActual())
    .eq('activo', true)
    .order('orden');

  const suyo = (premios ?? []).find(
    (p) =>
      p.titulo.includes(nombreClan.trim()) &&
      ((puesto === 1 && /1er/.test(p.titulo)) || (puesto === 2 && /2do/.test(p.titulo)))
  );

  const arriba = puesto > 1 ? clasificacion[puesto - 2] : null;
  const faltan = arriba ? arriba.estrellas - yo.estrellas : 0;

  const l = [];
  l.push(`💰 <b>${esc(yo.nombre)}</b> · ${esc(nombreClan)}`);
  l.push('');
  l.push(`Vas <b>${puesto}º de ${clasificacion.length}</b> con ${yo.estrellas}★.`);

  if (suyo) {
    l.push('');
    l.push(`Si la CWL cerrara ahora cobrarías <b>$${suyo.monto_usd}</b> — ${esc(suyo.titulo)}.`);
  } else {
    const segundo = (premios ?? []).find((p) => p.titulo.includes(nombreClan.trim()) && /2do/.test(p.titulo));
    l.push('');
    l.push(`Ahora mismo no estás en premio.`);
    if (arriba && segundo) {
      l.push(
        `Te faltan <b>${faltan === 0 ? 'nada, estás empatado' : faltan + '★'}</b> para pasar a ` +
          `${esc(arriba.nombre)} y meterte en los $${segundo.monto_usd}.`
      );
    }
  }

  l.push('');
  l.push('<i>Provisional: solo cuenta lo de las rondas ya cerradas.</i>');
  return l.join('\n');
}
