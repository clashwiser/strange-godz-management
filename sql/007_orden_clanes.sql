-- =====================================================================
-- Permiso para reordenar los clanes desde el website
-- Ejecutar DESPUES de 006_raids.sql
--
-- La tabla `clans` solo tenia politica de lectura. Para poder arrastrar las
-- tarjetas y que el orden quede guardado hace falta permitir UPDATE a los
-- lideres con permiso de edicion.
--
-- Se permite UPDATE, no INSERT ni DELETE: los clanes los da de alta el job de
-- snapshot desde la API, no el navegador. Asi un error en la interfaz no
-- puede borrar un clan de la alianza.
-- =====================================================================

drop policy if exists "lideres reordenan" on clans;
create policy "lideres reordenan"
  on clans for update
  using (puede_editar())
  with check (puede_editar());
