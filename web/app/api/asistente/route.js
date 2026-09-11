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

  const { pregunta } = await request.json().catch(() => ({}));
  const texto = String(pregunta ?? '').trim().slice(0, 500);
  if (!texto) return Response.json({ ok: false, error: 'falta la pregunta' }, { status: 400 });

  const nombre = lider.nombre || usuario.user.email?.split('@')[0] || null;
  const buscar = esPreguntaDelJuego(texto);

  // Las frases primero, salvo que sea una pregunta del juego: ahi la
  // frase de "el mejor ejercito es el que practicas" no es respuesta.
  let respuesta = buscar ? null : charlar(plano(texto));
  let via = respuesta ? 'frases' : null;
  if (!respuesta) {
    respuesta = await pensar(admin, 'heraldo', texto, nombre, { buscar, panel: true });
    via = respuesta ? (buscar ? 'ia con web' : 'ia') : null;
  }
  return Response.json({ ok: true, respuesta: respuesta ? aTexto(respuesta) : null, via });
}
