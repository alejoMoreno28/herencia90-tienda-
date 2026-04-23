# 📖 Documentación: Sistema de Pre-Venta (Catálogo por Encargo)

Este documento explica en detalle cómo se diseñó, construyó y cómo se mantiene el ecosistema de "Pre-Venta" (camisetas bajo encargo) para **Herencia 90**.

---

## 1. El Problema que Solucionamos
Herencia 90 necesitaba una forma de ofrecer **miles de modelos históricos** (versiones retro, ediciones de jugador, manga larga) sin tener que comprarlos por adelantado ni quemar stock físico.

**La Solución:** Se creó un catálogo interactivo que sirve como galería de "referencias famosas disponibles para encargar". El cliente navega por fotos sacadas directamente de **Yupoo**, selecciona la que quiere, añade personalizaciones y tallas, y el sistema genera automáticamente una cotización en WhatsApp asumiendo un anticipo del 20% y ~15 días de importación.

---

## 2. Componentes del Sistema (Frontend)

La cara visible para el cliente recae en tres archivos principales dentro de la carpeta `web/`:

- **`preventa.html`**: Estructura general de la página. Contiene el _Hero_ (mostrando reglas claras: 20% anticipo, 15 días entrega), los filtros (décadas, tipos, equipos) y el esqueleto de la grilla y del Wizard de 4 pasos.
- **`css/preventa.css`**: Define los estilos premium, el **Lightbox Modal** (para visualizar fotos grandes en carrusel) y el diseño dinámico y atractivo de los pasos de cotización.
- **`js/preventa.js`**: El cerebro del frontend. Sus tareas son:
  1. Conectarse a **Supabase** y traer todos los productos de pre-venta que tengan `publicado: true`.
  2. Implementar búsqueda en tiempo real y filtrado interactivo.
  3. Controlar el visualizador (Lightbox). Al darle al botón "Pedir por Pre-Venta", el Lightbox se cierra y hace *autofill* (pre-llenado) sobre el Wizard.
  4. Agrupar la información de los **4 Pasos** de compra (Camiseta, Talla/Parches/Estampado, Datos del usuario, Cotización) y codificarla en un texto limpio de WhatsApp con la URL que redirecciona a tu celular.

---

## 3. Base de Datos (Supabase)

El catálogo de preventa *no* está estático en un archivo JSON local (a diferencia del catálogo principal). Vive en Supabase, lo que permite agregar miles de camisetas sin ralentizar tu repositorio de Vercel.

**Tabla principal**: `preventa_catalogo`
- `id` (UUID) y `slug` (Ej: `real-madrid-2006-07`)
- `equipo`, `temporada`, `tipo` (Retro, Player, Fan), `categoria` (Clubes, Selecciones)
- `imagenes` (JSONB): Un arreglo (Array) que contiene las variadas URLs de las fotos importadas de Yupoo.
- `publicado` (Boolean): Si está falso, la camiseta no carga en el HTML.
- `destacado` (Boolean): Si es verdadero, aparece primero en la grilla con una estrella.

---

## 4. ¿Cómo agregar nuevas camisetas? (Mantenimiento)

La gran ventaja logística es que la creación es **semiautomática**. Como proveedor tienes álbumes inmensos de _Yupoo_, pero bajar manualmente 10 fotos por cada camiseta y subirlas es ineficiente. Lo solucionamos con scripts automatizados.

### Método Oficial (Scripts de Importación)
Si quieres agregar las nuevas top 50 (o cualquier cantidad) al sistema, usamos el flujo del script de NodeJS:

1. Ingresas al archivo: `scripts/pv-batch-import.mjs`
2. Buscas el arreglo (array) llamado `JERSEYS` cerca de la línea 34.
3. Lo configuras agregando la URL directa de Yupoo y las etiquetas, ejemplo:
   ```javascript
   const JERSEYS = [
     {
       url: 'https://ejemplo.x.yupoo.com/albums/12345?uid=1', 
       equipo: 'Boca Juniors', 
       temporada: '2000', 
       tipo: 'retro', 
       categoria: 'clubes', 
       decada: '2000s', 
       destacado: true
     }
   ]
   ```
4. En tu terminal (habiendo instalado Node.js), ejecutas:
   ```bash
   node scripts/pv-batch-import.mjs
   ```
5. **¿Qué hace esto en milisegundos por ti?** El script va a la URL oculta de Yupoo, rompe el bloqueo de Scrapeo, extrae las fotos de más alta calidad, las procesa, las sube directamente al bucket "preventa" dentro del *Storage de Supabase*, y al final, inserta un registro nuevo en la tabla `preventa_catalogo`.
6. Refrescas la página `preventa.html` en tu navegador, y la camiseta ya es visible con toda su galería funcional para los usuarios.

### Método Manual (Si necesitas editar un texto o precio directamente)
1. Entras al panel de control online de **Supabase**.
2. Abres `Table Editor` > `preventa_catalogo`.
3. Allí puedes modificar cualquier nombre mal escrito, bajar algo marcándolo como `publicado: false`, o cambiar el precio base. Las ediciones se reflejan inmediatamente en la pestaña `/preventa` de la web.

---

### Metodo desde Yupoo raiz (descubrimiento semiautomatico)
Cuando solo tienes la URL raiz del proveedor, puedes descubrir albumes candidatos antes de importarlos.

1. Ejecuta:
   ```bash
   node scripts/pv-discover-provider-catalog.mjs https://huiliyuan.x.yupoo.com/ 20
   ```
2. El script recorre las paginas `.../albums/?page=N`, extrae los albumes visibles y los cruza contra las 70 referencias aprobadas.
3. El resultado queda en `docs/provider-catalog-matches-huiliyuan.json`.
4. Ese JSON trae:
   - `albums`: albumes detectados en el barrido
   - `matches`: hasta 3 candidatos por referencia, con puntaje
   - `matchedReferences`: total de referencias con coincidencias
5. Con ese archivo ya puedes tomar los albumes buenos y pasarlos al arreglo `JERSEYS` en `scripts/pv-batch-import.mjs` para correr la importacion real.

### Archivos de apoyo
- `scripts/data/preventa-approved-references.mjs`: semilla con las 70 referencias aprobadas
- `scripts/lib/yupoo-catalog.mjs`: parser del listado raiz de Yupoo
- `scripts/pv-discover-provider-catalog.mjs`: buscador/rankeador desde la URL raiz del proveedor

---

*Documento generado por IA - Ecosistema de Arquitectura Herencia 90 - 2026*
