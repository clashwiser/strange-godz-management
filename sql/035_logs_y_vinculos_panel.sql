-- =====================================================================
-- Logs de quien edita que, y los vinculos de Telegram editables del panel
-- Ejecutar DESPUES de 034_asignar.sql
-- =====================================================================
--
-- Ya son tres los que editan el panel (Cris, Carlos, Deibis). Cada cambio
-- queda apuntado en `logs` por un trigger, con quien lo hizo (el nombre de
-- dashboard_users; si no hay sesion -bots y jobs- "sistema"), la tabla,
-- la fila y el antes/despues. La pestaña Logs lo enseña en cristiano.
--
-- Y los vinculos de Telegram (quien es quien) se pueden editar desde la
-- lista de jugadores del panel: los lideres con edicion escriben en
-- tg_vinculos y leen tg_usuarios (la gente apuntada del grupo).

-- ---------- Logs ----------
create table if not exists logs (
  id        bigserial primary key,
  hecho_en  timestamptz not null default now(),
  quien     text,                       -- nombre del lider, su correo, o 'sistema'
  origen    text not null,              -- 'panel' | 'sistema'
  tabla     text not null,
  accion    text not null,              -- INSERT | UPDATE | DELETE
  clave     text,                       -- algo legible de la fila
  antes     jsonb,
  despues   jsonb
);

create index if not exists idx_logs_fecha on logs (hecho_en desc);

alter table logs enable row level security;
drop policy if exists "lideres leen" on logs;
create policy "lideres leen" on logs for select using (es_lider_autorizado());
-- Sin politica de escritura: escribe el trigger (security definer).

create or replace function registrar_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_quien text;
  v_fila  jsonb;
  v_antes jsonb;
  v_desp  jsonb;
  v_clave text;
  ruido   text[] := array['updated_at', 'actualizado', 'actualizado_en', 'visto_en'];
begin
  -- Quien: el nombre del panel; si no, el correo; sin sesion, el sistema.
  if v_uid is not null then
    select nombre into v_quien from dashboard_users where user_id = v_uid;
    if v_quien is null then v_quien := coalesce(auth.jwt() ->> 'email', v_uid::text); end if;
  else
    v_quien := 'sistema';
  end if;

  -- Lo que escriben los jobs en config (digesto del meta, estado del
  -- cerebro) es grande y cada seis horas: no es un log de nadie.
  if tg_table_name = 'config' and v_uid is null then
    return coalesce(new, old);
  end if;

  v_antes := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_desp  := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;

  -- Un UPDATE que no cambia nada (salvo la fecha de toque) no se apunta.
  if tg_op = 'UPDATE' and (v_antes - ruido) = (v_desp - ruido) then
    return new;
  end if;

  -- En config el valor puede ser enorme (las normas): se recorta.
  if tg_table_name = 'config' then
    if v_antes is not null then v_antes := jsonb_build_object('clave', v_antes ->> 'clave', 'valor', left(v_antes ->> 'valor', 600)); end if;
    if v_desp  is not null then v_desp  := jsonb_build_object('clave', v_desp  ->> 'clave', 'valor', left(v_desp  ->> 'valor', 600)); end if;
  end if;

  v_fila  := coalesce(v_desp, v_antes);
  v_clave := coalesce(v_fila ->> 'titulo', v_fila ->> 'nombre', v_fila ->> 'nombre_actual', v_fila ->> 'clave',
                      v_fila ->> 'etiqueta', v_fila ->> 'cuando', v_fila ->> 'tg_nombre', v_fila ->> 'player_tag',
                      v_fila ->> 'tipo', v_fila ->> 'id');

  insert into logs (quien, origen, tabla, accion, clave, antes, despues)
  values (v_quien, case when v_uid is null then 'sistema' else 'panel' end, tg_table_name, tg_op, v_clave, v_antes, v_desp);

  return coalesce(new, old);
end
$$;

-- Los triggers, en lo que se edita desde el panel (y lo que tocan los
-- bots por orden de un lider). Sin las tablas de mucho volumen (snapshots,
-- outbox de jobs, job_runs, bitacora, ia_uso, base_pedidos, tg_usuarios).
do $$
declare t text;
begin
  foreach t in array array['premios_plan', 'alineaciones', 'clans', 'bases', 'base_packs', 'config', 'lecciones',
                           'bonos', 'castillos', 'retos', 'solicitudes', 'tg_vinculos', 'owners', 'players']
  loop
    if to_regclass(t) is not null then
      execute format('drop trigger if exists log_%I on %I', t, t);
      execute format('create trigger log_%I after insert or update or delete on %I for each row execute function registrar_log()', t, t);
    end if;
  end loop;
end $$;

-- ---------- Vinculos de Telegram, editables desde el panel ----------
drop policy if exists "lideres editan" on tg_vinculos;
create policy "lideres editan" on tg_vinculos for all
  using (puede_editar()) with check (puede_editar());

drop policy if exists "lideres leen" on tg_usuarios;
create policy "lideres leen" on tg_usuarios for select using (es_lider_autorizado());
