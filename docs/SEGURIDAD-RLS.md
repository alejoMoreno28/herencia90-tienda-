# Verificación de seguridad RLS — Herencia 90

La clave `anon` de Supabase es pública por diseño (está en el código del sitio). La seguridad depende 100% de las políticas RLS (Row Level Security). En esta auditoría se verificó, con solo lecturas no destructivas, que:

- **`transacciones` (ventas, costos, clientes): lectura anónima BLOQUEADA.** Un usuario anónimo recibe 0 filas. Correcto.
- **`productos`: lectura anónima PERMITIDA (58 filas).** Correcto: es el catálogo público.

Falta confirmar la **escritura** (INSERT/UPDATE/DELETE). No se probó en la auditoría para no insertar datos de prueba en tu base de producción. Verifícalo tú así:

## Cómo verificar en el panel de Supabase (2 minutos)

1. Entra a https://supabase.com/dashboard → proyecto Herencia 90.
2. Menú **Authentication → Policies** (o **Database → Policies**).
3. Para cada tabla (`productos` y `transacciones`) revisa que:
   - **RLS esté ACTIVADO** (badge "RLS enabled").
   - Las políticas de **INSERT / UPDATE / DELETE** apliquen solo al rol `authenticated`, nunca a `anon` ni a `public` sin condición.

## Políticas recomendadas

`productos` — lectura pública, escritura solo admin autenticado:

```sql
-- Lectura pública (catálogo)
create policy "productos_select_public" on public.productos
  for select using (true);

-- Escritura solo autenticados (panel admin)
create policy "productos_write_auth" on public.productos
  for all to authenticated using (true) with check (true);
```

`transacciones` — todo solo para admin autenticado:

```sql
create policy "transacciones_all_auth" on public.transacciones
  for all to authenticated using (true) with check (true);
```

Y asegúrate de que RLS esté activo:

```sql
alter table public.productos enable row level security;
alter table public.transacciones enable row level security;
```

## Señal de alarma

Si en el panel ves una política de INSERT o UPDATE con rol `public`/`anon` y condición `true`, cualquiera podría editar precios, stock o registrar transacciones falsas desde la consola del navegador. En ese caso, cámbiala para que sea `to authenticated` de inmediato.
