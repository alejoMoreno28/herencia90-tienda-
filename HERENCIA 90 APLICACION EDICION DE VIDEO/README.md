# HERENCIA 90 — Aplicación de Edición de Video

Editor de video tipo CapCut, de escritorio y de uso interno, para producir
contenido de la marca **Herencia 90** (camisetas de fútbol retro) con un flujo
**automático** (un agente edita solo) y un flujo **manual** (timeline completo).

> Estado: **fase de especificación**. Todavía no hay código.
> Ver `docs/ESPECIFICACION.md` para el alcance y `docs/DECISIONES.md` para
> las preguntas abiertas que hay que responder antes de programar.

## Estructura prevista

```
HERENCIA 90 APLICACION EDICION DE VIDEO/
├── docs/                 Especificación, decisiones técnicas, investigación
├── assets/referencias/   Ejemplos de voz, subtítulos, ganchos y guiones
│                         (videos de referencia que Alejo comparta)
└── (app/ y engine/ se crean cuando se cierre la especificación)
```

## Los dos modos

| Modo | Qué hace |
|---|---|
| **Automático** | Suelto los clips en crudo → el agente conoce la marca, elige la camiseta, escribe el guión con gancho, corta lo bueno, sube voz en off, pone subtítulos dinámicos, música y transiciones → sale un MP4 9:16 listo para TikTok. |
| **Manual** | Timeline multipista tipo CapCut para retocar cualquier cosa que el agente haya decidido: cortes, texto, tiempos, volumen, efectos. |

Ningún paso automático es una caja negra: todo lo que decide el agente queda
como capas editables en el timeline.
