# Portavoz de Facebook — x300 (Strange Godz Alliance)

Reclutamiento en grupos de Facebook, un post al día, cada grupo una vez
por semana. Publica la cuenta vieja de Cris como la Página "Strange Godz
Alliance · COC", desde el Chrome "Strange Godz", con una tarea programada
del escritorio de Claude a las 10:30 AM (hora de Cris). Si la PC está
apagada a esa hora, el post sale cuando abra la app.

- Los textos y las reglas de Cris: `src/lib/portavoz-textos.js`.
- El post de hoy con los números frescos de la API: `npm run portavoz`
  (`-- --todos` imprime los siete; `-- --fecha 2026-09-25` otro día).
- El parte a los líderes por Heraldo: `npm run portavoz:reporte`.
- Imágenes: `web/public/reclutamiento-x300.jpg` (vertical 4:5) y
  `web/public/reclutamiento-x300-ancho.jpg` (16:9); se alternan por día.

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

## Reglas del post (de Cris, 21 sep 2026)

- Sin rayas largas (—). Sin la palabra "bots". Primero el enlace de
  Telegram, debajo el del clan. Adultos y responsables; no es clan de
  farming. Los premios son varios, por tareas. Gente de Cuba, Latinoamérica
  e internacionales. "Se busca jugador".
- Los números (nivel, guerras ganadas, racha, TH18) salen de la API el
  día del post; la racha solo se presume si es de 5 o más.
- Ritmo humano: entrar al grupo, leer un poco, escribir, adjuntar la
  imagen, esperar, publicar. Si el grupo tiene el post en revisión de
  admins, se reporta como "pendiente de aprobación".
