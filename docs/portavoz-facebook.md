# Portavoz de Facebook — x300 (Strange Godz Alliance)

Reclutamiento en grupos de Facebook, un post al día, cada grupo una vez
por semana. Publica la cuenta vieja de Cris como la Página "Strange Godz
Alliance · COC", desde el Chrome "Strange Godz", con una tarea programada
del escritorio de Claude a las 10:30 AM (hora de Cris). Si la PC está
apagada a esa hora, el post sale cuando abra la app.

- Los textos y las reglas de Cris: `src/lib/portavoz-textos.js`.
- El post de hoy con los números frescos de la API: `npm run portavoz`
  (`-- --todos` imprime los siete; `-- --fecha 2026-09-25` otro día).
- El parte a los líderes por Valquiria (la que recluta): `npm run portavoz:reporte`.
- Lo que la tarea apunta en la base (posts, engagement, buzón de la
  Página): `npm run portavoz:anotar` (tablas `fb_posts` y `fb_mensajes`,
  `sql/037`), que es lo que enseña la pestaña Reclutamiento del panel.
- El texto de la tarea programada, paso a paso: `docs/portavoz-tarea.md`.
- Imágenes: `web/public/reclutamiento-x300.jpg` (vertical 4:5) y
  `web/public/reclutamiento-x300-ancho.jpg` (16:9); se alternan por día.

En *Clash of Clans Recruitment* (lunes, 106K) **la Página no puede
publicar**, y está `pausado` en la rotación. La pestaña «Look for players»
(«Try it») abre el compositor como la Página, pero el servidor rechaza el
post: `ComposerStoryCreateMutation` → `api_error_code 200` (permisos),
`is_transient: false`; igual con foto que como «looking for players».
Probado el 21 sep 2026 con seis intentos. Para publicar ahí hace falta que
el perfil viejo de Cris entre al grupo como perfil (y entonces la tarea
tendría que elegir esa identidad en el compositor) o cambiar el grupo.

*Clash of Clans Latinoamerica* (miércoles, 73K) está igual: la Página
está dentro y el feed no le enseña la caja de publicar. También `pausado`.
Revisado el 21 sep 2026: en los otros cinco grupos la caja sí sale (en
Comunidad Latina, además, el post entró a revisión de admins).

En su lugar entraron dos grupos que sí aceptan Páginas (21 sep 2026):
*CLASH OF CLANS RECRUITMENT* (privado, 17K; la solicitud de la Página
quedó pendiente de los admins) y *Clash of Clans - Reclutamiento de
Clanes! 🏆* (público, 6.9K; la Página ya está dentro y ve la caja).
Mientras un grupo no apruebe a la Página, la tarea lo salta con
`npm run portavoz -- --saltar "Nombre"` y publica en el siguiente libre.

## Rotación (día de la semana)

| Día | Grupo | Idioma | Texto |
|---|---|---|---|
| Lunes | CLASH OF CLANS RECRUITMENT (17K, privado) | EN | 1 |
| Martes | Comunidad Latina de Clash of Clans (111K) | ES | 2 |
| Miércoles | Clash of Clans - Reclutamiento de Clanes! 🏆 (6.9K) | ES | 3 |
| Jueves | Reclutamiento de Clash of Clans (44K) | ES | 4 |
| Viernes | Reclutamiento de clanes (25K) | ES | 5 |
| Sábado | Clash Of Clans - En Español (18K) | ES | 6 |
| Domingo | Clash of Clans Recruiting Worldwide (7K) | EN | 7 |

La rotación se corrige sola: `npm run portavoz` mira `fb_posts` y, si el
grupo del día ya tuvo post en los últimos seis días (el 21 sep, lunes, el
post fue al grupo del martes porque el del lunes no deja publicar a la
Página), sigue la rotación desde mañana y toma el primer grupo libre. Si
ya hubo post hoy, dice `saltar` y no se publica dos veces.

## Reglas del post (de Cris, 21 sep 2026)

- Sin rayas largas (—). Sin la palabra "bots". Primero el enlace de
  Telegram, debajo el del clan. Adultos y responsables; no es clan de
  farming. Los premios son varios, por tareas. Gente de Cuba, Latinoamérica
  e internacionales. "Se busca jugador". Por Telegram se ofrecen también
  bases top gratis (layouts).
- Los números (nivel, guerras ganadas, racha, TH18) salen de la API el
  día del post; la racha solo se presume si es de 5 o más.
- Ritmo humano: entrar al grupo, leer un poco, escribir, adjuntar la
  imagen, esperar, publicar. Si el grupo tiene el post en revisión de
  admins, se reporta como "pendiente de aprobación".

## Candidatos (el rastreo, de Cris el 21 sep 2026)

Cada día, en el grupo donde publica, la tarea lee el feed buscando
jugadores TH18 que piden clan (texto o captura), y les contesta en su post
como la Página con `mensajeCandidato(idioma)` (Telegram y clan, premios y
bases). Por Messenger no se puede: una Página no puede escribirle primero
a nadie. Máximo 3 al día, nunca dos veces al mismo (tabla `fb_candidatos`,
`sql/038`, única por `post_url`). Valquiria avisa a los líderes de cada
candidato («Buenas, encontré un candidato…») y de cada respuesta; el caso
se cierra en la pestaña Reclutamiento (respondió, entró, descartado).
Comandos: `npm run portavoz:anotar -- candidato | candidatos |
candidato-estado`.

El primero fue José Pleitez (Reclutamiento de Clash of Clans, 21 sep
2026, cuatro cuentas TH18/17/16/13), contestado a mano desde este mismo
flujo para probarlo de punta a punta.
