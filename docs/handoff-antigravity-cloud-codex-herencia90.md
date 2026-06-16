# HERENCIA90 Agent Handoff: Import Studio, Preventa y Plataforma

Ultima actualizacion: 2026-06-16

Archivo pensado para pegarlo en Antigravity, Claude/Cloud, Codex o cualquier agente nuevo que tome el proyecto.

Repositorio local:

```text
C:\Users\PC\Desktop\HERENCIA90
```

Sitio publico:

```text
https://www.herencia90.shop
https://www.herencia90.shop/preventa
```

Commit base verificado al crear este handoff:

```text
975fd2d5f4e982cb5744e4c277155d7b27c8a675
975fd2d feat: add local import studio app
```

Estado publico verificado el 2026-06-16:

```text
curl.exe -I https://www.herencia90.shop/preventa
HTTP/1.1 200 OK
Server: Vercel
```

## Prompt principal para un agente nuevo

Copia y pega este bloque completo al iniciar una nueva sesion con Antigravity, Claude/Cloud, Codex o un agente de desarrollo:

````text
Eres un agente de desarrollo trabajando en HERENCIA90, una tienda ecommerce de camisetas de futbol retro y de temporada.

Trabaja en el repo local:

C:\Users\PC\Desktop\HERENCIA90

Objetivo general del proyecto:

Convertir HERENCIA90 en una tienda profesional, escalable y facil de operar, con:
- catalogo amplio de camisetas retro y actuales;
- seccion de bajo pedido/pre orden visualmente ordenada;
- importacion rapida desde proveedores como Yupoo;
- fotos consistentes: frente, espalda y detalles;
- carrito con tallas y adicionales como parches, dorsales y nombres;
- pasarela de pagos futura;
- operaciones internas para pedidos, inventario, proveedores y analitica.

Contexto muy importante:

El usuario esta combinando trabajo entre Codex, Antigravity y posiblemente Claude/Cloud porque se le acaba el uso de una herramienta. Debes asumir que otros agentes pueden estar trabajando partes distintas. Antes de editar, inspecciona el repo, respeta cambios existentes y no reviertas trabajo de otros.

Reglas duras del repo:

1. Nunca uses staging amplio:
   - no `git add .`
   - no `git add -A`
   - no `git add --`
   - no acciones de "stage all changes"

2. Stagea solo archivos exactos:
   - ejemplo: `git add -- docs/handoff-antigravity-cloud-codex-herencia90.md`
   - ejemplo: `git add -- scripts/import-studio/app-server.mjs tests/import-studio-yupoo.test.mjs`

3. Nunca stagees:
   - `.codex_tmp/`
   - `.codex-scratch/`
   - `.codex-temp/`
   - `.codex-remote-attachments/`
   - `.pedido-imagenes-cache/`
   - `EQUIPOS_CENSURADOS/`
   - `EQUIPOS_CON_FONDO/`
   - videos o media cruda `.mp4`, `.mov`, `.m4v`, `.avi`, `.webm`
   - batches de proveedor o outputs generados

4. No hagas bulk replace destructivo en Supabase ni en JSON. Primero crea backup, dry-run o ruta nueva.

5. Para imagenes de preventa/bajo pedido:
   - la primera imagen debe ser la camiseta de frente;
   - la segunda debe ser espalda solo si realmente es espalda completa;
   - luego van detalles: logos, parches, tela, cuello, acabados, etiquetas;
   - conserva detalles utiles aunque tengan fondo si son close-ups necesarios;
   - no elimines imagenes originales del proveedor sin aprobacion;
   - no reemplaces en masa assets publicos sin aprobacion visual.

6. El flujo correcto para nuevas referencias es:
   - audit first;
   - dry-run;
   - revision visual;
   - aprobacion del usuario;
   - importar como borrador;
   - verificar;
   - publicar.

Estado actual del proyecto:

1. Ya existe una app local llamada HERENCIA90 Import Studio.
2. La app vive en:
   - `scripts/import-studio/`
3. La documentacion de uso vive en:
   - `docs/import-studio-local-app.md`
4. El plan amplio de plataforma vive en:
   - `docs/superpowers/plans/2026-06-15-herencia90-platform-phases-2-6-plan.md`
5. El sitio publico esta en Vercel:
   - `https://www.herencia90.shop/preventa`
6. El ultimo commit relevante es:
   - `975fd2d feat: add local import studio app`

Como arrancar la app local:

```powershell
cd C:\Users\PC\Desktop\HERENCIA90
npm run import-studio:app
```

Abrir:

```text
http://127.0.0.1:4892
```

Si el puerto 4892 esta ocupado:

```powershell
npm run import-studio:app -- --port 4893
```

Variables necesarias en `.env` para importacion real:

```text
SUPABASE_URL=...
SUPABASE_SERVICE_KEY=...
```

Opcional para BiRefNet si se quiere definir manualmente el Python:

```text
IMPORT_STUDIO_PYTHON=C:\ruta\a\python.exe
```

Por defecto la app busca BiRefNet en:

```text
.codex_tmp\bg-local\venv\Scripts\python.exe
```

Flujo de uso de Import Studio:

1. Pegar uno o varios links de Yupoo, uno por linea.
2. Presionar `Analizar referencias`.
3. Revisar o corregir metadata:
   - equipo;
   - temporada;
   - tipo;
   - categoria;
   - slug;
   - precio;
   - decada;
   - descripcion.
4. Revisar imagenes.
5. Marcar roles:
   - Frente;
   - Espalda;
   - Detalle;
   - Rechazar.
6. Ejecutar `Dry-run`.
7. Si esta bien, escribir `IMPORTAR` y usar `Importar borrador`.
8. Revisar en la web/admin.
9. Para publicar directamente, escribir `PUBLICAR` y usar `Publicar`.

Importante:

- `Dry-run` no sube nada.
- `Importar borrador` sube imagenes y hace upsert con `publicado:false`.
- `Publicar` sube imagenes y hace upsert con `publicado:true`.
- La app usa el bucket `preventa-images`.
- La ruta de storage es:
  `preventa-import/import-studio/YYYYMMDD/<job>/<slug>/...`
- La tabla usada es:
  `preventa_catalogo`.

Pruebas ya ejecutadas cuando se creo la app:

```powershell
node --check scripts\import-studio\app-server.mjs
```

```powershell
node --test tests\import-studio-intake.test.mjs tests\import-studio-dashboard.test.mjs tests\import-studio-manifest.test.mjs tests\import-studio-dry-run.test.mjs tests\import-studio-cli.test.mjs tests\import-studio-yupoo.test.mjs tests\import-studio-preventa-row.test.mjs
```

Resultado esperado:

```text
13 tests pass
```

```powershell
node --test tests\preventa-curate-local.test.mjs tests\preventa-curation-import.test.mjs
```

Resultado esperado:

```text
6 tests pass
```

```powershell
node tests\site-seo.test.mjs
```

Resultado esperado:

```text
PASS
```

Smoke test real usado con este link Yupoo:

```text
https://huiliyuan.x.yupoo.com/albums/193589600?uid=1&isSubCate=false&referrercate=
```

Resultado esperado:

```json
{
  "references": 1,
  "images": 10,
  "loadedImages": 10,
  "roles": {
    "front": 1,
    "back": 1,
    "detail": 8
  }
}
```

No se subieron productos falsos a Supabase durante ese smoke test. Se probo dry-run y UI para no contaminar produccion.

Archivos principales de Import Studio:

- `scripts/import-studio/app-server.mjs`
  - servidor local HTTP;
  - puerto default `4892`;
  - sirve la UI;
  - API local;
  - carga `.env`;
  - valida `IMPORTAR` y `PUBLICAR`.

- `scripts/import-studio/app/index.html`
  - interfaz visual local.

- `scripts/import-studio/app/styles.css`
  - estilos HERENCIA90.

- `scripts/import-studio/app/app.js`
  - logica frontend de la app;
  - crea jobs;
  - pinta imagenes;
  - guarda roles;
  - llama dry-run/import.

- `scripts/import-studio/lib/yupoo-album.mjs`
  - detecta albums Yupoo;
  - extrae titulo, album id, proveedor;
  - usa `data-src` y `data-origin-src`;
  - filtra logos/assets;
  - devuelve candidatas reales.

- `scripts/import-studio/lib/image-rank.mjs`
  - usa `sharp`;
  - puntua fotos completas segun fondo claro y distribucion visual;
  - promueve posibles frente/espalda primero;
  - deja detalles despues.

- `scripts/import-studio/lib/preventa-row.mjs`
  - infiere metadata;
  - genera slug;
  - arma row para `preventa_catalogo`;
  - separa `imagenes`, `imagenes_detalle`, `imagenes_originales`;
  - calcula `photo_count_gallery`;
  - setea `publicado`.

- `scripts/import-studio/lib/supabase-dry-run.mjs`
  - genera dry-run de uploads/upserts;
  - no sube nada.

- `scripts/import-studio/lib/supabase-import.mjs`
  - descarga imagenes aprobadas;
  - opcionalmente quita fondo con BiRefNet;
  - crea WebP card/master;
  - sube a Supabase Storage;
  - upsert en `preventa_catalogo`;
  - escribe `import/supabase-import-report.json`.

- `scripts/import-studio/lib/provider-extract.mjs`
  - enruta extractores de proveedor;
  - usa extractor especifico de Yupoo para URLs Yupoo.

- `scripts/import-studio/import-studio.mjs`
  - CLI V1 anterior para prepare/dry-run;
  - se mantiene como utilidad complementaria.

Endpoints locales de la app:

- `GET /api/config`
- `GET /api/image-proxy?url=...&ref=...`
- `POST /api/jobs`
- `GET /api/jobs/:jobId`
- `POST /api/jobs/:jobId/dry-run`
- `POST /api/jobs/:jobId/import`

Carpetas generadas por jobs:

```text
.codex_tmp\import-studio\jobs\<job-id>
```

Archivos utiles dentro de un job:

```text
job.json
approval-manifest.json
dry-run\supabase-dry-run.json
import\supabase-import-report.json
```

Nunca stagear `.codex_tmp`.

Integracion con la web publica:

El archivo `web/js/preventa.js` fue modificado para que `/preventa` cargue primero desde Supabase:

- tabla: `preventa_catalogo`;
- filtro: `publicado = true`;
- campos importantes:
  - `imagenes`;
  - `imagenes_detalle`;
  - `imagenes_originales`;
  - `photo_count_gallery`;
  - `gallery_status`;
  - `precio_aprox`;
  - `tags`.

La web conserva soporte para galerias completas:

- `imagenes` = primarias curadas;
- `imagenes_detalle` = detalles despues de frente/espalda;
- `imagenes_originales` = respaldo/originales proveedor.

Regla visual aprobada por el usuario:

- primera imagen: frente;
- segunda imagen: espalda, solo si es espalda real;
- luego detalles utiles;
- no repetir innecesariamente frente/espalda al final;
- no quitar detalles de logos, parches, acabados o cuello si aportan valor;
- si una foto de detalle ocupa toda la imagen y no tiene pared/fondo que moleste, puede quedar original.

Contexto de curacion masiva anterior:

Antes de Import Studio ya existia un pipeline local para limpiar imagenes de preventa:

- `scripts/preventa-birefnet-remove-bg.py`
- `scripts/preventa-curate-local.mjs`
- `tests/preventa-curate-local.test.mjs`

Modelo usado:

```text
ZhengPeng7/BiRefNet
```

Razon:

- funciona local;
- muy fuerte quitando fondos;
- licencia MIT.

No se uso BRIA RMBG-2.0 como base local porque sus pesos en Hugging Face son no comerciales sin acuerdo.

Resultados locales anteriores:

```text
C:\Users\PC\Desktop\HERENCIA90\.codex_tmp\preventa-curation-all-main
```

Reporte:

```text
C:\Users\PC\Desktop\HERENCIA90\.codex_tmp\preventa-curation-all-main\report.json
```

Revision:

```text
C:\Users\PC\Desktop\HERENCIA90\.codex_tmp\preventa-curation-all-main\review
```

Warnings:

```text
C:\Users\PC\Desktop\HERENCIA90\.codex_tmp\preventa-curation-all-main\review\warnings
```

Resultado:

- 347 imagenes procesadas;
- 347 PNG sin fondo;
- 694 WebP cuadrados;
- master 1200;
- card 640;
- 314 pasaron automatico;
- 33 requerian revision visual.

Los 33 warnings eran principalmente detalles, parches, logos o close-ups. No asumir automaticamente que son malos.

Comandos utiles del pipeline anterior:

```powershell
node --test tests\preventa-curate-local.test.mjs
```

Regenerar reporte sin volver a correr IA:

```powershell
node scripts/preventa-curate-local.mjs --all --all-images --out-dir .codex_tmp\preventa-curation-all-main --python .codex_tmp\bg-local\venv\Scripts\python.exe --device cpu --size 1024 --rows-per-sheet 18
```

Forzar reprocesamiento:

```powershell
node scripts/preventa-curate-local.mjs --all --all-images --out-dir .codex_tmp\preventa-curation-all-main --python .codex_tmp\bg-local\venv\Scripts\python.exe --device cpu --size 1024 --rows-per-sheet 18 --force
```

No usar `--force` salvo que el usuario lo pida o sea necesario.

Estado de commits relevantes:

```text
975fd2d feat: add local import studio app
504ab86 feat: merge preorder import studio v1
648097a docs: document import studio workflow
ef481f8 feat: add preorder import studio v1
d639a73 docs: plan herencia90 platform phases
58e497e feat: curate preorder gallery ordering
5cf7c5f feat: add local preorder image curation pipeline
```

Nota: si alguno no aparece en `git log`, inspecciona historial remoto/local antes de asumir estado.

Pendientes inmediatos recomendados:

1. Usar Import Studio con 5 referencias reales nuevas del proveedor.
2. Revisar manualmente frente/espalda/detalles.
3. Ejecutar dry-run.
4. Importar como borrador, no publicar directo.
5. Revisar que las imagenes quedaron correctas en Supabase.
6. Revisar que `/preventa` las puede leer si se publican.
7. Solo despues publicar una o varias referencias reales.

No metas todo el catalogo nuevo de golpe. Primero prueba 5 referencias, luego 20, luego batches mas grandes.

Pendientes tecnicos razonables para la siguiente fase:

1. Mejorar deteccion automatica de frente vs espalda.
2. Agregar vista comparativa antes/despues para imagenes con fondo removido.
3. Agregar validacion de slugs duplicados antes del import.
4. Agregar boton de "Importar borrador y abrir URL de revision".
5. Agregar log mas claro cuando Supabase rechaza un upsert.
6. Agregar busqueda de referencias importadas.
7. Agregar modo batch con progreso por referencia.
8. Guardar presets de proveedor.
9. Preparar un admin cloud seguro cuando la app local ya este probada.

Fases futuras de plataforma:

Fase 3: Catalogo publico escalable
- buscador;
- filtros por equipo, temporada, tipo, disponibilidad;
- colecciones;
- index unificado stock + bajo pedido;
- SEO.

Fase 4: Carrito y adicionales
- talla;
- parches;
- dorsal;
- nombre personalizado;
- totales;
- WhatsApp fallback.

Fase 5: Pagos y pedidos
- decidir gateway: Wompi, Mercado Pago, PayU, Stripe o transferencia manual;
- crear orden;
- guardar items y adicionales;
- estados de pago;
- webhooks si aplica;
- no confiar en estado de pago solo desde frontend.

Fase 6: Operaciones y crecimiento
- analitica de catalogo;
- productos con fotos faltantes;
- referencias con baja calidad;
- backlog de proveedores;
- demanda por equipos;
- metricas de pedidos.

Archivos de plan futuro:

```text
docs/superpowers/plans/2026-06-15-herencia90-platform-phases-2-6-plan.md
docs/superpowers/specs/2026-06-15-herencia90-platform-phase-1-design.md
```

Como dividir trabajo entre agentes:

Codex local:
- tocar archivos del repo;
- correr scripts locales;
- manejar PowerShell;
- probar app local;
- inspeccionar outputs;
- hacer commits exactos;
- desplegar si el usuario aprueba.

Antigravity:
- dividir fases grandes;
- ejecutar workflows con subagentes;
- QA visual/E2E;
- mejorar UI;
- implementar features largas por tareas.

Claude/Cloud:
- revisar arquitectura;
- generar planes y specs;
- analizar codigo;
- proponer mejoras;
- preparar prompts o documentos;
- revisar seguridad y edge cases.

Si hay varios agentes trabajando:

1. Antes de editar:
   ```powershell
   git status --short
   git log -5 --oneline --decorate
   ```

2. No reviertas cambios no tuyos.

3. Si hay archivos modificados por otro agente en tu area, lee primero y adapta.

4. Haz commits pequenos por unidad.

5. Nunca stagees carpetas generadas.

Comandos de verificacion base:

```powershell
node --check scripts\import-studio\app-server.mjs
```

```powershell
node --test tests\import-studio-intake.test.mjs tests\import-studio-dashboard.test.mjs tests\import-studio-manifest.test.mjs tests\import-studio-dry-run.test.mjs tests\import-studio-cli.test.mjs tests\import-studio-yupoo.test.mjs tests\import-studio-preventa-row.test.mjs
```

```powershell
node --test tests\preventa-curate-local.test.mjs tests\preventa-curation-import.test.mjs
```

```powershell
node tests\site-seo.test.mjs
```

Comando para probar sitio publico:

```powershell
curl.exe -I https://www.herencia90.shop/preventa
```

Comando para correr app:

```powershell
npm run import-studio:app
```

Comando para correr app en otro puerto:

```powershell
npm run import-studio:app -- --port 4893
```

Si se necesita hacer deploy:

1. Confirmar con el usuario si afecta produccion.
2. Correr pruebas.
3. Stagear solo archivos exactos.
4. Commit.
5. Push.
6. Deploy Vercel.
7. Verificar URL publica.

Checklist antes de importar referencias reales:

- [ ] `.env` tiene `SUPABASE_URL`.
- [ ] `.env` tiene `SUPABASE_SERVICE_KEY`.
- [ ] El usuario aprueba probar con referencias reales.
- [ ] Se empieza por 5 referencias.
- [ ] Se revisa frente/espalda/detalles.
- [ ] Dry-run sin warnings criticos.
- [ ] Importar primero como borrador.
- [ ] Verificar reporte `supabase-import-report.json`.
- [ ] Verificar Storage en Supabase.
- [ ] Verificar row en `preventa_catalogo`.
- [ ] Publicar solo cuando el usuario apruebe.

Cosas que NO se deben hacer:

- No borrar imagenes antiguas de Supabase.
- No sobreescribir rutas existentes sin backup.
- No importar cientos de referencias sin prueba pequena.
- No publicar productos falsos.
- No quitar fotos de detalle valiosas.
- No asumir que una imagen con fondo siempre debe ser limpiada: en close-ups puede no aplicar.
- No asumir que la metadata china/inglesa queda perfecta: revisar equipo, temporada y tipo.
- No subir `.env`.
- No exponer service keys.

Estado actual esperado de `git status --short`:

Puede haber archivos untracked no relacionados, por ejemplo:

```text
.agents/skills/herencia90-social/
.codex-remote-attachments/
docs/asistente-social-herencia90.md
docs/gpt-guionista-herencia90.md
scripts/remove-prod-36.js
scripts/test-match.js
web/img/guia-tallas-herencia90-horizontal.png
web/img/guia-tallas-herencia90-horizontal.svg
web/img/guia-tallas-herencia90-vertical.svg
```

No los borres, no los stagees y no los reviertas salvo instruccion explicita del usuario.

Mensaje final esperado para el usuario tras trabajar:

Explica:
- que archivos tocaste;
- que pruebas corriste;
- que no tocaste Supabase si solo fue dry-run;
- si importaste como borrador o publicaste;
- URL local o publica;
- commit/push/deploy si aplica.

Tono:

El usuario quiere avance practico, claro y profesional. Habla en espanol, directo, sin tecnicismos innecesarios. Si algo puede afectar produccion, dilo y pide aprobacion.
````

## Mapa rapido de carpetas

```text
C:\Users\PC\Desktop\HERENCIA90
```

Raiz del repo.

```text
scripts\import-studio
```

App local HERENCIA90 Import Studio.

```text
scripts\import-studio\app
```

Frontend local de la app.

```text
scripts\import-studio\lib
```

Logica de extraccion, ranking, metadata, dry-run e importacion Supabase.

```text
docs\import-studio-local-app.md
```

Manual corto para usar la app local.

```text
docs\import-studio-v1.md
```

Documentacion de la CLI V1 anterior.

```text
docs\handoff-antigravity-cloud-codex-herencia90.md
```

Este archivo de traspaso.

```text
docs\superpowers\plans\2026-06-15-herencia90-platform-phases-2-6-plan.md
```

Plan profesional de fases 2 a 6.

```text
web\js\preventa.js
```

Logica publica de la pagina `/preventa`.

```text
web\preventa-catalogo-list.json
web\preventa-catalogo.json
```

Catalogos estaticos historicos/fallback.

```text
.codex_tmp\import-studio\jobs
```

Jobs locales generados por la app. No versionar.

```text
.codex_tmp\preventa-curation-all-main
```

Outputs locales anteriores de curacion masiva. No versionar.

## Resumen ejecutivo

HERENCIA90 ya tiene la base para operar un flujo profesional de bajo pedido:

- el sitio publico esta desplegado;
- Preventa carga desde Supabase primero;
- existe una app local para importar desde Yupoo;
- la app ordena frente/espalda/detalles;
- puede quitar fondo en primarias con BiRefNet;
- conserva detalles;
- genera dry-run;
- puede importar borrador o publicar;
- hay tests de parsing, UI logica, dry-run, Yupoo y row Supabase.

La siguiente decision practica es probar con 5 referencias reales nuevas, importarlas como borrador y revisar el resultado antes de escalar.

## Comandos listos

Arrancar app:

```powershell
cd C:\Users\PC\Desktop\HERENCIA90
npm run import-studio:app
```

Abrir:

```text
http://127.0.0.1:4892
```

Tests Import Studio:

```powershell
node --test tests\import-studio-intake.test.mjs tests\import-studio-dashboard.test.mjs tests\import-studio-manifest.test.mjs tests\import-studio-dry-run.test.mjs tests\import-studio-cli.test.mjs tests\import-studio-yupoo.test.mjs tests\import-studio-preventa-row.test.mjs
```

Tests imagenes preventa:

```powershell
node --test tests\preventa-curate-local.test.mjs tests\preventa-curation-import.test.mjs
```

SEO/site:

```powershell
node tests\site-seo.test.mjs
```

Verificar publico:

```powershell
curl.exe -I https://www.herencia90.shop/preventa
```

Git seguro:

```powershell
git status --short
git add -- ruta\exacta\archivo
git commit -m "feat: mensaje claro"
git push origin main
```

Nunca:

```powershell
git add .
git add -A
git add --
```

## Nota para futuras sesiones

Si una futura sesion tiene poco contexto, empieza leyendo estos archivos en este orden:

1. `docs/handoff-antigravity-cloud-codex-herencia90.md`
2. `docs/import-studio-local-app.md`
3. `docs/superpowers/plans/2026-06-15-herencia90-platform-phases-2-6-plan.md`
4. `package.json`
5. `scripts/import-studio/app-server.mjs`
6. `scripts/import-studio/lib/supabase-import.mjs`
7. `scripts/import-studio/lib/preventa-row.mjs`
8. `web/js/preventa.js`

Con eso se entiende el estado real, el objetivo, los riesgos y la ruta de trabajo.
