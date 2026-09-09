-- =====================================================================
-- La tabla del grupo de CWL, no solo nuestras guerras
-- Ejecutar DESPUES de 014_war_roster.sql
-- =====================================================================
--
-- cwl_wars guarda las siete guerras de NUESTRO clan. Con eso se sabe como
-- vamos nosotros, pero no en que puesto vamos, que es la pregunta que se
-- hace todo el mundo el dia 4: "¿estamos descendiendo?". Para responder eso
-- hace falta cuantas estrellas llevan los otros siete clanes del grupo, y
-- eso obliga a entrar clan por clan en el juego.
--
-- El dato ya lo estabamos bajando. `getLeagueGroup` devuelve los tags de
-- TODAS las guerras de cada ronda -las cuatro, no solo la nuestra- y
-- cwl-sync se las pedia todas a la API para luego tirar las tres en las que
-- no jugabamos. Aqui se guardan.
--
-- Como se puntua la liga, que no es evidente:
--
--   estrellas del clan = las de sus ataques + 10 por cada guerra GANADA
--
-- Ese bono de 10 es lo que hace que ganar importe mas que hacer estrellas.
-- Empate a estrellas en una guerra: gana quien tenga mas destruccion. Si
-- tambien empatan, no hay ganador y nadie cobra el bono.
--
-- El desempate de la tabla general es la destruccion total acumulada.

create table if not exists cwl_grupo (
  id             bigserial primary key,
  season_id      bigint not null references cwl_seasons(id) on delete cascade,
  ronda          int not null check (ronda between 1 and 7),
  war_tag        text not null,
  -- 'a' y 'b' son los dos lados tal como los devuelve la API (clan y
  -- opponent). No hay "nuestro" y "rival": en la mayoria de estas guerras
  -- no jugamos nosotros.
  clan_a_tag     text not null,
  clan_a_nombre  text,
  estrellas_a    int,
  destruccion_a  numeric(6,2),
  clan_b_tag     text not null,
  clan_b_nombre  text,
  estrellas_b    int,
  destruccion_b  numeric(6,2),
  estado         text,
  end_time       timestamptz,
  actualizado_en timestamptz not null default now(),
  unique (season_id, war_tag)
);

create index if not exists idx_cwl_grupo_temporada on cwl_grupo (season_id, ronda);

-- ---------- Cupos de ascenso y descenso ----------
--
-- En tabla y no en el codigo A PROPOSITO. La regla general esta confirmada
-- -dos suben y dos bajan, y de Master para arriba sube solo uno- pero
-- Supercell la ha cambiado antes (en las CWL cortas de febrero los grupos
-- eran de seis clanes y los cupos otros), y en abril de 2026 se añadieron
-- Titan I-III y Legend por encima de Champion I. Si algun numero de estos
-- esta mal, se corrige con un UPDATE y no con un despliegue.
--
-- La escalera son los nombres exactos que devuelve /warleagues de la API.

create table if not exists cwl_ligas (
  liga       text primary key,
  orden      int  not null,
  promueven  int  not null default 2,
  descienden int  not null default 2
);

insert into cwl_ligas (liga, orden, promueven, descienden) values
  ('Unranked',            0, 2, 0),
  -- La ultima liga no tiene a donde bajar.
  ('Bronze League III',   1, 2, 0),
  ('Bronze League II',    2, 2, 2),
  ('Bronze League I',     3, 2, 2),
  ('Silver League III',   4, 2, 2),
  ('Silver League II',    5, 2, 2),
  ('Silver League I',     6, 2, 2),
  ('Gold League III',     7, 2, 2),
  ('Gold League II',      8, 2, 2),
  ('Gold League I',       9, 2, 2),
  ('Crystal League III', 10, 2, 2),
  ('Crystal League II',  11, 2, 2),
  ('Crystal League I',   12, 2, 2),
  -- De Master para arriba sube uno solo y siguen bajando dos.
  ('Master League III',  13, 1, 2),
  ('Master League II',   14, 1, 2),
  ('Master League I',    15, 1, 2),
  ('Champion League III',16, 1, 2),
  ('Champion League II', 17, 1, 2),
  ('Champion League I',  18, 1, 2),
  ('Titan League III',   19, 1, 2),
  ('Titan League II',    20, 1, 2),
  ('Titan League I',     21, 1, 2),
  -- Arriba del todo: no hay a donde subir.
  ('Legend League',      22, 0, 2)
on conflict (liga) do update
  set orden = excluded.orden,
      promueven = excluded.promueven,
      descienden = excluded.descienden;

-- ---------- La tabla de posiciones ----------
--
-- Vista y no calculo en el navegador para que el panel y el bot de Telegram
-- no puedan dar numeros distintos: los dos leen de aqui.

create or replace view cwl_tabla
with (security_invoker = true) as
with lados as (
  -- Cada guerra da DOS filas, una por clan. Es la unica forma de sumar por
  -- clan sin repetir el mismo case dos veces.
  select season_id, ronda, estado,
         clan_a_tag as clan_tag, clan_a_nombre as nombre,
         estrellas_a as estrellas, destruccion_a as destruccion,
         estrellas_b as estrellas_rival, destruccion_b as destruccion_rival
    from cwl_grupo
  union all
  select season_id, ronda, estado,
         clan_b_tag, clan_b_nombre,
         estrellas_b, destruccion_b,
         estrellas_a, destruccion_a
    from cwl_grupo
),
puntuado as (
  select l.*,
         case
           when l.estado = 'warEnded'
            and (l.estrellas > l.estrellas_rival
                 or (l.estrellas = l.estrellas_rival
                     and l.destruccion > l.destruccion_rival))
           then 1 else 0
         end as gano
    from lados l
)
select p.season_id,
       s.temporada,
       s.clan_tag as clan_nuestro,
       p.clan_tag,
       max(p.nombre)                                        as nombre,
       count(*)                                             as rondas,
       count(*) filter (where p.estado = 'warEnded')         as rondas_cerradas,
       sum(p.gano)                                          as ganadas,
       coalesce(sum(p.estrellas), 0)                        as estrellas_ataque,
       -- Lo que sale en la tabla del juego: ataques + bono de victoria.
       coalesce(sum(p.estrellas), 0) + sum(p.gano) * 10      as estrellas,
       round(coalesce(sum(p.destruccion), 0), 2)            as destruccion,
       rank() over (
         partition by p.season_id
         order by coalesce(sum(p.estrellas), 0) + sum(p.gano) * 10 desc,
                  coalesce(sum(p.destruccion), 0) desc
       )                                                    as puesto
  from puntuado p
  join cwl_seasons s on s.id = p.season_id
 group by p.season_id, s.temporada, s.clan_tag, p.clan_tag;

-- ---------- RLS ----------
alter table cwl_grupo enable row level security;
alter table cwl_ligas enable row level security;

drop policy if exists "lideres leen" on cwl_grupo;
create policy "lideres leen" on cwl_grupo for select using (es_lider_autorizado());

-- Los cupos los lee cualquiera que entre al panel; escribirlos es cosa del
-- SQL editor.
drop policy if exists "lideres leen" on cwl_ligas;
create policy "lideres leen" on cwl_ligas for select using (es_lider_autorizado());
