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
  'Arrastrar a otro clan': 'Drag to another clan',
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
  'Arrastra los nombres entre clanes. En el teléfono usa el desplegable de cada tarjeta.':
    'Drag names between clans. On the phone, use the dropdown on each card.',
  'Clan de': 'Clan for',
  'suelta nombres aquí': 'drop names here',
  'Generar mensaje': 'Generate message',
  'Guardando…': 'Saving…',
  'Guardar cambios': 'Save changes',
  'Sin asignar': 'Unassigned',
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
  'Ronda': 'Round',
  'Rival': 'Opponent',
  'Nosotros': 'Us',
  'Ellos': 'Them',
  'Tabla de estrellas': 'Star table',
  'Ataques': 'Attacks',
  'Ataques sin usar (guerras cerradas)': 'Unused attacks (finished wars)',
  'Fallados': 'Missed',
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
