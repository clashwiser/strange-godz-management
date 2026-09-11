// El Heraldo del panel, con IA detras.
//
// heraldo.jsx contesta de la base lo que es de la base -quien falta, las
// estrellas, la alineacion- sin salir del navegador. Lo que no casa con
// eso llega aqui: primero el cerebro de frases de Heraldo (gratis, en su
// voz), y si tampoco, la misma IA que usa en Telegram, sabiendo que esta
// dentro del panel hablando con un lider. Las preguntas del juego van con
// busqueda web, como en el grupo.
//
// Solo lideres con sesion: es la misma IA de cuota limitada, y sin esto
// cualquiera con la URL le gastaria el dia a los bots.

import { admin } from '../../../lib/supabase-admin';
import { pensar } from '../../../lib/pensar';
import { esPreguntaDelJuego } from '../../../lib/conocimiento';
import { charlar } from '../../../lib/charla';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const plano = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/** Las respuestas vienen en HTML de Telegram; el panel las enseña como texto. */
const aTexto = (s) =>
  String(s ?? '')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');

export async function POST(request) {
  const jwt = (request.headers.get('authorization') ?? '').replace(/^Bearer /, '');
  if (!jwt) return Response.json({ ok: false, error: 'sin sesión' }, { status: 401 });
  const { data: usuario, error } = await admin.auth.getUser(jwt);
  if (error || !usuario?.user) return Response.json({ ok: false, error: 'sesión inválida' }, { status: 401 });
  const { data: lider } = await admin
    .from('dashboard_users')
    .select('nombre, puede_editar')
    .eq('user_id', usuario.user.id)
    .maybeSingle();
  if (!lider) return Response.json({ ok: false, error: 'no autorizado' }, { status: 403 });

  const { pregunta, contexto } = await request.json().catch(() => ({}));
  const texto = String(pregunta ?? '').trim().slice(0, 500);
  if (!texto) return Response.json({ ok: false, error: 'falta la pregunta' }, { status: 400 });

  const nombre = lider.nombre || usuario.user.email?.split('@')[0] || null;
  // Desde el Cerebro llega el estado del sistema ya leido; con el delante
  // no hace falta buscar en la web: la pregunta es sobre la casa.
  const estado = String(contexto ?? '').slice(0, 4000);
  const buscar = !estado && esPreguntaDelJuego(texto);

  // En el panel manda la IA: es un asistente para un lider, no la charla
  // del grupo. Las frases de Telegram quedan de respaldo para cuando la IA
  // no puede (sin llave, tope del dia, fallo).
  let respuesta = await pensar(admin, 'heraldo', texto, nombre, { buscar, panel: true, contexto: estado });
  let via = respuesta ? (buscar ? 'ia con web' : 'ia') : null;
  if (!respuesta && !buscar) {
    respuesta = charlar(plano(texto));
    via = respuesta ? 'frases' : null;
  }
  return Response.json({ ok: true, respuesta: respuesta ? aTexto(respuesta) : null, via });
}
