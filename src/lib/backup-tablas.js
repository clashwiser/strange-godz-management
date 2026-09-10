// Que tablas entran en la copia, y en que orden.
//
// El orden es el de las claves foraneas: clanes antes que jugadores,
// jugadores antes que snapshots, temporadas antes que guerras. Asi la
// restauracion va de arriba a abajo sin tropezar con una referencia a
// algo que todavia no existe.
//
// Va en su propio archivo porque lo usan backup.js y restaurar.js, y
// backup.js hace la copia nada mas cargarse: importarlo desde restaurar
// dispararia una copia sin querer.

export const TABLAS = [
  'clans',
  'players',
  'memberships',
  'snapshots',
  'cwl_ligas',
  'cwl_seasons',
  'cwl_wars',
  'cwl_roster',
  'cwl_attacks',
  'cwl_grupo',
  'alineaciones',
  'config',
  'base_packs',
  'bases',
  'base_pedidos',
  'bonos',
  'premios_plan',
  'tg_vinculos',
  'solicitudes',
  'ia_uso',
  'dashboard_users',
  'raid_members',
  'wa_estado',
  'outbox',
  'job_runs',
];
