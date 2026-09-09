-- =====================================================================
-- Arreglo: el dedupe del outbox rompia TODOS los avisos
-- Ejecutar DESPUES de 009_bases_bonos.sql
-- =====================================================================
--
-- El indice de deduplicacion era PARCIAL:
--
--   create unique index idx_outbox_dedupe
--     on outbox (clave_dedupe) where clave_dedupe is not null;
--
-- Postgres no acepta un indice parcial como destino de ON CONFLICT salvo
-- que la sentencia repita el mismo WHERE. PostgREST -la API que usa
-- supabase-js- no lo emite: escribe "on conflict (clave_dedupe)" a secas.
--
-- Resultado: encolar() moria siempre con
--   "there is no unique or exclusion constraint matching the ON CONFLICT
--    specification"
-- y como TODO aviso pasa por el outbox, ninguna alerta salia nunca. El
-- job ademas terminaba en error, asi que en GitHub Actions se habria visto
-- como una corrida roja cada 2 horas.
--
-- El predicado tampoco hacia falta. En un indice unico Postgres considera
-- cada NULL distinto de los demas, asi que un indice normal ya permite
-- infinitas filas con clave_dedupe nula -que es justo lo que queremos para
-- los mensajes sueltos, los que no se deduplican.

drop index if exists idx_outbox_dedupe;

create unique index if not exists idx_outbox_dedupe
  on outbox (clave_dedupe);
