-- =====================================================================
-- Raid Weekends (Clan Capital)
-- Ejecutar DESPUES de 005_clanes.sql
--
-- Por que importa: un jugador hace ~7 ataques de CWL al mes contra ~22-26
-- de raids. El sistema de premios hoy reparte $61 de $91 mirando solo la
-- CWL, es decir el 12% de la actividad. Esto captura el resto.
--
-- A diferencia del snapshot diario, esta historia NO se pierde: el endpoint
-- devuelve los ultimos fines de semana, asi que se recupera hacia atras.
-- =====================================================================

create table if not exists raid_seasons (
  id                   bigserial primary key,
  clan_tag             text not null references clans(clan_tag) on delete cascade,
  inicio               timestamptz not null,
  fin                  timestamptz,
  estado               text,
  loot_total           bigint,
  raids_completados    int,
  ataques_totales      int,
  distritos_destruidos int,
  recompensa_ofensiva  int,
  recompensa_defensiva int,
  actualizado          timestamptz not null default now(),
  unique (clan_tag, inicio)
);

create index if not exists idx_raid_seasons_fecha on raid_seasons (inicio desc);

create table if not exists raid_members (
  id            bigserial primary key,
  raid_id       bigint not null references raid_seasons(id) on delete cascade,
  player_tag    text not null references players(player_tag) on delete cascade,
  ataques       int not null default 0,
  limite        int,        -- attackLimit
  limite_bonus  int,        -- bonusAttackLimit
  botin         bigint,     -- capitalResourcesLooted
  unique (raid_id, player_tag)
);

-- Ataques de raid sin usar. Ojo: el bonus solo se gana al rematar un
-- distrito, asi que el maximo real de una persona es limite + limite_bonus
-- y quien no desbloqueo el bonus no "fallo" ese ataque extra.
create or replace view raid_fallados with (security_invoker = true) as
select rs.clan_tag,
       rs.inicio,
       rm.player_tag,
       rm.ataques,
       coalesce(rm.limite, 0) as disponibles_base,
       coalesce(rm.limite_bonus, 0) as bonus,
       greatest(coalesce(rm.limite, 0) - rm.ataques, 0) as fallados
from raid_members rm
join raid_seasons rs on rs.id = rm.raid_id
where rs.estado = 'ended';

do $$
declare t text;
begin
  foreach t in array array['raid_seasons','raid_members']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "lideres leen" on %I', t);
    execute format('create policy "lideres leen" on %I for select using (es_lider_autorizado())', t);
  end loop;
end $$;
