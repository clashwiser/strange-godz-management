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
