-- =====================================================================
-- Entrenar a los bots desde el panel
-- Ejecutar DESPUES de 023_ia_contar_fallo.sql
-- =====================================================================
--
-- Carlos y Deibis no tocan codigo. Si Valquiria contesta mal a algo, o
-- quieren que Heraldo diga una cosa concreta cuando pregunten por otra,
-- lo enseñan desde la pestaña Bots y los bots lo miran ANTES que su
-- cerebro de frases y que la IA:
--
--   lecciones      "cuando digan X, responde Y", por bot o para los dos
--   bots_memoria   texto libre con lo que los lideres quieren que los
--                  bots sepan (entra en las instrucciones de la IA)
--
-- Y los interruptores de comportamiento, que hasta hoy la pestaña Bots
-- enseñaba pero ningun job leia: ahora los jobs y los webhooks los
-- consultan en cada corrida (src/lib/config.js, ajuste()).

create table if not exists lecciones (
  id             bigserial primary key,
  bot            text not null default 'ambos'
                 check (bot in ('heraldo', 'valquiria', 'ambos')),
  -- Lo que dice la gente. Se compara sin tildes ni mayusculas, y vale
  -- que aparezca dentro de una frase mas larga.
  cuando         text not null check (length(cuando) between 2 and 200),
  -- Lo que contesta el bot. {nombre} se cambia por el nombre de quien habla.
  respuesta      text not null check (length(respuesta) between 1 and 1500),
  activa         boolean not null default true,
  veces          int not null default 0,
  creado_por     text,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

alter table lecciones enable row level security;

drop policy if exists "lideres leen lecciones" on lecciones;
create policy "lideres leen lecciones" on lecciones
  for select using (es_lider_autorizado());

drop policy if exists "editores escriben lecciones" on lecciones;
create policy "editores escriben lecciones" on lecciones
  for all using (puede_editar()) with check (puede_editar());

-- Cuantas veces se uso cada leccion: para que el lider vea cuales sirven.
-- security definer: la llaman los webhooks con la service_role.
create or replace function leccion_usada(p_id bigint)
returns void
language sql
security definer
set search_path = public
as $$
  update lecciones set veces = veces + 1 where id = p_id;
$$;

-- Ajustes nuevos. `on conflict do nothing`: no pisa lo que ya hayan tocado.
insert into config (clave, valor, descripcion) values
  ('parte_cwl',       'true'::jsonb, 'Parte diario de la CWL en el grupo, con la tabla del grupo'),
  ('avisos_youtube',  'true'::jsonb, 'Anunciar los videos nuevos de los canales que seguimos'),
  ('valquiria_grupo', 'true'::jsonb, 'Valquiria contesta en el grupo cuando la nombran'),
  ('bienvenida',      'true'::jsonb, 'Dar la bienvenida a quien entra al grupo'),
  ('ia_activa',       'true'::jsonb, 'La IA de respaldo contesta lo que las frases no saben'),
  ('bots_memoria',    '""'::jsonb,   'Lo que los lideres quieren que los bots sepan (texto libre)')
on conflict (clave) do nothing;

-- El job de guerra normal lleva semanas corriendo y avisando: el
-- interruptor pasa a mandar de verdad, asi que se pone como esta la
-- realidad. Quien no lo quiera, lo apaga desde el panel.
update config set valor = 'true'::jsonb where clave = 'alerta_guerra';
