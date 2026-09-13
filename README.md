# Strange Godz Alliance - Management

Sistema de gestion para la alianza de clanes de Clash of Clans (principal: x300).
Corre solo, sin depender de ninguna PC encendida, y cuesta **$0 al mes**.


## Temas visuales

Tres temas intercambiables desde la cabecera; la eleccion se guarda en el navegador.

| Tema | Paleta | Fuente | Mascota |
|---|---|---|---|
| **Clash** (por defecto) | Pergamino claro, madera, boton verde | Lilita One | Barbaro rubio |
| **Strange World** | Carmesi y oro mistico | Cinzel | Hechicero de sigilos |
| **Godz** | Azul egeo y marmol | Cinzel | Campeon griego |

**El tema Clash es CLARO a proposito.** La interfaz real del juego usa paneles de pergamino
con marcos de madera y botones verdes, no paneles oscuros. Por eso los tokens soportan temas
claros y oscuros: `--texto` es el color del texto SOBRE PANEL y `--barra-texto` el de las
barras de madera. Ninguna regla lleva un color literal: si alguna lo llevara, ese elemento
quedaria congelado en un tema y el cambio se veria roto a medias.

Las texturas de fondo y las mascotas son imagenes generadas, no recursos de Supercell. Pesan
1.2 MB en total (webp comprimido; los PNG originales eran 14 MB).

### Sobre personajes con derechos

Supercell publica una Fan Content Policy que PERMITE usar su material bajo condiciones (no
cobrar, no aparentar patrocinio, no imitar sus logos). Por eso el barbaro puede acercarse
bastante al estilo del juego.

Marvel y Disney no tienen nada equivalente. Se intento generar un personaje tipo Dr. Strange
tres veces, describiendolo sin nombrarlo, y el generador lo rechazo las tres. El tema Strange
World usa un hechicero original.

## Armado de alineaciones de CWL

Reemplaza los mensajes de WhatsApp donde cada mes se escribe a mano quien va en cada clan.

**El roster NO se carga a mano.** Sale del snapshot diario, que la API baja sola. En el
website se arrastran los nombres entre columnas (una por clan de la alianza), el contador
avisa si un clan pasa de 15, y un boton genera el mensaje ya formateado para WhatsApp.

En telefonos no existe arrastrar, asi que cada tarjeta lleva ademas un desplegable con los
clanes: misma accion, dos formas.

La tabla `alineaciones` tiene clave primaria `(temporada, player_tag)`, asi que un jugador
en dos clanes a la vez es imposible a nivel de base, no solo de pantalla.

## Arquitectura

```
GitHub Actions (cron 24/7)  ──escribe──>  Supabase (Postgres + Auth)
        │                                         ▲
        └──alerta──> Telegram (3 lideres)         │
                                            Vercel (dashboard con login)
```

**Por que cada pieza:**

| Pieza | Por que esta y no otra |
|---|---|
| Proxy RoyaleAPI (`45.79.218.79`) | La API de CoC exige whitelist de IP. GitHub Actions no tiene IP fija. El proxy lo resuelve, gratis. |
| GitHub Actions | Unico cron gratis que corre cada 2 horas. **Requiere repo publico** (en repos privados el plan Free no ejecuta cron). |
| Supabase | Postgres hospedado + login con contrasena ya integrado. Pausa proyectos tras 7 dias sin actividad; nosotros escribimos cada 2h, asi que nunca pausa. |
| Telegram | Gratis, sin limites, soporta grupos, cero riesgo de baneo. Lleva lo que no puede fallar. |
| Vercel | Dashboard siempre encendido. **No sirve de cron**: en plan Hobby los cron corren 1 vez al dia como maximo. |

### Sobre WhatsApp

El clan vive en WhatsApp y no se va a mudar a Discord. Opciones evaluadas:

| Via | Manda al grupo | Gratis |
|---|---|---|
| Meta Cloud API oficial | Grupos **capados a 8 participantes** | El 1:1 gratis **termina el 1-oct-2026** |
| CallMeBot | **No manda a grupos** | Si, pero registro saturado |
| **Baileys** | **Si, al grupo real** | **Si** |

El modulo de Baileys esta construido y **apagado por defecto** (`WA_HABILITADO != true`),
porque encenderlo exige un numero secundario dedicado. Guarda la sesion en Supabase, que es
el patron que la propia documentacion recomienda para produccion: el bot vive dentro del job
de GitHub Actions (conecta, manda, guarda, desconecta) sin necesitar PC ni hosting 24/7 — que
en 2026 ya no existe gratis (Render duerme a los 15 min, Fly.io elimino su tier libre).

**Por que sigue apagado:** la sesion guardada da acceso completo a ese WhatsApp, historial
incluido, y puede escribir como el titular. En el numero personal de un lider cuyo clan entero
vive en WhatsApp, el riesgo no compensa ahorrarse un copiar y pegar mensual.

### Como se resuelve mientras tanto

Hay dos avisos distintos y no necesitan el mismo canal:

| Aviso | A quien | Frecuencia | Canal |
|---|---|---|---|
| Ataques de CWL sin usar | los 3 lideres | ~20 al mes, urgente | Telegram (grupo de 3) |
| Reporte de premios | grupo del clan | 1 al mes | Copiar del website y pegar |

Telegram aca no es "mudar el clan": son 2 personas instalando una app. Los jugadores siguen
en WhatsApp y no se enteran.

**Mitigacion de fondo:** todo mensaje se escribe primero en la tabla `outbox`. WhatsApp es el
envio, no el dato. Si un canal falla, el aviso sigue en el website con boton de copiar.

---

## Que hay construido

| Archivo | Estado |
|---|---|
| `sql/001_schema.sql` | Esquema completo |
| `sql/002_rls.sql` | Seguridad: solo lideres autenticados leen |
| `sql/003_outbox.sql` | Bandeja de salida y sesion de WhatsApp |
| `src/jobs/probe.js` | Verificacion de endpoints y de raids (correr primero) |
| `src/jobs/snapshot.js` | Snapshot diario de perfiles |
| `src/jobs/cwl-sync.js` | Rondas, roster y ataques de CWL |
| `src/jobs/cwl-alerta.js` | Alerta escalonada (6h/3h/1h) al outbox |
| `src/jobs/wa-vincular.js` | Vinculacion del bot de WhatsApp (una sola vez) |
| `src/jobs/wa-enviar.js` | Envia el outbox al grupo del clan (apagado por defecto) |
| `web/` | Website: login, resumen, CWL, jugadores y mensajes |
| `web/app/api/telegram/` | Webhook del bot: comandos con respuesta al instante |
| `src/jobs/tg-webhook.js` | Registra el webhook en Telegram (una sola vez) |
| `sql/004_alianza.sql` | Multi-clan y tabla de alineaciones |
| `sql/005_clanes.sql` | Los 5 clanes de la alianza, con sus tags |
| `sql/006_raids.sql` | Raid Weekends |
| `src/jobs/raids-sync.js` | Sincroniza los ultimos 10 fines de semana de raids |
| `web/app/alineacion.jsx` | Tablero de arrastrar y soltar para la CWL |
| `web/app/temas.jsx` | Selector de tema y mascota |
| `.github/workflows/` | Cron de snapshot, CWL y raids |

### Bot de Telegram

El webhook lo sirve la misma app de Vercel, asi que sale gratis y responde al
instante: no hace falta polling ni un servidor encendido. Comandos:

| Comando | Que hace |
|---|---|
| `/resumen` | Estado de los 3 clanes, ultimo snapshot y jobs |
| `/faltan` | Quien no ha atacado en la CWL en curso, con horas restantes |
| `/estrellas` | Tabla de estrellas de la temporada |
| `/jugador <nombre>` | Ficha con deltas de trofeos y estrellas |
| `/reporte` | Ultimo mensaje generado, listo para pegar en WhatsApp |

Registrarlo despues de desplegar en Vercel:

```bash
WEBHOOK_URL=https://tu-app.vercel.app/api/telegram npm run tg:webhook
```

**Seguridad:** Telegram reenvia `TELEGRAM_SECRET_TOKEN` en cada peticion y el webhook
rechaza con 401 cualquiera que no lo traiga. Ademas solo responde a los chat id de
`TELEGRAM_CHAT_ID`; a cualquier otro le dice que el bot es privado sin tocar la base.

**Pendiente:** `cierre-mensual.js` (calculo de ganadores), `wars-sync.js` (guerra normal,
depende de lo que diga el probe), alertas de ejercito roto, feeds de YouTube y packs de bases.

### Raid Weekends

`raids-sync.js` corre una vez al dia y trae los ultimos 10 fines de semana. **La primera
corrida recupera meses de historia de golpe**: a diferencia del snapshot diario, este dato no
se pierde, la API lo devuelve hacia atras.

Importa porque un jugador hace ~7 ataques de CWL al mes contra ~22-26 de raids. El sistema de
premios del brief reparte $61 de $91 mirando solo la CWL, o sea el 12% de lo que la gente
realmente juega. Esta tabla es la que permite discutir eso con numeros.

### Packs de bases: por que NO se puede automatizar desde Discord

Los packs llegan por **mensaje privado** con el proveedor. Un bot de Discord solo lee canales
de servidores donde lo invitaron: **no puede ver los DM de una persona**. La unica forma seria
usar la cuenta propia como bot (self-bot), que Discord prohibe y castiga con baneo de cuenta.

Solucion: subir el PDF al website una vez al mes. Todo lo demas si se automatiza — extraer los
links, repartirlos entre lideres y responder `/base` en Telegram.

### Website (Vercel)

```bash
cd web && npm install && npm run dev
```

Para desplegar: importar el repo en Vercel, poner **Root Directory = `web`**, y definir dos
variables de entorno:

| Variable | Valor |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL de Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | clave **anon** (NO la service_role) |

La clave anon en el navegador es segura: con RLS activo, quien no este en `dashboard_users`
no recibe ni una fila.

### Vincular WhatsApp (una sola vez, desde tu PC)

Con `WA_NUMERO` en el `.env` (el numero secundario, solo digitos con codigo de pais):

```bash
npm run wa:vincular
```

Da un codigo de 8 letras. En el WhatsApp de ese numero: **Dispositivos vinculados >
Vincular con numero de telefono**. Despues lista los grupos; copia el JID del grupo del
clan. La sesion queda en Supabase y GitHub Actions la usa sin tu PC.

---

## Encendido

### 1. Llave de la API de Clash of Clans

1. Entrar a <https://developer.clashofclans.com> y crear cuenta.
2. **My Account > Create New Key**.
3. En *Allowed IP Addresses* poner exactamente: `45.79.218.79`
   (es la IP del proxy de RoyaleAPI, no la tuya).
4. Copiar el token largo que devuelve.

### 2. Probar antes de construir nada

```bash
npm install
cp .env.example .env
```

Editar `.env` con el token y los 3 tags de clan, y correr:

```bash
npm run probe
```

Esto responde sin adivinar las preguntas del brief: si `/currentwar` funciona con el
registro de guerra privado, si los endpoints de CWL responden, y cuantos ataques de la
CWL en curso se pueden rescatar **ahora mismo**.

### 3. Supabase

1. Crear proyecto en <https://supabase.com> (plan Free).
2. **SQL Editor** > pegar y ejecutar `sql/001_schema.sql`, despues `sql/002_rls.sql`.
3. **Settings > API**: copiar `Project URL` y la clave `service_role`.
4. **Authentication > Users > Add user**: crear un usuario con email y contrasena para
   vos, Carlos y Deibis.
5. Volver al SQL Editor y autorizar a cada uno:

```sql
insert into dashboard_users (user_id, nombre, puede_editar)
select id, 'Cris', true from auth.users where email = 'tu@email.com';
```

### 4. GitHub

Crear un repositorio **publico** (el cron no corre en privados con plan Free) y subir esto.
El codigo puede ser publico sin riesgo; los datos viven en Supabase y las llaves en Secrets.

**Nunca commitear:** `.env`, la `service_role` key, el `COC_TOKEN`, los tags de clan.

En **Settings > Secrets and variables > Actions > Secrets**:

| Secret | Valor |
|---|---|
| `COC_TOKEN` | el token del paso 1 |
| `CLAN_TAGS` | `#AAAA:A,#BBBB:B,#CCCC:C` |
| `SUPABASE_URL` | Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | clave `service_role` |
| `TELEGRAM_BOT_TOKEN` | paso 5 |
| `TELEGRAM_CHAT_ID` | paso 5 |

En la pestana **Variables** (no Secrets):

| Variable | Valor |
|---|---|
| `COC_BASE_URL` | `https://cocproxy.royaleapi.dev/v1` |
| `ALERTA_UMBRALES` | `6,3,1` |

Despues, en **Actions**, correr *Snapshot diario* a mano una vez para confirmar que
escribe en Supabase.

### 5. Telegram

1. Hablarle a [@BotFather](https://t.me/BotFather) > `/newbot` > guardar el token.
2. Crear un grupo con Carlos y Deibis, agregar el bot.
3. Mandar cualquier mensaje al grupo y abrir:
   `https://api.telegram.org/bot<TOKEN>/getUpdates`
4. Copiar el `chat_id` (para grupos es negativo, ej. `-1001234567890`).

---

## Datos que faltan del brief

- [ ] Los 3 tags de clan
- [ ] Los 11 tags de las cuentas de los lideres (marcar `owners.cobra_premios = false`)
- [ ] Agrupacion de multicuentas por persona (tabla `owners`)
- [ ] Si Deibis compite o cobra fijo (`owners.pago_fijo_usd = 10.00`)
- [ ] Confirmar la bolsa final ($91 es borrador)

---

## Decisiones tecnicas que conviene recordar

- **La llave es el `player_tag`, nunca el nombre.** Los jugadores se renombran; `player_names`
  guarda el historial.
- **Idempotencia por `unique` + upsert.** Cualquier job puede correr dos veces sin duplicar.
- **El roster de CWL se guarda aparte de los ataques.** Sin saber quien estaba alineado no se
  puede distinguir "no atacó" de "no jugaba esa ronda".
- **La alerta lee de la API, no de la base.** Un fallo guardando datos no puede costar una guerra.
- **Fechas de la API:** vienen como `20260907T103000.000Z`, que `Date()` no parsea. Lo resuelve
  `parseCocDate()` en `src/lib/coc.js`.
- **Campo `townhallLevel`** (h minuscula) en objetos de guerra, contra `townHallLevel` en el
  perfil del jugador. El codigo acepta los dos.
- **El cron de GitHub se retrasa 5-30 min** bajo carga. Por eso la alerta usa una ventana de
  horas, no un instante exacto.
- **GitHub desactiva cron tras 60 dias sin actividad en el repo.** El workflow de snapshot
  commitea un `.heartbeat` diario para evitarlo. Si aun asi lo desactivan, llega un mail y se
  reactiva con un click.

---

© 2026 Praxiflux · Todos los derechos reservados. Ver [LICENSE](LICENSE).
