-- =====================================================================
-- x300 - Esquema base (Supabase / Postgres)
-- Ejecutar completo en Supabase > SQL Editor.
-- Idempotente: se puede volver a correr sin romper nada.
-- =====================================================================

-- ---------- Personas y cuentas -----------------------------------------
-- Un humano (owner) puede tener varias cuentas (players). Necesario para
-- la regla "una persona, un premio al mes".
create table if not exists owners (
  id            bigserial primary key,
  nombre        text not null,
  es_lider      boolean not null default false,
  cobra_premios boolean not null default true,   -- los 3 lideres: false
  pago_fijo_usd numeric(6,2),                    -- Deibis coordinador: 10.00
  telegram_id   text,
  notas         text,
  created_at    timestamptz not null default now()
);

create table if not exists clans (
  clan_tag text primary key,                     -- con # incluido
  nombre   text not null,
  escuadra char(1) not null check (escuadra in ('A','B','C')),
  activo   boolean not null default true
);

create table if not exists players (
  player_tag         text primary key,
  owner_id           bigint references owners(id) on delete set null,
  nombre_actual      text not null,
  elegible_premios   boolean not null default true,
  fecha_primer_visto date not null default current_date,
  activo             boolean not null default true,
  updated_at         timestamptz not null default now()
);

-- Los jugadores se renombran. La llave siempre es el tag; guardamos historia.
create table if not exists player_names (
  id          bigserial primary key,
  player_tag  text not null references players(player_tag) on delete cascade,
  nombre      text not null,
  visto_desde date not null default current_date,
  unique (player_tag, nombre)
);

-- Historial de membresia: el premio se paga a quien este el dia 5.
create table if not exists memberships (
  id         bigserial primary key,
  player_tag text not null references players(player_tag) on delete cascade,
  clan_tag   text not null references clans(clan_tag) on delete cascade,
  desde      date not null,
  hasta      date,
  rol        text,
  unique (player_tag, clan_tag, desde)
);
create index if not exists idx_memberships_abiertas
  on memberships (clan_tag) where hasta is null;

-- ---------- Snapshot diario --------------------------------------------
-- La API solo da el presente. Lo que no se guarde hoy se pierde para siempre.
-- unique(player_tag, fecha) = idempotencia via upsert.
create table if not exists snapshots (
  id                      bigserial primary key,
  player_tag              text not null references players(player_tag) on delete cascade,
  fecha                   date not null,
  clan_tag                text references clans(clan_tag) on delete set null,
  war_stars               int,
  logro_war_hero          int,   -- logro "War Hero"
  logro_war_league_legend int,   -- logro "War League Legend"
  trofeos                 int,
  liga                    text,
  th_level                int,
  donaciones              int,
  donaciones_recibidas    int,
  raw                     jsonb, -- perfil crudo, por si manana falta un campo
  created_at              timestamptz not null default now(),
  unique (player_tag, fecha)
);
create index if not exists idx_snapshots_fecha on snapshots (fecha desc);

-- ---------- CWL ---------------------------------------------------------
create table if not exists cwl_seasons (
  id             bigserial primary key,
  temporada      text not null,                 -- YYYY-MM
  clan_tag       text not null references clans(clan_tag) on delete cascade,
  liga           text,
  posicion_final int,
  ascendio       boolean,
  descendio      boolean,
  unique (temporada, clan_tag)
);

create table if not exists cwl_wars (
  id                  bigserial primary key,
  season_id           bigint not null references cwl_seasons(id) on delete cascade,
  ronda               int not null check (ronda between 1 and 7),
  war_tag             text not null unique,
  clan_rival_tag      text,
  clan_rival_nombre   text,
  estrellas_nuestras  int,
  estrellas_rival     int,
  destruccion_nuestra numeric(6,2),
  destruccion_rival   numeric(6,2),
  estado              text,                     -- preparation | inWar | warEnded
  end_time            timestamptz,
  team_size           int,
  actualizado_en      timestamptz not null default now(),
  unique (season_id, ronda)
);

-- Quien estaba ALINEADO en cada ronda. Sin esto no se puede calcular
-- "no atacó": hay que saber quien debia atacar.
create table if not exists cwl_roster (
  id            bigserial primary key,
  war_id        bigint not null references cwl_wars(id) on delete cascade,
  player_tag    text not null references players(player_tag) on delete cascade,
  posicion_mapa int,
  th_level      int,
  unique (war_id, player_tag)
);

create table if not exists cwl_attacks (
  id              bigserial primary key,
  war_id          bigint not null references cwl_wars(id) on delete cascade,
  player_tag      text not null references players(player_tag) on delete cascade,
  defender_tag    text,
  estrellas       int not null,
  destruccion_pct numeric(6,2),
  orden           int,
  th_atacante     int,
  th_defensor     int,
  unique (war_id, player_tag, orden)
);

-- Aviso previo al dia de batalla => sin penalidad. Se carga a mano.
create table if not exists cwl_excusas (
  id            bigserial primary key,
  war_id        bigint not null references cwl_wars(id) on delete cascade,
  player_tag    text not null references players(player_tag) on delete cascade,
  avisado       boolean not null default true,
  nota          text,
  registrado_en timestamptz not null default now(),
  unique (war_id, player_tag)
);

-- Ataques no usados = alineado y sin ataque en guerra ya cerrada.
-- security_invoker es OBLIGATORIO: sin el, la vista corre con permisos de su
-- dueno y SALTA el RLS de las tablas de abajo, dejando el dato expuesto.
create or replace view cwl_misses with (security_invoker = true) as
select r.war_id,
       r.player_tag,
       w.ronda,
       s.temporada,
       s.clan_tag,
       coalesce(e.avisado, false) as avisado,
       e.nota
from cwl_roster r
join cwl_wars    w on w.id = r.war_id
join cwl_seasons s on s.id = w.season_id
left join cwl_attacks a on a.war_id = r.war_id and a.player_tag = r.player_tag
left join cwl_excusas e on e.war_id = r.war_id and e.player_tag = r.player_tag
where w.estado = 'warEnded'
  and a.id is null;

-- ---------- Guerra normal (solo si /currentwar responde) ----------------
create table if not exists wars (
  id                 bigserial primary key,
  clan_tag           text not null references clans(clan_tag) on delete cascade,
  fecha_inicio       timestamptz not null,
  end_time           timestamptz,
  tamano             int,
  clan_rival_tag     text,
  clan_rival_nombre  text,
  estrellas_nuestras int,
  estrellas_rival    int,
  estado             text,
  resultado          text,
  unique (clan_tag, fecha_inicio)
);

create table if not exists war_attacks (
  id               bigserial primary key,
  war_id           bigint not null references wars(id) on delete cascade,
  player_tag       text not null references players(player_tag) on delete cascade,
  defender_tag     text,
  estrellas        int not null,
  estrellas_nuevas int,
  destruccion_pct  numeric(6,2),
  orden            int,
  unique (war_id, player_tag, orden)
);

-- ---------- Cierre mensual y pagos --------------------------------------
create table if not exists monthly_stats (
  id                          bigserial primary key,
  mes                         text not null,       -- YYYY-MM
  player_tag                  text not null references players(player_tag) on delete cascade,
  escuadra                    char(1),
  cwl_estrellas               int not null default 0,
  cwl_ataques_usados          int not null default 0,
  cwl_ataques_totales         int not null default 0,
  cwl_destruccion_prom        numeric(6,2),
  guerra_estrellas            int not null default 0,
  guerra_ataques_usados       int not null default 0,
  guerra_ataques_totales      int not null default 0,
  pct_tres_estrellas          numeric(6,2),
  trofeos_inicio              int,
  trofeos_fin                 int,
  delta_trofeos               int,
  liga_fin                    text,
  ataques_perdidos_sin_avisar int not null default 0,
  elegible                    boolean not null default true,
  calculado_en                timestamptz not null default now(),
  unique (mes, player_tag)
);

create table if not exists payouts (
  id         bigserial primary key,
  mes        text not null,
  player_tag text not null references players(player_tag) on delete cascade,
  premio     text not null,
  monto_usd  numeric(6,2),
  tipo       text not null check (tipo in ('efectivo','pase_oro')),
  pagado     boolean not null default false,
  fecha_pago date,
  nota       text,
  unique (mes, player_tag, premio)
);

create table if not exists squad_assignments (
  id         bigserial primary key,
  mes        text not null,
  player_tag text not null references players(player_tag) on delete cascade,
  escuadra   char(1) not null check (escuadra in ('A','B','C')),
  motivo     text,
  unique (mes, player_tag)
);

-- ---------- Observabilidad ----------------------------------------------
-- "Que pasa si una corrida falla": queda registrado y el dashboard lo muestra.
create table if not exists job_runs (
  id          bigserial primary key,
  job         text not null,
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  ok          boolean,
  filas       int,
  error       text,
  detalle     jsonb
);
create index if not exists idx_job_runs_job on job_runs (job, started_at desc);
