-- =====================================================================
-- ia_contar: un fallo no cuenta como llamada
-- Ejecutar DESPUES de 022_ia_uso.sql
-- =====================================================================
--
-- La version anterior sumaba una llamada tambien cuando se la llamaba
-- para anotar un fallo, y como la llamada ya se habia contado al
-- empezar, cada fallo salia como dos llamadas: el contador del tope se
-- gastaba el doble y la pestaña Bots enseñaba mas de lo real.
--
-- Ahora: p_fallo = false suma una llamada; p_fallo = true suma un fallo
-- y nada mas. Devuelve siempre las llamadas del dia.

create or replace function ia_contar(p_dia date, p_fallo boolean default false)
returns int
language sql
security definer
set search_path = public
as $$
  insert into ia_uso (dia, llamadas, fallos)
  values (p_dia, case when p_fallo then 0 else 1 end, case when p_fallo then 1 else 0 end)
  on conflict (dia) do update
    set llamadas = ia_uso.llamadas + (case when excluded.fallos = 1 then 0 else 1 end),
        fallos   = ia_uso.fallos + excluded.fallos
  returning llamadas;
$$;

-- Lo ya contado con la version anterior: cada fallo dejo una llamada de
-- mas, asi que se le resta. Solo afecta a las filas que existan hoy.
update ia_uso set llamadas = greatest(llamadas - fallos, 0) where fallos > 0;
