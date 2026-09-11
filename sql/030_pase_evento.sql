-- =====================================================================
-- premios: el Pase de evento como tipo de premio
-- Ejecutar DESPUES de 029_retos.sql
-- =====================================================================
--
-- El premio de los puntos del mes (castillos donados y desafios amistosos)
-- va a ser el Pase de evento del juego. Entra como tipo en el plan de
-- premios y en los pagos. Y de paso, payouts admite 'medallas', que el plan
-- ya permitia y el cierre mensual tenia que disfrazar de 'efectivo'.

alter table premios_plan drop constraint if exists premios_plan_tipo_check;
alter table premios_plan add constraint premios_plan_tipo_check
  check (tipo in ('efectivo', 'pase_oro', 'medallas', 'pase_evento'));

alter table payouts drop constraint if exists payouts_tipo_check;
alter table payouts add constraint payouts_tipo_check
  check (tipo in ('efectivo', 'pase_oro', 'medallas', 'pase_evento'));
