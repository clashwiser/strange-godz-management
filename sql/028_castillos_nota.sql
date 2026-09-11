-- =====================================================================
-- castillos: la nota de lo que leyo la IA en la captura
-- Ejecutar DESPUES de 027_castillos_mensaje.sql
-- =====================================================================
--
-- El aviso de castillo puede venir con una captura del mapa de guerra.
-- Heraldo la lee con la IA (web/lib/castillo-foto.js) y la cruza con la
-- API; lo que vio queda aqui ("foto: Fulano 55/55", "foto: incompleto
-- 30/55", "foto: no es el mapa de guerra") para que en Bonos se entienda
-- por que un aviso se confirmo solo o por que sigue pendiente.

alter table castillos add column if not exists nota text;
