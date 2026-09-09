-- =====================================================================
-- Quien pidio bases y cuando
-- Ejecutar DESPUES de 015_cwl_grupo.sql
-- =====================================================================
--
-- El pack de bases es contenido PAGADO. Que el bot suelte los diecisiete
-- enlaces de golpe a quien escriba /base es regalar el pack entero: basta
-- con que alguien reenvie el mensaje. Da una sola base por vez y como
-- maximo dos al dia por persona.
--
-- El limite no es tacaneria: obliga a pedirla cuando de verdad se va a
-- atacar, que es cuando sirve, en vez de coleccionarlas.
--
-- El dia se guarda YA CALCULADO en hora de Cuba, no como timestamp. Contar
-- "las de hoy" con un rango de horas obliga a repetir la conversion de zona
-- horaria en cada consulta, y basta equivocarse una vez para que el cupo se
-- reinicie a las 8 de la noche.

create table if not exists base_pedidos (
  id          bigserial primary key,
  -- El id numerico de Telegram, que no cambia aunque la persona se cambie
  -- el @usuario ni el nombre.
  tg_user_id  bigint not null,
  tg_nombre   text,
  base_id     bigint references bases(id) on delete set null,
  dia         date not null,
  pedido_en   timestamptz not null default now()
);

-- La consulta del cupo es siempre "cuantas lleva esta persona hoy".
create index if not exists idx_base_pedidos_cupo on base_pedidos (tg_user_id, dia);
-- Y para no repetirle la misma base a la misma persona.
create index if not exists idx_base_pedidos_quien on base_pedidos (tg_user_id, base_id);

-- ---------- RLS ----------
alter table base_pedidos enable row level security;

drop policy if exists "lideres leen" on base_pedidos;
create policy "lideres leen" on base_pedidos for select using (es_lider_autorizado());

-- Sin politica de escritura: la llena el webhook con la service_role, que
-- salta RLS. Desde el navegador nadie puede fabricarse pedidos ni borrarlos
-- para saltarse el cupo.
