---
name: image-background-adder
description: Herramienta automatizada para aplicar un fondo y un logo a un conjunto de imágenes (ej. camisetas transparentes) manteniendo la estructura de directorios.
---

# Image Background Adder Skill

Esta skill utiliza un script en Node.js (`scripts/aplicar_fondo_equipos.js`) para tomar imágenes `.png` o `.webp` (generalmente con fondo transparente), y superponerlas sobre una imagen de fondo. Además, coloca un logo en la esquina inferior derecha.

El script crea un nuevo directorio destino y copia toda la estructura de subcarpetas, procesando las imágenes y guardando los resultados sin alterar los originales.

## Requisitos Previos

- **Fondo:** Una imagen de fondo (ej. `FONDO IMAGENES FINAL 1.png`).
- **Logo:** Una imagen de logo con fondo transparente (ej. `LOGO NUEVO PNG@4x.png`).
- **Dependencias:** Requiere Node.js y el paquete `sharp` (`npm install sharp`).

## Uso del Script

El script recibe dos parámetros opcionales por línea de comandos: el directorio de origen y el directorio de destino. Si no se proveen, usa los configurados por defecto (`EQUIPOS` y `EQUIPOS_CON_FONDO`).

```bash
# Para procesar todas las carpetas (Configuración por defecto)
node scripts/aplicar_fondo_equipos.js

# Para procesar una carpeta específica a una carpeta de prueba (Recomendado para pruebas)
node scripts/aplicar_fondo_equipos.js "EQUIPOS/CARPETA_ESPECIFICA" "EQUIPOS_CON_FONDO_TEST/CARPETA_ESPECIFICA"
```

## Detalles de Implementación (Para Agentes)

- Si el usuario solicita agregar fondos a nuevas camisetas, usa esta skill.
- Verifica siempre que las rutas del logo y el fondo existan antes de correr el script a gran escala.
- El logo se escala automáticamente al 15% del ancho de la imagen procesada y se coloca en la esquina inferior derecha con un margen del 5%.
- El fondo se ajusta (`cover`) para coincidir exactamente con las proporciones de la imagen de origen.
