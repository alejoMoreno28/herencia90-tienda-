---
name: herencia-90-crear-pedido
description: >
  Skill para crear el Excel de pedido de HERENCIA 90 con formato correcto y
  fotos de referencia automáticas. Lee un Excel fuente con las referencias,
  busca imágenes de cada camiseta en DuckDuckGo (foto del producto, no modelo),
  y genera un Excel listo para enviar al proveedor chino con precios, resumen
  y configuración del proveedor. Usar cuando el usuario tenga un pedido nuevo
  o quiera actualizar el Excel de pedido.
---

# HERENCIA 90 — Pedido al Proveedor

## Flujo para cada pedido

1. Editar el Excel fuente con las referencias del pedido
2. Correr el script
3. Se genera `PEDIDO HERENCIA 90 [fecha].xlsx` listo para enviar

```bash
npm run pedido
# o especificando otro archivo fuente:
node scripts/crear-pedido.mjs "mi-pedido-fuente.xlsx"
```

## Cambiar proveedor

Abrir `scripts/crear-pedido.mjs` y editar el bloque `PROVIDER` al inicio del archivo:

```js
const PROVIDER = {
  name:    'Helen',          // ← nombre del proveedor
  contact: '+86 XXX XXX',   // ← WhatsApp
  catalog: 'https://...',   // ← catálogo
  notes:   '',
};
```

No hay que tocar ningún otro archivo.

## Cambiar precios

En el mismo archivo, editar el objeto `PRICES`:

```js
const PRICES = {
  'FAN':    10,
  'RETRO':  15,
  // ...
};
```

## Estructura del Excel de entrada

El Excel fuente puede ser cualquier archivo con esta estructura de columnas:

| Col | Nombre | Ejemplo |
|-----|--------|---------|
| B   | Size   | L, M, XL |
| C   | Version / Type | RETRO, FAN, PLAYER |
| D   | Comment / Description | Brasil 2004 Home |
| E   | Quantity | 1 |

## Estructura del Excel generado

**Hoja CONFIG**: proveedor activo, precios por tipo, reglas de envío.

**Hoja ORDER**: 
- Columna A: foto de referencia (camiseta sola, sin modelo)
- Columnas B-H: size, tipo, descripción, cantidad, precio unit, subtotal, running total
- Columnas J-K: resumen del pedido (total unidades, subtotal, envío, total)

## Imágenes

- Se buscan en DuckDuckGo con query `"{descripción} football shirt jersey flat lay white background"`
- Se descargan, se recortan a 70×70px con fondo blanco
- Se cachean en `.pedido-imagenes-cache/` — no se vuelven a descargar en pedidos futuros
- Si una imagen no sirve: borrar su archivo del cache y volver a correr

## Script principal

`scripts/crear-pedido.mjs` — hace todo en un paso (sin archivos intermedios).

## Scripts de apoyo (legacy)

- `scripts/pedido-imagenes.mjs` — solo inserta imágenes en un Excel existente
- `scripts/limpiar-pedido.mjs` — solo limpia el formato del Excel (sin imágenes)
- Ambos quedan como referencia pero el flujo normal es `crear-pedido.mjs`
