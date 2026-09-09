import './globals.css';
import { guionAntiParpadeo } from './temas';

export const metadata = {
  title: 'Strange Godz Alliance · Management',
  description: 'Rendimiento, CWL y premios de la alianza Strange Godz',
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
