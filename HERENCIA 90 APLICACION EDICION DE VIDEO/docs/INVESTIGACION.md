# Investigación: ¿con qué construimos el editor? (sept 2026)

Objetivo: **material en crudo de Alejo + guión escrito por Alejo → TikTok vertical
terminado**, con voz en off tipo CapCut, subtítulos dinámicos en español, cortes
inteligentes, música y transiciones. Todo local, en PC Windows con GPU NVIDIA.

---

## 1. Herramientas completas que ya existen (¿nos sirve alguna tal cual?)

### OpenMontage — AGPLv3 · el que viste en Twitter
"Primer sistema agéntico de producción de video open source". 12 pipelines,
~100 herramientas, 700+ archivos de skills. El agente (Claude Code, Codex,
Cursor…) lee un manifiesto YAML, llama herramientas Python, se autorrevisa y
renderiza con Remotion o HyperFrames.

**Lo bueno:** funciona sin APIs de pago (Piper TTS + archivos libres + FFmpeg),
tiene subtítulos palabra por palabra estilo TikTok, controles de calidad muy
serios (valida el render, extrae frames y se autorrevisa), y soporta Windows.

**El problema para nosotros:** está diseñado para videos que se *fabrican*
(stock, archivo libre, generación por IA) a partir de un guión que *escribe la
IA*. Nuestro caso —tu material grabado + tu guión— es una esquina pequeña de
ese sistema. Instalarlo trae Node + Remotion + 12 pipelines + un motor de
puntuación de proveedores que no vamos a usar. Es un camión para ir por el pan.

> **Nota legal:** AGPLv3 obliga a liberar el código derivado *si lo distribuyes
> o lo ofreces como servicio por red*. Para uso interno tuyo no te afecta.

**Veredicto: no lo instalamos como base, pero le copiamos tres ideas buenas**
(autorrevisión post-render, subtítulos word-by-word, gates de aprobación).

### clipfactory — Elastic License 2.0
En el papel es literalmente nuestro caso: "videos verticales a partir de tu
B-roll, con guión, voz y subtítulos". **Pero:** el guión lo escribe la IA y no
acepta el tuyo (tu requisito #1), exige internet con OpenAI + ElevenLabs sí o
sí, tiene 1 estrella y 0 forks, y la licencia restringe. **Descartado.**

### claude-video-studio — MIT
Muy buena vara de calidad: corta en frontera de palabra, reencuadra video de
celular, quema subtítulos, genera música con ducking y corre 16 chequeos antes
de entregar. Usa `faster-whisper` offline. **Pero** está pensado para
*talking head* (tú hablando) y **no genera voz en off**, que es justo lo que
necesitamos para tus tomas mudas. **Buena referencia, no base.**

### video-editing-skill (6missedcalls) — MIT
Bash + FFmpeg + Whisper puro. Recorte, jumpcut por silencio, subtítulos estilo
Hormozi. Simple y sano, pero **sin TTS** y sin manejo de música ni proyectos.
**Es más o menos lo que íbamos a construir, pero más pequeño.**

### ai-video-captions — MIT
6 estilos virales (Hormozi, MrBeast, Karaoke, Minimal, Bounce, Classic), ASS
generado con `pysubs2`, animación por palabra (resaltado, wipe, rebote, escala),
`faster-whisper`, 100+ idiomas. Es una web app con Docker, **pero su motor de
subtítulos es lo mejor que encontré y es MIT: esa parte sí la replicamos.**

**Conclusión de la sección:** ninguna sirve tal cual. La que más se acerca
(clipfactory) falla justo en lo que tú pediste. Pero no arrancamos de cero:
copiamos el motor de subtítulos de `ai-video-captions` y la disciplina de
calidad de `claude-video-studio`.

---

## 2. El stack que hoy es el mejor para cada pieza

| Pieza | Herramienta elegida | Por qué esta y no otra |
|---|---|---|
| **Que el agente VEA el material** | FFmpeg → fotogramas → visión de Claude | Es como Claude/Codex ya "entienden" tus videos. Sin esto la edición es ciega. |
| **Detectar tomas y cortes** | **PySceneDetect** | El estándar para detectar cambios de toma. Exporta lista de escenas y miniaturas. |
| **Quitar silencios / muletillas** | **auto-editor** | Solo para los pocos clips donde hablas. Corta sin alterar la velocidad. |
| **Tiempos palabra por palabra** | **WhisperX** (fallback `faster-whisper`) | WhisperX alinea con wav2vec2 y baja el error a <100 ms. Whisper solo da tiempos por frase, que "patinan" cientos de ms — inservible para karaoke. |
| **Subtítulos animados** | **pysubs2 → ASS → quemado con FFmpeg** | Control total del estilo, sin depender de un render en React. Es lo que usa `ai-video-captions`. |
| **Voz en off** | **edge-tts** (por defecto) · **Kokoro** (offline) · **ElevenLabs** (premium) | Ver sección 3. |
| **Música** | **ACE-Step 1.5** (MIT, uso comercial libre) + tu carpeta de MP3 | Genera una pista a medida en <10 s en una RTX 3090. MusicGen queda fuera: sus pesos son **CC-BY-NC, prohibido comercialmente**. |
| **Render final** | **FFmpeg** | Todo lo que necesitas (9:16, cortes, mezcla, ducking, quemado) lo hace FFmpeg solo. |
| **Gráficos elaborados** (opcional, después) | Remotion o HyperFrames | Solo si algún día quieres intros animadas o tipografía cinética. Hoy es peso muerto. |
| **Orquestación** | Skill propia + Claude Code / Codex | El cerebro que mira los frames y decide. |

---

## 3. La voz: el punto más delicado

CapCut usa modelos propietarios (familia Dreamina/Seedance) con 200+ voces. No
hay un clon exacto open source, pero sí equivalentes muy cercanos en español:

| Motor | Costo | Internet | Calidad en español | Nota |
|---|---|---|---|---|
| **edge-tts** | Gratis | Sí | **Muy alta** | Voces neuronales de Microsoft (`es-CO-Gonzalo`, `es-MX-Jorge`). Son **lo más parecido a CapCut** y salen en segundos. **Por defecto.** |
| **Kokoro** (82M) | Gratis | No | Alta (MOS 4.2) | El mejor local puro. Para cuando no haya internet. |
| **Chatterbox** | Gratis | No | Alta | **Clona tu voz** con ~10 s de audio tuyo. Necesita la GPU. |
| **Piper** | Gratis | No | Media, **robótica** | Es lo que trae OpenMontage por defecto. Suena plano. **No lo usamos.** |
| **ElevenLabs** | ~5-22 USD/mes | Sí | La más alta | Botón de "calidad final" y clonado de voz profesional. |

**Decisión:** `edge-tts` por defecto, `kokoro` como respaldo offline,
`elevenlabs` opcional. Cambiar de motor es una bandera, no una reescritura.

---

## 4. Qué construimos entonces

Una skill propia, delgada, que **orquesta el stack de la sección 2**:

```
Tú dejas:  crudo/*.mp4  +  guion.txt
                 ↓
   1. frames      FFmpeg saca fotogramas → Claude MIRA tus tomas
   2. escenas     PySceneDetect separa las tomas de cada clip
   3. voz         edge-tts lee tu guión                        → voz.wav
   4. tiempos     WhisperX alinea palabra por palabra          → palabras.json
   5. reparto     Claude decide qué toma va con cada frase     → plan.json
   6. subtítulos  pysubs2 arma el ASS animado                  → subs.ass
   7. montaje     FFmpeg: 9:16, cortes, música con ducking, efectos
   8. revisión    Extrae frames del resultado y Claude verifica
                 ↓
            salida/video_final.mp4
```

El paso 5 es el que ninguna herramienta del mercado hace bien para tu caso, y
es exactamente donde un agente con visión gana: **ve** que la toma del escudo
calza con la frase del escudo.

Lo que quede en `plan.json` es texto plano y editable: si no te gusta un corte,
cambias un número y se vuelve a renderizar. Y para retoques finos siempre
queda CapCut, que ya tienes.

---

## Fuentes

- [OpenMontage (calesthio)](https://github.com/calesthio/OpenMontage) · [guía Tosea](https://tosea.ai/blog/openmontage-agentic-video-production-guide)
- [clipfactory](https://github.com/akuntryout00/clipfactory) · [claude-video-studio](https://github.com/sukhrobabdullaev/claude-video-studio) · [video-editing-skill](https://github.com/6missedcalls/video-editing-skill) · [ai-video-captions](https://github.com/nicolaigaina/ai-video-captions) · [Claude-Code-Video-Toolkit](https://github.com/wilwaldon/Claude-Code-Video-Toolkit)
- [PySceneDetect](https://www.scenedetect.com/) · [stable-ts](https://github.com/jianfch/stable-ts) · [WhisperX (guía 2026)](https://localaimaster.com/blog/whisperx-guide)
- [ACE-Step 1.5](https://github.com/ace-step/ACE-Step-1.5) · [comparativa modelos de música](https://www.it-jim.com/blog/best-open-source-ai-music-generator/)
- [Kokoro vs Piper vs XTTS](https://contracollective.com/blog/kokoro-vs-piper-vs-xtts-local-text-to-speech-m5-max-2026) · [mejores TTS locales 2026](https://localaimaster.com/blog/best-local-tts-models)
- [Remotion vs HyperFrames](https://www.jondoesflow.com/post/remotion-vs-hyperframes-programmatic-video) · [voces TTS de CapCut](https://www.capcut.com/tools/tiktok-ai-voice)
