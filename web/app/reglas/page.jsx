// /reglas: las normas del clan, publicas y en el tema del panel.
//
// Es el enlace que Valquiria manda a quien quiere entrar y el que Heraldo
// da en el grupo cuando alguien pregunta. Sin login: el que tiene que
// leerlas es el que todavia no esta dentro. Se lee de la base en cada
// visita (los lideres las editan en la pestaña Reglas del panel).

import { markdownAHtml } from '../../lib/reglas';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Normas · Strange Godz',
  description: 'Las normas de los clanes de Strange Godz.',
};

export default async function Reglas() {
  // El cliente admin revienta al importarse si faltan las variables (en
  // local no estan): import dinamico y, si no hay base, la pagina lo dice
  // en vez de caerse.
  let c = {};
  try {
    const { admin } = await import('../../lib/supabase-admin');
    const { data } = await admin.from('config').select('clave, valor').in('clave', ['reglas', 'reglas_fecha']);
    c = Object.fromEntries((data ?? []).map((r) => [r.clave, r.valor]));
  } catch (e) {
    console.error(`[reglas] ${e.message}`);
  }
  const html = markdownAHtml(String(c.reglas ?? ''));

  return (
    <main className="reglas-publicas">
      <div className="card reglas-hoja">
        <div className="reglas-cab">
          <img src="/heraldo.png" alt="" width="56" height="56" />
          <div>
            <div className="sub">Strange Godz · x300</div>
            {c.reglas_fecha && <div className="sub">Actualizadas el {String(c.reglas_fecha)}</div>}
          </div>
        </div>
        {html ? (
          <article dangerouslySetInnerHTML={{ __html: html }} />
        ) : (
          <p className="vacio">Todavía no hay normas publicadas.</p>
        )}
        <p className="sub" style={{ marginTop: 24 }}>
          ¿Quieres entrar? Escríbele a <b>@Valqui_bot</b> en Telegram.
        </p>
      </div>
    </main>
  );
}
