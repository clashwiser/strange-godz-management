-- =====================================================================
--  Strange Godz Alliance - Management
--  INSTALACION COMPLETA EN UN SOLO PASO
--
--  Pegar TODO este archivo en el SQL Editor de Supabase y darle Run.
--  Es la union de los 15 archivos de sql/ en el orden correcto; el orden
--  importa porque cada uno se apoya en tablas del anterior.
--
--  Se puede correr dos veces sin romper nada: todo va con
--  "if not exists" / "or replace" / "drop policy if exists".
--  Si algo falla a mitad, se arregla y se vuelve a pegar entero.
--
--  GENERADO - no editar a mano. Regenerar con: npm run sql:unir
-- =====================================================================



-- ####################################################################
-- ##  001_schema.sql
-- ####################################################################

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


-- ####################################################################
-- ##  002_rls.sql
-- ####################################################################

-- =====================================================================
-- x300 - Seguridad (Row Level Security)
-- Ejecutar DESPUES de 001_schema.sql
--
-- Modelo: el dashboard es privado. Solo los 3 lideres, autenticados con
-- usuario y contrasena de Supabase Auth, pueden leer. Nadie puede escribir
-- desde el navegador: los jobs de GitHub Actions escriben con la service
-- role key, que salta RLS por diseno y nunca sale del servidor.
-- =====================================================================

-- Lista blanca de quien puede entrar al dashboard.
create table if not exists dashboard_users (
  user_id  uuid primary key references auth.users(id) on delete cascade,
  nombre   text not null,
  owner_id bigint references owners(id) on delete set null,
  puede_editar boolean not null default false,  -- editar excusas / escuadras
  created_at timestamptz not null default now()
);

alter table dashboard_users enable row level security;

drop policy if exists "cada uno ve su propia fila" on dashboard_users;
create policy "cada uno ve su propia fila"
  on dashboard_users for select
  using (user_id = auth.uid());

-- Helper: ¿el que consulta esta en la lista blanca?
create or replace function es_lider_autorizado()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from dashboard_users where user_id = auth.uid());
$$;

create or replace function puede_editar()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from dashboard_users
    where user_id = auth.uid() and puede_editar = true
  );
$$;

-- ---------- Lectura para lideres autorizados ----------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'owners','clans','players','player_names','memberships','snapshots',
    'cwl_seasons','cwl_wars','cwl_roster','cwl_attacks','cwl_excusas',
    'wars','war_attacks','monthly_stats','payouts','squad_assignments',
    'job_runs'
  ]
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "lideres leen" on %I', t);
    execute format(
      'create policy "lideres leen" on %I for select using (es_lider_autorizado())', t);
  end loop;
end $$;

-- ---------- Escritura acotada desde el dashboard ------------------------
-- Solo tres cosas se editan a mano: excusas de CWL, escuadras propuestas
-- y marcar un pago como hecho. Todo lo demas lo escriben los jobs.
do $$
declare t text;
begin
  foreach t in array array['cwl_excusas','squad_assignments','payouts']
  loop
    execute format('drop policy if exists "lideres editan" on %I', t);
    execute format(
      'create policy "lideres editan" on %I for all using (puede_editar()) with check (puede_editar())', t);
  end loop;
end $$;

-- NOTA: la clave anon de Supabase puede ir en el frontend sin riesgo.
-- Con RLS activo y sin fila en dashboard_users, no devuelve nada.
-- La service_role key JAMAS va al frontend: solo en GitHub Secrets.


-- ####################################################################
-- ##  003_outbox.sql
-- ####################################################################

-- =====================================================================
-- x300 - Bandeja de salida y sesion de WhatsApp
-- Ejecutar DESPUES de 002_rls.sql
--
-- Principio de diseno: WhatsApp es el ENVIO, no el DATO. Todo mensaje se
-- escribe primero aca. Si el bot falla, el mensaje sigue existiendo y el
-- website lo muestra con boton de copiar. Nunca se pierde un aviso por
-- una sesion caida.
-- =====================================================================

create table if not exists outbox (
  id            bigserial primary key,
  tipo          text not null,          -- alerta_cwl | reporte_mensual | alerta_guerra | manual
  destino       text not null default 'grupo_clan',
  cuerpo        text not null,          -- texto plano, listo para copiar y pegar
  clave_dedupe  text,                   -- evita repetir el mismo aviso en cada corrida
  estado        text not null default 'pendiente'
                check (estado in ('pendiente','enviado','fallido','cancelado','copiado')),
  intentos      int  not null default 0,
  error         text,
  creado_en     timestamptz not null default now(),
  enviado_en    timestamptz
);

-- Sin esto, el cron cada 2 horas mandaria el mismo "fulano no atacó" 3 veces.
create unique index if not exists idx_outbox_dedupe
  on outbox (clave_dedupe) where clave_dedupe is not null;

create index if not exists idx_outbox_pendientes
  on outbox (creado_en) where estado = 'pendiente';

-- ---------- Sesion de WhatsApp -----------------------------------------
-- Baileys guarda credenciales y llaves de cifrado. La documentacion oficial
-- recomienda persistirlas en base de datos para produccion: asi el bot corre
-- dentro de un job efimero (conecta, manda, guarda, desconecta) en vez de
-- necesitar un servidor encendido 24/7.
--
-- OJO: cada fila es material criptografico de la sesion. Nunca se expone al
-- navegador: RLS deniega todo y solo la service_role key la lee.
create table if not exists wa_auth (
  clave      text primary key,          -- 'creds' o 'app-state-sync-key-xxx', etc.
  valor      jsonb not null,
  actualizado timestamptz not null default now()
);

alter table wa_auth enable row level security;
-- Sin policies = nadie con la clave anon puede leerla ni escribirla.

-- Estado visible de la sesion, para que el website muestre si el bot esta
-- vinculado o hay que re-escanear el QR.
create table if not exists wa_estado (
  id             int primary key default 1 check (id = 1),
  vinculado      boolean not null default false,
  numero         text,
  grupo_jid      text,                  -- JID del grupo del clan
  ultimo_ok      timestamptz,
  ultimo_error   text,
  actualizado    timestamptz not null default now()
);

insert into wa_estado (id) values (1) on conflict (id) do nothing;

-- El outbox y el estado SI los ve el dashboard; wa_auth no.
do $$
declare t text;
begin
  foreach t in array array['outbox','wa_estado']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "lideres leen" on %I', t);
    execute format('create policy "lideres leen" on %I for select using (es_lider_autorizado())', t);
    execute format('drop policy if exists "lideres editan" on %I', t);
    execute format('create policy "lideres editan" on %I for all using (puede_editar()) with check (puede_editar())', t);
  end loop;
end $$;


-- ####################################################################
-- ##  004_alianza.sql
-- ####################################################################

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


-- ####################################################################
-- ##  005_clanes.sql
-- ####################################################################

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


-- ####################################################################
-- ##  006_raids.sql
-- ####################################################################

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


-- ####################################################################
-- ##  007_orden_clanes.sql
-- ####################################################################

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


-- ####################################################################
-- ##  008_config.sql
-- ####################################################################

-- =====================================================================
-- Ajustes editables de los bots
-- Ejecutar DESPUES de 007_orden_clanes.sql
--
-- Hasta ahora los umbrales de alerta y demas vivian en variables de entorno:
-- para cambiar una habia que tocar GitHub. Con esta tabla los lideres las
-- editan desde el website y los jobs las leen en cada corrida.
--
-- Las CLAVES (tokens, llaves) NO van aca: siguen en Secrets. Aca solo
-- preferencias que no comprometen nada si alguien las ve.
-- =====================================================================

create table if not exists config (
  clave       text primary key,
  valor       jsonb not null,
  descripcion text,
  actualizado timestamptz not null default now()
);

insert into config (clave, valor, descripcion) values
  ('bot_nombre',        '"Heraldo"'::jsonb,
   'Nombre con el que firma el bot sus mensajes'),
  ('bot_firma',         '"— Heraldo de Strange Godz"'::jsonb,
   'Linea final de cada mensaje al clan'),
  ('alerta_umbrales',   '[6,3,1]'::jsonb,
   'Horas antes del cierre de la ronda en que avisa (de mayor a menor)'),
  ('alerta_cwl',        'true'::jsonb,
   'Avisar ataques de CWL sin usar'),
  ('alerta_guerra',     'false'::jsonb,
   'Avisar ataques de guerra normal sin usar (requiere /currentwar)'),
  ('alerta_raids',      'true'::jsonb,
   'Resumen del Raid Weekend al cerrar'),
  ('reporte_mensual',   'true'::jsonb,
   'Generar la tabla de premios el dia 1'),
  ('telegram_activo',   'true'::jsonb,
   'Mandar avisos por Telegram'),
  ('whatsapp_activo',   'false'::jsonb,
   'Mandar avisos por WhatsApp (necesita numero secundario vinculado)')
on conflict (clave) do nothing;

alter table config enable row level security;

drop policy if exists "lideres leen" on config;
create policy "lideres leen" on config for select using (es_lider_autorizado());

drop policy if exists "lideres editan" on config;
create policy "lideres editan" on config for update
  using (puede_editar()) with check (puede_editar());
-- Solo UPDATE: las claves son fijas, nadie inventa ni borra ajustes desde
-- el navegador. Una clave nueva se agrega con una migracion como esta.


-- ####################################################################
-- ##  009_bases_bonos.sql
-- ####################################################################

-- =====================================================================
-- Packs de bases y bonos de CWL
-- Ejecutar DESPUES de 008_config.sql
-- =====================================================================

-- ---------- Packs de bases -------------------------------------------
-- Los PDF llegan por DM del proveedor una vez al mes. Un bot de Discord no
-- puede leer mensajes privados, asi que el PDF se sube a mano y de ahi en
-- adelante todo es automatico.
create table if not exists base_packs (
  id         bigserial primary key,
  nombre     text not null,
  mes        text,                    -- 'YYYY-MM'
  origen     text,                    -- proveedor o archivo de origen
  subido_en  timestamptz not null default now(),
  nota       text
);

create table if not exists bases (
  id          bigserial primary key,
  pack_id     bigint not null references base_packs(id) on delete cascade,
  url         text not null,
  th          int,                    -- 18, 17...
  tipo        text,                   -- 'HV' aldea | 'WB' guerra
  etiqueta    text,                   -- nombre corto para reconocerla
  asignada_a  text references players(player_tag) on delete set null,
  usada       boolean not null default false,
  nota        text,
  creada_en   timestamptz not null default now(),
  unique (pack_id, url)
);

create index if not exists idx_bases_libres
  on bases (pack_id) where asignada_a is null;
create index if not exists idx_bases_tipo on bases (th, tipo);

-- ---------- Bonos de CWL ----------------------------------------------
-- Las medallas bonus que el juego reparte cada temporada. Hoy se acuerdan de
-- memoria en el chat; aca queda registrado quien recibio que y si ya se dio.
create table if not exists bonos (
  id          bigserial primary key,
  temporada   text not null,           -- 'YYYY-MM'
  clan_tag    text not null references clans(clan_tag) on delete cascade,
  player_tag  text not null references players(player_tag) on delete cascade,
  tipo        text not null default 'medallas_cwl',
  cantidad    int,
  motivo      text,
  entregado   boolean not null default false,
  entregado_en timestamptz,
  creado_en   timestamptz not null default now(),
  unique (temporada, clan_tag, player_tag, tipo)
);

create index if not exists idx_bonos_temporada on bonos (temporada, clan_tag);

-- ---------- RLS --------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['base_packs','bases','bonos']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "lideres leen" on %I', t);
    execute format('create policy "lideres leen" on %I for select using (es_lider_autorizado())', t);
    execute format('drop policy if exists "lideres editan" on %I', t);
    execute format('create policy "lideres editan" on %I for all using (puede_editar()) with check (puede_editar())', t);
  end loop;
end $$;

-- Miniatura de la base, sacada del propio PDF. Solo algunos packs traen
-- imagenes: los que son solo texto quedan en null y la interfaz lo tolera.
alter table bases add column if not exists preview text;

-- ---------- Estructura de premios del mes --------------------------------
-- Hoy el reparto se acuerda por WhatsApp y se recuerda de memoria. Aca queda
-- escrito, editable desde el website, y sirve para publicarlo al clan ANTES
-- de que empiece el mes: la gente se esfuerza por lo que sabe que existe.
create table if not exists premios_plan (
  id        bigserial primary key,
  mes       text not null,                 -- 'YYYY-MM'
  orden     int  not null default 0,
  titulo    text not null,
  criterio  text,
  clan_tag  text references clans(clan_tag) on delete set null,
  monto_usd numeric(6,2) not null default 0,
  tipo      text not null default 'efectivo'
            check (tipo in ('efectivo','pase_oro','medallas')),
  activo    boolean not null default true,
  unique (mes, titulo)
);

create index if not exists idx_premios_plan_mes on premios_plan (mes, orden);

alter table premios_plan enable row level security;
drop policy if exists "lideres leen" on premios_plan;
create policy "lideres leen" on premios_plan for select using (es_lider_autorizado());
drop policy if exists "lideres editan" on premios_plan;
create policy "lideres editan" on premios_plan for all
  using (puede_editar()) with check (puede_editar());

-- Presupuesto mensual, editable desde la pestana Bonos
insert into config (clave, valor, descripcion) values
  ('presupuesto_mensual', '80'::jsonb, 'Tope de dolares a repartir cada mes')
on conflict (clave) do nothing;


-- ####################################################################
-- ##  010_outbox_dedupe.sql
-- ####################################################################

-- =====================================================================
-- Arreglo: el dedupe del outbox rompia TODOS los avisos
-- Ejecutar DESPUES de 009_bases_bonos.sql
-- =====================================================================
--
-- El indice de deduplicacion era PARCIAL:
--
--   create unique index idx_outbox_dedupe
--     on outbox (clave_dedupe) where clave_dedupe is not null;
--
-- Postgres no acepta un indice parcial como destino de ON CONFLICT salvo
-- que la sentencia repita el mismo WHERE. PostgREST -la API que usa
-- supabase-js- no lo emite: escribe "on conflict (clave_dedupe)" a secas.
--
-- Resultado: encolar() moria siempre con
--   "there is no unique or exclusion constraint matching the ON CONFLICT
--    specification"
-- y como TODO aviso pasa por el outbox, ninguna alerta salia nunca. El
-- job ademas terminaba en error, asi que en GitHub Actions se habria visto
-- como una corrida roja cada 2 horas.
--
-- El predicado tampoco hacia falta. En un indice unico Postgres considera
-- cada NULL distinto de los demas, asi que un indice normal ya permite
-- infinitas filas con clave_dedupe nula -que es justo lo que queremos para
-- los mensajes sueltos, los que no se deduplican.

drop index if exists idx_outbox_dedupe;

create unique index if not exists idx_outbox_dedupe
  on outbox (clave_dedupe);


-- ####################################################################
-- ##  011_alta_clanes.sql
-- ####################################################################

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


-- ####################################################################
-- ##  012_owners_unico.sql
-- ####################################################################

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


-- ####################################################################
-- ##  013_duracion_ataque.sql
-- ####################################################################

-- =====================================================================
-- Guardar cuanto duro cada ataque
-- Ejecutar DESPUES de 012_owners_unico.sql
-- =====================================================================
--
-- La API devuelve `duration` en cada ataque -segundos que tardo- y lo
-- estabamos descartando. Se guarda ahora por el mismo motivo por el que se
-- guarda todo lo demas: la API solo da el presente, y cuando la temporada
-- pase ese dato no vuelve.
--
-- No se usa para nada todavia. Sirve como desempate alternativo si algun
-- dia "quien ataco primero" no basta: entre dos que hicieron 3 estrellas,
-- el que tardo 108 segundos jugo distinto que el que tardo 180.

alter table cwl_attacks add column if not exists duracion_seg int;

comment on column cwl_attacks.duracion_seg is
  'Segundos que duro el ataque, tal cual los da la API. Se guarda aunque no se use: cuando la temporada pasa, la API deja de devolverlo.';

comment on column cwl_attacks.orden is
  'Puesto del ataque dentro de la guerra, contando los de los DOS clanes intercalados (1-30 en una de 15v15). Es orden cronologico relativo: la API no expone ninguna hora. Es lo que permite desempatar por quien ataco primero.';


-- ####################################################################
-- ##  014_war_roster.sql
-- ####################################################################

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


-- ####################################################################
-- ##  015_cwl_grupo.sql
-- ####################################################################

-- =====================================================================
-- La tabla del grupo de CWL, no solo nuestras guerras
-- Ejecutar DESPUES de 014_war_roster.sql
-- =====================================================================
--
-- cwl_wars guarda las siete guerras de NUESTRO clan. Con eso se sabe como
-- vamos nosotros, pero no en que puesto vamos, que es la pregunta que se
-- hace todo el mundo el dia 4: "¿estamos descendiendo?". Para responder eso
-- hace falta cuantas estrellas llevan los otros siete clanes del grupo, y
-- eso obliga a entrar clan por clan en el juego.
--
-- El dato ya lo estabamos bajando. `getLeagueGroup` devuelve los tags de
-- TODAS las guerras de cada ronda -las cuatro, no solo la nuestra- y
-- cwl-sync se las pedia todas a la API para luego tirar las tres en las que
-- no jugabamos. Aqui se guardan.
--
-- Como se puntua la liga, que no es evidente:
--
--   estrellas del clan = las de sus ataques + 10 por cada guerra GANADA
--
-- Ese bono de 10 es lo que hace que ganar importe mas que hacer estrellas.
-- Empate a estrellas en una guerra: gana quien tenga mas destruccion. Si
-- tambien empatan, no hay ganador y nadie cobra el bono.
--
-- El desempate de la tabla general es la destruccion total acumulada.

create table if not exists cwl_grupo (
  id             bigserial primary key,
  season_id      bigint not null references cwl_seasons(id) on delete cascade,
  ronda          int not null check (ronda between 1 and 7),
  war_tag        text not null,
  -- 'a' y 'b' son los dos lados tal como los devuelve la API (clan y
  -- opponent). No hay "nuestro" y "rival": en la mayoria de estas guerras
  -- no jugamos nosotros.
  clan_a_tag     text not null,
  clan_a_nombre  text,
  estrellas_a    int,
  destruccion_a  numeric(6,2),
  clan_b_tag     text not null,
  clan_b_nombre  text,
  estrellas_b    int,
  destruccion_b  numeric(6,2),
  estado         text,
  end_time       timestamptz,
  actualizado_en timestamptz not null default now(),
  unique (season_id, war_tag)
);

create index if not exists idx_cwl_grupo_temporada on cwl_grupo (season_id, ronda);

-- ---------- Cupos de ascenso y descenso ----------
--
-- En tabla y no en el codigo A PROPOSITO. La regla general esta confirmada
-- -dos suben y dos bajan, y de Master para arriba sube solo uno- pero
-- Supercell la ha cambiado antes (en las CWL cortas de febrero los grupos
-- eran de seis clanes y los cupos otros), y en abril de 2026 se añadieron
-- Titan I-III y Legend por encima de Champion I. Si algun numero de estos
-- esta mal, se corrige con un UPDATE y no con un despliegue.
--
-- La escalera son los nombres exactos que devuelve /warleagues de la API.

create table if not exists cwl_ligas (
  liga       text primary key,
  orden      int  not null,
  promueven  int  not null default 2,
  descienden int  not null default 2
);

insert into cwl_ligas (liga, orden, promueven, descienden) values
  ('Unranked',            0, 2, 0),
  -- La ultima liga no tiene a donde bajar.
  ('Bronze League III',   1, 2, 0),
  ('Bronze League II',    2, 2, 2),
  ('Bronze League I',     3, 2, 2),
  ('Silver League III',   4, 2, 2),
  ('Silver League II',    5, 2, 2),
  ('Silver League I',     6, 2, 2),
  ('Gold League III',     7, 2, 2),
  ('Gold League II',      8, 2, 2),
  ('Gold League I',       9, 2, 2),
  ('Crystal League III', 10, 2, 2),
  ('Crystal League II',  11, 2, 2),
  ('Crystal League I',   12, 2, 2),
  -- De Master para arriba sube uno solo y siguen bajando dos.
  ('Master League III',  13, 1, 2),
  ('Master League II',   14, 1, 2),
  ('Master League I',    15, 1, 2),
  ('Champion League III',16, 1, 2),
  ('Champion League II', 17, 1, 2),
  ('Champion League I',  18, 1, 2),
  ('Titan League III',   19, 1, 2),
  ('Titan League II',    20, 1, 2),
  ('Titan League I',     21, 1, 2),
  -- Arriba del todo: no hay a donde subir.
  ('Legend League',      22, 0, 2)
on conflict (liga) do update
  set orden = excluded.orden,
      promueven = excluded.promueven,
      descienden = excluded.descienden;

-- ---------- La tabla de posiciones ----------
--
-- Vista y no calculo en el navegador para que el panel y el bot de Telegram
-- no puedan dar numeros distintos: los dos leen de aqui.

create or replace view cwl_tabla
with (security_invoker = true) as
with lados as (
  -- Cada guerra da DOS filas, una por clan. Es la unica forma de sumar por
  -- clan sin repetir el mismo case dos veces.
  select season_id, ronda, estado,
         clan_a_tag as clan_tag, clan_a_nombre as nombre,
         estrellas_a as estrellas, destruccion_a as destruccion,
         estrellas_b as estrellas_rival, destruccion_b as destruccion_rival
    from cwl_grupo
  union all
  select season_id, ronda, estado,
         clan_b_tag, clan_b_nombre,
         estrellas_b, destruccion_b,
         estrellas_a, destruccion_a
    from cwl_grupo
),
puntuado as (
  select l.*,
         case
           when l.estado = 'warEnded'
            and (l.estrellas > l.estrellas_rival
                 or (l.estrellas = l.estrellas_rival
                     and l.destruccion > l.destruccion_rival))
           then 1 else 0
         end as gano
    from lados l
)
select p.season_id,
       s.temporada,
       s.clan_tag as clan_nuestro,
       p.clan_tag,
       max(p.nombre)                                        as nombre,
       count(*)                                             as rondas,
       count(*) filter (where p.estado = 'warEnded')         as rondas_cerradas,
       sum(p.gano)                                          as ganadas,
       coalesce(sum(p.estrellas), 0)                        as estrellas_ataque,
       -- Lo que sale en la tabla del juego: ataques + bono de victoria.
       coalesce(sum(p.estrellas), 0) + sum(p.gano) * 10      as estrellas,
       round(coalesce(sum(p.destruccion), 0), 2)            as destruccion,
       rank() over (
         partition by p.season_id
         order by coalesce(sum(p.estrellas), 0) + sum(p.gano) * 10 desc,
                  coalesce(sum(p.destruccion), 0) desc
       )                                                    as puesto
  from puntuado p
  join cwl_seasons s on s.id = p.season_id
 group by p.season_id, s.temporada, s.clan_tag, p.clan_tag;

-- ---------- RLS ----------
alter table cwl_grupo enable row level security;
alter table cwl_ligas enable row level security;

drop policy if exists "lideres leen" on cwl_grupo;
create policy "lideres leen" on cwl_grupo for select using (es_lider_autorizado());

-- Los cupos los lee cualquiera que entre al panel; escribirlos es cosa del
-- SQL editor.
drop policy if exists "lideres leen" on cwl_ligas;
create policy "lideres leen" on cwl_ligas for select using (es_lider_autorizado());
