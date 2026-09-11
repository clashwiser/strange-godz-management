-- =====================================================================
-- castillos: el id del mensaje con que el bot contesto al aviso
-- Ejecutar DESPUES de 026_reglas.sql
-- =====================================================================
--
-- Las donaciones al castillo de guerra NO suben el contador de tropas
-- donadas del jugador (lo dijo Cris; en Reddit lleva años pidiéndose que
-- cuenten), asi que la comprobacion por la API que traia la 026 era
-- falsa y se quita del codigo. Confirma un lider: contestando ✅ al
-- mensaje del bot -por eso se guarda su id- o desde la pestaña Bonos.

alter table castillos add column if not exists mensaje_bot_id bigint;
create index if not exists idx_castillos_mensaje on castillos (mensaje_bot_id);
