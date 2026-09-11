-- =====================================================================
-- retos: los puntos que no son el castillo (por ahora, los desafios
-- amistosos leidos de una captura del chat del clan)
-- Ejecutar DESPUES de 028_castillos_nota.sql
-- =====================================================================
--
-- Un reto es un punto ganado con una captura: "5 desafios amistosos con
-- 2 estrellas o mas en una captura del chat" (web/lib/retos.js). Heraldo
-- lee la captura con la IA, cruza el nombre del atacante con el /soy del
-- que la manda y el clan de la cabecera con el suyo, y si cuadra anota
-- los puntos. La firma es lo que impide reciclar la misma captura otro
-- dia: la secuencia de tarjetas mas los contadores de recursos que salen
-- en la misma pantalla, que cambian a cada rato.
--
-- Va en su tabla y no en castillos porque castillos es un aviso que se
-- confirma; esto se anota ya confirmado y solo se quita (❌ de un lider o
-- la pestaña Bonos). La tabla del mes suma las dos.

create table if not exists retos (
  id            bigserial primary key,
  temporada     text not null,                 -- YYYY-MM, el mes del premio
  tg_user_id    bigint not null,
  player_tag    text,
  nombre        text not null,
  tipo          text not null,                 -- 'fc' por ahora
  puntos        int not null default 0,
  verificado    boolean not null default false,
  verificado_por text,
  nota          text,                          -- lo que leyo la IA
  firma         text,                          -- huella de la captura, contra repetidas
  mensaje_bot_id bigint,                       -- para quitarlo contestando ❌
  creado_en     timestamptz not null default now()
);
create index if not exists idx_retos_temporada on retos (temporada, tg_user_id);
create index if not exists idx_retos_firma on retos (firma);
create index if not exists idx_retos_mensaje on retos (mensaje_bot_id);

alter table retos enable row level security;
drop policy if exists "lideres leen retos" on retos;
create policy "lideres leen retos" on retos for select using (es_lider_autorizado());
drop policy if exists "editores deciden retos" on retos;
create policy "editores deciden retos" on retos for update using (puede_editar()) with check (puede_editar());
drop policy if exists "editores borran retos" on retos;
create policy "editores borran retos" on retos for delete using (puede_editar());
-- Inserta el webhook con la service_role.
