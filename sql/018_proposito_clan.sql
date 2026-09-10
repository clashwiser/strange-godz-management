-- =====================================================================
-- Para que sirve cada clan
-- Ejecutar DESPUES de 017_tg_vinculos.sql
-- =====================================================================
--
-- No todos los clanes de la alianza hacen lo mismo, y medirlos con la
-- misma vara da un diagnostico falso.
--
-- Olympus y Cuban Pirates son clanes de TROFEOS: tienen buenas estadisticas
-- y su historia, y solo se usan de vez en cuando para amistosas y CWL. Que
-- tengan dos miembros y cero donaciones no es un problema, es como estan
-- pensados. Sin esta columna, la pantalla de salud los pintaria en rojo
-- todos los dias y acabaria ignorandose entera.
--
-- Los de guerra -x300, STRANGE-WORLD, Cuba- si se miden con todo: quien
-- dona, quien ataca, quien entra y quien se va.

alter table clans add column if not exists proposito text not null default 'guerra';

alter table clans drop constraint if exists clans_proposito_check;
alter table clans add constraint clans_proposito_check
  check (proposito in ('guerra', 'trofeos'));

comment on column clans.proposito is
  'guerra = se le exige donar y atacar; trofeos = clan de vitrina, solo amistosas y CWL';

update clans set proposito = 'trofeos'
 where clan_tag in ('#228QU9Q8', '#JUYP2PL');
