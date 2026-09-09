-- =====================================================================
-- x300 - Bandeja de salida y sesion de WhatsApp
-- Ejecutar DESPUES de 002_rls.sql
--
-- Principio de diseno: WhatsApp es el ENVIO, no el DATO. Todo mensaje se
-- escribe primero aca. Si el bot falla, el mensaje sigue existiendo y el
-- website lo muestra con boton de copiar. Nunca se pierde un aviso por
-- una sesion caida.
-- =====================================================================

create table if not exists outbox (
  id            bigserial primary key,
  tipo          text not null,          -- alerta_cwl | reporte_mensual | alerta_guerra | manual
  destino       text not null default 'grupo_clan',
  cuerpo        text not null,          -- texto plano, listo para copiar y pegar
  clave_dedupe  text,                   -- evita repetir el mismo aviso en cada corrida
  estado        text not null default 'pendiente'
                check (estado in ('pendiente','enviado','fallido','cancelado','copiado')),
  intentos      int  not null default 0,
  error         text,
  creado_en     timestamptz not null default now(),
  enviado_en    timestamptz
);

-- Sin esto, el cron cada 2 horas mandaria el mismo "fulano no atacó" 3 veces.
create unique index if not exists idx_outbox_dedupe
  on outbox (clave_dedupe) where clave_dedupe is not null;

create index if not exists idx_outbox_pendientes
  on outbox (creado_en) where estado = 'pendiente';

-- ---------- Sesion de WhatsApp -----------------------------------------
-- Baileys guarda credenciales y llaves de cifrado. La documentacion oficial
-- recomienda persistirlas en base de datos para produccion: asi el bot corre
-- dentro de un job efimero (conecta, manda, guarda, desconecta) en vez de
-- necesitar un servidor encendido 24/7.
--
-- OJO: cada fila es material criptografico de la sesion. Nunca se expone al
-- navegador: RLS deniega todo y solo la service_role key la lee.
create table if not exists wa_auth (
  clave      text primary key,          -- 'creds' o 'app-state-sync-key-xxx', etc.
  valor      jsonb not null,
  actualizado timestamptz not null default now()
);

alter table wa_auth enable row level security;
-- Sin policies = nadie con la clave anon puede leerla ni escribirla.

-- Estado visible de la sesion, para que el website muestre si el bot esta
-- vinculado o hay que re-escanear el QR.
create table if not exists wa_estado (
  id             int primary key default 1 check (id = 1),
  vinculado      boolean not null default false,
  numero         text,
  grupo_jid      text,                  -- JID del grupo del clan
  ultimo_ok      timestamptz,
  ultimo_error   text,
  actualizado    timestamptz not null default now()
);

insert into wa_estado (id) values (1) on conflict (id) do nothing;

-- El outbox y el estado SI los ve el dashboard; wa_auth no.
do $$
declare t text;
begin
  foreach t in array array['outbox','wa_estado']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "lideres leen" on %I', t);
    execute format('create policy "lideres leen" on %I for select using (es_lider_autorizado())', t);
    execute format('drop policy if exists "lideres editan" on %I', t);
    execute format('create policy "lideres editan" on %I for all using (puede_editar()) with check (puede_editar())', t);
  end loop;
end $$;
