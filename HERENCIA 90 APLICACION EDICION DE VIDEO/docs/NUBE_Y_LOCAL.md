# Trabajar en la nube y en tu PC al mismo tiempo

## Por qué hacen falta los dos

Son dos Claude distintos, cada uno con lo que el otro no tiene.

| | Claude en la nube (este) | Claude en tu PC |
|---|---|---|
| Ve el repositorio | Sí | Sí |
| Ve tus videos en crudo del escritorio | **No** | Sí |
| Usa tu GPU NVIDIA | No | Sí |
| Genera la voz con edge-tts | No (bloqueado aquí) | Sí |
| Renderiza un video tuyo de verdad | No | Sí |
| Investiga en internet, lee y escribe código | Sí, sin cansarse | Sí |
| Sigue trabajando con el PC apagado | Sí | No |

**En corto:** la nube sirve para *construir* la herramienta. Tu PC es el único
sitio donde la herramienta puede *usarse*, porque ahí están tus videos, tu GPU
y tus fuentes.

## El puente es Git

No hay que sincronizar nada a mano. Los dos Claude trabajan sobre la misma rama:

```
Claude nube  --- git push --->  GitHub  --- git pull --->  Claude en tu PC
```

Rama de trabajo: **`claude/stoic-maxwell-83tdti`**

## Cómo dejar listo el Claude de tu PC

### 1. Node.js

Descárgalo de [nodejs.org](https://nodejs.org/) (versión LTS) e instálalo.

### 2. Claude Code

Abre PowerShell y ejecuta:

```powershell
npm install -g @anthropic-ai/claude-code
```

> También existe la **aplicación de escritorio de Claude** para Windows, que
> permite abrir sesiones locales y en la nube desde la misma ventana. Si
> prefieres no usar la terminal, esa es la vía.

### 3. Traer el proyecto

```powershell
cd "C:\Users\PC\Desktop"
git clone https://github.com/alejoMoreno28/herencia90-tienda-.git
cd herencia90-tienda-
git checkout claude/stoic-maxwell-83tdti
```

### 4. Instalar el motor

```powershell
cd "HERENCIA 90 APLICACION EDICION DE VIDEO"
.\INSTALAR.bat
```

### 5. Arrancar Claude ahí

```powershell
cd ..
claude
```

La skill `editor-herencia90` se carga sola: está en
`.claude/skills/editor-herencia90/SKILL.md`, dentro del repositorio.

## Cómo repartir el trabajo

**A Claude en la nube pídele:** investigar herramientas, escribir y corregir
código, documentar, analizar videos que le subas, planear.

**A Claude en tu PC pídele:** *"edita el video de la camiseta de Brasil"*.
Ahí tiene tus clips, tu GPU y tus voces.

## Las dos reglas para que no choquen

**1. Antes de trabajar en tu PC, trae lo último:**

```powershell
git pull origin claude/stoic-maxwell-83tdti
```

**2. Cuando termines en tu PC, súbelo:**

```powershell
git add -A
git commit -m "lo que hiciste"
git push origin claude/stoic-maxwell-83tdti
```

Si los dos tocan el mismo archivo a la vez, Git avisa con un conflicto y
cualquiera de los dos Claude lo resuelve. No se pierde nada.

> Tus videos **no** se suben a GitHub: `.gitignore` excluye los `.mp4`, `.wav`
> y `.mp3`, y las carpetas `trabajo/` y `salida/`. Lo que viaja es el código,
> la configuración y los guiones — que es lo liviano.
