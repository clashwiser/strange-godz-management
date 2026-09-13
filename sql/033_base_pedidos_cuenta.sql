-- =====================================================================
-- Las bases se piden por CUENTA, no por persona
-- Ejecutar DESPUES de 032_tg_vinculos_varias.sql
-- =====================================================================
--
-- Carlos tiene seis cuentas y pidio seis bases; el limite (una cada tres
-- dias) era por persona de Telegram. Ahora cada pedido lleva la cuenta del
-- juego para la que es, y el limite y el "no me la repitas" van por cuenta.
-- Sin cuenta (quien no se presento con /soy) sigue siendo por persona.

alter table base_pedidos add column if not exists player_tag text;
create index if not exists idx_base_pedidos_cuenta on base_pedidos (tg_user_id, player_tag, dia);
