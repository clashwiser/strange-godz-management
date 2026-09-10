-- =====================================================================
-- Cuantas veces al dia se le ha preguntado a la IA
-- Ejecutar DESPUES de 021_entrevista.sql
-- =====================================================================
--
-- Los bots tienen un cerebro de frases para lo que se pregunta siempre.
-- Para todo lo demas -que es infinito- preguntan a una IA con nivel
-- gratuito (Gemini). Gratis quiere decir con limite diario, y el limite
-- lo pone Google por cuenta; si se pasa, la API devuelve 429 y la
-- respuesta se pierde.
--
-- Aqui se lleva la cuenta de cuantas llamadas van hoy para cortar ANTES
-- de que Google corte, con un tope propio mas bajo que el suyo. Cuando se
-- llega, el bot vuelve a las frases de siempre y nadie nota nada.
--
-- Una fila por dia. Vercel apaga la funcion entre mensaje y mensaje, asi
-- que el contador no puede vivir en memoria.

create table if not exists ia_uso (
  dia       date primary key,
  llamadas  int  not null default 0,
  -- Cuantas fallaron (429, timeout, respuesta vacia). Si un dia son muchas,
  -- algo pasa con la llave o con el limite de Google.
  fallos    int  not null default 0
);

-- Sube el contador y devuelve el valor nuevo, en una sola operacion: dos
-- mensajes a la vez no pueden pisarse el numero.
create or replace function ia_contar(p_dia date, p_fallo boolean default false)
returns int
language sql
security definer
set search_path = public
as $$
  insert into ia_uso (dia, llamadas, fallos)
  values (p_dia, 1, case when p_fallo then 1 else 0 end)
  on conflict (dia) do update
    set llamadas = ia_uso.llamadas + 1,
        fallos   = ia_uso.fallos + (case when p_fallo then 1 else 0 end)
  returning llamadas;
$$;

alter table ia_uso enable row level security;

drop policy if exists "lideres leen ia_uso" on ia_uso;
create policy "lideres leen ia_uso" on ia_uso for select using (es_lider_autorizado());
-- Escribe solo el webhook, con la service_role, a traves de ia_contar().
