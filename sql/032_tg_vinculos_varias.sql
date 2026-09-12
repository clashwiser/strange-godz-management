-- =====================================================================
-- Una persona, varias cuentas de Clash
-- Ejecutar DESPUES de 031_cerebro.sql
-- =====================================================================
--
-- tg_vinculos ataba UNA cuenta de Clash por cuenta de Telegram (la clave
-- era el id de Telegram). En el juego lo normal es tener dos o tres
-- cuentas, y cuando Heraldo pregunto "¿cual de los dos eres?" Carlos
-- contesto "las dos" y el bot no supo que hacer con eso.
--
-- Ahora la clave es (telegram, cuenta): una fila por cuenta, y una de
-- ellas es la principal (la primera que ato). Los que ya estaban atados
-- siguen igual: su unica cuenta pasa a ser la principal.

alter table tg_vinculos drop constraint if exists tg_vinculos_pkey;
alter table tg_vinculos add primary key (tg_user_id, player_tag);
alter table tg_vinculos add column if not exists principal boolean not null default true;

-- Solo una principal por persona.
create unique index if not exists idx_tg_vinculos_principal on tg_vinculos (tg_user_id) where principal;

-- ---------- El /soy a medias ----------
-- Cuando hay dos con ese nombre, el bot pregunta cual y se queda con los
-- candidatos hasta que conteste ("las dos", "la primera", "1", el nombre).
create table if not exists soy_pendientes (
  tg_user_id bigint primary key,
  candidatos jsonb  not null,               -- [{tag, nombre}, ...]
  creado_en  timestamptz not null default now()
);

alter table soy_pendientes enable row level security;
-- Sin politicas: la usa solo el webhook con la service_role.
