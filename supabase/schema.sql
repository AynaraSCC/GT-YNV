-- =====================================================================
-- Golden Ticket — base de datos (Supabase / PostgreSQL)
-- Pega TODO este archivo en Supabase → SQL Editor → New query → Run.
-- =====================================================================

-- 1) Tiquetes: los 1000 números y su estado ---------------------------
create table if not exists public.tiquetes (
  numero          int primary key check (numero between 1 and 1000),
  estado          text not null default 'disponible'
                  check (estado in ('disponible', 'reservado', 'vendido')),
  reservado_hasta timestamptz,
  compra_id       uuid,
  actualizado     timestamptz not null default now()
);

insert into public.tiquetes (numero)
select g from generate_series(1, 1000) g
on conflict (numero) do nothing;

-- 2) Compras: quién compró, qué celebración eligió y cómo va el pago ---
create table if not exists public.compras (
  id              uuid primary key default gen_random_uuid(),
  referencia      text not null unique,          -- la que se envía a Wompi
  numero          int  not null references public.tiquetes(numero),
  nombre          text not null,
  cedula          text not null,
  telefono        text not null,
  email           text not null,
  celebracion     text not null check (celebracion in ('quince', 'boda', 'grado')),
  acepta_datos    boolean not null default false,
  valor_centavos  bigint not null,
  estado_pago     text not null default 'PENDIENTE', -- PENDIENTE, APPROVED, DECLINED, VOIDED, ERROR, CONFLICTO
  wompi_id        text,
  notificado      boolean not null default false,
  creado          timestamptz not null default now(),
  actualizado     timestamptz not null default now()
);
create index if not exists compras_cedula_idx on public.compras (cedula);

-- 3) Seguridad: nadie desde la página puede leer datos personales ------
alter table public.tiquetes enable row level security;
alter table public.compras  enable row level security;
-- (sin políticas = el público no puede leer ni escribir estas tablas;
--  solo las funciones del servidor, que usan la llave de servicio)

-- 4) Vista pública: SOLO número y estado (para pintar la cuadrícula) ---
create or replace view public.estado_tiquetes as
select numero,
       case
         when estado = 'reservado' and reservado_hasta < now() then 'disponible'
         else estado
       end as estado
from public.tiquetes;

grant select on public.estado_tiquetes to anon, authenticated;

-- 5) Reservar un número de forma segura (evita que dos personas compren el mismo)
create or replace function public.reservar_tiquete(
  p_numero int, p_nombre text, p_cedula text, p_telefono text, p_email text,
  p_celebracion text, p_acepta boolean, p_valor bigint, p_minutos int default 15
) returns table (compra_id uuid, referencia text, reservado_hasta timestamptz)
language plpgsql security definer set search_path = public as $$
declare
  v_id   uuid := gen_random_uuid();
  v_ref  text := 'GT-' || lpad(p_numero::text, 3, '0') || '-' || to_char(now(), 'YYMMDDHH24MISS') || '-' || substr(replace(v_id::text, '-', ''), 1, 6);
  v_hasta timestamptz := now() + make_interval(mins => p_minutos);
begin
  if not p_acepta then raise exception 'debe_aceptar_datos'; end if;

  -- una misma cédula no puede tener varios números "apartados" a la vez
  if exists (
    select 1 from compras c join tiquetes t on t.compra_id = c.id
    where c.cedula = p_cedula and t.estado = 'reservado' and t.reservado_hasta > now()
  ) then
    raise exception 'ya_tiene_reserva';
  end if;

  update tiquetes
     set estado = 'reservado', reservado_hasta = v_hasta, compra_id = v_id, actualizado = now()
   where numero = p_numero
     and (estado = 'disponible' or (estado = 'reservado' and tiquetes.reservado_hasta < now()));
  if not found then raise exception 'no_disponible'; end if;

  insert into compras (id, referencia, numero, nombre, cedula, telefono, email, celebracion, acepta_datos, valor_centavos)
  values (v_id, v_ref, p_numero, p_nombre, p_cedula, p_telefono, p_email, p_celebracion, p_acepta, p_valor);

  return query select v_id, v_ref, v_hasta;
end $$;

-- 6) Registrar el resultado del pago (lo llama el webhook de Wompi) ----
create or replace function public.registrar_pago(p_referencia text, p_estado text, p_wompi_id text)
returns table (compra_id uuid, numero int, estado_final text)
language plpgsql security definer set search_path = public as $$
declare
  c compras%rowtype;
  t tiquetes%rowtype;
begin
  select * into c from compras where referencia = p_referencia for update;
  if not found then raise exception 'referencia_desconocida'; end if;
  select * into t from tiquetes where tiquetes.numero = c.numero for update;

  if p_estado = 'APPROVED' then
    if t.compra_id = c.id or t.estado = 'disponible'
       or (t.estado = 'reservado' and t.reservado_hasta < now()) then
      update tiquetes set estado = 'vendido', reservado_hasta = null, compra_id = c.id, actualizado = now()
       where tiquetes.numero = c.numero;
      update compras set estado_pago = 'APPROVED', wompi_id = p_wompi_id, actualizado = now() where id = c.id;
      return query select c.id, c.numero, 'APPROVED'::text;
    else
      -- caso raro: pagó un número que ya se vendió a otra persona → revisar y devolver dinero
      update compras set estado_pago = 'CONFLICTO', wompi_id = p_wompi_id, actualizado = now() where id = c.id;
      return query select c.id, c.numero, 'CONFLICTO'::text;
    end if;
  else
    update compras set estado_pago = p_estado, wompi_id = p_wompi_id, actualizado = now() where id = c.id;
    if p_estado in ('DECLINED', 'VOIDED', 'ERROR') and t.compra_id = c.id and t.estado = 'reservado' then
      update tiquetes set estado = 'disponible', reservado_hasta = null, compra_id = null, actualizado = now()
       where tiquetes.numero = c.numero;
    end if;
    return query select c.id, c.numero, p_estado;
  end if;
end $$;

-- Estas funciones solo las puede usar el servidor (no la página pública)
revoke execute on function public.reservar_tiquete(int, text, text, text, text, text, boolean, bigint, int) from public, anon, authenticated;
revoke execute on function public.registrar_pago(text, text, text) from public, anon, authenticated;

-- 7) Vista cómoda para tu tía: ventas confirmadas -----------------------
create or replace view public.ventas_confirmadas as
select numero, nombre, cedula, telefono, email, celebracion, valor_centavos / 100 as valor_cop, wompi_id, creado
from public.compras where estado_pago = 'APPROVED' order by numero;
revoke all on public.ventas_confirmadas from anon, authenticated;
