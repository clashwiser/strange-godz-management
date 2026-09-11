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
import { flujoSolicitud, decirCon, escribiendo, esAdminDelGrupo } from '../../../lib/solicitud';
import { pensar, thDe } from '../../../lib/pensar';
import { esPreguntaDelJuego } from '../../../lib/conocimiento';
import { leccionPara, reglasDelClan } from '../../../lib/entrenamiento';
import { pideLasReglas, mensajeReglas } from '../../../lib/reglas';
import { avisaCastillo, anotarCastillo, tablaPuntos, temporadaDe, confirmaCastillo, rechazaCastillo, decidirCastillo, recordarMensaje } from '../../../lib/castillos';
import { fotoDe, filaParaFoto, verificarCastilloConFoto } from '../../../lib/castillo-foto';

export const dynamic = 'force-dynamic';
// Vercel corta las funciones a los 10 segundos por defecto. Con la IA de
// respaldo detras, una respuesta puede tardar mas que eso y la funcion
// moria a mitad: la llamada a Gemini se contaba, la respuesta nunca
// llegaba al grupo y Telegram veia un 500. Treinta segundos es el margen;
// pensar() se rinde mucho antes.
export const maxDuration = 30;

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
// Su propio id de usuario: la parte del token antes de los dos puntos.
// Para saber si un mensaje es respuesta a EL y no a Valquiria.
const MI_ID = Number((TOKEN || '').split(':')[0]) || 0;
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
  const cuerpo = conFoto
    ? { chat_id: chatId, photo: respuesta.foto, caption: respuesta.pie, parse_mode: 'HTML' }
    : {
        chat_id: chatId,
        text: String(respuesta),
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
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

  const msg = update.message ?? update.edited_message;
  const chatId = msg?.chat?.id;
  const texto = (msg?.text || '').trim();

  if (!chatId) return Response.json({ ok: true });

  // Sin "PERMITIDOS.length &&": la lista vacia ya se rechaza arriba con 503,
  // asi que aca un chat que no este en la lista blanca siempre se corta.
  if (!PERMITIDOS.includes(String(chatId))) {
    // La rendija: un desconocido, EN PRIVADO, solo puede pedir entrar. Ni
    // un comando, ni un dato del clan, ni una base. Ver flujoSolicitud.
    // Sin exigir texto: en el paso del video llega un archivo, y la
    // conversacion es la que sabe si lo esta esperando. Las respuestas con
    // botones ({texto, teclado}) salen por decirCon, que las entiende.
    if (msg.chat?.type === 'private') {
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

  // Una foto: la captura del mapa de guerra con el castillo donado. Cuenta
  // si el pie es el aviso ("ya doné mi castillo"), si nombra a un bot y
  // habla del castillo, o si contesta al "Anotado" de un bot. La lee la IA
  // y la cruza con la API (ver castillo-foto.js); si cuadra, los puntos se
  // dan solos. Las fotos las mira solo Heraldo: Valquiria no lee fotos, y
  // asi no contestan los dos.
  const foto = fotoDe(msg);
  if (foto) {
    const pie = (msg.caption || '').trim();
    const quienFoto = { id: msg.from?.id ?? chatId, nombre: esc(msg.from?.first_name || msg.from?.username || 'socio') };
    const aUnBot = msg.reply_to_message?.from?.is_bot ? msg.reply_to_message.message_id : null;
    const reclama = avisaCastillo(pie) || (/heraldo|valqui/i.test(pie) && /castillo/i.test(pie));
    let fila = null;
    if (reclama) {
      fila = (await anotarCastillo(admin, { tgId: quienFoto.id, nombre: quienFoto.nombre, texto: pie })).fila ?? null;
    } else if (aUnBot) {
      fila = await filaParaFoto(admin, { tgId: quienFoto.id, mensajeBotId: aUnBot });
    }
    if (fila) {
      await escribiendo(TOKEN, chatId);
      const r = await verificarCastilloConFoto(admin, { token: TOKEN, msg, fila, quien: quienFoto.nombre });
      const idMensaje = await responder(chatId, r.texto);
      // Sin verificar, un lider puede confirmar contestando ✅ a ESTE mensaje.
      if (!r.verificado) await recordarMensaje(admin, fila.id, idMensaje);
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

  let comando;
  let arg;

  if (texto.startsWith('/')) {
    // "/jugador@x300bot Cris" -> comando "jugador", argumento "Cris"
    const [crudo, ...resto] = texto.split(/\s+/);
    comando = crudo.slice(1).split('@')[0].toLowerCase();
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
        const r = await decidirCastillo(admin, {
          mensajeBotId: respondeA.message_id,
          confirmar: confirmaCastillo(texto),
          lider: esc(quien.nombre ?? 'un líder'),
        });
        if (r) {
          await responder(chatId, r);
          return Response.json({ ok: true });
        }
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
    const r = await ejecutar(comando, arg, quien, chatId);
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
  if (/\b(base|bases|dise|layout|aldea)\b/.test(q)) return { comando: 'base', arg: q };
  if (/(falta|sin atacar|no\s+(ha\s+|han\s+)?atac|quien debe|pendiente)/.test(q))
    return { comando: 'faltan', arg: '' };
  // "mejor" a secas no: "cual es el mejor ejercito" no pide la tabla.
  if (/(estrella|tabla|ranking|quien va gan|quien (es|va) (el )?mejor|los mejores|mejores del clan)/.test(q))
    return { comando: 'estrellas', arg: '' };
  if (/(resumen|como vamos|estado|situacion)/.test(q)) return { comando: 'resumen', arg: '' };

  // "pa que clan voy yo", "a donde me toca", "en que clan estoy"
  if (/\b(pa que clan|para que clan|que clan voy|donde me toca|donde juego|en que clan|mi clan|a que clan)\b/.test(q))
    return { comando: 'miclan', arg: '' };

  // "cuanto llevo", "como voy yo", "mis estrellas"
  if (/(cuanto llevo|como voy|mis estrellas|mis stats|mis ataques|como ando)/.test(q))
    return { comando: 'yo', arg: '' };
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
async function ejecutar(comando, arg, quien = { id: 0, nombre: null }, chatId = null) {
  switch (comando) {
    case 'start':
    case 'ayuda':
    case 'help':
      return (
        `<b>x300 · bot de líderes</b>\n\n` +
        `/resumen — estado de los 3 clanes y de los jobs\n` +
        `/faltan — quién no ha atacado en la CWL de ahora\n` +
        `/estrellas — tabla de estrellas de la temporada\n` +
        `/jugador &lt;nombre&gt; — ficha de un jugador\n` +
        `/yo — tus estrellas y ataques de esta CWL
` +
        `/cobro — en qué puesto vas del reparto
` +
        `/miclan — a qué clan te toca ir esta CWL
` +
        `/soy &lt;tu nombre del juego&gt; — para que te reconozca
` +
        `/base [th] [guerra|cwl|aldea] — una base del pack, con su mini\n` +
        `/reporte — último mensaje generado, para pegar en WhatsApp`
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

    // La tabla de puntos del mes.
    case 'puntos': {
      const { data: filas } = await admin.from('castillos').select('tg_user_id, nombre, verificado, puntos').eq('temporada', temporadaDe());
      const tabla = tablaPuntos(filas);
      if (!tabla.length) return `Todavía nadie tiene puntos este mes. El castillo de guerra donado y avisado da puntos: <code>/castillo</code>.`;
      return (
        `🏅 <b>Puntos de disciplina · ${temporadaDe()}</b>\n\n` +
        tabla.slice(0, 15).map((p, i) => `${i + 1}. ${esc(p.nombre)} — ${p.puntos} pts (${p.veces} ${p.veces === 1 ? 'castillo' : 'castillos'})`).join('\n')
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
    case 'estrellas':
      return await cmdEstrellas();
    case 'jugador':
      return await cmdJugador(arg);
    case 'base':
    case 'bases':
      return await cmdBase(arg, quien);
    case 'soy':
      return await cmdSoy(arg, quien);
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
    default:
      return `No conozco <code>/${esc(comando)}</code>. Prueba /ayuda.`;
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

async function cmdFaltan() {
  const { data: seasons } = await admin
    .from('cwl_seasons')
    .select('id, clan_tag')
    .eq('temporada', temporadaActual());

  if (!seasons?.length) return 'No hay CWL registrada para este mes.';

  const { data: wars } = await admin
    .from('cwl_wars')
    .select('id, ronda, estado, end_time, season_id')
    .in('season_id', seasons.map((s) => s.id))
    .eq('estado', 'inWar');

  if (!wars?.length) return 'No hay ninguna ronda de CWL en curso ahora mismo.';

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

async function cmdEstrellas() {
  const { data: seasons } = await admin
    .from('cwl_seasons')
    .select('id')
    .eq('temporada', temporadaActual());
  if (!seasons?.length) return 'No hay CWL registrada para este mes.';

  const { data: wars } = await admin.from('cwl_wars').select('id').in('season_id', seasons.map((s) => s.id));
  if (!wars?.length) return 'Todavía no hay rondas guardadas.';

  const [{ data: ataques }, { data: players }] = await Promise.all([
    admin.from('cwl_attacks').select('player_tag, estrellas, destruccion_pct').in('war_id', wars.map((w) => w.id)),
    admin.from('players').select('player_tag, nombre_actual'),
  ]);

  const nombre = Object.fromEntries((players ?? []).map((p) => [p.player_tag, p.nombre_actual]));
  const m = new Map();
  for (const a of ataques ?? []) {
    const v = m.get(a.player_tag) ?? { e: 0, n: 0, d: 0 };
    v.e += a.estrellas ?? 0;
    v.d += Number(a.destruccion_pct ?? 0);
    v.n += 1;
    m.set(a.player_tag, v);
  }

  const tabla = [...m.entries()]
    .map(([tag, v]) => ({ nombre: nombre[tag] ?? tag, ...v, prom: v.n ? v.d / v.n : 0 }))
    .sort((a, b) => b.e - a.e || b.prom - a.prom)
    .slice(0, 25)
    .map((p, i) => `${String(i + 1).padStart(2)}. ${p.e}★ ${p.prom.toFixed(0).padStart(3)}%  ${p.nombre}`);

  return tabla.length
    ? `⭐ <b>Estrellas · ${temporadaActual()}</b>\n<pre>${esc(tabla.join('\n'))}</pre>`
    : 'Todavía no hay ataques registrados.';
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
// regalarlo: basta con que alguien reenvie el mensaje. Va de una en una y
// con cupo diario. Ver sql/016_base_pedidos.sql.

const CUPO_DIARIO = 1;
// Tope de TODO el grupo por dia. El pack trae unas 32 bases y en el grupo
// esta el clan entero: con una por cabeza, cuarenta personas lo vacian en
// una tarde. Esto reparte el pack a lo largo del mes en vez de quemarlo el
// dia que llega.
const CUPO_GRUPO = 10;

/** El dia de hoy en Cuba, que es donde vive la gente que pide. */
const diaCuba = () =>
  new Date().toLocaleDateString('en-CA', { timeZone: 'America/Havana' });

/**
 * Una base al azar, con su miniatura y con lo que hay que donarle al
 * castillo.
 *
 * Evita repetir: primero busca entre las que esa persona NO ha pedido nunca.
 * Solo si ya las pidio todas vuelve a entrar en el saco completo — asi el
 * que pide dos al dia durante una semana ve catorce distintas, no la misma
 * tres veces.
 */
async function cmdBase(arg, quien) {
  const texto = (arg || '').toLowerCase();
  // El ayuntamiento vale si lleva "th"/"ayuntamiento" delante, o si es un
  // numero suelto en rango de ayuntamiento. Sin lo segundo, "dame 2 bases"
  // se leia como TH2 y no devolvia nada: el numero de la frase no siempre
  // es un nivel.
  const conPrefijo = /(?:th|ayuntamiento)\s*(\d{1,2})/.exec(texto);
  const suelto = /\b(\d{1,2})\b/.exec(texto);
  const candidato = Number(conPrefijo?.[1] ?? suelto?.[1]);
  const th = candidato >= 6 && candidato <= 20 ? candidato : null;
  const tipo = /guerra|war|cwl|wb/.test(texto) ? 'WB' : /aldea|home|hv/.test(texto) ? 'HV' : null;

  const hoy = diaCuba();
  const { count: llevaHoy, error: errCupo } = await admin
    .from('base_pedidos')
    .select('id', { count: 'exact', head: true })
    .eq('tg_user_id', quien.id)
    .eq('dia', hoy);
  if (errCupo) throw errCupo;

  // El tope del grupo se mira ANTES que el personal: si el pack ya se
  // repartio hoy, da igual que a esta persona le quede la suya.
  const { count: delGrupoHoy } = await admin
    .from('base_pedidos')
    .select('id', { count: 'exact', head: true })
    .eq('dia', hoy);

  if ((delGrupoHoy ?? 0) >= CUPO_GRUPO && (llevaHoy ?? 0) === 0) {
    return (
      `📜 Hoy ya se repartieron las <b>${CUPO_GRUPO} bases del día</b> entre todos, mi hermano.\n\n` +
      `Mañana hay ${CUPO_GRUPO} más. Pídela temprano.`
    );
  }

  if ((llevaHoy ?? 0) >= CUPO_DIARIO) {
    // El texto se adapta al cupo: con CUPO_DIARIO en 1, "tus 1 bases de hoy"
    // canta a plantilla mal hecha y el bot pierde toda la gracia.
    const cuantas =
      CUPO_DIARIO === 1 ? 'una base por día' : `${CUPO_DIARIO} bases por día`;
    return (
      `📜 Ya alcanzaste tu límite de <b>${cuantas}</b>, pipo.\n\n` +
      `Mañana puedes pedir ${CUPO_DIARIO === 1 ? 'otra' : 'más'}.`
    );
  }

  let q = admin.from('bases').select('id, url, th, tipo, etiqueta, nota, preview');
  if (th) q = q.eq('th', th);
  if (tipo) q = q.eq('tipo', tipo);
  const { data: todas, error } = await q;
  if (error) throw error;

  if (!todas?.length) {
    const filtro = [th ? `TH${th}` : null, tipo === 'WB' ? 'de guerra' : tipo === 'HV' ? 'de aldea' : null]
      .filter(Boolean)
      .join(' ');
    return `No tengo ninguna base ${esc(filtro)} en el pack.\nPrueba <code>/base</code> a secas.`;
  }

  // Las que esta persona ya vio, para no repetirselas mientras haya nuevas.
  const { data: vistas } = await admin
    .from('base_pedidos')
    .select('base_id')
    .eq('tg_user_id', quien.id);
  const yaVio = new Set((vistas ?? []).map((v) => v.base_id));
  const nuevas = todas.filter((b) => !yaVio.has(b.id));
  const saco = nuevas.length ? nuevas : todas;

  const base = saco[Math.floor(Math.random() * saco.length)];

  await admin.from('base_pedidos').insert({
    tg_user_id: quien.id,
    tg_nombre: quien.nombre ?? null,
    base_id: base.id,
    dia: hoy,
  });

  // Sin recordarle el cupo al final. Cada mensaje diciendo "mañana hay otra"
  // es publicidad del limite: pone el foco en lo que NO puede pedir en vez
  // de en la base que acaba de recibir. El limite ya se dice cuando toca,
  // que es al llegar a el.
  const pie =
    `🏰 <b>TH${base.th ?? '?'} · ${base.tipo === 'WB' ? 'guerra' : 'aldea'}</b>` +
    (base.etiqueta ? ` · ${esc(base.etiqueta)}` : '') +
    (base.nota ? `\n\n🛡 <i>${esc(base.nota)}</i>` : '') +
    `\n\n<a href="${esc(base.url)}">Abrir en el juego</a>` +
    `\n\n${cierreBase()}`;

  // Con miniatura si el pack la trae; los packs de solo texto no la tienen.
  if (base.preview) {
    return { foto: `${SITIO}${base.preview}`, pie };
  }
  return pie;
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

/** "Heraldo yo soy Anabolic Batman" -> ata esa cuenta con ese jugador. */
async function cmdSoy(arg, quien) {
  const buscado = plano(arg);
  if (!buscado) {
    return 'Dime tu nombre del juego, mi hermano: <code>/soy Anabolic Batman</code>';
  }

  const { data: jugadores, error } = await admin
    .from('players')
    .select('player_tag, nombre_actual');
  if (error) throw error;

  const hallados = (jugadores ?? []).filter((p) => plano(p.nombre_actual).includes(buscado));

  if (!hallados.length) {
    return (
      `No encuentro a nadie que se llame "${esc(arg)}" en los clanes, asere.\n` +
      `Escríbelo igualito que en el juego.`
    );
  }
  if (hallados.length > 1) {
    // Con varios no se elige por el bot: elegir mal es peor que no elegir,
    // porque despues le responde la alineacion de otro.
    return (
      `Hay ${hallados.length} con ese nombre:\n` +
      hallados.slice(0, 6).map((p) => `• ${esc(p.nombre_actual)}`).join('\n') +
      `\n\nEscríbelo completo para saber cuál eres.`
    );
  }

  const p = hallados[0];
  await admin
    .from('tg_vinculos')
    .upsert(
      { tg_user_id: quien.id, player_tag: p.player_tag, tg_nombre: quien.nombre ?? null },
      { onConflict: 'tg_user_id' }
    );

  return `Anotado: tú eres <b>${esc(p.nombre_actual)}</b>. Ya te reconozco. 📜`;
}

/**
 * "¿Pa que clan voy yo?" — la alineacion de CWL de quien pregunta, con el
 * enlace para entrar al clan.
 */
async function cmdMiClan(quien) {
  const { data: vinculo } = await admin
    .from('tg_vinculos')
    .select('player_tag')
    .eq('tg_user_id', quien.id)
    .maybeSingle();

  if (!vinculo) {
    return (
      `Todavía no sé quién eres en el juego, mi hermano.\n\n` +
      `Dime <code>/soy TuNombreDelJuego</code> y te reconozco para siempre.`
    );
  }

  const temporada = temporadaActual();
  const { data: alin } = await admin
    .from('alineaciones')
    .select('clan_tag')
    .eq('temporada', temporada)
    .eq('player_tag', vinculo.player_tag)
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

/** El jugador atado a esta cuenta de Telegram, o null. */
async function jugadorDe(quien) {
  const { data } = await admin
    .from('tg_vinculos')
    .select('player_tag')
    .eq('tg_user_id', quien.id)
    .maybeSingle();
  return data?.player_tag ?? null;
}

const PIDE_VINCULO =
  'Todavía no sé quién eres en el juego, mi hermano.\n\n' +
  'Dime <code>/soy TuNombreDelJuego</code> y te reconozco para siempre.';

/** "¿Cuánto llevo?" */
async function cmdYo(quien) {
  const tag = await jugadorDe(quien);
  if (!tag) return PIDE_VINCULO;

  const tabla = await tablaDelMes();
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

/** "¿Cuánto voy a cobrar?" */
async function cmdCobro(quien) {
  const tag = await jugadorDe(quien);
  if (!tag) return PIDE_VINCULO;

  const tabla = await tablaDelMes();
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
