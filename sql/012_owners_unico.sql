-- =====================================================================
-- Una persona, una fila en owners
-- Ejecutar DESPUES de 011_alta_clanes.sql
-- =====================================================================
--
-- `owners.nombre` no tenia restriccion de unicidad, asi que un upsert por
-- nombre fallaba con "there is no unique or exclusion constraint matching
-- the ON CONFLICT specification" -el mismo fallo que tuvo el outbox- y
-- volver a cargar a los lideres habria creado un Cris duplicado, con sus
-- cuentas repartidas entre las dos filas y el reparto de premios roto.
--
-- Dos personas con el mismo nombre en una alianza de 45 es un error de
-- captura, no un caso real: si algun dia pasa, se distinguen con un apodo.

create unique index if not exists idx_owners_nombre on owners (lower(nombre));

-- Los lideres consultan quien es quien desde el panel.
alter table owners enable row level security;

drop policy if exists "lideres leen" on owners;
create policy "lideres leen" on owners for select using (es_lider_autorizado());

drop policy if exists "lideres editan" on owners;
create policy "lideres editan" on owners for all
  using (puede_editar()) with check (puede_editar());
