-- =====================================================================
-- Dar de alta un clan desde el panel
-- Ejecutar DESPUES de 010_outbox_dedupe.sql
-- =====================================================================
--
-- Hasta ahora los clanes solo entraban por el job de snapshot, que los saca
-- de la variable CLAN_TAGS de GitHub. Eso obliga a que un cambio de alianza
-- pase por mi: Carlos o Deibis no pueden anadir un clan nuevo aunque sean
-- lideres. Con esto lo hacen desde la pestana Clanes.
--
-- Sigue SIN permitirse DELETE, a proposito. Borrar un clan se lleva por
-- delante en cascada sus snapshots, temporadas de CWL y ataques: meses de
-- historial que la API ya no devuelve. Para sacar un clan de circulacion
-- esta `activo`, que lo esconde del panel y lo excluye de los jobs pero
-- conserva todo lo que paso.

-- ---------- Retirar sin borrar ---------------------------------------
-- La columna `activo` existe desde 001_schema.sql, pero hasta ahora no la
-- miraba nadie: los jobs leian los tags del entorno y se sincronizaban
-- todos por igual. Lo nuevo es que src/lib/config.js ya la respeta.
-- El add column queda por si esta migracion cae sobre una base mas vieja.
alter table clans add column if not exists activo boolean not null default true;

comment on column clans.activo is
  'false = el clan sale del panel y los jobs dejan de sincronizarlo, pero su historial se conserva. Es el sustituto de borrar, que nunca se permite: borrar arrastra en cascada snapshots, temporadas y ataques que la API ya no devuelve.';

-- Los jobs preguntan por los clanes activos en cada corrida.
create index if not exists idx_clans_activos on clans (orden) where activo;

-- ---------- Alta desde el navegador -----------------------------------
drop policy if exists "lideres dan de alta" on clans;
create policy "lideres dan de alta"
  on clans for insert
  with check (puede_editar());

-- La de UPDATE ya existe desde 007, pero se redefine aqui para que este
-- archivo se pueda correr solo sin depender de que 007 haya pasado.
drop policy if exists "lideres reordenan" on clans;
create policy "lideres reordenan"
  on clans for update
  using (puede_editar())
  with check (puede_editar());

-- ---------- Coherencia de la alianza ----------------------------------
-- Un solo clan principal. Ya lo cubria un indice unico parcial de 004, pero
-- se repite aqui por si este archivo se corre sobre una base mas vieja.
create unique index if not exists idx_clan_principal
  on clans (es_principal) where es_principal;
