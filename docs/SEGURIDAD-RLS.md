# Verificación de seguridad RLS — Herencia 90

La clave `anon` de Supabase es pública por diseño (está en el código del sitio). La seguridad depende 100% de las políticas RLS (Row Level Security). En esta auditoría se verificó, con solo lecturas no destructivas, que:

- **`transacciones` (ventas, costos, clientes): lectura anónima BLOQUEADA.** Un usuario anónimo recibe 0 filas. Correcto.
- **`productos`: lectura anónima PERMITIDA (58 filas).** Correcto: es el catálogo público.

Falta confirmar la **escritura** (INSERT/UPDATE/DELETE). No se probó en producción para no insertar ni cambiar datos reales. `Needs confirmation`: antes del despliegue hay que revisar las políticas vigentes y conceder acceso únicamente a la cuenta administradora.

## Cómo verificar en el panel de Supabase (2 minutos)

1. Entra a https://supabase.com/dashboard → proyecto Herencia 90.
2. Menú **Authentication → Policies** (o **Database → Policies**).
3. Para cada tabla interna (`productos`, `transacciones`, `pedidos`, `preventa_catalogo` y lectura de `analytics_events`) revisa que:
   - **RLS esté ACTIVADO** (badge "RLS enabled").
   - Las políticas de **INSERT / UPDATE / DELETE** exijan `app_metadata.role = admin` o que el arreglo `app_metadata.roles` contenga `admin`. El rol genérico `authenticated` no es suficiente: incluye cualquier cliente que cree una cuenta.

## Políticas recomendadas

La condición segura reutilizable es:

```sql
(
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  or coalesce(auth.jwt() -> 'app_metadata' -> 'roles', '[]'::jsonb) ? 'admin'
)
```

`productos` — lectura pública, escritura solo admin:

```sql
-- Lectura pública (catálogo)
create policy "productos_select_public" on public.productos
  for select using (true);

-- Escritura solo para la cuenta con claim de admin
create policy "productos_write_admin" on public.productos
  for all to authenticated
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    or coalesce(auth.jwt() -> 'app_metadata' -> 'roles', '[]'::jsonb) ? 'admin'
  )
  with check (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    or coalesce(auth.jwt() -> 'app_metadata' -> 'roles', '[]'::jsonb) ? 'admin'
  );
```

`transacciones` — todo solo para admin:

```sql
create policy "transacciones_all_admin" on public.transacciones
  for all to authenticated
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    or coalesce(auth.jwt() -> 'app_metadata' -> 'roles', '[]'::jsonb) ? 'admin'
  )
  with check (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    or coalesce(auth.jwt() -> 'app_metadata' -> 'roles', '[]'::jsonb) ? 'admin'
  );
```

Y asegúrate de que RLS esté activo:

```sql
alter table public.productos enable row level security;
alter table public.transacciones enable row level security;
alter table public.pedidos enable row level security;
alter table public.preventa_catalogo enable row level security;
alter table public.analytics_events enable row level security;
```

Antes de crear políticas nuevas, elimina o restringe cualquier política anterior que conceda escritura a todo `authenticated`. No ejecutes cambios a ciegas: exporta las políticas actuales y conserva un rollback.

La cuenta administradora del panel debe autorizarse con `app_metadata.role = admin` o con `admin` dentro de `app_metadata.roles`. Las allowlists privadas `ADMIN_USER_IDS` y `ADMIN_EMAILS` sirven únicamente para APIs del servidor: una allowlist no reemplaza el claim que RLS necesita para las operaciones directas del panel. Nunca uses `user_metadata.role`, porque el usuario puede modificar esos metadatos.

## Señal de alarma

Si en el panel ves una política de INSERT o UPDATE con rol `public`/`anon`, o una política para `authenticated` con condición `true`, una cuenta no administradora podría editar precios, stock o registrar transacciones falsas. Debe exigir el claim de administrador.
