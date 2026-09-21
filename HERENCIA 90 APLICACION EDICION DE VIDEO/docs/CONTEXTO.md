# Contexto para retomar el proyecto

> Este archivo existe para que cualquier Claude (o Codex) que abra el proyecto
> entienda en 5 minutos qué se decidió, por qué, y qué falta. La conversación
> donde nació esto ocurrió en Claude Code en la nube, que **no** puede alcanzar
> los archivos del PC de Alejo; el trabajo real se hace en local.

## Quién y qué

**Alejo** (alejandro.xnova360@gmail.com) vende camisetas de fútbol retro bajo la
marca **Herencia 90**, en Colombia. Graba las camisetas con el celular y publica
videos verticales en TikTok.

**Lo que pidió:** una herramienta que, a partir de sus clips en crudo y de un
guión escrito por él, saque el TikTok terminado: voz en off tipo CapCut,
subtítulos dinámicos en español, cortes con ritmo, música y transiciones.

## Las decisiones que ya se tomaron

Todas las tomó Alejo, no hay que volver a abrirlas salvo que él lo pida.

| Decisión | Qué se eligió | Por qué |
|---|---|---|
| **Forma del producto** | Una skill + un motor de scripts, **no** un clon de CapCut | Un clon son meses de trabajo para una sola persona. Para retoques finos ya tiene CapCut. |
| **El guión** | **Lo escribe Alejo, no la IA** | Él conoce cada camiseta. La IA ejecuta, no inventa texto. |
| **Voz** | `edge-tts` por defecto; Kokoro sin internet; ElevenLabs premium | Las voces neuronales de Microsoft son lo más parecido a CapCut en español y son gratis. |
| **Subtítulos** | WhisperX / faster-whisper → ASS propio → quemado con FFmpeg | WhisperX alinea palabra por palabra con error <100 ms; Whisper normal patina y arruina el karaoke. |
| **Render** | FFmpeg solo | Hace todo lo necesario. Remotion y HyperFrames son peso muerto hoy. |
| **Música** | ACE-Step 1.5 (MIT) o la carpeta propia de Alejo | MusicGen queda descartado: sus pesos son CC-BY-NC, prohibido comercialmente. |
| **Dónde corre** | PC Windows de Alejo, con GPU NVIDIA | Ahí están los videos, la GPU y las fuentes. |
| **Orden de trabajo** | Primero el modo automático, el timeline manual después (o nunca) | Que produzca videos antes que verse bonito. |

Se evaluaron **OpenMontage**, **clipfactory**, **claude-video-studio**,
**video-editing-skill** y **ai-video-captions**. Ninguna servía tal cual; el
razonamiento completo está en `INVESTIGACION.md`. De ahí se tomaron prestadas
dos ideas: el motor de subtítulos de `ai-video-captions` y la autorrevisión
post-render de OpenMontage.

## Lo que ya está construido y probado

```
HERENCIA 90 APLICACION EDICION DE VIDEO/
├── INSTALAR.bat           un clic: Python, FFmpeg, librerías, CUDA, fuentes
├── ESCUCHAR_VOCES.bat     graba la misma frase con todas las voces en español
├── probar_voces.py        idem, desde la terminal
├── descargar_fuentes.py   baja Montserrat variable y la congela en ExtraBold/SemiBold
├── config/
│   ├── marca.json                 tono, ritmo, estructura de guión, tomas típicas
│   └── estilos_subtitulos.json    estilos medidos sobre los videos reales
├── motor/
│   ├── util.py         localiza ffmpeg, lee metadatos
│   ├── frames.py       extrae fotogramas para que el agente VEA el material
│   ├── escenas.py      PySceneDetect: separa las tomas de cada clip
│   ├── voz.py          edge-tts / kokoro / chatterbox / elevenlabs
│   ├── subtitulos.py   tiempos por palabra + generación del .ass animado
│   ├── montar.py       cortes, 9:16, música con ducking, quemado, render
│   └── cli.py          python -m motor.cli <comando>
└── docs/               INVESTIGACION, REFERENCIAS, NUBE_Y_LOCAL, este archivo
```

La skill vive en **`.claude/skills/editor-herencia90/SKILL.md`** (raíz del repo)
y se carga sola.

**Probado de punta a punta** en Linux con FFmpeg 7.0.2: render 1080x1920 correcto,
con cortes, efecto de zoom, mezcla de voz y música con ducking, y subtítulos
quemados con la palabra activa resaltada. Se comparó un render propio contra el
video real de Alejo y los subtítulos salen prácticamente idénticos.

**Sin probar todavía** (no se podía desde la nube):
- `edge-tts` — el proxy bloquea sus websockets. En Windows debería funcionar directo.
- `faster-whisper` y `whisperx` — nunca se descargaron los modelos.
- Aceleración por GPU.
- El flujo completo con material en crudo real de Alejo.

## Lo que falta, en orden

1. **Que Alejo escuche las voces** (`ESCUCHAR_VOCES.bat`) y diga cuál se parece a
   **Valentino** y cuál a **Nandez**, las dos de CapCut que usaba antes.
   Pista medida sobre sus videos: Valentino ≈ 123 Hz, Nandez ≈ 140 Hz.
2. **Fijar esas voces** en `config/marca.json` y como valor por defecto en `voz.py`.
3. **Primer video real**, con los clips de
   `C:\Users\PC\Desktop\HERENCIA 90 MARKETING\VIDEO CRUDOS PEDIDO 4\1`.
4. Ajustar lo que salga mal en ese primer video.
5. Música: decidir si carpeta propia, generada con ACE-Step, o las dos.
6. Efectos de sonido en los cortes (aún no hay nada hecho).

## Cosas que conviene saber antes de tocar el código

- **El acento en mayúsculas:** los videos originales de Alejo dicen "CLáSICO",
  "DISEñO", "FúTBOL" — la herramienta que usaba no convertía bien los acentos.
  El motor lo hace bien. No es un bug, es una mejora deliberada.
- **La posición del subtítulo** quedó en 68% de la altura. Sus dos videos no
  coinciden entre sí (66% y 78%) y más abajo choca con la interfaz de TikTok.
- **Los subtítulos van sin puntuación**, como en sus videos. La puntuación sí se
  usa internamente para decidir las pausas y los cortes de bloque.
- **Montserrat** se descarga como fuente variable y se congela en pesos fijos:
  libass no elige bien el grosor dentro de una variable y saldría en peso normal.
- **Nunca reescribir el guión de Alejo.** Ni inventar precios, tallas o stock.
- `plan.json` y `subs.ass` son texto plano y editables: si un corte o un
  subtítulo quedó mal, se corrige ahí y se vuelve a renderizar, sin repetir todo.
