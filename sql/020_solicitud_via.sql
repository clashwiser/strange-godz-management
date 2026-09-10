-- =====================================================================
-- Por que bot entro cada solicitud
-- Ejecutar DESPUES de 019_solicitudes.sql
-- =====================================================================
--
-- Hay dos bots que reciben solicitudes: Heraldo y el de reclutar, el del
-- nombre corto que va en la descripcion del clan.
--
-- Hace falta saber por cual entro cada una por una regla de Telegram que
-- no se puede saltar: un bot solo puede escribirle a quien le escribio
-- primero A EL. Si alguien pidio entrar por el bot de reclutar y al
-- aceptarlo se le contesta con Heraldo, el mensaje no llega -403- y la
-- persona se queda esperando un enlace que nunca sale.

alter table solicitudes add column if not exists via text not null default 'heraldo';

alter table solicitudes drop constraint if exists solicitudes_via_check;
alter table solicitudes add constraint solicitudes_via_check
  check (via in ('heraldo', 'recluta'));

comment on column solicitudes.via is
  'bot por el que escribio: al contestarle hay que usar ese mismo, o Telegram devuelve 403';
