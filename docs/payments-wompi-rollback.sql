-- Rollback aislado de la preparacion Wompi.
-- No toca las tablas actuales de inventario, pedidos o finanzas.

begin;

drop function if exists public.h90_record_wompi_event(text, text, text, text, bigint, text, jsonb, text);
drop table if exists public.wompi_events;
drop table if exists public.wompi_orders;

commit;
