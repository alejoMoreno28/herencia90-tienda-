-- ============================================================
-- HERENCIA 90 — Galería de Pre-Venta
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- Proyecto: nlnrdtcgbdkzfzwnsffp
-- Rama git: preventa-galeria (NO afecta producción)
-- ============================================================

-- 1. TABLA preventa_catalogo
-- ============================================================
create table if not exists preventa_catalogo (
  id              uuid        primary key default gen_random_uuid(),
  slug            text        unique not null,
  equipo          text        not null,
  temporada       text        not null,
  tipo            text        not null check (tipo in ('local','visitante','tercera','retro','portero','manga-larga','fan','player')),
  categoria       text        not null check (categoria in ('selecciones','clubes','ligas-nba','otros')),
  pais_o_club     text,
  decada          text        check (decada in ('70s','80s','90s','2000s','2010s','2020s')),
  descripcion     text,
  imagenes        jsonb       not null default '[]'::jsonb,
  tags            text[]      not null default '{}',
  precio_aprox    int,
  yupoo_origen    text,
  publicado       bool        not null default false,
  destacado       bool        not null default false,
  orden           int         not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Índices para filtros de galería
create index if not exists idx_preventa_galeria
  on preventa_catalogo (publicado, destacado desc, orden asc);

create index if not exists idx_preventa_categoria
  on preventa_catalogo (categoria, decada);

create index if not exists idx_preventa_pais
  on preventa_catalogo (pais_o_club);

-- auto-update updated_at
create or replace function preventa_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_preventa_updated_at on preventa_catalogo;
create trigger trg_preventa_updated_at
  before update on preventa_catalogo
  for each row execute function preventa_set_updated_at();

-- 2. RLS — lectura pública solo publicados; escritura solo service-role
-- ============================================================
alter table preventa_catalogo enable row level security;

-- Drop policies si ya existen (idempotente)
drop policy if exists "preventa_public_read" on preventa_catalogo;
drop policy if exists "preventa_service_write" on preventa_catalogo;

-- Cualquier visitante puede leer referencias publicadas
create policy "preventa_public_read"
  on preventa_catalogo for select
  using (publicado = true);

-- Escritura permitida para anon y service-role.
-- La seguridad real la da el login custom del admin (igual que en tabla productos/transacciones).
create policy "preventa_admin_write"
  on preventa_catalogo for all
  using (true)
  with check (true);

-- 3. BUCKET preventa-images
-- ============================================================
-- Ejecutar en: Supabase Dashboard → Storage → New bucket
-- Nombre: preventa-images
-- Public: true
-- Max file size: 5 MB
-- Allowed MIME types: image/webp, image/jpeg, image/png
--
-- O via SQL (puede no estar soportado en todos los proyectos):
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'preventa-images',
  'preventa-images',
  true,
  5242880,  -- 5 MB
  array['image/webp','image/jpeg','image/png']
)
on conflict (id) do nothing;

-- Storage RLS: lectura pública, escritura solo service-role
drop policy if exists "preventa_images_public_read" on storage.objects;
drop policy if exists "preventa_images_service_write" on storage.objects;

create policy "preventa_images_public_read"
  on storage.objects for select
  using (bucket_id = 'preventa-images');

create policy "preventa_images_service_write"
  on storage.objects for insert
  with check (bucket_id = 'preventa-images' and auth.role() = 'service_role');

create policy "preventa_images_service_delete"
  on storage.objects for delete
  using (bucket_id = 'preventa-images' and auth.role() = 'service_role');

-- ============================================================
-- VERIFICACIÓN — correr después de ejecutar el schema:
-- ============================================================
-- select table_name from information_schema.tables where table_name = 'preventa_catalogo';
-- select * from storage.buckets where id = 'preventa-images';
