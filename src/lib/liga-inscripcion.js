// El recordatorio de inscribirse en la Liga de Guerra (CWL).
//
// La inscripción abre el día 1 a las 08:00 UTC y cierra el día 3 a las
// 08:00 UTC: dos días justos. En Cuba, de las 4 de la mañana del 1 a las 4
// de la mañana del 3. En octubre de 2026 se perdió la liga en tres clanes
// porque se creía que había hasta el día 3 entero, y a las 4 AM ya estaba
// cerrada. Por eso Heraldo pregunta cada 4 horas mientras esté abierta.
//
// El aviso es una pregunta, no una bronca: durante la ventana la API puede
// decir que un clan no tiene grupo aunque ya se haya inscrito (el grupo no
// se forma hasta que emparejan), así que no se puede afirmar nada.
//
// Y se calla de dos formas: sola, cuando cierra la inscripción, o porque
// un líder toca "Ya lanzamos". Ese botón hace falta porque no todos los
// meses se tira liga en los cinco clanes: en octubre de 2026 la idea era
// tirarla solo en x300 y en ＳＴＲＡＮＧＥ-ＷＯＲＬＤ, así que avisar por los
// otros tres sería dar la lata por gusto.

/** Si ahora mismo se puede inscribir (día 1 08:00 UTC → día 3 08:00 UTC). */
export function inscripcionAbierta(ahora = new Date()) {
  const dia = ahora.getUTCDate();
  const hora = ahora.getUTCHours();
  if (dia === 1) return hora >= 8;
  if (dia === 2) return true;
  if (dia === 3) return hora < 8;
  return false;
}

/** Cuántas horas quedan para que cierre (null si no está abierta). */
export function horasParaCerrar(ahora = new Date()) {
  if (!inscripcionAbierta(ahora)) return null;
  const cierre = Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), 3, 8, 0, 0);
  return Math.max(0, (cierre - ahora.getTime()) / 3600000);
}

/**
 * Un clan está inscrito si la API le ve un grupo de liga de ESTA
 * temporada. Un grupo en estado "ended" es el del mes pasado: ese no
 * cuenta.
 */
export function estaInscrito(grupo) {
  return Boolean(grupo && grupo.state && grupo.state !== 'ended');
}

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** El botón para que un líder calle el recordatorio del mes. */
export const DATO_LANZADO = 'liga:lanzado';
export const botonLanzado = () => ({ inline_keyboard: [[{ text: '✅ Ya lanzamos', callback_data: DATO_LANZADO }]] });

/**
 * El mensaje al grupo. Lo escribió Cris: preguntar sin dar la lata, con el
 * dato que se les olvidó (son dos días, no hasta el día 3 entero).
 *
 * @param {string[]} sinInscribir  nombres de los clanes que no se ven inscritos
 * @param {number} horas           las que quedan para que cierre
 */
export function textoInscripcion(sinInscribir, horas) {
  const quedan =
    horas >= 24
      ? `Quedan <b>${Math.floor(horas / 24)} día${Math.floor(horas / 24) === 1 ? '' : 's'} y ${Math.round(horas % 24)} h</b>`
      : horas >= 1
        ? `Quedan <b>${Math.round(horas)} horas</b>`
        : `Queda <b>menos de una hora</b>`;
  const lista = sinInscribir.length
    ? `\n\nNo veo inscrito${sinInscribir.length === 1 ? '' : 's'} a: <b>${sinInscribir.map(esc).join('</b>, <b>')}</b>. Si ya lo mandaron, ignórenme.`
    : '';
  return (
    `⚔️ <b>¿Ya mandaron liga?</b>\n\n` +
    `No quiero ser un dolor de cabeza, pero recuerden que la inscripción de la Liga de Guerra dura <b>dos días</b>: ` +
    `abre el día 1 a las 8:00 UTC (4:00 AM en Cuba) y cierra el día 3 a la misma hora, no el día 3 entero.\n\n` +
    `${quedan} para que cierre.${lista}\n\nSi no han lanzado, métanle mano. ` +
    `Si ya está todo lo que iban a lanzar este mes, un líder toca <b>Ya lanzamos</b> y no vuelvo a preguntar.`
  );
}
