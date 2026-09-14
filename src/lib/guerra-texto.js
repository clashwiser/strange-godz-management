// Los textos de Heraldo sobre la guerra normal (no CWL), puros para
// probarlos: el bloque del aviso de ataques sin usar (guerra-alerta.js) y
// el aviso de que la guerra se acabo (pulso.js). Marcas de WhatsApp
// (*negrita*, ```mono```), que telegram.js traduce.

// Las mismas marcas que outbox.js, sin importarlo: eso arrastra db.js y
// las pruebas corren sin base.
const negrita = (s) => `*${s}*`;
const mono = (s) => '```' + s + '```';

/**
 * El bloque de un clan en "ATAQUES DE GUERRA SIN USAR".
 *
 * `max` son las estrellas posibles (3 por base). Cuando los dos clanes ya
 * las tienen todas, la guerra esta cerrada (empate perfecto) y aun asi hay
 * que atacar: se dejan minerales y bono de guerra en la mesa. Cuando solo
 * nosotros las tenemos, la guerra no se pierde, y lo mismo. Lo pidio Cris
 * el 13 sep 2026 al ver "Van 90★ contra 90★" en una guerra de 30.
 *
 * @param {{ nombre:string, rival:string, restan:number, nosotros:number, ellos:number, max:number, sinUsar:number, lista:string }} g
 */
export function bloqueAlerta({ nombre, rival, restan, nosotros, ellos, max, sinUsar, lista }) {
  const marcador = `Van ${nosotros}★ contra ${ellos}★`;
  let situacion;
  if (max > 0 && nosotros >= max && ellos >= max) {
    situacion =
      `${marcador}: ${max} es el máximo, la guerra está cerrada en empate. ` +
      `Aunque esté cerrada hay que usar todos los ataques: están dejando minerales y bono de guerra en la mesa. ¡Ataquen!`;
  } else if (max > 0 && nosotros >= max) {
    situacion =
      `${marcador}: vamos perfectos, esta guerra no se pierde. ` +
      `Pero hay que usar todos los ataques: están dejando minerales y bono de guerra en la mesa. ¡Ataquen!`;
  } else {
    situacion = marcador;
  }
  return (
    `${negrita(nombre)}\n` +
    `Contra ${rival} · cierra en ${negrita(restan.toFixed(1) + 'h')}\n` +
    `${situacion}\n` +
    `Chicos, faltan ${negrita(sinUsar)} ataques:\n` +
    mono(lista)
  );
}

/** "ganamos" / "perdimos" / "empatamos", por estrellas y luego por destrucción. */
export function resultadoDe({ nosotros, ellos, destruccionNos = 0, destruccionEllos = 0 }) {
  if (nosotros !== ellos) return nosotros > ellos ? 'ganamos' : 'perdimos';
  if (destruccionNos !== destruccionEllos) return destruccionNos > destruccionEllos ? 'ganamos' : 'perdimos';
  return 'empatamos';
}

/**
 * La guerra normal se acabo: a los lideres, que lancen otra. Los tags de
 * los lideres van aparte (menciones de telegram.js).
 */
export function textoFinGuerra({ nombre, rival, nosotros, ellos, destruccionNos = 0, destruccionEllos = 0 }) {
  const resultado = resultadoDe({ nosotros, ellos, destruccionNos, destruccionEllos });
  const marcador = `${nosotros}★ – ${ellos}★`;
  return (
    `🏁 ${negrita('Líderes')}: la guerra de ${negrita(nombre)} contra ${negrita(rival)} ya se acabó — ${negrita(resultado)} ${marcador}.\n\n` +
    `Lancen guerra, no podemos perder tiempo. ⚔️`
  );
}
