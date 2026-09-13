-- =====================================================================
-- El pulso: miembros nuevos en los clanes (Valquiria pregunta)
-- Ejecutar DESPUES de 035_logs_y_vinculos_panel.sql
-- =====================================================================
--
-- Un job cada cinco minutos (src/jobs/pulso.js) mira la lista de miembros
-- de cada clan por la API. Al que no habia visto nunca en ese clan lo apunta
-- aqui y Valquiria pregunta a los lideres, en el grupo y en privado, si ya
-- hablaron con el o es un visitante; ellos contestan con un boton. A las
-- dos horas sin respuesta, recuerda una vez; a las 24, lo da por sin
-- respuesta.
--
-- La primera vez que ve un clan, apunta a todos los que estan como
-- conocidos, sin preguntar: los que ya estaban no son nuevos.

create table if not exists miembros_vistos (
  id            bigserial primary key,
  player_tag    text not null,
  clan_tag      text not null,
  nombre        text,
  th            int,
  primera_vez   timestamptz not null default now(),
  estado        text not null default 'pendiente',  -- conocido | pendiente | de_casa | nuevo | visita | sin_respuesta
  avisos        jsonb,                              -- [{chat_id, message_id}] de las preguntas mandadas
  recordado_en  timestamptz,
  decidido_por  text,
  decidido_en   timestamptz,
  unique (player_tag, clan_tag)
);

create index if not exists idx_miembros_vistos_estado on miembros_vistos (estado, primera_vez);

alter table miembros_vistos enable row level security;
drop policy if exists "lideres leen" on miembros_vistos;
create policy "lideres leen" on miembros_vistos for select using (es_lider_autorizado());
-- Escribe el job (service_role) y el webhook de Valquiria.
