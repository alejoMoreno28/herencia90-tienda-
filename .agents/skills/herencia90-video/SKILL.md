---
name: herencia90-video
description: Use when editing, producing, or scripting a TikTok/Reels video for HERENCIA90 from raw jersey footage - identifying the shirt, researching current news about the club, writing the selling script and hook, generating the Valentino or Nandez narrator voiceover via Fish Audio, building karaoke subtitles, and cutting the final vertical video with ffmpeg. Trigger on raw clips of football shirts, "hazme el video", "edita este clip", "guion para TikTok", or any HERENCIA90 video production request.
risk: low
source: local
date_added: "2026-09-20"
---

# HERENCIA 90 - Produccion de video

Convierte clips crudos de camisetas en videos verticales listos para TikTok e
Instagram: voz de narrador, subtitulos karaoke y cortes al ritmo del guion.

Esta skill **ejecuta**. Para voz de marca, ganchos y calendario usa
`herencia90-social`. Para verificar que camiseta es usa
`identify-football-jerseys`. No repitas aqui lo que esas dos ya definen.

## Las tres reglas que el dueno ya corrigio

Son las unicas tres cosas por las que ha devuelto un video. Fallar una
obliga a re-renderizar.

1. **Ninguna imagen al reves. Ninguna.** La prenda se gira sobre la mesa
   mientras se graba: la orientacion cambia dentro del MISMO clip. Audita
   todas las tomas (paso 8a), no solo el gancho.
2. **Gancho bonito.** Camiseta de frente, completa, cuello dentro del cuadro,
   sin manos, bien tendida. Si no hay plano limpio, abre con movimiento (la
   prenda sacudiendose hacia la camara).
3. **Guion con persona famosa + numero concreto.** "Neymar supero a Pele.
   Setenta y nueve goles." Si, "primera vez que el Jumpman aparece en una
   seleccion", no. El dato de diseno va despues del gancho, nunca como gancho.

## Las dos voces

El usuario usa **Nandez** y **Valentino**, las dos. El elige cual en cada
video. Si no lo dice, **preguntale**; no asumas.

| Voz | palabras/seg | Guion en 14s | Caracter |
|---|---|---|---|
| **Nandez** | 3.38 | **41 palabras** | Mas agil, cabe el CTA completo |
| **Valentino** | 2.14 - 2.28 | **31 palabras** | Mas grave y lento, mas narrador |

**El guion se escribe segun la voz, no al reves.** Este es el error mas facil
de cometer: con 41 palabras Valentino se va a 18 segundos y el video se pasa.

```powershell
.\scripts\voz-fishaudio.ps1 -Guion guion.txt -Salida voz\nandez.mp3 -Voz nandez
.\scripts\voz-fishaudio.ps1 -Guion guion.txt -Salida voz\valentino.mp3 -Voz valentino-calm
```

La API key vive en `FISH_AUDIO_API_KEY` del usuario. **Nunca se la pidas por
chat ni la escribas en ningun archivo.** El script la lee solo, incluso del
entorno de usuario si la consola es vieja.

Todo lo de voces, limites y alternativas: `references/voces.md`.

## Especificaciones fijas

Medidas de los dos videos del usuario que si funcionaron en TikTok
(Brasil 2004 Ronaldo 13.05s, Argentina 2026 14.68s). No las cambies sin que
te lo pida.

| Cosa | Valor |
|---|---|
| Formato | 1080x1920, 30 fps, H.264, yuv420p |
| Duracion | **13-15 segundos** |
| Cortes | cada 0.9-1.8s, en limite de palabra |
| Audio | solo voz |
| **Musica** | **NUNCA.** La pone el usuario en TikTok al final |
| Subtitulos | quemados, karaoke, Arial Black 88, palabra activa amarilla |

## Flujo

### 1. Identificar la camiseta

```powershell
.\scripts\analizar-clips.ps1 -Carpeta "ruta\a\clips" -Salida "temp"
```

Abre las hojas de contacto y **mira**. Aplica `identify-football-jerseys`:
dos confirmaciones independientes antes de afirmar temporada. Anota tambien:

- **que tramos estan boca abajo** → `girar: 180` en el plan
- **que tramos no sirven** (color plano, fuera de foco)
- **el detalle de diseno con historia** (patron, homenaje) → alimenta el gancho

### 2. Buscar la noticia

Busca en internet **siempre**. Titulo, tabla, racha, fichaje, record. Un
gancho con noticia fresca rinde mas que uno generico. Si no hay nada, cae a
nostalgia o producto. No inventes resultados.

### 3. Escribir el guion

Pregunta la voz primero, porque fija el largo (31 o 41 palabras).

Da **3-5 ganchos** antes del guion final. Estructura: gancho (2-3s), por que
importa (4-6s), disponibilidad (2-3s), CTA (2-3s). Formulas literales en
`references/guiones.md`.

Escribe los numeros en letras ("veintidos", no "22"): el TTS y whisper los
tratan distinto y se desalinean los subtitulos.

### 4. Generar la voz

Si ya hay un mp3 en `proyectos/<x>/voz/`, usalo y no generes nada.
Si no, Fish Audio con la voz que el usuario pidio (arriba).

### 5. Subtitulos karaoke

```powershell
.\scripts\subtitulos-karaoke.ps1 -Audio voz\valentino.mp3 -Guion guion.txt -Salida subtitulos.ass
```

Mide tiempos con whisper pero pinta **el guion verdadero**. Whisper se
equivoca ("agote" → "hagote") y eso no puede salir en pantalla.

### 6. Plan de tomas

Saca los tiempos por palabra de la voz y ubica donde arranca cada frase.
Asigna una toma a cada beat.

**Empieza por el gancho.** Los primeros 2 segundos llevan el plano mas bonito
que haya: camiseta de frente, completa, logos visibles, calidad a la vista.
Cierra con ese mismo plano. Si el gancho choca con la sincronia
palabra-imagen, **gana el gancho**.

Ninguna toma sobre 1.8s ni bajo 0.65s.

```json
{
  "ancho": 1080, "alto": 1920, "fps": 30,
  "tomas": [
    { "clip": "C:\\ruta\\clip.mp4", "desde": 11.0, "duracion": 1.76,
      "girar": 0, "nota": "escudo (dice ARSENAL)" }
  ]
}
```

`girar`: 0, 90, 180, 270. **Revisalo siempre**: el usuario filma la camiseta
acostada y suele quedar boca abajo.

### 7. Montar

```powershell
.\scripts\montar-video.ps1 -Plan plan.json -Voz voz\valentino.mp3 -Subtitulos subtitulos.ass -Salida salida\FINAL.mp4
```

### 8. Verificar ANTES de entregar

Dos pasos, los dos obligatorios.

**8a. Auditar la orientacion de TODAS las tomas:**

```powershell
.\scripts\auditar-orientacion.ps1 -Video salida\FINAL.mp4 -Plan plan.json
```

Saca un fotograma por toma, numerado. **Miralo entero.** Ninguna imagen puede
salir al reves: el cliente ve el video en el celular y tiene que leerse todo
de frente. La orientacion cambia varias veces dentro del mismo clip crudo, asi
que no alcanza con revisar el gancho. Tabla de referencia por escudo en
`references/estilo.md`.

**8b. Verificar lo medible:**

```powershell
.\scripts\verificar-video.ps1 -Video salida\FINAL.mp4 -Plan plan.json -Subtitulos subtitulos.ass
```

Revisa solo: medidas, fps, duracion en rango, que la voz cubra el video,
duracion de cada toma, tamano y margen de los subtitulos. Saca ademas una
hoja de contactos.

Si dice **NO ENTREGAR**, arregla y vuelve a montar.

**Mira la hoja igual.** Ningun chequeo automatico ve si el producto sale al
reves, si el gancho quedo feo o si un plano esta fuera de foco. Esos tres
errores se cometieron el primer dia y solo se vieron mirando.

### 9. Entregar

Muestra el mp4 y dale el caption con 3-5 hashtags (pool en
`herencia90-social`) y la mejor hora de publicacion.

## Reglas duras

- Nunca musica en el render.
- Nunca subtitulos con la transcripcion de whisper: siempre el guion verdadero.
- Nunca afirmar temporada, titulo o resultado sin dos fuentes.
- Nunca un plano de apertura con el producto al reves.
- Nunca pasar de 15s sin que lo pida.
- Nunca pedir la API key por chat.
- Mira la hoja de contactos antes de elegir tomas; no cortes a ciegas.

## Requisitos

- `ffmpeg` y `ffprobe` en el PATH (con libass)
- `whisper-ctranslate2` para tiempos por palabra
- Arial Black (`C:\Windows\Fonts\ariblk.ttf`)
- `FISH_AUDIO_API_KEY` configurada

## Referencias

- `references/ejemplo-arsenal.md` — **el caso completo, paso a paso, con los
  numeros reales.** Leelo si es tu primera vez.
- `references/voces.md` — voces, ritmos, limites, alternativas
- `references/estilo.md` — specs visuales medidas
- `references/guiones.md` — formulas de guion probadas

## Donde vive

- Canon versionado: `HERENCIA90/.agents/skills/herencia90-video/`
- Copia global: `~/.claude/skills/herencia90-video/`

Si cambias una, copia la otra.

En el PC de otro socio basta la copia global (`~/.claude/skills/`), junto con
`herencia90-social` e `identify-football-jerseys`. Cada persona usa **su
propia** `FISH_AUDIO_API_KEY`; nunca se comparte.
