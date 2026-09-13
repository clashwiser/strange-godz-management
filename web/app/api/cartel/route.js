// El cartel de los premios del mes, dibujado por el OS.
//
// GET /api/cartel?mes=2026-09 -> PNG de 1080x1620 (para Telegram y
// WhatsApp). El fondo es una ilustracion hecha una sola vez con IA, SIN
// texto (public/cartel-fondo.jpg); las tarjetas de los premios las pone
// este codigo encima leyendo premios_plan, asi que cuando cambian los
// premios en la pestaña Bonos, el cartel cambia solo y el texto es siempre
// exacto (un generador de imagenes escribe mal los numeros).
//
// Se dibuja con ImageResponse (Satori): flexbox, SVG en linea y fuentes
// propias; ni grid, ni emoji, ni imagenes relativas.

import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { admin } from '../../../lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30;

const ANCHO = 1080;
const ALTO = 1620;

// Las fuentes y el fondo se leen del disco de la funcion (Node): van en
// esta carpeta y next.config los incluye en el paquete (outputFileTracing).
// En Edge no cabian: el limite del plan es 1 MB y Satori solo ya pesa casi eso.
const CARPETA = path.join(process.cwd(), 'app', 'api', 'cartel');
const leer = (nombre) => readFile(path.join(CARPETA, nombre));
let cacheRecursos = null;
function recursos() {
  cacheRecursos ??= Promise.all([leer('LilitaOne.woff'), leer('OpenSans-600.woff'), leer('OpenSans-800.woff'), leer('cartel-fondo.jpg')]).then(
    ([lilita, open600, open800, fondoJpg]) => ({
      lilita,
      open600,
      open800,
      // A data URI: Satori no lee archivos, solo URLs o datos en linea.
      fondoUri: `data:image/jpeg;base64,${Buffer.from(fondoJpg).toString('base64')}`,
    })
  );
  return cacheRecursos;
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const nombreMes = (mes) => {
  const [a, m] = String(mes).split('-').map(Number);
  return m >= 1 && m <= 12 ? `${MESES[m - 1].toUpperCase()} ${a}` : String(mes);
};

const ORO = '#f5c542';
const ORO_HONDO = '#b8862b';
const CREMA = '#f3e6cc';

/** Lo que se paga: "$15", "Pase de Oro"... */
function premioDe(p) {
  if (p.tipo === 'pase_oro') return 'Pase de Oro';
  if (p.tipo === 'pase_evento') return 'Pase de evento';
  if (p.tipo === 'medallas') return 'Medallas';
  return `$${Number(p.monto_usd)}`;
}

/** El puesto que dice el titulo: "1er", "2do", "Tercero"... -> 1, 2, 3. */
function puestoDe(titulo) {
  const t = titulo.toLowerCase();
  const m = /(\d)\s*(?:er|do|ro|º|°)/.exec(t);
  if (m) return Number(m[1]);
  if (/primer/.test(t)) return 1;
  if (/segund/.test(t)) return 2;
  if (/tercer/.test(t)) return 3;
  return null;
}

// ---------- Iconos (SVG en linea; Satori no dibuja emoji ni <text>) ----------
// El numero del puesto va en un div encima del SVG, con la fuente del cartel.

const Numero = ({ n, size = 26, color = '#4a2e0a', top = 26, left = 0, width = 64 }) =>
  n == null ? null : (
    <div style={{ position: 'absolute', top, left, width, display: 'flex', justifyContent: 'center', fontFamily: 'Lilita One', fontSize: size, color, lineHeight: 1 }}>
      {String(n)}
    </div>
  );

const Icono = ({ children }) => <div style={{ position: 'relative', width: 64, height: 64, display: 'flex' }}>{children}</div>;

const Medalla = ({ n, color = ORO }) => (
  <Icono>
    <svg width="64" height="64" viewBox="0 0 64 64">
      <path d="M20 4 L32 22 L44 4" fill="none" stroke="#c0392b" strokeWidth="10" strokeLinejoin="round" />
      <circle cx="32" cy="38" r="22" fill={color} stroke="#7a5416" strokeWidth="3" />
      <circle cx="32" cy="38" r="15" fill="none" stroke="#7a5416" strokeWidth="2" opacity="0.6" />
    </svg>
    <Numero n={n} top={25} />
  </Icono>
);

const BanderaCuba = ({ n }) => (
  <Icono>
    <svg width="64" height="64" viewBox="0 0 64 64">
      <rect x="4" y="12" width="56" height="40" rx="4" fill="#ffffff" />
      <rect x="4" y="12" width="56" height="8" fill="#003da5" />
      <rect x="4" y="28" width="56" height="8" fill="#003da5" />
      <rect x="4" y="44" width="56" height="8" fill="#003da5" />
      <path d="M4 12 L34 32 L4 52 Z" fill="#cf142b" />
      <circle cx="15" cy="32" r="4" fill="#ffffff" />
      <rect x="4" y="12" width="56" height="40" rx="4" fill="none" stroke="#7a5416" strokeWidth="2.5" />
      {n ? <circle cx="52" cy="50" r="11" fill={ORO} stroke="#7a5416" strokeWidth="2" /> : null}
    </svg>
    <Numero n={n} size={15} top={43} left={40} width={24} />
  </Icono>
);

const Escudo = ({ n, color = '#6c2bd9', letra = null }) => (
  <Icono>
    <svg width="64" height="64" viewBox="0 0 64 64">
      <path d="M32 4 L54 12 V32 C54 46 44 56 32 60 C20 56 10 46 10 32 V12 Z" fill={color} stroke="#2a103f" strokeWidth="3" />
      <path d="M32 10 L48 16 V32 C48 42 41 50 32 53 C23 50 16 42 16 32 V16 Z" fill="none" stroke="#e7d4ff" strokeWidth="2" opacity="0.6" />
    </svg>
    <Numero n={letra ?? n} size={letra ? 20 : 28} color="#ffffff" top={letra ? 22 : 18} />
  </Icono>
);

const Espadas = () => (
  <Icono>
    <svg width="64" height="64" viewBox="0 0 64 64">
      <circle cx="32" cy="32" r="28" fill="#3b2412" stroke="#7a5416" strokeWidth="3" />
      <g transform="rotate(45 32 32)">
        <rect x="29" y="8" width="6" height="34" fill="#d9d9d9" stroke="#555" strokeWidth="1" />
        <rect x="24" y="40" width="16" height="5" fill={ORO} />
        <rect x="30" y="45" width="4" height="10" fill="#7a5416" />
      </g>
      <g transform="rotate(-45 32 32)">
        <rect x="29" y="8" width="6" height="34" fill="#d9d9d9" stroke="#555" strokeWidth="1" />
        <rect x="24" y="40" width="16" height="5" fill={ORO} />
        <rect x="30" y="45" width="4" height="10" fill="#7a5416" />
      </g>
    </svg>
  </Icono>
);

const Trofeo = () => (
  <Icono>
    <svg width="64" height="64" viewBox="0 0 64 64">
      <path d="M18 8 H46 V26 C46 36 40 42 32 42 C24 42 18 36 18 26 Z" fill={ORO} stroke="#7a5416" strokeWidth="3" />
      <path d="M18 12 H8 V20 C8 28 13 32 19 32" fill="none" stroke="#7a5416" strokeWidth="3" />
      <path d="M46 12 H56 V20 C56 28 51 32 45 32" fill="none" stroke="#7a5416" strokeWidth="3" />
      <rect x="28" y="42" width="8" height="8" fill="#7a5416" />
      <rect x="18" y="50" width="28" height="8" rx="2" fill={ORO} stroke="#7a5416" strokeWidth="3" />
      <polygon points="32,15 35,23 43,23 37,28 39,36 32,31 25,36 27,28 21,23 29,23" fill="#7a5416" />
    </svg>
  </Icono>
);

const Monedas = () => (
  <svg width="30" height="26" viewBox="0 0 30 26">
    <ellipse cx="10" cy="18" rx="9" ry="5" fill={ORO} stroke="#7a5416" strokeWidth="1.5" />
    <ellipse cx="10" cy="13" rx="9" ry="5" fill={ORO} stroke="#7a5416" strokeWidth="1.5" />
    <ellipse cx="20" cy="9" rx="9" ry="5" fill={ORO} stroke="#7a5416" strokeWidth="1.5" />
  </svg>
);

const Tique = () => (
  <svg width="32" height="24" viewBox="0 0 32 24">
    <path d="M2 4 H30 V9 A3 3 0 0 0 30 15 V20 H2 V15 A3 3 0 0 0 2 9 Z" fill={ORO} stroke="#7a5416" strokeWidth="1.5" />
    <rect x="8" y="9" width="16" height="2" fill="#7a5416" opacity="0.6" />
    <rect x="8" y="13" width="10" height="2" fill="#7a5416" opacity="0.6" />
  </svg>
);

/** El icono que le toca a cada premio, por lo que dice el titulo. */
function iconoDe(p) {
  const t = p.titulo.toLowerCase();
  const n = puestoDe(p.titulo);
  if (/cuba/.test(t)) return <BanderaCuba n={n} />;
  if (/strange/.test(t)) return <Escudo color="#6c2bd9" letra={n ? String(n) : 'SW'} />;
  if (/leyenda|legend/.test(t)) return <Escudo color="#8e24aa" n={n} />;
  if (/guerra normal|ataques/.test(t)) return <Espadas />;
  if (/punto/.test(t)) return <Trofeo />;
  return <Medalla n={n} color={n === 1 ? ORO : n === 2 ? '#c9ced6' : n === 3 ? '#cd7f32' : ORO} />;
}

const recortar = (s, n) => (String(s ?? '').length > n ? `${String(s).slice(0, n - 1)}…` : String(s ?? ''));

function Tarjeta({ p }) {
  const efectivo = p.tipo === 'efectivo';
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        width: 432,
        height: 103,
        padding: '8px 12px',
        borderRadius: 14,
        border: `2px solid ${ORO_HONDO}`,
        background: 'linear-gradient(180deg, rgba(48,22,12,0.92) 0%, rgba(18,8,6,0.94) 100%)',
        boxShadow: '0 4px 14px rgba(0,0,0,0.55)',
      }}
    >
      <div style={{ display: 'flex', width: 64, height: 64, flexShrink: 0 }}>{iconoDe(p)}</div>
      <div style={{ display: 'flex', flexDirection: 'column', marginLeft: 12, width: 330 }}>
        <div style={{ display: 'flex', fontFamily: 'Lilita One', fontSize: 21, color: '#ffffff', lineHeight: 1.05, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {recortar(p.titulo, 34)}
        </div>
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
          {efectivo ? <Monedas /> : <Tique />}
          <div style={{ display: 'flex', marginLeft: 8, fontFamily: 'Lilita One', fontSize: 24, color: ORO, lineHeight: 1 }}>{premioDe(p)}</div>
        </div>
        <div style={{ display: 'flex', marginTop: 4, fontFamily: 'Open Sans', fontWeight: 600, fontSize: 12.5, color: CREMA, lineHeight: 1.15, opacity: 0.92 }}>
          {recortar(p.criterio ?? '', 88)}
        </div>
      </div>
    </div>
  );
}

function Cartel({ mes, premios, fondoUri }) {
  return (
    <div style={{ display: 'flex', width: ANCHO, height: ALTO, position: 'relative', background: '#1a0c08' }}>
      <img src={fondoUri} width={ANCHO} height={ALTO} style={{ position: 'absolute', left: 0, top: 0 }} />

      {/* El titulo, dentro de la placa dorada */}
      <div style={{ position: 'absolute', left: 240, top: 352, width: 596, height: 160, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', fontFamily: 'Lilita One', fontSize: 44, color: '#5a3a10', lineHeight: 1 }}>PREMIOS DE</div>
        <div style={{ display: 'flex', fontFamily: 'Lilita One', fontSize: 62, color: '#3b2408', lineHeight: 1, marginTop: 6 }}>{nombreMes(mes)}</div>
      </div>

      {/* Las tarjetas, dentro del marco fino */}
      <div style={{ position: 'absolute', left: 100, top: 700, width: 880, height: 662, display: 'flex', flexDirection: 'row', flexWrap: 'wrap', alignContent: 'flex-start', gap: 8 }}>
        {premios.slice(0, 12).map((p) => (
          <Tarjeta key={p.id ?? p.titulo} p={p} />
        ))}
        {!premios.length && (
          <div style={{ display: 'flex', width: 880, height: 200, alignItems: 'center', justifyContent: 'center', fontFamily: 'Lilita One', fontSize: 36, color: CREMA }}>
            Los premios de este mes están por publicar
          </div>
        )}
      </div>

      {/* El credito, discreto, abajo a la derecha */}
      <div style={{ position: 'absolute', right: 26, bottom: 16, display: 'flex', fontFamily: 'Open Sans', fontWeight: 800, fontSize: 15, color: 'rgba(243,230,204,0.75)' }}>
        © {new Date().getFullYear()} Praxiflux · Management OS
      </div>

      {/* El pie, sobre la piedra */}
      <div style={{ position: 'absolute', left: 0, top: 1428, width: ANCHO, display: 'flex', justifyContent: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 34px', borderRadius: 16, background: 'rgba(12,6,4,0.78)', border: `2px solid ${ORO_HONDO}` }}>
          <div style={{ display: 'flex', fontFamily: 'Lilita One', fontSize: 26, color: ORO, lineHeight: 1 }}>Se entregan al cerrar el mes</div>
          <div style={{ display: 'flex', fontFamily: 'Open Sans', fontWeight: 800, fontSize: 18, color: CREMA, marginTop: 6 }}>
            Cómo vas tú: /cobro · Los premios: /premios · Telegram y WhatsApp obligatorios
          </div>
        </div>
      </div>
    </div>
  );
}

// Para la demo (y para probar el dibujo sin base): los premios de septiembre 2026.
const DEMO = [
  { titulo: 'x300 · 1er lugar CWL', criterio: 'Más estrellas de CWL en x300', monto_usd: 15, tipo: 'efectivo' },
  { titulo: 'x300 · 2do lugar CWL', criterio: 'Segundo en estrellas de CWL en x300', monto_usd: 7, tipo: 'pase_oro' },
  { titulo: 'x300 · 3er lugar CWL', criterio: 'Tercero en estrellas de CWL en x300', monto_usd: 7, tipo: 'pase_oro' },
  { titulo: 'STRANGE-WORLD · 1er lugar', criterio: 'Primero en estrellas de CWL en STRANGE-WORLD', monto_usd: 7, tipo: 'pase_oro' },
  { titulo: 'Cuba · 1er lugar', criterio: 'Más estrellas de CWL en Cuba', monto_usd: 7, tipo: 'pase_oro' },
  { titulo: 'Cuba · 2do lugar', criterio: 'Segundo en estrellas de CWL en Cuba', monto_usd: 7, tipo: 'pase_oro' },
  { titulo: 'Mejor en guerra normal', criterio: 'Más ataques USADOS del mes. Participación, no estrellas.', monto_usd: 7, tipo: 'pase_oro' },
  { titulo: 'Primero en llegar a Leyenda 1', criterio: 'El primero del mes que llegue a Liga Leyenda', monto_usd: 10, tipo: 'efectivo' },
  { titulo: 'Segundo de llegar a Leyenda 1', criterio: 'El segundo del mes que llegue a Liga Leyenda', monto_usd: 7, tipo: 'pase_oro' },
  { titulo: 'Tercero de llegar a Leyenda 1', criterio: 'El tercero del mes que llegue a Liga Leyenda', monto_usd: 7, tipo: 'pase_oro' },
  { titulo: 'Puntos del mes', criterio: 'El que más puntos tenga (castillos y retos)', monto_usd: 5, tipo: 'pase_evento' },
];

export async function GET(request) {
  const url = new URL(request.url);
  const mes = /^\d{4}-\d{2}$/.test(url.searchParams.get('mes') ?? '') ? url.searchParams.get('mes') : new Date().toISOString().slice(0, 7);
  let premios = [];
  if (url.searchParams.get('demo')) {
    premios = DEMO;
  } else {
    const { data } = await admin
      .from('premios_plan')
      .select('id, titulo, criterio, monto_usd, tipo')
      .eq('mes', mes)
      .eq('activo', true)
      .order('orden');
    premios = data ?? [];
  }
  const { lilita, open600, open800, fondoUri } = await recursos();
  return new ImageResponse(<Cartel mes={mes} premios={premios} fondoUri={fondoUri} />, {
    width: ANCHO,
    height: ALTO,
    fonts: [
      { name: 'Lilita One', data: lilita, weight: 400, style: 'normal' },
      { name: 'Open Sans', data: open600, weight: 600, style: 'normal' },
      { name: 'Open Sans', data: open800, weight: 800, style: 'normal' },
    ],
    headers: { 'Cache-Control': 'public, max-age=300, s-maxage=300' },
  });
}
