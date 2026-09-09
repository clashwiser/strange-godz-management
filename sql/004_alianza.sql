-- =====================================================================
-- Strange Godz Alliance - Multi-clan y armado de alineaciones de CWL
-- Ejecutar DESPUES de 003_outbox.sql
-- =====================================================================

-- ---------- La alianza deja de ser solo A/B/C ---------------------------
-- Antes `escuadra` estaba limitada a 'A','B','C' con un CHECK. La alianza
-- crece, asi que pasa a ser una etiqueta libre y opcional.
alter table clans drop constraint if exists clans_escuadra_check;
alter table clans alter column escuadra drop not null;
alter table clans alter column escuadra type text;

alter table clans add column if not exists es_principal boolean not null default false;
alter table clans add column if not exists orden int not null default 100;
alter table clans add column if not exists cwl_tamano int not null default 15;

-- Solo un clan principal en toda la alianza.
create unique index if not exists idx_clan_principal
  on clans (es_principal) where es_principal;

-- ---------- Alineaciones de CWL ----------------------------------------
-- Lo que hoy se escribe a mano en WhatsApp cada mes. Un jugador va a un solo
-- clan por temporada: la PK compuesta lo garantiza a nivel de base, no de UI.
create table if not exists alineaciones (
  temporada   text not null,                    -- 'YYYY-MM'
  player_tag  text not null references players(player_tag) on delete cascade,
  clan_tag    text not null references clans(clan_tag) on delete cascade,
  posicion    int,                              -- orden dentro del clan
  nota        text,
  fijado_por  uuid references auth.users(id) on delete set null,
  actualizado timestamptz not null default now(),
  primary key (temporada, player_tag)
);

create index if not exists idx_alineaciones_clan
  on alineaciones (temporada, clan_tag, posicion);

-- Estado de la planificacion, para saber si ya se publico al clan.
create table if not exists alineacion_estado (
  temporada    text primary key,
  publicada    boolean not null default false,
  publicada_en timestamptz,
  nota         text
);

-- Vista comoda: alineacion con nombre y datos del ultimo snapshot.
create or replace view alineacion_detalle with (security_invoker = true) as
select a.temporada,
       a.clan_tag,
       a.player_tag,
       a.posicion,
       a.nota,
       p.nombre_actual,
       s.th_level,
       s.trofeos,
       s.liga
from alineaciones a
join players p on p.player_tag = a.player_tag
left join lateral (
  select th_level, trofeos, liga
  from snapshots
  where player_tag = a.player_tag
  order by fecha desc
  limit 1
) s on true;

-- ---------- RLS ---------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['alineaciones','alineacion_estado']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "lideres leen" on %I', t);
    execute format('create policy "lideres leen" on %I for select using (es_lider_autorizado())', t);
    execute format('drop policy if exists "lideres editan" on %I', t);
    execute format('create policy "lideres editan" on %I for all using (puede_editar()) with check (puede_editar())', t);
  end loop;
end $$;
