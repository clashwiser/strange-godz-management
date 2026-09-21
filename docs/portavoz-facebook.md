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

## Rotación (día de la semana)

| Día | Grupo | Idioma | Texto |
|---|---|---|---|
| Lunes | Clash of Clans Recruitment (106K) | EN | 1 |
| Martes | Comunidad Latina de Clash of Clans (111K) | ES | 2 |
| Miércoles | Clash of Clans Latinoamerica (73K) | ES | 3 |
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
