'use client';

// Idioma del panel: espanol de Cuba por defecto, ingles opcional.
//
// El espanol de este panel es CUBANO, o sea TUTEO: "elige", "usa", "abre",
// "pega". No voseo rioplatense ("elegi", "usa" con tilde, "abri", "pega"
// con tilde), que es como estaba escrito antes y suena extranjero a un
// jugador cubano. Tampoco jerga: esto decide reparto de dinero entre 45
// personas y tiene que leerse serio.
//
// Por que la clave es el propio texto en espanol y no un identificador tipo
// 'clanes.pista': el JSX se sigue leyendo solo, no hay que bautizar 117
// cadenas, y una traduccion que falta cae en espanol en vez de mostrar la
// clave cruda al usuario. El precio es que si se edita el espanol, esa
// entrada se desconecta en silencio; para eso existe scripts/faltan-en.mjs,
// que lista las cadenas sin par.

import { createContext, useContext, useEffect, useState } from 'react';

const CLAVE = 'sga-idioma';

/** Espanol (clave) -> ingles americano. */
export const EN = {
  // ---- Cabecera y navegacion ----
  'Salir': 'Sign out',
  'Actualizar': 'Refresh',
  'Resumen': 'Overview',
  'Lista CWL': 'CWL Roster',
  'CWL Resultados': 'CWL Results',
  'Alineación': 'Lineup',
  'CWL': 'CWL',
  'Jugadores': 'Players',
  'Mensajes': 'Messages',
  'Bases': 'Bases',
  'Bonos': 'Prizes',
  'Bots': 'Bots',
  'Cargando…': 'Loading…',
  'Castillos': 'Castles',
  'Retos': 'Challenges',
  'Cargando datos…': 'Loading data…',
  'Error: ': 'Error: ',

  // ---- Entrada ----
  'Acceso solo para los líderes.': 'Leaders only.',
  'correo': 'email',
  'contraseña': 'password',
  'Entrar': 'Sign in',
  'Entrando…': 'Signing in…',
  'Descargar app': 'Install app',
  'Instalar el panel en el teléfono': 'Install the panel on your phone',

  // ---- Sin base de datos ----
  'Todavía no hay base de datos': 'No database yet',
  'El panel real necesita Supabase conectado. Mientras tanto puedes recorrer todo con datos de ejemplo.':
    'The real panel needs Supabase connected. In the meantime you can explore everything with sample data.',
  'Ver la demo': 'View the demo',
  'Para activarlo: define': 'To turn it on, set',

  // ---- Instalar como app ----
  'Instalarla a mano': 'Install it manually',
  'En iPhone y iPad, Apple no permite que una web se instale sola. Son tres toques y queda igual que una app.':
    "On iPhone and iPad, Apple doesn't let a website install itself. It's three taps and it works just like an app.",
  'Abre esta página en': 'Open this page in',
  'Desde Chrome o desde el navegador de WhatsApp no aparece la opción.':
    "The option doesn't show up in Chrome or in WhatsApp's browser.",
  'Toca': 'Tap',
  'Compartir': 'Share',
  ', el cuadrito con la flecha hacia arriba.': ', the square with the up arrow.',
  'Baja y elige': 'Scroll down and choose',
  'Añadir a pantalla de inicio': 'Add to Home Screen',
  'Tu navegador no ofreció instalarla. Suele pasar cuando la página se abre dentro de otra app —WhatsApp, Instagram— en vez del navegador.':
    "Your browser didn't offer to install it. That usually happens when the page opens inside another app — WhatsApp, Instagram — instead of the browser.",
  'Ábrela en': 'Open it in',
  'Si estás dentro de WhatsApp, usa': "If you're inside WhatsApp, use",
  'Abrir en el navegador': 'Open in browser',
  'arriba a la derecha.': 'at the top right.',
  'Elige': 'Choose',
  'Instalar aplicación': 'Install app',
  'Añadir a pantalla principal': 'Add to Home screen',
  'No se descarga nada ni ocupa espacio: queda el icono en la pantalla de inicio y abre sin la barra de direcciones. Se actualiza sola.':
    'Nothing is downloaded and it takes no space: you get an icon on your home screen and it opens without the address bar. It updates itself.',
  'Entendido': 'Got it',

  // ---- Clanes ----
  'Nuestros clanes': 'Our clans',
  'Cambia el orden con': 'Change the order with',
  ', o arrastra desde el asa': ', or drag from the handle',
  '. Se guarda solo.': '. It saves itself.',
  'Subir': 'Move up',
  'Bajar': 'Move down',
  'Arrastrar para reordenar': 'Drag to reorder',
  'Arrastra desde cualquier parte. En el teléfono, mantén pulsado.':
    'Drag from anywhere. On the phone, press and hold.',
  'Orden guardado.': 'Order saved.',
  'Orden cambiado (en la demo no se guarda).': 'Order changed (nothing is saved in the demo).',
  'No se pudo guardar: ': 'Could not save: ',
  'Sin clanes todavía': 'No clans yet',
  'Falta cargar': 'You still need to set',
  'y correr el snapshot por primera vez.': 'and run the snapshot for the first time.',
  'miembros en el último snapshot': 'members in the latest snapshot',
  'escuadra': 'squad',
  'principal': 'main',

  // ---- Alineacion ----
  'Sin jugadores todavía. Corre el snapshot primero.':
    'No players yet. Run the snapshot first.',
  'temporada': 'season',
  'Generando…': 'Generating…',
  'Arrastra los nombres entre clanes. En el teléfono mantén pulsada la tarjeta y arrástrala; el desplegable también sirve.':
    'Drag names between clans. On the phone press and hold a card, then drag it; the dropdown works too.',
  // ---- Salud del clan ----
  'Salud del clan': 'Clan health',
  'trofeos': 'trophies',
  'clan de vitrina, no se le exige donar': 'showcase clan, no donations expected',
  'sin donar': 'not donating',
  'Todos los clanes': 'All clans',
  'Primero los problemas': 'Problems first',
  'Menos donaciones': 'Fewest donations',
  'Más ataques fallados': 'Most missed attacks',
  'Por nombre': 'By name',
  'Solo los que hay que mirar': 'Only the ones to look at',
  'Dona': 'Gives',
  'Recibe': 'Gets',
  'Ataques CWL': 'CWL attacks',
  'Nadie con esos filtros. Buena señal.': 'Nobody matches. Good sign.',
  'Quién entró y quién se fue': 'Who joined and who left',
  'se fue': 'left',
  'entró': 'joined',
  'Todavía no hay snapshot. Corre el job primero.': 'No snapshot yet. Run the job first.',
  'en rojo': 'in red',
  'para vigilar': 'to watch',
  'donaciones de media': 'donations on average',
  'Más debe al clan': 'Owes the clan most',
  'Qué pasa': 'What is going on',
  'pide y no da': 'takes, never gives',
  'no dona': 'no donations',
  'sin señales': 'no sign of life',
  'falló': 'missed',
  // ---- Felicitar al ganador de un premio ----
  'Se lo ganó': 'Winner',
  '— elige jugador —': '- pick a player -',
  'Felicitar': 'Congratulate',
  'Crea el mensaje de felicitación en la pestaña Mensajes': 'Creates the congratulation message in the Messages tab',
  'Elige primero al jugador que se lo ganó.': 'Pick the player who won it first.',
  'Ese premio no tiene título todavía.': 'That prize has no title yet.',
  'Mensaje listo en la pestaña Mensajes para': 'Message ready in the Messages tab for',
  // ---- Solicitudes de ingreso ----
  'Solicitudes': 'Applications',
  'sin decidir': 'undecided',
  'Para que lleguen solicitudes, pon esto en la descripción del clan dentro del juego:': 'To get applications, put this in the clan description inside the game:',
  '— se busca dentro de Telegram, así que no hace falta enlace.': '- it is searchable inside Telegram, so no link is needed.',
  'Sin decidir': 'Undecided',
  'Todas': 'All',
  'Nada pendiente. Cuando alguien le escriba a Valquiria, aparece aquí.': 'Nothing pending. When someone writes to Valquiria, it shows up here.',
  'Todavía no ha solicitado nadie.': 'Nobody has applied yet.',
  'Esperando': 'Waiting',
  'En prueba': 'On trial',
  'Dentro': 'In',
  'Rechazada': 'Rejected',
  'sin nombre': 'no name',
  'mejor': 'best',
  'está en': 'is in',
  'Donado de por vida': 'Donated lifetime',
  'Juegos del clan': 'Clan games',
  'Sin ficha: no se pudo leer su perfil. Búscalo por el tag.': 'No card: their profile could not be read. Look them up by tag.',
  '— a qué clan —': '- which clan -',
  'Nota para los líderes (opcional)': 'Note for the leaders (optional)',
  'Aceptar e invitar': 'Accept and invite',
  'Rechazar': 'Reject',
  'Ya tiene el enlace. Rétalo a una amistosa y anota cómo atacó.': 'They have the link. Challenge them to a friendly and record how they attacked.',
  'Pasó la prueba': 'Passed the trial',
  'No dio la talla': 'Not up to it',
  'En la demo no se decide nada, pero así se ve.': 'Nothing is decided in the demo, but this is how it looks.',
  'Guardado, pero no se le pudo escribir por Telegram. Avísale tú.': 'Saved, but Telegram delivery failed. Tell them yourself.',
  'Hecho.': 'Done.',
  'Valquiria elige quién entra. Tú tienes la última palabra.': 'Valquiria picks who gets in. You have the final say.',
  // ---- Bots: salud y mandos ----
  'En la demo no se toca a los bots, pero así se ve.': 'The demo does not touch the bots, but this is how it looks.',
  'Mensaje de prueba enviado al grupo.': 'Test message sent to the group.',
  'Webhook reinstalado.': 'Webhook reinstalled.',
  'Comandos publicados': 'Commands published',
  'Guardado': 'Saved',
  'ajuste': 'setting',
  'ajustes': 'settings',
  'Los bots': 'The bots',
  'Preguntando a Telegram…': 'Asking Telegram…',
  'Volver a comprobar': 'Check again',
  'Actividad': 'Activity',
  'Solicitudes sin decidir': 'Undecided applications',
  'en total': 'in total',
  'dentro': 'in',
  '— se deciden en la pestaña Solicitudes.': '- decided in the Applications tab.',
  'Jugadores que Heraldo reconoce': 'Players Heraldo recognizes',
  'Se presentaron con /soy. Solo a ellos les vibra el teléfono cuando se les menciona.': 'They introduced themselves with /soy. Only their phones buzz when mentioned.',
  'Bases dadas hoy': 'Bases handed out today',
  'Tope de diez por día para el grupo, una por persona.': 'Cap of ten a day for the group, one per person.',
  'Cómo firma Heraldo': 'How Heraldo signs',
  'Última alerta': 'Last alert',
  'todavía no corrió': 'has not run yet',
  'Necesita un número secundario. Nunca el personal: la sesión guardada da acceso completo a ese WhatsApp.': 'Needs a secondary number. Never the personal one: the saved session gives full access to that WhatsApp.',
  'Qué entiende Heraldo': 'What Heraldo understands',
  'Los comandos con / funcionan siempre. Sin barra, contesta si lo nombran ("Heraldo…") o le responden a un mensaje suyo.': 'Slash commands always work. Without one, he answers if named ("Heraldo…") or replied to.',
  'O dicho como la gente habla': 'Or said the way people talk',
  'Una base del pack con su mini. Una por persona al día, diez por grupo': 'A base from the pack with its thumbnail. One per person a day, ten per group',
  'Te ata a tu cuenta del juego: desde entonces te menciona y te vibra el teléfono': 'Links you to your game account: from then on he mentions you and your phone buzzes',
  'Último mensaje generado. Solo líderes: puede llevar quién cobra cuánto': 'Last generated message. Leaders only: may include who gets paid what',
  'Charla: 130 frases de cerebro. Es para retención, no para información': 'Chat: a 130-phrase brain. For retention, not information',
  'Qué entiende Valquiria': 'What Valquiria understands',
  'En privado lleva la conversación de ingreso entera. En el grupo solo contesta si la nombran ("Valquiria…", "Valqui…"). Nunca atiende comandos con /: esos son de Heraldo.': 'In private she runs the whole application. In the group she only answers if named ("Valquiria…", "Valqui…"). She never handles slash commands: those belong to Heraldo.',
  'Le dicen': 'They say',
  'Qué hace': 'What she does',
  '"hola" en privado': '"hi" in private',
  'Empieza la solicitud: pide el tag, lee el perfil real de Supercell, confirma, pregunta de dónde sale y avisa a los líderes': 'Starts the application: asks for the tag, reads the real Supercell profile, confirms, asks where they come from and alerts the leaders',
  'Explica que le escriba en privado a @Valqui_bot': 'Explains to write @Valqui_bot in private',
  'Cuántas solicitudes hay sin decidir': 'How many applications are undecided',
  'Se presenta': 'Introduces herself',
  'piropos, insultos, preguntas por Heraldo': 'compliments, insults, questions about Heraldo',
  'Contesta con personalidad y las manda a su sitio': 'Answers with personality and puts them in their place',
  'cualquier cosa de bases, estrellas o guerra': 'anything about bases, stars or war',
  'Lo manda a Heraldo, que es de quien es': 'Sends it to Heraldo, whose job it is',
  'entra al grupo alguien que ella eligió': 'someone she chose joins the group',
  'Lo presenta: nombre, TH, y que viene a probarse en amistosa': 'Introduces them: name, TH, and that they come to try out in a friendly',
  'Webhook': 'Webhook',
  'conectado': 'connected',
  'roto': 'broken',
  'En el grupo': 'In the group',
  'sí, admin': 'yes, admin',
  'Oye': 'Hears',
  'todo el chat': 'the whole chat',
  'solo si le hablan': 'only when spoken to',
  'Sin procesar': 'Unprocessed',
  'Último error de Telegram': 'Last Telegram error',
  'El webhook no apunta a este sitio. Reinstálalo con el botón.': 'The webhook does not point to this site. Reinstall it with the button.',
  'Probar en el grupo': 'Test in the group',
  'Reinstalar webhook': 'Reinstall webhook',
  'Publicar comandos': 'Publish commands',
  'No hay cambios.': 'No changes.',
  'Tus estrellas y ataques de esta CWL': 'Your stars and attacks this CWL',
  'A qué clan te toca ir esta CWL': 'Which clan you go to this CWL',
  'En qué puesto vas del reparto': 'Where you stand in the payout',
  'Ver su ataque': 'Watch their attack',
  'Bajando…': 'Downloading…',
  'En la demo no hay video que bajar.': 'No video to download in the demo.',
  'IA de respaldo': 'Backup AI',
  'con llave': 'key set',
  'sin llave': 'no key',
  'preguntas a la IA hoy. Solo entra cuando el cerebro de frases no sabe; sin llave o al tope, vuelven las frases.': 'AI questions today. It only steps in when the phrase brain has no answer; with no key or at the cap, the phrases come back.',
  'fallos': 'failures',
  'Falta': 'Missing',
  'en Vercel (gratis en aistudio.google.com/apikey).': 'in Vercel (free at aistudio.google.com/apikey).',
  'motor compatible OpenAI': 'OpenAI-compatible engine',
  'con web': 'with web search',
  'Parte diario de la CWL': 'Daily CWL report',
  'Heraldo cuenta cada día cómo va el grupo: tabla, ronda y probabilidades.': 'Heraldo reports daily how the group is going: table, round and odds.',
  'Videos nuevos de YouTube': 'New YouTube videos',
  'Los canales que seguimos, con la miniatura del video.': 'The channels we follow, with the video thumbnail.',
  'Guardar los Raid Weekend': 'Save the Raid Weekends',
  'Los ~24 ataques mensuales de raids, guardados cada fin de semana.': 'The ~24 monthly raid attacks, saved every weekend.',
  'Cierre mensual de premios': 'Monthly prize closing',
  'El día 1 se calcula quién ganó cada premio.': 'On the 1st, who won each prize is computed.',
  'Cómo se comportan': 'How they behave',
  'Valquiria habla en el grupo': 'Valquiria talks in the group',
  'Contesta cuando la nombran o le responden. Apagada, solo atiende en privado a los que quieren entrar.': 'She answers when named or replied to. Off, she only handles applicants in private.',
  'Bienvenida a los nuevos': 'Welcome for newcomers',
  'Valquiria saluda en video a quien entra al grupo.': 'Valquiria greets on video whoever joins the group.',
  'Contesta lo que las frases no saben, y busca en la web las preguntas del juego. Apagada, solo frases.': 'Answers what the phrases cannot, and searches the web for game questions. Off, phrases only.',
  'Entrenar a los bots': 'Train the bots',
  'Lo que enseñes aquí lo aplican antes que su cerebro de frases y que la IA. Tarda un minuto en entrar en vigor.': 'What you teach here is applied before their phrase brain and the AI. It takes a minute to kick in.',
  'Nueva lección': 'New lesson',
  'Cuando alguien diga algo parecido a esto (sin importar tildes ni el orden), el bot contesta eso.': 'When someone says something like this (accents and order do not matter), the bot answers that.',
  'Cuando digan…': 'When they say…',
  'Responde…': 'Answer…',
  '{nombre} se cambia por el nombre de quien pregunta.': '{nombre} becomes the name of whoever asks.',
  'Los dos': 'Both',
  'Enseñar': 'Teach',
  'Probar': 'Try it',
  'Escribe lo que diría alguien en el grupo y mira qué lección saltaría (incluida la que estás escribiendo).': 'Type what someone would say in the group and see which lesson fires (including the one you are writing).',
  'la nueva': 'the new one',
  'ninguna lección; contestaría con su cerebro o la IA': 'no lesson; the brain or the AI would answer',
  'Lo que deben saber': 'What they should know',
  'Cosas del clan que la IA no puede saber sola: quién reparte los premios, cuándo se juega la CWL, reglas de la casa. Entra en sus instrucciones tal cual.': 'Clan facts the AI cannot know by itself: who hands out prizes, when CWL is played, house rules. It goes into its instructions as is.',
  'Guardado. La IA lo tiene en cuenta en un minuto.': 'Saved. The AI takes it into account within a minute.',
  'Lección guardada. Los bots la aplican en un minuto.': 'Lesson saved. The bots apply it within a minute.',
  '¿Borrar esta lección?': 'Delete this lesson?',
  'Usada': 'Used',
  'Reglas': 'Rules',
  'Normas del clan': 'Clan rules',
  'Ver la página pública': 'Open the public page',
  'Vista previa': 'Preview',
  'Editar': 'Edit',
  'Guardar normas': 'Save rules',
  'Normas guardadas. Los bots las usan en un minuto.': 'Rules saved. The bots use them within a minute.',
  'Lo que guardes aquí es lo que Valquiria hace leer y aceptar antes de entrar, lo que Heraldo contesta cuando preguntan por las normas en el grupo, y lo que se ve en la página pública. Markdown sencillo: # título, - lista, **negrita**.': 'What you save here is what Valquiria makes applicants read and accept, what Heraldo answers when someone asks for the rules in the group, and what the public page shows. Simple Markdown: # heading, - list, **bold**.',
  'Última edición': 'Last edited',
  'Normas completas': 'Full rules',
  'Resumen para Telegram': 'Telegram summary',
  'Lo que manda Valquiria en la entrevista y Heraldo en el grupo, con el enlace a las completas. Que quepa en un mensaje.': 'What Valquiria sends in the interview and Heraldo in the group, with the link to the full rules. Keep it to one message.',
  'Mandar el resumen al grupo': 'Send the summary to the group',
  'Guarda primero': 'Save first',
  'Guarda primero para mandar la versión nueva.': 'Save first to send the new version.',
  '¿Mandar el resumen de las normas al grupo de Telegram ahora?': 'Send the rules summary to the Telegram group now?',
  'Mandado al grupo.': 'Sent to the group.',
  'aceptó las normas': 'accepted the rules',
  'sin aceptar las normas': 'rules not accepted',
  'Puntos de disciplina': 'Discipline points',
  'Cada castillo de guerra donado y avisado a los bots ("ya doné mi castillo") vale': 'Each war castle donated and reported to the bots ("ya doné mi castillo") is worth',
  'puntos cuando un líder lo confirma: contestando ✅ al aviso en Telegram, o aquí. La API de Clash no enseña el castillo de guerra y esas donaciones no suben el contador, así que la confirmación es de ustedes. El que más puntos tenga al cerrar el mes se lleva el premio de los puntos.': 'points once a leader confirms it: replying ✅ to the notice in Telegram, or here. The Clash API does not show the war castle and those donations do not raise the donation counter, so confirmation is on you. Whoever has the most points when the month closes wins the points prize.',
  'Tabla del mes': 'This month',
  'Nadie tiene puntos todavía.': 'Nobody has points yet.',
  'Por confirmar': 'To confirm',
  'Nada pendiente.': 'Nothing pending.',
  'sin /soy': 'no /soy',
  '¿Quitar el castillo de': 'Remove the castle of',
  'De dónde sale el meta': 'Where the meta comes from',
  'Cuando preguntan por ejércitos, la IA lee primero lo último de estos canales (títulos y enlaces de ejército de sus videos, por la API de YouTube) y los artículos de estos feeds; la búsqueda web se limita a estas webs. Se renueva solo cada seis horas.': 'When asked about armies, the AI first reads the latest from these channels (video titles and army links, via the YouTube API) and the articles from these feeds; web search is limited to these sites. It refreshes itself every six hours.',
  'Canales de YouTube': 'YouTube channels',
  'Uno por línea: Nombre | id del canal (empieza por UC). Applesauce, ShocK, Habibi, Ace, TK, Blueprint, iTzu vienen de serie.': 'One per line: Name | channel id (starts with UC). Applesauce, ShocK, Habibi, Ace, TK, Blueprint, iTzu come by default.',
  'Feeds de artículos': 'Article feeds',
  'Atom o RSS, una URL por línea. Los blogs de Blueprint (TH18, TH17, Leyenda) vienen de serie.': 'Atom or RSS, one URL per line. Blueprint blogs (TH18, TH17, Legend) come by default.',
  'Webs para buscar': 'Sites to search',
  'Un dominio por línea. Solo en estas busca la IA cuando la pregunta es de meta.': 'One domain per line. The AI only searches these when the question is about the meta.',
  'El digesto': 'The digest',
  'Último': 'Last',
  'Todavía no se ha hecho ninguno.': 'None made yet.',
  'Actualizar el digesto ahora': 'Refresh the digest now',
  'Guardar fuentes': 'Save sources',
  'Fuentes guardadas': 'Sources saved',
  'Digesto actualizado': 'Digest refreshed',
  'Ver lo que lee la IA': 'See what the AI reads',
  'Trabajando…': 'Working…',
  'caracteres': 'characters',
  'errores': 'errors',
  'Activa': 'Active',
  'Falta la llave en Vercel:': 'Missing the key in Vercel:',
  'o': 'or',
  // ---- Borrar un mensaje ----
  'Para borrar uno: arrástralo a la derecha o usa la papelera.': 'To delete one: drag it to the right or use the bin.',
  '¿Borrar este mensaje?': 'Delete this message?',
  'Sí, borrar': 'Yes, delete it',
  'Borrar este mensaje': 'Delete this message',
  'No se pudo borrar: ': 'Could not delete: ',
  // ---- Mandarle la base al jugador ----
  'Enviar al jugador': 'Send to the player',
  'Enviada': 'Sent',
  'Heraldo se la manda al jugador, mencionándolo': 'Heraldo sends it to the player, tagging them',
  'Asígnale la base a alguien primero': 'Assign the base to someone first',
  'En la demo no se envía.': 'Nothing is sent in the demo.',
  'Enviado, pero': 'Sent, but',
  'no se ha presentado a Heraldo, así que no le sonó el teléfono. Dile que escriba': 'has not introduced themselves to Heraldo, so their phone did not buzz. Tell them to write',
  // ---- Enviar con Heraldo ----
  'Dale a Enviar y Heraldo lo publica en el grupo, o cópialo y pégalo tú.': 'Hit Send and Heraldo posts it to the group, or copy it and paste it yourself.',
  'No se pudo enviar: ': 'Could not send: ',
  'Heraldo lo envió': 'Heraldo sent it',
  'Enviando…': 'Sending…',
  'Enviar con Heraldo': 'Send with Heraldo',
  // ---- Entrar con la huella ----
  'Entrar con huella o PIN': 'Sign in with fingerprint or PIN',
  'No se pudo entrar con la huella: ': 'Could not sign in with fingerprint: ',
  'Escribe tu correo primero.': 'Type your email first.',
  'Te mandamos un enlace al correo. Ábrelo desde este mismo teléfono.': 'We sent you a link by email. Open it from this same phone.',
  'Mándame un enlace al correo': 'Email me a link',
  'Mandando…': 'Sending…',
  'Entrar con contraseña': 'Sign in with a password',
  'Volver': 'Back',
  'Activar huella': 'Turn on fingerprint',
  'Registrando…': 'Registering…',
  'Listo. Ya puedes entrar con la huella en este aparato.': 'Done. You can now sign in with your fingerprint on this device.',
  'La llave se crea dentro del teléfono y no sale de ahí: no hay contraseña que se pueda robar. Si el dedo no lee, el teléfono te pide su propio PIN.': 'The key is created inside the phone and never leaves it: there is no password to steal. If the finger does not read, the phone asks for its own PIN.',
  'Este navegador no lo soporta. Ábrelo desde el teléfono, con la app instalada.': 'This browser does not support it. Open it from the phone, with the app installed.',
  'Aparato': 'Device',
  'Registrado': 'Registered',
  'Aparato sin nombre': 'Unnamed device',
  'Quitar': 'Remove',
  'Todavía no hay ningún aparato registrado.': 'No device registered yet.',
  'Registrar este aparato': 'Register this device',
  'Hazlo una vez en cada teléfono desde el que entres.': 'Do it once on each phone you sign in from.',
  // ---- Planear el mes que viene ----
  'Estás planeando': 'You are planning',
  'Se guarda igual que el mes en curso; puedes seguir editándolo hasta que empiece.': 'It saves just like the current month; you can keep editing it until it starts.',
  'a': 'to',
  // ---- Tabla del grupo de CWL ----
  'Desciende': 'Relegated',
  'En zona de descenso': 'In the relegation zone',
  'Riesgo de bajar': 'Relegation risk',
  'Asciende': 'Promoted',
  'Sube': 'Promotion',
  'Puede subir': 'Can still promote',
  'Se mantiene': 'Stays put',
  'Puesto': 'Position',
  'de ataque': 'from attacks',
  'por victoria': 'per win',
  'G': 'W',
  'P': 'L',
  'rondas': 'rounds',
  'ronda': 'round',
  'contra': 'vs',
  'Margen sobre el descenso': 'Margin over relegation',
  'sobre': 'over',
  'Ahora mismo bajamos.': 'As things stand, we go down.',
  'Todavía se puede salir: hay que pasar a': 'There is still a way out: we need to get past',
  'Con lo que queda por jugar ya no alcanzan las cuentas.': 'With what is left to play, the numbers no longer add up.',
  'Para subir faltan': 'To promote we need',
  'ya no da con las rondas que quedan': 'not reachable in the rounds left',
  'Suben': 'Promote',
  'bajan': 'relegate',
  'probabilidades simuladas con el historial de esta liga': 'odds simulated from this league’s own history',
  'Ataque': 'Attack',
  'Ganadas': 'Wins',
  'Destrucción': 'Destruction',
  'Ocultar el parte': 'Hide the briefing',
  'Ver el parte de hoy': "See today's briefing",
  'Copiar para WhatsApp': 'Copy for WhatsApp',
  'Todavía no hay tabla del grupo': 'No group table yet',
  'La baja el job cwl:sync junto con las rondas. Si la CWL ya empezó, córrelo.': 'The cwl:sync job downloads it along with the rounds. If CWL already started, run it.',
  'Grupo de CWL': 'CWL group',
  // ---- Temporadas anteriores de la alineacion ----
  'Temporada': 'Season',
  'en curso': 'current',
  'Estás viendo': 'You are viewing',
  'Los meses cerrados no se editan.': 'Closed months cannot be edited.',
  'Esto reemplaza la alineación de': 'This replaces the lineup for',
  'Copiando…': 'Copying…',
  'Sí, copiar': 'Yes, copy it',
  'Copiar a': 'Copy to',
  'Esa temporada no tiene a nadie asignado que siga en la alianza.': 'That season has nobody assigned who is still in the alliance.',
  'Copiada la alineación de': 'Copied the lineup from',
  'jugadores': 'players',
  'Ahora edita lo que haga falta.': 'Now edit whatever needs changing.',
  'Clan de': 'Clan for',
  'suelta nombres aquí': 'drop names here',
  'Generar mensaje': 'Generate message',
  'Guardando…': 'Saving…',
  'Guardar cambios': 'Save changes',
  'Sin asignar': 'Unassigned',

  // ---- Bases ----
  'Todavía no hay bases cargadas': 'No bases loaded yet',
  'Baja el PDF del proveedor y corre:': "Download the provider's PDF and run:",
  'Los enlaces van como anotaciones dentro del PDF, no como texto — por eso copiar y pegar el contenido no trae nada. El importador los lee y saca de cada uno el nivel de ayuntamiento y si es base de aldea o de guerra.':
    'The links live as annotations inside the PDF, not as text — that is why copying and pasting the content brings nothing. The importer reads them and pulls the town hall level and whether it is a home village or war base from each one.',
  'Todos los packs': 'All packs',
  'Aldea y guerra': 'Home and war',
  'Solo guerra': 'War only',
  'Solo aldea': 'Home only',
  'Solo sin asignar': 'Unassigned only',
  'Base': 'Base',
  'Tipo': 'Type',
  'Asignada a': 'Assigned to',
  'Notas': 'Notes',
  'contra qué defiende, qué donar…': 'what it defends against, what to donate…',
  'Enlace': 'Link',
  'Aldea': 'Home',
  'Guerra': 'War',
  'sin imagen': 'no image',
  'Ver': 'View',
  'Copiar': 'Copy',
  'Abrir': 'Open',
  '¡Copiado!': 'Copied!',
  'Copiar enlace': 'Copy link',
  'Abrir en el juego': 'Open in game',
  'Cerrar': 'Close',
  'Ver la base en grande': 'View the base larger',
  'Este pack no trae imagen': 'This pack has no image',
  '— libre —': '— free —',
  'Ninguna base con esos filtros.': 'No base matches those filters.',
  'En la demo no se guarda.': 'Nothing is saved in the demo.',
  'No se pudo copiar. Ábrela con el botón y copia desde la barra.':
    'Could not copy. Open it with the button and copy from the address bar.',

  // ---- Bonos ----
  'Presupuesto': 'Budget',
  'Asignado': 'Allocated',
  'Queda': 'Left',
  'Premio': 'Prize',
  'Clan': 'Clan',
  'Monto': 'Amount',
  'Guardar': 'Save',
  'Guardado.': 'Saved.',
  'premio(s) eliminado(s).': 'prize(s) removed.',
  'Publicar por Telegram': 'Publish on Telegram',
  'Recarga para deshacer.': 'Reload to undo.',

  'Tope que se reparte cada mes.': 'The cap shared out each month.',
  'Te pasaste': 'Over budget',
  'La suma supera el presupuesto.': 'The total is over the budget.',
  'Justo en el tope.': 'Exactly at the cap.',
  'Sin asignar.': 'Nothing allocated yet.',
  'Cómo se gana': 'How to earn it',
  'Activo': 'Active',
  'Jugador': 'Player',
  'Estrellas': 'Stars',
  'Entregado': 'Delivered',
  'Efectivo': 'Cash',
  'Pase de Oro': 'Gold Pass',
  'Pase de evento': 'Event Pass',
  'Va ganando': 'Leading',
  Usar: 'Use',
  'Medallas': 'Medals',
  'Liga A 1º': 'League A 1st',
  'Más estrellas en CWL': 'Most CWL stars',
  'Quitar este premio (se confirma al guardar)': 'Remove this prize (confirmed when you save)',
  'Sin datos de CWL todavía. Corre': 'No CWL data yet. Run',
  'Hay premios sin título.': 'Some prizes have no title.',
  'No hay premios activos que publicar.': 'There are no active prizes to publish.',
  'En la demo no se guarda, pero así queda.': 'Nothing is saved in the demo, but this is how it looks.',
  'Ese jugador no tiene clan en el último snapshot.': 'That player has no clan in the latest snapshot.',
  'Encolado. Sale por Telegram en la próxima corrida, y está en la pestaña Mensajes para copiar.':
    'Queued. It goes out on Telegram on the next run, and it is in the Messages tab to copy.',

  // ---- Resumen ----
  'Estado del sistema': 'System status',
  'Mensajes por enviar': 'Messages to send',
  'se copian desde la pestaña Mensajes': 'copy them from the Messages tab',
  'WhatsApp automático': 'Automatic WhatsApp',
  'apagado': 'off',
  'Último snapshot': 'Latest snapshot',
  'Últimas corridas': 'Latest runs',
  'Cuándo': 'When',
  'Estado': 'Status',
  'Filas': 'Rows',
  'Error': 'Error',
  'Todavía no corrió ningún job.': 'No job has run yet.',

  // ---- CWL ----
  'Por clan': 'By clan',
  'Rondas': 'Rounds',
  'Sin usar': 'Unused',
  'Ronda': 'Round',
  'Rival': 'Opponent',
  'Nosotros': 'Us',
  'Ellos': 'Them',
  'Tabla de estrellas': 'Star table',
  'Ataques': 'Attacks',
  'Ataques sin usar (guerras cerradas)': 'Unused attacks (finished wars)',
  'Nadie falló ataques.': 'Nobody missed an attack.',

  // ---- Jugadores ----
  'Sin snapshots todavía. Corre': 'No snapshots yet. Run',
  'Trofeos': 'Trophies',
  'Liga': 'League',
  'Estrellas guerra': 'War stars',
  'Donaciones': 'Donations',
  'Buscar jugador…': 'Search player…',

  // ---- Mensajes ----
  'No hay mensajes generados todavía.': 'No messages generated yet.',
  'Copia y pega en el grupo del clan. Al copiar, el mensaje se marca como compartido.':
    'Copy and paste into the clan group. Copying marks the message as shared.',

  // ---- Bots ----
  'Falta correr': 'You still need to run',
  'en Supabase para crear los ajustes.': 'in Supabase to create the settings.',
  'Identidad del bot': 'Bot identity',
  'Nombre': 'Name',
  'Con este nombre firma sus avisos.': 'It signs its alerts with this name.',
  'Firma': 'Signature',
  'Línea final de cada mensaje al clan.': 'Last line of every message to the clan.',
  'Umbrales de aviso': 'Alert thresholds',
  'Horas antes del cierre en que avisa. Separadas por coma.':
    'Hours before closing when it warns. Comma separated.',
  'Qué avisa': 'What it reports',
  'Por dónde avisa': 'Where it sends',
  'Gratis, sin límites y sin riesgo de baneo. Lleva lo que no puede fallar.':
    'Free, no limits, no ban risk. It carries what cannot fail.',
  'Mandar avisos por Telegram': 'Send alerts on Telegram',
  'Bandeja de salida': 'Outbox',
  'Comandos de Telegram': 'Telegram commands',
  'Comando': 'Command',
  'Qué devuelve': 'What it returns',
  'Activado': 'Enabled',
  'sí': 'yes',
  'no': 'no',

  // ---- Demo ----
  'Vista de ejemplo · clanes reales,': 'Sample view · real clans,',
  'números inventados': 'made-up numbers',
  '· aún no hay Supabase conectado': '· no Supabase connected yet',

  // ---- Bonos, resto ----
  'para armar el reparto.': 'to build the split.',
  'Ordenado por estrellas, que es el criterio que ya usan. Marca a quién se las diste.':
    'Sorted by stars, the criterion you already use. Check off who you gave them to.',

  'clan': 'clan',
  'clanes': 'clans',
  'miembro': 'member',
  'miembros': 'members',
  'de': 'of',
  'Sin número secundario. El reporte se copia y se pega a mano.':
    'No secondary number. The report is copied and pasted by hand.',
  'Sin premios para': 'No prizes for',
  'Pulsa': 'Press',
  'Lo más valioso: avisa antes de perder la guerra.':
    'The most valuable one: it warns before you lose the war.',
  'Necesita que /currentwar responda. Correr el probe primero.':
    'Needs /currentwar to respond. Run the probe first.',
  'Los ~24 ataques mensuales que hoy no mide nadie.':
    'The ~24 monthly attacks nobody measures today.',
  'La tabla de ganadores, el día 1.': 'The winners table, on the 1st.',

  'Ataques de CWL sin usar': 'Unused CWL attacks',
  'Ataques de guerra normal': 'Regular war attacks',
  'Resumen de Raid Weekend': 'Raid Weekend summary',
  'Reporte mensual de premios': 'Monthly prize report',
  'vinculado': 'linked',
  'sin vincular': 'not linked',
  'Mandar avisos por WhatsApp': 'Send alerts on WhatsApp',
  '(hay que vincular primero)': '(you have to link it first)',
  'mensajes por enviar. Si ningún canal está activo, se copian a mano desde la pestaña Mensajes — nunca se pierden.':
    'messages to send. If no channel is active, they are copied by hand from the Messages tab — they are never lost.',
  'Quién no ha atacado en la CWL en curso, con horas restantes':
    'Who has not attacked in the current CWL, with hours left',
  'Tabla de estrellas de la temporada': "The season's star table",
  'Estado de los clanes, último snapshot y jobs': 'Clan status, latest snapshot and jobs',
  'Ficha con deltas de trofeos y estrellas': 'Profile with trophy and star deltas',
  'Último mensaje generado, listo para pegar': 'Latest generated message, ready to paste',

  // ---- Alta de clan ----
  'Añadir clan': 'Add clan',
  'Pega el tag del clan o el enlace de invitación que comparte el juego. Se comprueba contra Clash of Clans antes de guardarlo.':
    'Paste the clan tag or the invite link the game shares. It is checked against Clash of Clans before saving.',
  'Eso no parece un tag. Pega el tag del clan o su enlace de invitación.':
    'That does not look like a tag. Paste the clan tag or its invite link.',
  'Ese clan ya está en la alianza.': 'That clan is already in the alliance.',
  'Buscar': 'Search',
  'Buscando…': 'Searching…',
  'nivel': 'level',
  'Su registro de guerra está en privado: la guerra normal de este clan no se podrá medir hasta que lo abran.':
    "Its war log is private: this clan's regular war cannot be measured until they open it.",
  'Escuadra': 'Squad',
  'Cupo de CWL': 'CWL slots',
  'Cancelar': 'Cancel',
  'Añadir a la alianza': 'Add to the alliance',

  // ---- Heraldo en el panel ----
  'responde de la base, sin inventar': 'answers from the database, no guessing',
  'los datos, de la base; lo demás, con IA': 'data from the database; the rest, with AI',
  'Déjame ver…': 'Let me see…',
  '¿En qué te ayudo hoy?': 'What can I help you with today?',
  '¿Cómo te puedo ayudar?': 'How can I help you?',
  'Pregúntame. Por ejemplo:': 'Ask me. For example:',
  '¿quién no ha atacado?': 'who has not attacked?',
  'Enviar': 'Send',
  'No entendí. Puedo responder a:': "I didn't get that. I can answer:",
  'quién no ha atacado': 'who has not attacked',
  'tabla de estrellas': 'star table',
  'ficha de alguien': 'someone profile',
  'el reparto del mes': 'this month split',
  'quién va en cada clan': 'who goes in each clan',
  'Nadie falló ataques en las rondas cerradas.': 'Nobody missed an attack in the finished rounds.',
  'Ataques sin usar en rondas cerradas:': 'Unused attacks in finished rounds:',
  'Estrellas de la temporada:': 'Stars this season:',
  'Todavía no hay ataques de CWL guardados.': 'No CWL attacks saved yet.',
  'No encuentro a nadie con ese nombre.': 'I cannot find anyone with that name.',
  'Ese nombre coincide con demasiados. Sé más específico.': 'That name matches too many. Be more specific.',
  'en': 'in',
  'ataques': 'attacks',
  'No hay premios cargados para este mes.': 'No prizes loaded for this month.',
  'Premios de este mes:': 'This month prizes:',
  'Total': 'Total',
  'Todavía no hay nadie asignado a la CWL.': 'Nobody is assigned to the CWL yet.',

  // ---- Aviso legal ----
  'Este material no está creado ni respaldado por Supercell. Para más información, consulta la':
    'This material is not created by or endorsed by Supercell. For more information, see',
  'Política de Contenido de Fans': "Supercell's Fan Content Policy",
  'de Supercell.': '.',
  // ---- Cerebro, puntos, entrenar (sep 2026) ----
  'Ahora mismo no puedo pensar (sin IA o tope del día). Mira los vitales de arriba.': 'I can\'t think right now (no AI, or today\'s cap reached). Check the vitals above.',
  'Ahora': 'Now',
  'Alguien corrigió a un bot en el grupo contestando a un mensaje suyo. Completa qué frase la dispara y qué debe responder, y apruébala; o descártala.': 'Someone corrected a bot in the group by replying to one of its messages. Fill in what phrase triggers it and what it should answer, then approve it; or discard it.',
  'Anota el castillo de guerra donado; un líder lo confirma contestando ✅ y suman los puntos': 'Logs the donated war castle; a leader confirms by replying ✅ and the points are added',
  'Aprobar': 'Approve',
  'BITÁCORA': 'LOG',
  'Bases en el pack': 'Bases in the pack',
  'Bitácora: lo último que contestó': 'Log: the latest answers',
  'Borrar': 'Delete',
  'Bot': 'Bot',
  'Clanes': 'Clans',
  'Cuando digan… (la frase que la dispara)': 'When they say… (the trigger phrase)',
  'Descartar': 'Discard',
  'ENTER': 'ENTER',
  'El resumen de las normas y el enlace a las completas': 'The rules summary and the link to the full text',
  'En la demo el cerebro no mira nada; así se ve.': 'In the demo the brain doesn\'t measure anything; this is how it looks.',
  'Entrenarlos': 'Training them',
  'Escribe qué frase la dispara y qué debe responder.': 'Write the trigger phrase and what it should answer.',
  'Escríbele a @Valqui_bot, {nombre}, que ella te hace la entrevista.': 'Message @Valqui_bot, {nombre}, she runs the interview.',
  'FALLA': 'FAILING',
  'Fallados': 'Failed',
  'Fuentes del meta': 'Meta sources',
  'Glosario del juego': 'Game glossary',
  'Hace leer y aceptar las normas antes de anotar la solicitud': 'Makes them read and accept the rules before logging the application',
  'Heraldo, ¿cómo entro al clan?': 'Heraldo, how do I join the clan?',
  'Job': 'Job',
  'Jugadores que conoce': 'Players it knows',
  'La tabla de puntos de disciplina del mes': 'This month\'s points table',
  'Las lecciones, lo que deben saber y las fuentes del meta se editan en la pestaña Cerebro, donde también se ve la salud del sistema y todo lo que los bots saben.': 'Lessons, what they must know and the meta sources are edited in the Brain tab, which also shows the system\'s health and everything the bots know.',
  'Lecciones': 'Lessons',
  'Lección aprobada: ya la usa.': 'Lesson approved: it\'s live.',
  'Lo anota; un líder lo confirma contestando ✅ al mensaje y suman los puntos': 'Logs it; a leader confirms by replying ✅ to the message and the points are added',
  'Lo que sabe': 'What it knows',
  'Los jobs': 'The jobs',
  'Los premios los reparte Cris el día 1. La CWL se juega del 1 al 10. En x300 se exige TH17.': 'Cris hands out the prizes on the 1st. CWL runs from the 1st to the 10th. x300 requires TH17.',
  'MAL': 'BAD',
  'MEMORIA': 'MEMORY',
  'Manda el resumen de las normas con el enlace; las dudas concretas las contesta con el texto oficial de la pestaña Reglas': 'Sends the rules summary with the link; specific questions are answered from the official text in the Rules tab',
  'Ningún reto todavía.': 'No challenges yet.',
  'No pude contestar.': 'I couldn\'t answer.',
  'Normas': 'Rules',
  'OJO': 'WATCH',
  'PUNTOS': 'POINTS',
  'Propuestas del cerebro': 'Brain proposals',
  'Puntos del mes': 'Points of the month',
  'Qué es esto': 'What is this',
  'Resultado': 'Result',
  'Reto': 'Challenge',
  'Retos del mes': 'Challenges this month',
  'SALUD': 'HEALTH',
  'Tarea': 'Task',
  'Telegram ↔ juego': 'Telegram ↔ game',
  'Vinculados con /soy': 'Linked with /soy',
  '"las normas" / "¿se puede…?"': '"the rules" / "is it allowed to…?"',
  'aceptadas': 'accepted',
  'activos en los clanes': 'active in the clans',
  'actualiza el digesto': 'refresh the digest',
  'actualizadas el': 'updated on',
  'al final de la entrevista': 'at the end of the interview',
  'arrancando…': 'booting…',
  'artículos': 'articles',
  'cada castillo de guerra donado y avisado a los bots (/castillo o "@Heraldo ya doné mi castillo") vale': 'each war castle donated and reported to the bots (/castillo or "@Heraldo ya doné mi castillo") is worth',
  'canales de YouTube': 'YouTube channels',
  'canales': 'channels',
  'caracteres escritos por los líderes': 'characters written by the leaders',
  'castillo': 'castle',
  'castillos': 'castles',
  'cerrar la guía': 'close the guide',
  'comandos publicados en Telegram': 'commands published on Telegram',
  'cómo entro al clan': 'how do I join the clan',
  'de la alianza': 'in the alliance',
  'desafíos amistosos con': 'friendly challenges with',
  'desafíos amistosos': 'friendly challenges',
  'digesto de': 'digest of',
  'digesto del meta renovado ✓': 'meta digest refreshed ✓',
  'dijo': 'said',
  'el cerebro no contestó': 'the brain didn\'t answer',
  'error': 'error',
  'glosario': 'glossary',
  'hace menos de 1 h': 'less than 1 h ago',
  'hace {x} h': '{x} h ago',
  'Soy el cerebro del OS. ¿Qué necesitas?': 'I am the OS brain. What do you need?',
  'hace {x} d': '{x} d ago',
  'lecciones': 'lessons',
  'lo corrigió': 'corrected by',
  'medido otra vez ✓': 'measured again ✓',
  'mensaje de prueba mandado al grupo ✓': 'test message sent to the group ✓',
  'midiendo Vercel, Supabase, Clash, IA, bots, jobs…': 'measuring Vercel, Supabase, Clash, AI, bots, jobs…',
  'midiendo…': 'measuring…',
  'no pude': 'couldn\'t',
  'normas': 'rules',
  'o más en una captura del chat del clan mandada con /fc en el pie valen': 'or more in one clan-chat screenshot sent with /fc as the caption are worth',
  'palabras': 'words',
  'para repartir': 'to hand out',
  'pendientes': 'pending',
  'por confirmar': 'to confirm',
  'pregúntale o dale una orden…': 'ask it, or give it an order…',
  'propuestas': 'proposals',
  'puntos, una vez al día; Heraldo los cuenta y cruza el nombre del atacante con el /soy. Un líder quita cualquiera contestando ❌ en Telegram, o aquí. El que más puntos tenga al cerrar el mes se lleva el premio.': 'points, once a day; Heraldo counts them and matches the attacker\'s name with /soy. A leader can remove any of them by replying ❌ on Telegram, or here. Whoever has the most points at month\'s end takes the prize.',
  'puntos. Si el aviso trae una captura del mapa de guerra, Heraldo la lee con la IA, la cruza con la API (quién está debajo de quién y contra qué clan) y confirma solo. Sin captura, o si no cuadra, lo confirma un líder: contestando ✅ al aviso en Telegram, o aquí.': 'points. If the report comes with a war-map screenshot, Heraldo reads it with the AI, checks it against the API (who is below whom and which clan we face) and confirms it alone. Without a screenshot, or if it doesn\'t match, a leader confirms: by replying ✅ to the report on Telegram, or here.',
  'reinstala el webhook': 'reinstall the webhook',
  'respuestas recientes': 'recent answers',
  'sin datos. ¿hay sesión?': 'no data. are you signed in?',
  'sin publicar': 'not published',
  'tropas, hechizos, héroes, defensas': 'troops, spells, heroes, defenses',
  'videos': 'videos',
  'volver a mirar': 'look again',
  'webhook reinstalado ✓': 'webhook reinstalled ✓',
  '¿Cómo estás?': 'How are you?',
  '¿Quitar el reto de': 'Remove the challenge of',
  '¿Qué falla ahora mismo?': 'What\'s failing right now?',
  '¿Qué jobs corrieron hoy?': 'Which jobs ran today?',
  '¿qué es cada cosa?': 'what is each thing?',
  'ÚLTIMO LATIDO': 'LAST HEARTBEAT',
  'Última vez': 'Last run',
  'última': 'last',
  'EN FORMA': 'IN SHAPE',
  'ATENTO': 'ALERT',
  'SOBRECARGADO': 'OVERLOADED',
  'PENSANDO': 'THINKING',
  'API de Clash': 'Clash API',
  'Jobs (GitHub Actions)': 'Jobs (GitHub Actions)',
  'Datos de los jugadores': 'Player data',
  'Digesto del meta': 'Meta digest',
  'Cuota de IA hoy': 'AI quota today',
  'Cuota de IA': 'AI quota',
  'Último latido': 'Last heartbeat',
  'Bitácora': 'Log',
  'webhook conectado': 'webhook connected',
  'webhook mal apuntado': 'webhook pointing elsewhere',
  'la base de datos': 'the database',
  'sin llave en este entorno': 'no key in this environment',
  'sin modelo de visión': 'no vision model',
  'los robots de fondo: sincronizar, avisar, cerrar el mes': 'the background robots: sync, alerts, month close',
  'avisos por mandar': 'notices to send',
  'sin snapshots': 'no snapshots',
  'sin digesto': 'no digest',
  'no medido aquí': 'not measured here',
  'por el proxy de RoyaleAPI': 'through the RoyaleAPI proxy',
  'en el grupo': 'in the group',
  'fuera del grupo': 'not in the group',
  'El cerebro es el sistema mirándose a sí mismo: comprueba cada pieza (el servidor, la base de datos, la API de Clash, la IA, los bots, los robots de fondo) y da una nota de 0 a 100. Si algo falla, lo dice aquí y avisa a los líderes en privado.': 'The brain is the system looking at itself: it checks every piece (the server, the database, the Clash API, the AI, the bots, the background robots) and gives a score from 0 to 100. If something fails, it says so here and messages the leaders privately.',
  'Vercel es donde vive la web (este panel y los bots). "Desplegado" con un código quiere decir qué versión está publicada.': 'Vercel is where the web lives (this panel and the bots). "Deployed" with a code tells you which version is published.',
  'Supabase es la base de datos: jugadores, guerras, puntos, normas, lecciones. Si falla, nada se guarda ni se lee.': 'Supabase is the database: players, wars, points, rules, lessons. If it fails, nothing gets saved or read.',
  'La API de Clash es la puerta oficial de Supercell por la que leemos clanes, jugadores y guerras. Va por un proxy (RoyaleAPI) porque la llave está atada a una IP.': 'The Clash API is Supercell\'s official door through which we read clans, players and wars. It goes through a proxy (RoyaleAPI) because the key is tied to one IP.',
  'La IA (en Groq, gratis) es la que contesta cuando las frases no bastan, lee las capturas de castillos y desafíos, y contesta aquí en el cerebro. "Visión" es el modelo que ve imágenes.': 'The AI (on Groq, free) answers when canned phrases aren\'t enough, reads the castle and challenge screenshots, and answers here in the brain. "Vision" is the model that sees images.',
  'Heraldo es el bot del grupo: avisos, puntos, bases, dudas. "Webhook conectado" quiere decir que Telegram le entrega los mensajes.': 'Heraldo is the group bot: notices, points, bases, questions. "Webhook connected" means Telegram delivers the messages to it.',
  'Valquiria es el bot que entrevista a los que quieren entrar y da la bienvenida. También contesta en el grupo si la nombran.': 'Valquiria is the bot that interviews applicants and welcomes newcomers. She also answers in the group when named.',
  'Los jobs son robots de fondo que corren solos en GitHub Actions: sincronizar guerras y jugadores, avisar de la CWL y las raids, cerrar el mes, rehacer el digesto, el latido del cerebro. Aquí se ve la última vez que corrió cada uno y si salió bien.': 'Jobs are background robots that run on their own in GitHub Actions: syncing wars and players, CWL and raid alerts, month close, rebuilding the digest, the brain\'s heartbeat. Here you see the last run of each and whether it went well.',
  'El snapshot es la foto diaria de todos los jugadores (trofeos, donaciones, estrellas). Si es de hace más de un día y medio, algo no está sincronizando.': 'The snapshot is the daily picture of every player (trophies, donations, stars). If it\'s older than a day and a half, something isn\'t syncing.',
  'El digesto del meta es un resumen que el sistema rehace cada 6 horas con los últimos videos de los YouTubers de confianza (Applesauce, ShocK, Habibi, Blueprint…) y los artículos de Blueprint. Es lo que la IA lee cuando alguien pregunta "¿qué ejército uso?", para no contestar con cosas viejas.': 'The meta digest is a summary the system rebuilds every 6 hours from the latest videos of the trusted YouTubers (Applesauce, ShocK, Habibi, Blueprint…) and Blueprint\'s articles. It\'s what the AI reads when someone asks "which army should I use?", so it doesn\'t answer with stale stuff.',
  'La bandeja de salida son los avisos que el sistema generó y están por mandar al grupo (o ya mandados). Se ven en la pestaña Mensajes.': 'The outbox holds the notices the system generated that are waiting to go to the group (or already sent). See the Messages tab.',
  'La IA gratis tiene un tope de llamadas por día. Aquí se ve cuántas van y cuántas fallaron.': 'The free AI has a daily call cap. Here you see how many are used and how many failed.',
  'El latido corre cada hora: mide todo esto y, si la nota cae de 70, Heraldo escribe en privado a los administradores del grupo. Cuando se recupera, avisa otra vez.': 'The heartbeat runs every hour: it measures all of this and, if the score drops below 70, Heraldo privately messages the group admins. When it recovers, it tells them again.',
  'La bitácora guarda lo último que contestó la IA: en el grupo, aquí en el cerebro, y cada captura que leyó (castillos, desafíos). Solo la respuesta y a quién; lo que preguntaron no se guarda.': 'The log keeps the AI\'s latest answers: in the group, here in the brain, and every screenshot it read (castles, challenges). Only the answer and to whom; the question isn\'t stored.',
  'Cuántos jugadores conoce el sistema: los que están hoy en los clanes de la alianza, con su historial.': 'How many players the system knows: the ones in the alliance\'s clans today, with their history.',
  'Los clanes dados de alta en el panel. Se administran en Resumen.': 'The clans registered in the panel. Managed in Overview.',
  'Los que se presentaron con /soy en Telegram: así el bot sabe quién es quién en el juego, y puede darle su alineación, sus puntos y leer sus capturas.': 'Those who introduced themselves with /soy on Telegram: that\'s how the bot knows who is who in the game, and can give them their lineup, their points, and read their screenshots.',
  'Las lecciones son "cuando digan X, responde Y": lo que los líderes enseñan a los bots sin tocar código. Se escriben aquí abajo, en Entrenar.': 'Lessons are "when they say X, answer Y": what the leaders teach the bots without touching code. They\'re written below, in Training.',
  'El glosario son las tropas, hechizos, héroes, mascotas, defensas y trampas del juego, sacadas de la wiki. Cuando alguien nombra una, la IA lee su página antes de contestar, para no inventar.': 'The glossary is the game\'s troops, spells, heroes, pets, defenses and traps, taken from the wiki. When someone names one, the AI reads its page before answering, so it doesn\'t make things up.',
  'Las normas del clan, las que se editan en la pestaña Reglas. Los bots las mandan en la entrevista y contestan dudas con ellas.': 'The clan rules, edited in the Rules tab. The bots send them in the interview and answer questions with them.',
  '"Lo que deben saber" es un texto libre de los líderes (reglas de la casa, quién es quién) que entra en las instrucciones de los bots.': '"What they must know" is free text from the leaders (house rules, who is who) that goes into the bots\' instructions.',
  'De dónde sale el meta: los canales de YouTube y los feeds que el sistema lee cada 6 horas para el digesto.': 'Where the meta comes from: the YouTube channels and feeds the system reads every 6 hours for the digest.',
  'El pack de bases por ayuntamiento que Heraldo reparte con /base.': 'The pack of bases per town hall that Heraldo hands out with /base.',
  'La gente que pidió entrar por Valquiria. Se aceptan o rechazan en la pestaña Solicitudes.': 'The people who applied through Valquiria. Accepted or rejected in the Applications tab.',
  'Los puntos del mes: castillos de guerra donados (con captura) y retos de desafíos amistosos. La tabla y el premio están en Bonos.': 'This month\'s points: donated war castles (with screenshot) and friendly-challenge challenges. The table and the prize are in Bonuses.',
  'Escribe como hablas. El cerebro contesta con lo que acaba de medir. Y hay órdenes que ejecuta de verdad: "reinstala el webhook", "publica los comandos", "actualiza el digesto", "manda un mensaje de prueba", "vuelve a mirar".': 'Write the way you talk. The brain answers with what it just measured. And there are orders it actually executes: "reinstall the webhook", "publish the commands", "refresh the digest", "send a test message", "look again".',
  'Cuando alguien en el grupo contesta a un mensaje de un bot con "no, eso está mal…", el cerebro lo anota como lección propuesta. Aquí se completa qué frase la dispara y qué debe responder, y se aprueba. Nada se aprende sin un líder.': 'When someone in the group replies to a bot\'s message with "no, that\'s wrong…", the brain logs it as a proposed lesson. Here you fill in the trigger phrase and the answer, and approve it. Nothing is learned without a leader.',
  'Escribe algo como lo diría alguien del grupo y mira qué contestaría cada bot con las lecciones que hay.': 'Type something the way someone in the group would say it and see what each bot would answer with the current lessons.',
  'Rehacer el digesto ahora, sin esperar a las 6 horas: vuelve a leer los canales y los feeds y guarda el resumen que usa la IA.': 'Rebuild the digest now, without waiting 6 hours: it re-reads the channels and feeds and stores the summary the AI uses.',
  // ---- El cerebro mira la guerra de ahora (sep 2026) ----
  'Según lo que tengo cargado, ningún clan está en guerra ahora mismo': 'From what I have loaded, no clan is at war right now',
  'Cuando empiece el día de batalla, pregúntame y te digo quién falta.': 'When battle day starts, ask me and I\'ll tell you who still has to attack.',
  'No pude mirar las guerras ahora mismo.': 'I couldn\'t check the wars right now.',
  'Ahora mismo ningún clan está en guerra': 'No clan is at war right now',
  'liga': 'CWL',
  'guerra': 'war',
  'día de preparación': 'preparation day',
  'la batalla empieza en {x}': 'battle starts in {x}',
  'Todavía nadie tiene que atacar.': 'Nobody has to attack yet.',
  'quedan {x}': '{x} left',
  'todos atacaron': 'everyone attacked',
  'Faltan por atacar': 'Still to attack',
  'Siguiente ronda': 'Next round',
  'No puedo ver la guerra normal de': "I can't see the regular war of",
  'registro de guerra privado. Si lo ponen público, la miro.': 'private war log. If they make it public, I will check it.',
  'pregunta u ordena…': 'ask or command…',
  // ---- Logs y Telegram de jugadores (sep 2026) ----
  'Hay dos premios con el mismo título:': 'Two prizes have the same title:',
  'Ya hay un premio con ese título en este mes.': 'There is already a prize with that title this month.',
  '— toda la alianza': '— whole alliance',
  'Logs': 'Logs',
  'Cada cambio que se guarda en el panel queda aquí: quién, cuándo y qué cambió. Lo que hacen los bots y los robots de fondo se puede ver marcando "también el sistema".': 'Every change saved in the panel lands here: who, when and what changed. What the bots and background jobs do can be shown by checking "also the system".',
  'Buscar…': 'Search…',
  'Todos': 'Everyone',
  'también el sistema': 'also the system',
  'Todavía no hay cambios apuntados.': 'No changes recorded yet.',
  'el sistema': 'the system',
  'Cargar más': 'Load more',
  'Cambiar': 'Change',
  '— elige —': '— choose —',
  'Sin Telegram (quitar)': 'No Telegram (remove)',
  'Otro (por id de Telegram)…': 'Other (by Telegram id)…',
  'id numérico': 'numeric id',
  'creó': 'created',
  'editó': 'edited',
  'borró': 'deleted',
  'Premios': 'Prizes',
  'Packs de bases': 'Base packs',
  'Ajustes': 'Settings',
  'Bonos pagados': 'Paid bonuses',
  'Telegram de jugadores': 'Players\' Telegram',
  'Dueños': 'Owners',
  // ---- Logs y Telegram de jugadores (sep 2026) ----
  'Contactos de los líderes': 'Leaders\' contacts',
  'Lo que contesta Heraldo a /contacto: el Telegram (abre el chat) y el enlace de WhatsApp de cada líder. El @ de Telegram o, si no tiene, su id numérico. Se guarda con el botón de arriba.': 'What Heraldo answers to /contacto: each leader\'s Telegram (opens the chat) and WhatsApp link. The Telegram @ or, without one, the numeric id. Saved with the button above.',
  'Rol': 'Role',
  'Id de Telegram': 'Telegram id',
  'Añadir líder': 'Add leader',
  // ---- Logs y Telegram de jugadores (sep 2026) ----
  'Cartel del mes': 'Poster of the month',
  'El cartel de los premios, para compartir': 'The prizes poster, to share',
  // ---- Logs y Telegram de jugadores (sep 2026) ----
  'Por aprobar': 'To approve',
  'Notificaciones': 'Notifications',
  'Lo que preparan los líderes (la lista de CWL, los premios, felicitaciones, las normas). No sale hasta que alguien le da a Enviar, o lo copia y lo pega.': 'What leaders prepare (the CWL roster, prizes, congratulations, the rules). Nothing goes out until someone hits Send, or copies and pastes it.',
  'Lo que Heraldo manda solo (avisos de guerra y CWL, el parte diario, los videos). Aquí queda el historial; si uno falló, se puede reenviar.': 'What Heraldo sends on its own (war and CWL alerts, the daily report, videos). This is the history; if one failed, it can be resent.',
  'Nada por aprobar.': 'Nothing to approve.',
  'Sin notificaciones todavía.': 'No notifications yet.',
  'Premios del mes': 'Prizes of the month',
  'Felicitación': 'Congratulation',
  'Aviso de CWL': 'CWL alert',
  'Aviso de guerra': 'War alert',
  'Parte de CWL': 'CWL report',
  'Video de YouTube': 'YouTube video',
  'Medallas de CWL': 'CWL medals',
  // ---- Logs y Telegram de jugadores (sep 2026) ----
  'Todos los derechos reservados.': 'All rights reserved.',
};

const Ctx = createContext({ idioma: 'es', setIdioma: () => {}, t: (s) => s });

export function ProveedorIdioma({ children }) {
  // Arranca siempre en espanol: es el idioma de los tres lideres y de los 45
  // jugadores. Leer localStorage aca mismo haria que el HTML del servidor y
  // el del cliente no coincidan (error de hidratacion), asi que el idioma
  // guardado se aplica en el efecto de abajo.
  const [idioma, setIdiomaEstado] = useState('es');

  useEffect(() => {
    try {
      const g = localStorage.getItem(CLAVE);
      if (g === 'en' || g === 'es') {
        setIdiomaEstado(g);
        // Tambien el atributo lang: si no, tras recargar queda diciendo 'es'
        // aunque el panel este en ingles, y eso afecta al lector de pantalla
        // y al corrector ortografico del navegador.
        document.documentElement.lang = g;
      }
    } catch {
      // Navegacion privada o almacenamiento bloqueado: se queda en espanol.
    }
  }, []);

  function setIdioma(nuevo) {
    setIdiomaEstado(nuevo);
    try {
      localStorage.setItem(CLAVE, nuevo);
    } catch {
      // Que no se pueda recordar la eleccion no debe romper el cambio.
    }
    if (typeof document !== 'undefined') document.documentElement.lang = nuevo;
  }

  const t = (s) => (idioma === 'en' ? EN[s] ?? s : s);

  return <Ctx.Provider value={{ idioma, setIdioma, t }}>{children}</Ctx.Provider>;
}

export function useIdioma() {
  return useContext(Ctx);
}

/** Atajo para componentes que solo traducen. */
export function useT() {
  return useContext(Ctx).t;
}

/**
 * Aviso de la politica de contenido de fans de Supercell.
 *
 * Vive aqui y no en layout.jsx porque layout es componente de servidor y no
 * puede leer el contexto de idioma. Es obligatorio mostrarlo: la politica de
 * Supercell permite el contenido de fans a condicion de dejar claro que no
 * esta hecho ni respaldado por ellos.
 */
export function AvisoLegal() {
  const t = useT();
  return (
    <>
      <p className="aviso-legal">
        {t('Este material no está creado ni respaldado por Supercell. Para más información, consulta la')}{' '}
        <a href="https://supercell.com/en/fan-content-policy/" target="_blank" rel="noopener noreferrer">
          {t('Política de Contenido de Fans')}
        </a>{' '}
        {t('de Supercell.')}
      </p>
      {/* La obra es de Praxiflux: el aviso de derechos va en todas las
          paginas (panel, demo, entrada, normas). */}
      <p className="aviso-legal copyright">
        © {new Date().getFullYear()} <b>Praxiflux</b> · Management OS · {t('Todos los derechos reservados.')}
      </p>
    </>
  );
}

/** Interruptor ES / EN. Va al lado del selector de tema. */
export function SelectorIdioma() {
  const { idioma, setIdioma } = useIdioma();
  return (
    <div className="idioma" role="group" aria-label="Idioma / Language">
      <button
        type="button"
        className="fantasma"
        data-on={idioma === 'es' ? '1' : '0'}
        onClick={() => setIdioma('es')}
        aria-pressed={idioma === 'es'}
        title="Español"
      >
        ES
      </button>
      <button
        type="button"
        className="fantasma"
        data-on={idioma === 'en' ? '1' : '0'}
        onClick={() => setIdioma('en')}
        aria-pressed={idioma === 'en'}
        title="American English"
      >
        EN
      </button>
    </div>
  );
}
