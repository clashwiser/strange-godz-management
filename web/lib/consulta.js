// Una consulta a Supabase que no se calla los fallos.
//
// El 12 sep 2026 dos consultas devolvieron vacio sin mas (un error
// pasajero del API): a Cris le salio el limite de bases "de otro" y la
// tabla de estrellas salio con tags en vez de nombres. Con { data } a
// secas un fallo parece "no hay filas". Aqui se reintenta una vez y, si
// sigue fallando, se tira: mejor un "⚠️ Error" que un dato falso.

/**
 * @param {() => PromiseLike<{data:any, error:any}>} hacer  arma la consulta (una nueva cada vez)
 * @param {string} nombre  para el mensaje de error
 */
export async function consultar(hacer, nombre = 'consulta') {
  let r = await hacer();
  if (r?.error) {
    await new Promise((x) => setTimeout(x, 400));
    r = await hacer();
  }
  if (r?.error) throw new Error(`${nombre}: ${r.error.message}`);
  return r?.data ?? null;
}
