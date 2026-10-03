-- =====================================================================
-- El idioma de cada quien. Ejecutar DESPUES de 038_fb_candidatos.sql
-- =====================================================================
--
-- Entró Queen, de Filipinas, con un inglés básico (3 oct 2026). Los
-- botones de traducir de los mensajes del grupo son los mismos para todos
-- (Telegram no personaliza los botones por usuario), así que lo que sí se
-- puede hacer por persona es esto: que diga en qué idioma quiere que el
-- bot le hable EN PRIVADO, con /idioma.
--
-- 'es' es el de la casa y no gasta nada; cualquier otro hace que la
-- respuesta pase por el traductor de la IA antes de salir.

alter table tg_usuarios add column if not exists idioma text;

comment on column tg_usuarios.idioma is 'Idioma para las respuestas en privado: es (por defecto), en, fil. Lo elige cada uno con /idioma.';
