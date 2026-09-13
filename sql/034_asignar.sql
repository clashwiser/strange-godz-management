-- =====================================================================
-- /asignar: un lider dice quien es quien
-- Ejecutar DESPUES de 033_base_pedidos_cuenta.sql
-- =====================================================================
--
-- Mucha gente entra al grupo, Valquiria le dice "presentate con /soy" y no
-- lo hace: no sabe, no tiene tiempo. Un administrador puede atarlo el:
-- contesta al mensaje de la persona (o la menciona) con /asignar Nombre.
--
-- Para poder mencionarla por @usuario hace falta saber su id, y Telegram
-- no lo da por el nombre: se apunta a cada persona que escribe en el grupo
-- (id, @usuario, nombre) y de ahi se saca.

create table if not exists tg_usuarios (
  tg_user_id bigint primary key,
  username   text,
  nombre     text,
  visto_en   timestamptz not null default now()
);

create index if not exists idx_tg_usuarios_username on tg_usuarios (lower(username));

alter table tg_usuarios enable row level security;
-- Sin politicas: la usa solo el webhook con la service_role.
