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
