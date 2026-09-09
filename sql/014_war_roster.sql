-- =====================================================================
-- Quien estaba EN la guerra normal
-- Ejecutar DESPUES de 013_duracion_ataque.sql
-- =====================================================================
--
-- war_attacks solo guarda ataques hechos. Sin saber quien estaba alineado
-- es imposible distinguir "no atacó" de "no jugaba esa guerra", que es
-- justo lo que el premio de guerra tiene que medir: el hallazgo del probe
-- fue que se desperdicia el 14,7% de los ataques de guerra normal contra
-- el 0,8% de los de CWL.
--
-- Es el mismo problema que ya resolvia cwl_roster para la CWL, y se
-- resuelve igual.

create table if not exists war_roster (
  id            bigserial primary key,
  war_id        bigint not null references wars(id) on delete cascade,
  player_tag    text not null references players(player_tag) on delete cascade,
  posicion_mapa int,
  th_level      int,
  -- Cuantos ataques le tocaban. En guerra normal son 2 por cabeza, pero
  -- viene de la API (`attacksPerMember`) en vez de estar escrito a fuego:
  -- Supercell ya lo ha cambiado antes en eventos especiales.
  ataques_disponibles int not null default 2,
  unique (war_id, player_tag)
);

create index if not exists idx_war_roster_jugador on war_roster (player_tag);

-- ---------- RLS ----------
alter table war_roster enable row level security;

drop policy if exists "lideres leen" on war_roster;
create policy "lideres leen" on war_roster for select using (es_lider_autorizado());

-- Sin politica de escritura: esta tabla la llena el job con la service_role,
-- que salta RLS. El navegador no tiene por que tocar el historial.
