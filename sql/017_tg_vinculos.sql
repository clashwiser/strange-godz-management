-- =====================================================================
-- Quien es quien: cuenta de Telegram -> jugador de Clash
-- Ejecutar DESPUES de 016_base_pedidos.sql
-- =====================================================================
--
-- Heraldo sabe todo del CLAN pero no sabe quien le esta hablando. Para
-- contestar "¿pa que clan voy yo?" hace falta atar la cuenta de Telegram
-- con la de Clash, y eso no se puede adivinar: el nombre de Telegram y el
-- del juego casi nunca coinciden, y en un clan de sesenta hay tres que se
-- llaman parecido.
--
-- Se ata UNA vez, la primera que alguien dice "Heraldo yo soy Fulano", y de
-- ahi en adelante el bot lo reconoce solo.
--
-- Un jugador, una cuenta de Telegram: la clave es el id de Telegram, asi
-- que quien tiene tres cuentas de Clash ata la que mas use. La alineacion
-- se responde por esa.

create table if not exists tg_vinculos (
  tg_user_id bigint primary key,
  player_tag text not null references players(player_tag) on delete cascade,
  tg_nombre  text,
  creado_en  timestamptz not null default now()
);

create index if not exists idx_tg_vinculos_jugador on tg_vinculos (player_tag);

-- ---------- RLS ----------
alter table tg_vinculos enable row level security;

drop policy if exists "lideres leen" on tg_vinculos;
create policy "lideres leen" on tg_vinculos for select using (es_lider_autorizado());

-- Sin politica de escritura: la llena el webhook con la service_role. Desde
-- el navegador nadie puede hacerse pasar por otro.
