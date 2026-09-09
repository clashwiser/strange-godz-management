-- =====================================================================
-- Ajustes editables de los bots
-- Ejecutar DESPUES de 007_orden_clanes.sql
--
-- Hasta ahora los umbrales de alerta y demas vivian en variables de entorno:
-- para cambiar una habia que tocar GitHub. Con esta tabla los lideres las
-- editan desde el website y los jobs las leen en cada corrida.
--
-- Las CLAVES (tokens, llaves) NO van aca: siguen en Secrets. Aca solo
-- preferencias que no comprometen nada si alguien las ve.
-- =====================================================================

create table if not exists config (
  clave       text primary key,
  valor       jsonb not null,
  descripcion text,
  actualizado timestamptz not null default now()
);

insert into config (clave, valor, descripcion) values
  ('bot_nombre',        '"Heraldo"'::jsonb,
   'Nombre con el que firma el bot sus mensajes'),
  ('bot_firma',         '"— Heraldo de Strange Godz"'::jsonb,
   'Linea final de cada mensaje al clan'),
  ('alerta_umbrales',   '[6,3,1]'::jsonb,
   'Horas antes del cierre de la ronda en que avisa (de mayor a menor)'),
  ('alerta_cwl',        'true'::jsonb,
   'Avisar ataques de CWL sin usar'),
  ('alerta_guerra',     'false'::jsonb,
   'Avisar ataques de guerra normal sin usar (requiere /currentwar)'),
  ('alerta_raids',      'true'::jsonb,
   'Resumen del Raid Weekend al cerrar'),
  ('reporte_mensual',   'true'::jsonb,
   'Generar la tabla de premios el dia 1'),
  ('telegram_activo',   'true'::jsonb,
   'Mandar avisos por Telegram'),
  ('whatsapp_activo',   'false'::jsonb,
   'Mandar avisos por WhatsApp (necesita numero secundario vinculado)')
on conflict (clave) do nothing;

alter table config enable row level security;

drop policy if exists "lideres leen" on config;
create policy "lideres leen" on config for select using (es_lider_autorizado());

drop policy if exists "lideres editan" on config;
create policy "lideres editan" on config for update
  using (puede_editar()) with check (puede_editar());
-- Solo UPDATE: las claves son fijas, nadie inventa ni borra ajustes desde
-- el navegador. Una clave nueva se agrega con una migracion como esta.
