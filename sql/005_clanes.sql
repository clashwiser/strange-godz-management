-- =====================================================================
-- Strange Godz Alliance - carga de los clanes
-- Ejecutar DESPUES de 004_alianza.sql
--
-- Tags sacados de los enlaces link.clashofclans.com que paso Cris.
--
-- OJO con #2GC: solo 3 caracteres. Los tags de clan suelen tener 8-9.
-- Los muy cortos existen (clanes creados en 2012-2013), pero puede ser
-- que el enlace viniera cortado. `npm run probe` lo confirma en un
-- segundo: si el tag esta mal devuelve 404 y hay que corregirlo aca.
-- =====================================================================

insert into clans (clan_tag, nombre, escuadra, es_principal, orden, cwl_tamano, activo) values
  ('#2GC',       'x300',              'A',  true,  1, 15, true),
  ('#2CCJYG2YL', 'STRANGE - WORLD',   null, false, 2, 15, true),
  ('#228QU9Q8',  'Olympus',           null, false, 3, 15, true),
  ('#JUYP2PL',   'Cuban Pirates',     null, false, 4, 15, true),
  ('#2Q0P0P2JU', 'Cuba',              null, false, 5, 15, true)
on conflict (clan_tag) do update set
  nombre       = excluded.nombre,
  es_principal = excluded.es_principal,
  orden        = excluded.orden,
  activo       = excluded.activo;

-- Las escuadras A/B/C de la CWL se asignan cada mes desde el website,
-- no se fijan aca: cambian segun rendimiento.
