-- =====================================================================
-- El cerebro: la bitacora de lo que contesta la IA, las lecciones
-- propuestas desde el grupo, y el estado del latido
-- Ejecutar DESPUES de 030_pase_evento.sql
-- =====================================================================
--
-- bitacora: cada respuesta de la IA (en el grupo, en el panel, o al leer
-- una captura) queda aqui, para que la pestaña Cerebro enseñe que dijo
-- hoy sin ir a los logs de Vercel. Solo la respuesta y quien pregunto
-- (nombre de pila); lo que preguntaron no se guarda, como hasta ahora.
--
-- lecciones.propuesta: cuando alguien en el grupo corrige al bot
-- contestando a un mensaje suyo ("no, Heraldo, eso esta mal"), el cerebro
-- anota una leccion PROPUESTA (inactiva) con lo que dijo el bot y la
-- correccion; un lider la completa y la aprueba en Cerebro > Entrenar.
--
-- config.cerebro_estado: lo ultimo que midio el latido (nota, hora, que
-- fallaba), para no avisar cada hora de lo mismo y para que el panel diga
-- "ultimo latido: hace 20 min".

create table if not exists bitacora (
  id         bigserial primary key,
  creado_en  timestamptz not null default now(),
  bot        text not null,            -- 'heraldo' | 'valquiria' | 'panel'
  modo       text,                     -- 'charla' | 'buscar' | 'panel' | 'foto:fc' | 'foto:castillo' ...
  nombre     text,                     -- quien pregunto (nombre de pila)
  texto      text not null
);
create index if not exists idx_bitacora_fecha on bitacora (creado_en desc);
alter table bitacora enable row level security;
drop policy if exists "lideres leen bitacora" on bitacora;
create policy "lideres leen bitacora" on bitacora for select using (es_lider_autorizado());
-- Inserta el servidor con la service_role.

alter table lecciones add column if not exists propuesta boolean not null default false;
alter table lecciones add column if not exists contexto text;        -- lo que dijo el bot
alter table lecciones add column if not exists propuesta_por text;   -- quien lo corrigio
-- La propuesta llega sin "cuando": el lider lo escribe al aprobar. El
-- check de longitud minima (2) se cumple con un marcador.

insert into config (clave, valor) values ('cerebro_estado', 'null'::jsonb)
on conflict (clave) do nothing;
