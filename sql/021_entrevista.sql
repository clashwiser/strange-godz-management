-- =====================================================================
-- La entrevista de Valquiria crece: pasos nuevos en la conversacion
-- Ejecutar DESPUES de 020_solicitud_via.sql
-- =====================================================================
--
-- La solicitud original miraba el perfil y hacia UNA pregunta abierta.
-- Con eso se elige por estrellas, y las estrellas engañan en los dos
-- sentidos: una cuenta nueva tiene pocas y puede ser un jugador bueno; una
-- cuenta comprada tiene muchas y detras puede no haber nadie que sepa
-- atacar.
--
-- Ahora hay un cuestionario corto -pleno, ejercito, nivel de un heroe,
-- cuantos clanes- y una prueba: un video atacando, o el reto en amistosa
-- al entrar. Cada paso es un toque o una linea; en total, tres minutos.
--
-- Las respuestas van en el jsonb `respuestas` que ya existia. Lo unico
-- que cambia en el esquema es la lista de pasos permitidos.

alter table solicitudes drop constraint if exists solicitudes_paso_check;
alter table solicitudes add constraint solicitudes_paso_check
  check (paso in (
    'tag', 'confirmar',
    'pleno', 'ejercito', 'heroe', 'clanes', 'prueba', 'video',
    'cuenta', 'listo'
  ));

comment on column solicitudes.respuestas is
  'pleno, ejercito, heroe {nombre, real, dijo, segundos, acierta}, clanes, prueba (video|reto), video {file_id, message_id, duracion}, cuenta';
