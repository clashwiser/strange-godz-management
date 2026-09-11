'use client';

// La "i" de informacion: un boton redondo al lado de cada cosa que un
// lider puede no entender ("¿que es el digesto?"). Al pulsarlo sale un
// globo con la explicacion, en lenguaje llano. Se cierra al pulsar fuera
// o con la x. Las explicaciones viven en EXPLICA, con su traduccion en
// idioma.jsx como todo lo demas.

import { useEffect, useRef, useState } from 'react';
import { useT } from './idioma';

export const EXPLICA = {
  cerebro: 'El cerebro es el sistema mirándose a sí mismo: comprueba cada pieza (el servidor, la base de datos, la API de Clash, la IA, los bots, los robots de fondo) y da una nota de 0 a 100. Si algo falla, lo dice aquí y avisa a los líderes en privado.',
  vercel: 'Vercel es donde vive la web (este panel y los bots). "Desplegado" con un código quiere decir qué versión está publicada.',
  supabase: 'Supabase es la base de datos: jugadores, guerras, puntos, normas, lecciones. Si falla, nada se guarda ni se lee.',
  clash: 'La API de Clash es la puerta oficial de Supercell por la que leemos clanes, jugadores y guerras. Va por un proxy (RoyaleAPI) porque la llave está atada a una IP.',
  ia: 'La IA (en Groq, gratis) es la que contesta cuando las frases no bastan, lee las capturas de castillos y desafíos, y contesta aquí en el cerebro. "Visión" es el modelo que ve imágenes.',
  heraldo: 'Heraldo es el bot del grupo: avisos, puntos, bases, dudas. "Webhook conectado" quiere decir que Telegram le entrega los mensajes.',
  valquiria: 'Valquiria es el bot que entrevista a los que quieren entrar y da la bienvenida. También contesta en el grupo si la nombran.',
  jobs: 'Los jobs son robots de fondo que corren solos en GitHub Actions: sincronizar guerras y jugadores, avisar de la CWL y las raids, cerrar el mes, rehacer el digesto, el latido del cerebro. Aquí se ve la última vez que corrió cada uno y si salió bien.',
  snapshot: 'El snapshot es la foto diaria de todos los jugadores (trofeos, donaciones, estrellas). Si es de hace más de un día y medio, algo no está sincronizando.',
  meta: 'El digesto del meta es un resumen que el sistema rehace cada 6 horas con los últimos videos de los YouTubers de confianza (Applesauce, ShocK, Habibi, Blueprint…) y los artículos de Blueprint. Es lo que la IA lee cuando alguien pregunta "¿qué ejército uso?", para no contestar con cosas viejas.',
  outbox: 'La bandeja de salida son los avisos que el sistema generó y están por mandar al grupo (o ya mandados). Se ven en la pestaña Mensajes.',
  cuota: 'La IA gratis tiene un tope de llamadas por día. Aquí se ve cuántas van y cuántas fallaron.',
  latido: 'El latido corre cada hora: mide todo esto y, si la nota cae de 70, Heraldo escribe en privado a los administradores del grupo. Cuando se recupera, avisa otra vez.',
  bitacora: 'La bitácora guarda lo último que contestó la IA: en el grupo, aquí en el cerebro, y cada captura que leyó (castillos, desafíos). Solo la respuesta y a quién; lo que preguntaron no se guarda.',
  jugadores: 'Cuántos jugadores conoce el sistema: los que están hoy en los clanes de la alianza, con su historial.',
  clanes: 'Los clanes dados de alta en el panel. Se administran en Resumen.',
  vinculados: 'Los que se presentaron con /soy en Telegram: así el bot sabe quién es quién en el juego, y puede darle su alineación, sus puntos y leer sus capturas.',
  lecciones: 'Las lecciones son "cuando digan X, responde Y": lo que los líderes enseñan a los bots sin tocar código. Se escriben aquí abajo, en Entrenar.',
  glosario: 'El glosario son las tropas, hechizos, héroes, mascotas, defensas y trampas del juego, sacadas de la wiki. Cuando alguien nombra una, la IA lee su página antes de contestar, para no inventar.',
  normas: 'Las normas del clan, las que se editan en la pestaña Reglas. Los bots las mandan en la entrevista y contestan dudas con ellas.',
  memoriaLideres: '"Lo que deben saber" es un texto libre de los líderes (reglas de la casa, quién es quién) que entra en las instrucciones de los bots.',
  fuentes: 'De dónde sale el meta: los canales de YouTube y los feeds que el sistema lee cada 6 horas para el digesto.',
  bases: 'El pack de bases por ayuntamiento que Heraldo reparte con /base.',
  solicitudes: 'La gente que pidió entrar por Valquiria. Se aceptan o rechazan en la pestaña Solicitudes.',
  puntos: 'Los puntos del mes: castillos de guerra donados (con captura) y retos de desafíos amistosos. La tabla y el premio están en Bonos.',
  preguntar: 'Escribe como hablas. El cerebro contesta con lo que acaba de medir. Y hay órdenes que ejecuta de verdad: "reinstala el webhook", "publica los comandos", "actualiza el digesto", "manda un mensaje de prueba", "vuelve a mirar".',
  propuestas: 'Cuando alguien en el grupo contesta a un mensaje de un bot con "no, eso está mal…", el cerebro lo anota como lección propuesta. Aquí se completa qué frase la dispara y qué debe responder, y se aprueba. Nada se aprende sin un líder.',
  probar: 'Escribe algo como lo diría alguien del grupo y mira qué contestaría cada bot con las lecciones que hay.',
  digesto: 'Rehacer el digesto ahora, sin esperar a las 6 horas: vuelve a leer los canales y los feeds y guarda el resumen que usa la IA.',
};

export function Info({ clave, texto, titulo }) {
  const t = useT();
  const [abierto, setAbierto] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setAbierto(false);
    };
    const tecla = (e) => e.key === 'Escape' && setAbierto(false);
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('mousedown', fuera);
      document.removeEventListener('keydown', tecla);
    };
  }, [abierto]);

  const cuerpo = texto ?? EXPLICA[clave] ?? '';
  if (!cuerpo) return null;
  return (
    <span className="info-caja" ref={ref}>
      <button type="button" className="info-boton" aria-label={t('Qué es esto')} aria-expanded={abierto} onClick={() => setAbierto((a) => !a)}>
        i
      </button>
      {abierto && (
        <span className="info-globo" role="dialog">
          {titulo && <b>{titulo}</b>}
          <span>{t(cuerpo)}</span>
          <button type="button" className="info-cerrar" aria-label={t('Cerrar')} onClick={() => setAbierto(false)}>
            ×
          </button>
        </span>
      )}
    </span>
  );
}
