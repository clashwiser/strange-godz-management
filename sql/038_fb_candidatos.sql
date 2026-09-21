-- =====================================================================
-- Candidatos encontrados en Facebook: el rastreo diario del portavoz.
-- Ejecutar DESPUES de 037_reclutamiento_facebook.sql
-- =====================================================================
--
-- Cada dia, en el mismo grupo donde publica, la tarea mira los posts de
-- jugadores TH18 que buscan clan, les contesta como la Pagina (un
-- comentario con el Telegram y el clan: las Paginas no pueden escribir
-- primero por Messenger) y lo apunta aqui. Valquiria avisa a los lideres
-- de cada candidato y de cada respuesta; los lideres cierran el caso desde
-- la pestaña Reclutamiento (respondió, entró, descartado).

create table if not exists fb_candidatos (
  id            bigserial primary key,
  fecha         date not null default (now() at time zone 'America/Havana')::date,
  grupo         text not null,
  grupo_url     text,
  post_url      text not null unique,            -- el post del jugador (una vez por post)
  jugador       text not null,                   -- nombre en Facebook
  texto_post    text,                            -- lo que puso, recortado
  th            text,                            -- '18' si se vio; null si no
  liga          text,                            -- 'Leyenda II' si se vio; null si no
  via           text not null default 'comentario', -- comentario | mensaje
  mensaje       text,                            -- lo que le contestamos
  estado        text not null default 'contactado', -- contactado | respondio | entro | descartado
  respuesta     text,                            -- lo que contesto el jugador, si contesto
  nota          text,
  avisado       boolean not null default false,  -- Valquiria ya aviso a los lideres
  revisado_en   timestamptz,                     -- ultima vez que la tarea miro si respondio
  creado_en     timestamptz not null default now()
);
create index if not exists idx_fb_candidatos_fecha on fb_candidatos (fecha desc);

alter table fb_candidatos enable row level security;
drop policy if exists "lideres leen fb_candidatos" on fb_candidatos;
create policy "lideres leen fb_candidatos" on fb_candidatos for select using (es_lider_autorizado());
drop policy if exists "editores cierran fb_candidatos" on fb_candidatos;
create policy "editores cierran fb_candidatos" on fb_candidatos for update using (puede_editar()) with check (puede_editar());
-- Escribe la tarea diaria (service_role).
