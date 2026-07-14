-- HERENCIA90 - base aislada para conciliacion de pagos Wompi.
-- NO ejecutar hasta completar PAGOS_WOMPI_RUNBOOK.md y aprobar la migracion.
-- Este archivo no modifica productos, pedidos ni transacciones existentes.

create extension if not exists pgcrypto;

create table if not exists public.wompi_orders (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique check (reference ~ '^H90-[A-Za-z0-9_-]+$'),
  environment text not null check (environment in ('test', 'prod')),
  status text not null default 'PENDING' check (status in ('PENDING', 'APPROVED', 'DECLINED', 'VOIDED', 'ERROR')),
  amount_in_cents bigint not null check (amount_in_cents > 0),
  currency text not null default 'COP' check (currency = 'COP'),
  items jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array'),
  customer jsonb not null default '{}'::jsonb check (jsonb_typeof(customer) = 'object'),
  provider_transaction_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wompi_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.wompi_orders(id) on delete cascade,
  event_key text not null,
  provider_transaction_id text not null,
  status text not null,
  checksum text not null check (checksum ~ '^[a-f0-9]{64}$'),
  payload jsonb not null,
  received_at timestamptz not null default now(),
  constraint wompi_events_event_key_unique unique (event_key)
);

create index if not exists wompi_orders_status_created_idx
  on public.wompi_orders (status, created_at desc);
create index if not exists wompi_events_order_received_idx
  on public.wompi_events (order_id, received_at desc);

alter table public.wompi_orders enable row level security;
alter table public.wompi_events enable row level security;

revoke all on table public.wompi_orders from anon, authenticated;
revoke all on table public.wompi_events from anon, authenticated;
grant select, insert, update on table public.wompi_orders to service_role;
grant select, insert on table public.wompi_events to service_role;

create or replace function public.h90_record_wompi_event(
  p_event_key text,
  p_reference text,
  p_transaction_id text,
  p_status text,
  p_amount_in_cents bigint,
  p_currency text,
  p_payload jsonb,
  p_checksum text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_order public.wompi_orders%rowtype;
  inserted_event_id uuid;
begin
  if p_status not in ('APPROVED', 'DECLINED', 'VOIDED', 'ERROR') then
    raise exception 'Unsupported Wompi status';
  end if;

  select * into current_order
  from public.wompi_orders
  where reference = p_reference
  for update;

  if not found then
    raise exception 'Unknown Wompi reference';
  end if;
  if current_order.amount_in_cents <> p_amount_in_cents or current_order.currency <> p_currency then
    raise exception 'Wompi amount or currency mismatch';
  end if;

  insert into public.wompi_events (
    order_id, event_key, provider_transaction_id, status, checksum, payload
  ) values (
    current_order.id, p_event_key, p_transaction_id, p_status, lower(p_checksum), p_payload
  )
  on conflict (event_key) do nothing
  returning id into inserted_event_id;

  if inserted_event_id is null then
    return jsonb_build_object('applied', false, 'duplicate', true);
  end if;

  -- Un pago aprobado nunca se degrada por un evento posterior contradictorio.
  if current_order.status <> 'APPROVED' or p_status = 'APPROVED' then
    update public.wompi_orders
    set status = p_status,
        provider_transaction_id = p_transaction_id,
        updated_at = now()
    where id = current_order.id;
  end if;

  return jsonb_build_object('applied', true, 'duplicate', false);
end;
$$;

revoke all on function public.h90_record_wompi_event(text, text, text, text, bigint, text, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.h90_record_wompi_event(text, text, text, text, bigint, text, jsonb, text)
  to service_role;
