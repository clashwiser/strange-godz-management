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
    <p className="aviso-legal">
      {t('Este material no está creado ni respaldado por Supercell. Para más información, consulta la')}{' '}
      <a href="https://supercell.com/en/fan-content-policy/" target="_blank" rel="noopener noreferrer">
        {t('Política de Contenido de Fans')}
      </a>{' '}
      {t('de Supercell.')}
    </p>
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
