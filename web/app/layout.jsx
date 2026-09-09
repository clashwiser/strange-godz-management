import './globals.css';
import { guionAntiParpadeo } from './temas';

export const metadata = {
  title: 'Strange Godz Alliance · Management',
  description: 'Rendimiento, CWL y premios de la alianza Strange Godz',
  manifest: '/manifest.webmanifest',
  // iOS ignora los iconos del manifest y solo mira apple-touch-icon.
  icons: { icon: '/icons/icon-192.png', apple: '/icons/apple-touch-icon.png' },
  appleWebApp: {
    capable: true,
    title: 'Strange Godz',
    statusBarStyle: 'black-translucent',
  },
};

// Color de la barra del sistema cuando se abre como app. Es la madera del
// marco, para que no aparezca una franja blanca arriba del pergamino.
export const viewport = {
  themeColor: '#3d2610',
  // La app va a pantalla completa en el telefono; sin esto, iOS deja un
  // borde blanco en el area de la muesca.
  viewportFit: 'cover',
};

export default function RootLayout({ children }) {
  return (
    // suppressHydrationWarning: el guion de abajo pone data-tema antes de que
    // React hidrate, asi que el HTML del servidor nunca va a coincidir con el
    // del cliente. Es esperado y solo aplica a este elemento.
    <html lang="es" suppressHydrationWarning>
      <head>
        {/* Aplica el tema guardado antes del primer pintado: si no, la pagina
            aparece con el tema por defecto y salta al elegido. */}
        <script dangerouslySetInnerHTML={{ __html: guionAntiParpadeo }} />
      </head>
      <body>
        {children}
        <p className="aviso-legal">
          Este material no está creado ni respaldado por Supercell. Para más información, consultá
          la <a href="https://supercell.com/en/fan-content-policy/" target="_blank" rel="noopener noreferrer">
          Política de Contenido de Fans</a> de Supercell.
        </p>
      </body>
    </html>
  );
}
