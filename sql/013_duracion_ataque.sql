-- =====================================================================
-- Guardar cuanto duro cada ataque
-- Ejecutar DESPUES de 012_owners_unico.sql
-- =====================================================================
--
-- La API devuelve `duration` en cada ataque -segundos que tardo- y lo
-- estabamos descartando. Se guarda ahora por el mismo motivo por el que se
-- guarda todo lo demas: la API solo da el presente, y cuando la temporada
-- pase ese dato no vuelve.
--
-- No se usa para nada todavia. Sirve como desempate alternativo si algun
-- dia "quien ataco primero" no basta: entre dos que hicieron 3 estrellas,
-- el que tardo 108 segundos jugo distinto que el que tardo 180.

alter table cwl_attacks add column if not exists duracion_seg int;

comment on column cwl_attacks.duracion_seg is
  'Segundos que duro el ataque, tal cual los da la API. Se guarda aunque no se use: cuando la temporada pasa, la API deja de devolverlo.';

comment on column cwl_attacks.orden is
  'Puesto del ataque dentro de la guerra, contando los de los DOS clanes intercalados (1-30 en una de 15v15). Es orden cronologico relativo: la API no expone ninguna hora. Es lo que permite desempatar por quien ataco primero.';
