// Cliente de la API oficial de Clash of Clans.
//
// El problema del whitelist de IP se resuelve con el proxy de RoyaleAPI:
// se crea la llave en developer.clashofclans.com whitelisteando 45.79.218.79
// y se apunta la base URL al proxy. Asi funciona desde GitHub Actions, que
// no tiene IP fija.

const BASE = process.env.COC_BASE_URL || 'https://proxy.royaleapi.dev/v1';
const TOKEN = process.env.COC_TOKEN;

if (!TOKEN) throw new Error('Falta COC_TOKEN en el entorno');

/** Error con el status HTTP a la vista, para poder distinguir 403 de 429. */
export class CocError extends Error {
  constructor(status, path, body) {
    super(`CoC API ${status} en ${path}: ${body}`);
    this.status = status;
    this.path = path;
  }
}

const encodeTag = (tag) => encodeURIComponent(tag.trim().toUpperCase());
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * La API devuelve fechas como "20260907T103000.000Z", que no es ISO valido
 * y Date() no parsea. Hay que separarla a mano.
 */
export function parseCocDate(s) {
  if (!s) return null;
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})\.(\d{3})Z$/.exec(s);
  if (!m) return new Date(s);
  const [, y, mo, d, h, mi, sec, ms] = m;
  return new Date(`${y}-${mo}-${d}T${h}:${mi}:${sec}.${ms}Z`);
}

async function request(path, { retries = 4 } = {}) {
  let lastErr;
  for (let intento = 0; intento <= retries; intento++) {
    let res;
    try {
      res = await fetch(`${BASE}${path}`, {
        headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(20000),
      });
    } catch (err) {
      // Timeout o error de red: reintentar.
      lastErr = err;
      await sleep(500 * 2 ** intento);
      continue;
    }

    if (res.ok) return res.json();

    const body = await res.text().catch(() => '');

    // 403 = registro de guerra privado o llave mal whitelisteada. No reintentar.
    // 404 = no existe (ej. clan sin CWL este mes). No reintentar.
    if (res.status === 403 || res.status === 404) {
      throw new CocError(res.status, path, body);
    }

    // 429 (rate limit) y 5xx: backoff exponencial.
    lastErr = new CocError(res.status, path, body);
    await sleep(800 * 2 ** intento);
  }
  throw lastErr;
}

/** Corre las tareas con concurrencia limitada, para no gatillar el 429. */
export async function mapLimit(items, limite, fn) {
  const salida = new Array(items.length);
  let i = 0;
  const obreros = Array.from({ length: Math.min(limite, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      salida[idx] = await fn(items[idx], idx);
    }
  });
  await Promise.all(obreros);
  return salida;
}

// ---------- Endpoints --------------------------------------------------

export const getClan = (clanTag) => request(`/clans/${encodeTag(clanTag)}`);

export const getPlayer = (playerTag) => request(`/players/${encodeTag(playerTag)}`);

export const getLeagueGroup = (clanTag) =>
  request(`/clans/${encodeTag(clanTag)}/currentwar/leaguegroup`);

export const getLeagueWar = (warTag) =>
  request(`/clanwarleagues/wars/${encodeTag(warTag)}`);

export const getCurrentWar = (clanTag) =>
  request(`/clans/${encodeTag(clanTag)}/currentwar`);

export const getWarLog = (clanTag) =>
  request(`/clans/${encodeTag(clanTag)}/warlog`);

/**
 * Raid Weekends. Por miembro devuelve `attacks` contra
 * `attackLimit + bonusAttackLimit`: ataques fallados exactos, sin inferir.
 * Son ~22-26 ataques por jugador al mes, tanto volumen como la guerra normal.
 */
export const getCapitalRaids = (clanTag, limit = 10) =>
  request(`/clans/${encodeTag(clanTag)}/capitalraidseasons?limit=${limit}`);

/**
 * Igual que la funcion que recibe, pero devuelve null en vez de tirar cuando
 * el endpoint esta bloqueado por registro de guerra privado (403) o no hay
 * nada que traer (404). Sirve para no tumbar un job entero por eso.
 */
export async function opcional(promesa) {
  try {
    return await promesa;
  } catch (err) {
    if (err instanceof CocError && (err.status === 403 || err.status === 404)) return null;
    throw err;
  }
}

/** Extrae el valor de un logro por nombre exacto. */
export function logro(player, nombre) {
  const a = player?.achievements?.find((x) => x.name === nombre);
  return a ? a.value : null;
}
