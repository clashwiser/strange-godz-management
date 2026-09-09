// Los mensajes que Heraldo manda al grupo cada dia de CWL.
//
// Modulo puro, como cwl-analisis.js: lo llama el job que envia a Telegram y
// tambien el panel, para que un lider pueda leer el mensaje del dia antes
// de que salga y copiarlo a WhatsApp si hace falta.
//
// El tono lo puso Cris y no es decoracion:
//
//   - Un mensaje por clan y por dia, al empezar cada dia de guerra.
//   - Si el clan va camino de bajar: alerta fuerte, emojis rojos y
//     "ponganse las pilas". Que se note.
//   - Al final, si subimos se felicita. Si no subimos, animo. Si bajamos NO
//     se reprime a nadie, pero se dice claro que hay que entrenar mas:
//     "nosotros no bajamos clanes, los subimos, minimo los mantenemos".
//
// Espanol de Cuba: "elige", "usa", "acuerdense" — nunca "elegí" ni "usá".

const pct = (x) => `${Math.round(x * 100)}%`;
const estrellas = (n) => `${n}★`;
/** "1 ronda" / "3 rondas", con el verbo que toca. */
const rondas = (n) => `${n} ${n === 1 ? 'ronda' : 'rondas'}`;
const queda = (n) => (n === 1 ? 'queda' : 'quedan');

/** "5º de 8" */
const puestoDe = (n, total) => `${n}º de ${total}`;

/**
 * Como se llama el dia que se esta jugando.
 *
 * La CWL son 8 dias: uno de preparacion y siete de guerra. La ronda N se
 * juega el dia N de guerra, asi que los dos numeros coinciden y no hace
 * falta llevar un calendario aparte.
 */
export function faseDe(analisis) {
  if (!analisis) return null;
  // Dia de preparacion: la ronda 1 existe pero todavia esta en preparation y
  // no ha cerrado ninguna. Ojo con mirar solo `rondaActual`: ese dia ya vale
  // 1, asi que por si solo no distingue el dia 1 del dia 2.
  if (!analisis.rondasJugadas && analisis.estadoRonda === 'preparation') return 'preparacion';
  if (analisis.rondaActual) return 'guerra';
  return 'final';
}

/** Mensaje del dia de preparacion. */
export function mensajePreparacion({ clan, liga, promueven, descienden }) {
  const reglas =
    promueven > 0
      ? `Suben ${promueven} y bajan ${descienden}.`
      : `Aqui no se sube mas: bajan ${descienden}.`;
  return [
    `⚔️ *CWL — ${clan}*`,
    '',
    '¡Vamos gente! Acaba de empezar el dia de preparacion.',
    'Acuerdense de donar los castillos y de estar pendientes al telefono.',
    '',
    `Estamos en *${liga ?? 'liga sin definir'}*. ${reglas}`,
    '',
    'Empecemos con el pie derecho esta liga. 💪',
  ].join('\n');
}

/**
 * Mensaje de un dia de guerra: como vamos, contra quien jugamos hoy y que
 * esta en juego.
 */
export function mensajeDiaDeGuerra({ clan, liga, analisis }) {
  const a = analisis;
  const total = a.tabla.length;
  const perdidas = a.rondasJugadas - a.yo.ganadas;
  const quedan = 7 - a.rondasJugadas;

  const l = [];
  l.push(`⚔️ *CWL ${clan} — dia ${a.rondaActual} de 7*`);
  l.push('');
  l.push(
    `Vamos *${puestoDe(a.yo.puesto, total)}* con *${estrellas(a.yo.estrellas)}* ` +
      `(${a.yo.estrellas_ataque} de ataque + ${a.yo.ganadas} ${a.yo.ganadas === 1 ? 'victoria' : 'victorias'}).`
  );
  l.push(
    `Llevamos ${a.yo.ganadas} ${a.yo.ganadas === 1 ? 'ganada' : 'ganadas'} y ` +
      `${perdidas} ${perdidas === 1 ? 'perdida' : 'perdidas'} de ${a.rondasJugadas}.`
  );

  if (a.rival) {
    l.push('');
    l.push(
      `Hoy nos toca *${a.rival.nombre}* (${puestoDe(a.rival.puesto, total)}, ${estrellas(a.rival.estrellas)}).`
    );
  }

  l.push('');

  // ---- El aviso, que es el motivo de todo el mensaje ----
  if (a.probBajar >= 0.995 && quedan > 0) {
    // Ya no hay cuentas que hacer. Decir "hay que ganar si o si" cuando la
    // aritmetica esta cerrada es mentirle al grupo, y el grupo se da cuenta.
    l.push('🔴🔴 *EL DESCENSO YA NO SE PUEDE EVITAR* 🔴🔴');
    l.push('Con lo que queda por jugar no alcanzan las cuentas. Bajamos.');
    l.push('');
    l.push(
      `Aun asi, ${quedan === 1 ? 'esta guerra se juega' : 'estas guerras se juegan'}: ` +
        'nadie deja ataques sin usar. Se cierra con la cara alta y el mes que viene subimos.'
    );
  } else if (a.enDescenso) {
    l.push('🔴🔴 *ALERTA: ESTAMOS EN ZONA DE DESCENSO* 🔴🔴');
    l.push(
      `Ahora mismo bajamos. ¡Ponganse las pilas! Hay que ganar ` +
        `${quedan === 1 ? 'esta guerra' : `estas ${quedan} guerras`} si o si.`
    );
  } else if (a.probBajar >= 0.25) {
    l.push('🔴 *RIESGO DE DESCENSO* 🔴');
    l.push(
      `Estamos a solo ${estrellas(a.margenSobreDescenso)} del puesto que baja ` +
        `(${a.primeroQueBaja?.nombre ?? '—'}). Riesgo de bajar: *${pct(a.probBajar)}*.`
    );
    // En CWL es UN ataque por cabeza y por ronda, no dos: los dos son de la
    // guerra normal. Decirlo mal aqui es peor que no decir nada, porque el
    // que se lo crea se queda esperando un segundo ataque que no existe.
    l.push('No se puede fallar ni un ataque. Aqui es uno por cabeza: úsenlo con calma.');
  } else if (a.probSubir >= 0.5) {
    l.push('🟢 *VAMOS DE SUBIDA*');
    l.push(`Con esto subimos: ${pct(a.probSubir)} de posibilidades. A no relajarse.`);
  } else if (a.probSubir > 0.02) {
    l.push('🟡 *TODAVIA SE PUEDE SUBIR*');
    l.push(
      `Faltan ${estrellas(a.faltanParaSubir)} para alcanzar a ${a.ultimoQueSube?.nombre ?? '—'}. ` +
        `Posibilidades: *${pct(a.probSubir)}*.`
    );
  } else {
    l.push('🟢 *Estamos comodos*');
    l.push(
      a.margenSobreDescenso > 0
        ? `Tenemos ${estrellas(a.margenSobreDescenso)} de colchon sobre el descenso. Igual, cero ataques sin usar.`
        : 'Igual, cero ataques sin usar.'
    );
    if (a.faltanParaSubir > 0 && a.probSubir <= 0.02) {
      l.push(`Subir ya no da: faltan ${estrellas(a.faltanParaSubir)} y ${queda(quedan)} ${rondas(quedan)}.`);
    }
  }

  return l.join('\n');
}

/**
 * Mensaje del cierre de la liga.
 *
 * Los tres casos los dicto Cris tal cual: si subimos, felicitar; si nos
 * quedamos, animar; si bajamos, no reprimir a nadie pero decirlo fuerte.
 */
export function mensajeFinal({ clan, liga, analisis }) {
  const a = analisis;
  const total = a.tabla.length;
  const perdidas = a.rondasJugadas - a.yo.ganadas;
  const cierre =
    `Terminamos ${puestoDe(a.yo.puesto, total)} con ${estrellas(a.yo.estrellas)}, ` +
    `${a.yo.ganadas} ${a.yo.ganadas === 1 ? 'ganada' : 'ganadas'} y ${perdidas} ${perdidas === 1 ? 'perdida' : 'perdidas'}.`;

  if (a.enAscenso) {
    return [
      `🏆🏆 *¡SUBIMOS! — ${clan}* 🏆🏆`,
      '',
      cierre,
      '',
      '¡Tremendo trabajo, gente! Esto lo hicieron ustedes, ataque por ataque.',
      'Nos vemos en la liga de arriba. 🔥',
    ].join('\n');
  }

  if (a.enDescenso) {
    return [
      `⚠️ *Bajamos de liga — ${clan}*`,
      '',
      cierre,
      '',
      'Aqui nadie va a reprimir a nadie: el que atacó, atacó.',
      'Pero hay que decirlo claro: *esto no puede volver a pasar*.',
      'Nosotros no bajamos clanes, los subimos; y como minimo los mantenemos.',
      '',
      'El mes que viene hay que entrenar mas: practiquen el ataque en amistosas',
      'antes del dia de guerra y pidan la base con tiempo. Volvemos a subir. 💪',
    ].join('\n');
  }

  return [
    `⚔️ *Se acabo la CWL — ${clan}*`,
    '',
    cierre,
    `Nos quedamos en ${liga ?? 'la misma liga'}.`,
    '',
    'No subimos, pero tampoco bajamos, y eso tambien se defiende.',
    'El mes que viene vamos por el ascenso: menos ataques sin usar y mas 3 estrellas. 💪',
  ].join('\n');
}

/**
 * El mensaje que toca hoy para este clan, o null si hoy no toca ninguno.
 *
 * `fase` se puede forzar para previsualizar desde el panel; si no viene, se
 * deduce del estado de la liga.
 */
export function mensajeDelDia({ clan, liga, analisis, promueven = 2, descienden = 2, fase }) {
  const f = fase ?? faseDe(analisis);
  if (f === 'preparacion') return mensajePreparacion({ clan, liga, promueven, descienden });
  if (!analisis) return null;
  if (f === 'final') return mensajeFinal({ clan, liga, analisis });
  return mensajeDiaDeGuerra({ clan, liga, analisis });
}

/**
 * Que cara pone Heraldo en cada anuncio.
 *
 * El parte va a Telegram como FOTO con el texto de pie, y la pose cambia
 * segun lo que toque decir: no es adorno, es la primera lectura. En una
 * lista de notificaciones, la foto se ve antes que la primera palabra, y
 * la alarma roja tiene que distinguirse del parte de rutina sin leer nada.
 *
 * Los nombres corresponden a web/public/heraldo-<pose>.png.
 */
export function poseDelDia({ analisis, fase }) {
  const f = fase ?? faseDe(analisis);

  // Dia de preparacion: llamar a todo el mundo. Corneta.
  if (f === 'preparacion') return 'corneta';
  if (!analisis) return 'lee';

  const a = analisis;
  if (f === 'final') {
    if (a.enAscenso) return 'corneta';   // celebrar tambien es tocar la corneta
    if (a.enDescenso) return 'alarma';
    return 'lee';
  }

  // Dia de guerra: alarma solo cuando de verdad hay que gritar. Si la
  // alarma sale todos los dias, deja de significar nada.
  if (a.enDescenso || a.probBajar >= 0.25) return 'alarma';
  return 'lee';
}
