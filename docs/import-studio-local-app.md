# HERENCIA90 Import Studio Local

Aplicacion local para importar nuevas referencias de bajo pedido desde links de Yupoo.

La herramienta corre en tu PC, abre una interfaz en el navegador y conecta con Supabase solo cuando confirmas la importacion.

## Arrancar

```powershell
npm run import-studio:app
```

Abre:

```text
http://127.0.0.1:4892
```

Si ese puerto esta ocupado:

```powershell
npm run import-studio:app -- --port 4893
```

## Requisitos

El archivo `.env` debe tener:

```text
SUPABASE_URL=...
SUPABASE_SERVICE_KEY=...
```

Para quitar fondo en frente/espalda, la app usa por defecto:

```text
.codex_tmp\bg-local\venv\Scripts\python.exe
```

Tambien puedes definir:

```text
IMPORT_STUDIO_PYTHON=C:\ruta\a\python.exe
```

## Flujo recomendado

1. Pega uno o varios links de albumes Yupoo, uno por linea.
2. Pulsa `Analizar referencias`.
3. Revisa equipo, temporada, tipo, categoria, slug, precio y descripcion.
4. Marca cada foto como `Frente`, `Espalda`, `Detalle` o `Rechazar`.
5. Pulsa `Dry-run`.
6. Si todo esta bien, escribe `IMPORTAR` y pulsa `Importar borrador`.
7. Revisa la referencia en el admin/web.
8. Cuando quieras publicarla directamente desde la app, escribe `PUBLICAR` y pulsa `Publicar`.

## Seguridad

- El dry-run no sube nada.
- `Importar borrador` sube imagenes y hace upsert con `publicado:false`.
- `Publicar` requiere escribir `PUBLICAR` y sube con `publicado:true`.
- Las imagenes van al bucket `preventa-images`.
- La ruta usada es `preventa-import/import-studio/YYYYMMDD/<job>/<slug>/...`.
- La tabla usada es `preventa_catalogo`.

## Que automatiza

- Extrae fotos grandes reales de Yupoo.
- Evita logos y assets de Yupoo.
- Usa proxy local para que las imagenes carguen aunque Yupoo bloquee hotlink.
- Detecta fotos completas con una heuristica visual y las pone primero.
- Preserva close-ups como detalles.
- Genera `approval-manifest.json`.
- Genera dry-run de uploads y upserts.
- Optimiza imagenes en WebP card/master.
- Opcionalmente quita fondo en frente/espalda con BiRefNet local.

## Archivos generados

Los jobs quedan en:

```text
.codex_tmp\import-studio\jobs\<job-id>
```

Archivos utiles:

```text
job.json
approval-manifest.json
dry-run\supabase-dry-run.json
import\supabase-import-report.json
```

No stages ni subas `.codex_tmp` a Git.
