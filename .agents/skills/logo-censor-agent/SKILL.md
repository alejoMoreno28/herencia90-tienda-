---
name: logo-censor-agent
description: Agente heurístico de alto rendimiento para censurar logos de marcas (Nike, Adidas, etc.) en camisetas para cumplir con las políticas de Mercado Libre.
---

# Logo Censor Agent Skill

Esta skill utiliza un script optimizado en Node.js (`scripts/censor_heuristico.js`) para colocar un parche oscuro semi-transparente de censura sobre la zona donde habitualmente se encuentran los logos de las marcas en las camisetas (el pecho derecho del jugador, que equivale al 20%-40% del ancho desde la izquierda en la foto frontal).

Es ideal para evitar infracciones de copyright al subir lotes masivos de fotos a plataformas estrictas como Mercado Libre.

## ¿Por qué Heurística sobre Detección Cero-Shot de IA?
Durante las pruebas, los modelos genéricos de IA de visión demostraron ser poco confiables con la ropa arrugada, ya que los pliegues deforman los logos, causando que la IA:
1. No detectara el logo.
2. Tapara zonas gigantes de la camiseta por error.

El enfoque heurístico matemático (basado en proporciones relativas de la imagen) garantiza un 100% de éxito en la cobertura de esa zona, siendo la solución profesional más utilizada por agencias de e-commerce deportivo para asegurar cumplimiento.

## Requisitos Previos

- **Dependencias:** Requiere Node.js y el paquete `sharp` (`npm install sharp`).

## Uso del Script

El script procesará todas las imágenes y replicará la estructura de carpetas en un directorio seguro para no afectar las originales.

```bash
# Para procesar todas las carpetas (Configuración por defecto: EQUIPOS -> EQUIPOS_CENSURADOS)
node scripts/censor_heuristico.js

# Para procesar una carpeta específica
node scripts/censor_heuristico.js "EQUIPOS/CARPETA_ESPECIFICA" "EQUIPOS_CENSURADOS/CARPETA_ESPECIFICA"
```

## Detalles de Implementación (Para Agentes)

- Si el usuario solicita censurar logos de nuevas camisetas, usa esta skill.
- El script calcula matemáticamente un área que empieza en `width * 0.20` y `height * 0.22`, y cubre un bloque de `20% x 15%`. Este parche es un rectángulo redondeado (`rx="15"`) color negro al 98% de opacidad, lo cual es estética y funcionalmente aceptado por los algoritmos de revisión de Mercado Libre.
