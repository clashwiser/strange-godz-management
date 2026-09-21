-- =====================================================================
-- Reclutamiento en Facebook: los posts del portavoz y los mensajes del
-- buzón de la Página. Ejecutar DESPUES de 036_pulso.sql
-- =====================================================================
--
-- La pestaña Solicitudes pasa a llamarse Reclutamiento y junta tres
-- cosas: las solicitudes de Valquiria (tabla `solicitudes`, la de
-- siempre), los posts que la tarea diaria publica en los grupos de
-- Facebook con su enlace y su engagement, y los mensajes que llegan al
-- buzón de la Página (que nadie mira; Valquiria avisa por Telegram).
--
-- Lo escribe la tarea programada del escritorio (con la service_role,
-- desde src/jobs/portavoz-*.js); los lideres leen desde el panel.

create table if not exists fb_posts (
  id            bigserial primary key,
  fecha         date not null default (now() at time zone 'America/Havana')::date,
  grupo         text not null,                 -- nombre del grupo de Facebook
  grupo_url     text,
  texto_num     int,                           -- cual de los siete textos
  imagen        text,                          -- vertical | ancha
  estado        text not null default 'publicado', -- publicado | pendiente | rechazado | fallo
  url           text,                          -- enlace al post, cuando se tiene
  nota          text,                          -- motivo del fallo, o lo que sea
  reacciones    int not null default 0,
  comentarios   int not null default 0,
  compartidos   int not null default 0,
  revisado_en   timestamptz,                   -- ultima vez que se midio el engagement
  creado_en     timestamptz not null default now()
);
create index if not exists idx_fb_posts_fecha on fb_posts (fecha desc);

create table if not exists fb_mensajes (
  id            bigserial primary key,
  remitente     text not null,
  texto         text,
  recibido_en   timestamptz,
  url           text,                          -- enlace a la conversacion en el buzon
  avisado       boolean not null default false, -- ya se aviso por Telegram
  atendido      boolean not null default false, -- un lider ya le contesto
  creado_en     timestamptz not null default now(),
  unique (remitente, recibido_en)
);

alter table fb_posts enable row level security;
alter table fb_mensajes enable row level security;
drop policy if exists "lideres leen fb_posts" on fb_posts;
create policy "lideres leen fb_posts" on fb_posts for select using (es_lider_autorizado());
drop policy if exists "lideres leen fb_mensajes" on fb_mensajes;
create policy "lideres leen fb_mensajes" on fb_mensajes for select using (es_lider_autorizado());
drop policy if exists "editores atienden fb_mensajes" on fb_mensajes;
create policy "editores atienden fb_mensajes" on fb_mensajes for update using (puede_editar()) with check (puede_editar());
-- Escribe la tarea diaria (service_role).
