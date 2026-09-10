-- =====================================================================
-- Solicitudes de ingreso: reclutar sin abrir la puerta
-- Ejecutar DESPUES de 018_proposito_clan.sql
-- =====================================================================
--
-- Hasta hoy entrar a la alianza era: alguien te ve en el juego, alguien
-- te invita, y ya. No hay filtro, no queda constancia, y el que no
-- conocia a nadie no tenia por donde entrar.
--
-- La idea: el clan queda en "solo por invitacion" -que es lo correcto- y
-- en la descripcion va el nombre del bot. Quien quiera entrar le escribe
-- a Heraldo, contesta cuatro cosas, y los lideres lo miran con calma
-- desde el panel antes de invitarlo.
--
-- Lo que hace que esto valga la pena: se le pide el TAG, y con el tag
-- Heraldo consulta la API de Clash y trae los datos DE VERDAD -que
-- ayuntamiento tiene, cuantas estrellas de guerra lleva, si tiene la
-- guerra encendida, en que clan esta ahora-. El lider no lee lo que la
-- persona dice de si misma; ve los numeros.
--
-- perfil y respuestas van en jsonb a proposito. El perfil es lo que
-- devolvio Supercell tal cual: si mañana añaden un campo util, esta
-- guardado sin migrar nada. Y las preguntas de la conversacion van a
-- cambiar mas de una vez antes de acertar con ellas.

create table if not exists solicitudes (
  id             bigserial primary key,

  -- Una solicitud viva por cuenta de Telegram. Si vuelve a escribir,
  -- se retoma la suya en vez de crear otra: sin esto, quien se traba a
  -- mitad y escribe /start otra vez llena la bandeja de duplicados.
  tg_user_id     bigint not null unique,
  tg_nombre      text,
  tg_username    text,

  -- Por donde va la conversacion. Ver web/app/api/telegram/route.js.
  paso           text not null default 'tag'
                 check (paso in ('tag', 'confirmar', 'cuenta', 'listo')),

  player_tag     text,
  perfil         jsonb,
  respuestas     jsonb not null default '{}'::jsonb,

  -- A que clan se le manda. Lo decide el lider, no el que solicita.
  clan_destino   text references clans(clan_tag) on delete set null,

  -- borrador  = a mitad de la conversacion, todavia no se mira
  -- pendiente = contesto todo, esperando a un lider
  -- prueba    = aceptado a falta del reto amistoso
  -- aceptada / rechazada = decidido
  estado         text not null default 'borrador'
                 check (estado in ('borrador', 'pendiente', 'prueba', 'aceptada', 'rechazada')),

  -- El ultimo filtro: se le invita, entra, y se le reta en amistosa para
  -- ver como ataca de verdad. Eso NO lo puede leer la API -las amistosas
  -- no salen en ningun endpoint-, asi que lo anota el lider a mano.
  prueba_ok      boolean,
  nota           text,

  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  decidido_en    timestamptz,
  decidido_por   text
);

-- La bandeja del lider: lo que espera respuesta, primero lo mas viejo.
create index if not exists idx_solicitudes_pendientes
  on solicitudes (creado_en) where estado in ('pendiente', 'prueba');

create index if not exists idx_solicitudes_jugador on solicitudes (player_tag);

-- ---------- RLS ----------
alter table solicitudes enable row level security;

drop policy if exists "lideres leen solicitudes" on solicitudes;
create policy "lideres leen solicitudes" on solicitudes
  for select using (es_lider_autorizado());

drop policy if exists "lideres deciden solicitudes" on solicitudes;
-- Leer la bandeja lo puede hacer cualquier lider; ACEPTAR o RECHAZAR no:
-- eso es puede_editar(), la misma linea que separa mirar de tocar en el
-- resto del panel.
create policy "lideres deciden solicitudes" on solicitudes
  for update using (puede_editar()) with check (puede_editar());

-- Sin politica de INSERT: las crea el webhook con la service_role. Desde
-- el navegador nadie puede fabricar una solicitud a nombre de otro.
