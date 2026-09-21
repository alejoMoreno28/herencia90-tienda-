"""Voz en off a partir del guion de Alejo.

Motores disponibles, de mas simple a mas potente:

  edge        Voces neuronales de Microsoft. GRATIS, sin GPU, resultado en segundos.
              Son las que mas se parecen a las voces de CapCut en espanol.  <- por defecto
  kokoro      Local, muy rapido, sin internet. Calidad alta, voces fijas.
  chatterbox  Local con GPU. Clona tu voz desde ~10s de audio tuyo.
  elevenlabs  API de pago. La mas natural; requiere ELEVENLABS_API_KEY.
"""
from __future__ import annotations

import asyncio
import os
from pathlib import Path

from .util import ErrorMotor, correr, ffmpeg_bin, info_medio, log, paso

# Catalogo de voces recomendadas para contenido viral en espanol.
VOCES_EDGE = {
    "gonzalo":  ("es-CO-GonzaloNeural", "Hombre colombiano, natural y cercano"),
    "salome":   ("es-CO-SalomeNeural",  "Mujer colombiana, calida"),
    "jorge":    ("es-MX-JorgeNeural",   "Hombre mexicano, energico - el clasico de TikTok"),
    "dalia":    ("es-MX-DaliaNeural",   "Mujer mexicana, muy usada en virales"),
    "alvaro":   ("es-ES-AlvaroNeural",  "Hombre espanol, locutor"),
}
VOZ_EDGE_POR_DEFECTO = "gonzalo"

VOCES_KOKORO = {"dora": "ef_dora", "alex": "em_alex", "santa": "em_santa"}


def _limpiar_guion(texto: str) -> str:
    """Quita marcas de escena, vinetas y emojis que no deben leerse en voz alta."""
    import re
    lineas = []
    for linea in texto.splitlines():
        linea = linea.strip()
        if not linea or linea.startswith("#"):
            continue
        # [ESCENA 1], (toma del escudo), - vineta, 1. numeracion
        linea = re.sub(r"^\s*[\[\(][^\]\)]*[\]\)]\s*", "", linea)
        linea = re.sub(r"^\s*(?:[-*•]|\d+[.)])\s*", "", linea)
        linea = re.sub(r"[\U0001F000-\U0001FAFF☀-➿]", "", linea)
        linea = linea.strip()
        if linea:
            lineas.append(linea)
    limpio = " ".join(lineas)
    if not limpio:
        raise ErrorMotor("El guion quedo vacio despues de limpiarlo. Revisa el archivo guion.txt")
    return limpio


# --------------------------------------------------------------------------
# Motores
# --------------------------------------------------------------------------

def _edge(texto: str, salida: Path, voz: str, velocidad: float) -> None:
    try:
        import edge_tts
    except ImportError:
        raise ErrorMotor("Falta edge-tts. Instalalo con:  pip install edge-tts")

    nombre = VOCES_EDGE.get(voz, (voz, ""))[0]
    # edge-tts expresa la velocidad como porcentaje relativo
    delta = int(round((velocidad - 1.0) * 100))
    rate = f"{delta:+d}%"

    mp3 = salida.with_suffix(".mp3")

    async def _hablar() -> None:
        com = edge_tts.Communicate(texto, nombre, rate=rate)
        await com.save(str(mp3))

    asyncio.run(_hablar())
    correr([ffmpeg_bin(), "-y", "-loglevel", "error", "-i", str(mp3),
            "-ar", "48000", "-ac", "1", str(salida)], descripcion="conversion de la voz")
    mp3.unlink(missing_ok=True)


def _kokoro(texto: str, salida: Path, voz: str, velocidad: float) -> None:
    try:
        import soundfile as sf
        from kokoro import KPipeline
    except ImportError:
        raise ErrorMotor("Falta kokoro. Instalalo con:  pip install kokoro soundfile")

    import numpy as np
    pipeline = KPipeline(lang_code="e")  # 'e' = espanol
    nombre = VOCES_KOKORO.get(voz, voz if voz.startswith(("ef_", "em_")) else "em_alex")
    trozos = [audio for _, _, audio in pipeline(texto, voice=nombre, speed=velocidad)]
    if not trozos:
        raise ErrorMotor("Kokoro no genero audio.")
    sf.write(str(salida), np.concatenate(trozos), 24000)


def _chatterbox(texto: str, salida: Path, voz: str, velocidad: float) -> None:
    try:
        import torch
        import torchaudio
        from chatterbox.tts import ChatterboxMultilingualTTS
    except ImportError:
        raise ErrorMotor(
            "Falta chatterbox. Instalalo con:  pip install chatterbox-tts\n"
            "Necesita GPU NVIDIA para ir rapido."
        )

    referencia = voz if voz and Path(voz).exists() else None
    if referencia:
        log(f"Clonando la voz de {Path(referencia).name}")
    else:
        log("Sin audio de referencia: se usa la voz por defecto de Chatterbox. "
            "Para clonar tu voz pasa --voz ruta/a/tu_voz.wav")

    dispositivo = "cuda" if torch.cuda.is_available() else "cpu"
    modelo = ChatterboxMultilingualTTS.from_pretrained(device=dispositivo)
    wav = modelo.generate(texto, language_id="es", audio_prompt_path=referencia)
    torchaudio.save(str(salida), wav, modelo.sr)

    if abs(velocidad - 1.0) > 0.01:
        _cambiar_velocidad(salida, velocidad)


def _elevenlabs(texto: str, salida: Path, voz: str, velocidad: float) -> None:
    clave = os.environ.get("ELEVENLABS_API_KEY")
    if not clave:
        raise ErrorMotor(
            "Falta la variable de entorno ELEVENLABS_API_KEY.\n"
            "Consiguela en elevenlabs.io y guardala en el archivo .env del proyecto."
        )
    try:
        from elevenlabs.client import ElevenLabs
    except ImportError:
        raise ErrorMotor("Falta elevenlabs. Instalalo con:  pip install elevenlabs")

    cliente = ElevenLabs(api_key=clave)
    voz_id = voz or os.environ.get("ELEVENLABS_VOICE_ID") or "onwK4e9ZLuTAKqWW03F9"
    mp3 = salida.with_suffix(".mp3")
    audio = cliente.text_to_speech.convert(
        voice_id=voz_id, text=texto,
        model_id="eleven_multilingual_v2", output_format="mp3_44100_128",
    )
    with open(mp3, "wb") as f:
        for trozo in audio:
            f.write(trozo)
    correr([ffmpeg_bin(), "-y", "-loglevel", "error", "-i", str(mp3),
            "-ar", "48000", "-ac", "1", str(salida)], descripcion="conversion de la voz")
    mp3.unlink(missing_ok=True)
    if abs(velocidad - 1.0) > 0.01:
        _cambiar_velocidad(salida, velocidad)


def _cambiar_velocidad(wav: Path, velocidad: float) -> None:
    """Ajusta la velocidad sin alterar el tono."""
    temporal = wav.with_name(wav.stem + "_tmp.wav")
    correr([ffmpeg_bin(), "-y", "-loglevel", "error", "-i", str(wav),
            "-filter:a", f"atempo={max(0.5, min(2.0, velocidad))}", str(temporal)],
           descripcion="ajuste de velocidad")
    temporal.replace(wav)


MOTORES = {"edge": _edge, "kokoro": _kokoro, "chatterbox": _chatterbox, "elevenlabs": _elevenlabs}


# --------------------------------------------------------------------------
# API publica
# --------------------------------------------------------------------------

def sintetizar(guion: str | Path, salida: str | Path, *, motor: str = "edge",
               voz: str | None = None, velocidad: float = 1.08) -> Path:
    """Convierte el guion en un WAV de voz en off.

    `velocidad` por defecto va ligeramente acelerada: es lo que se usa en TikTok
    para que el video no se sienta lento.
    """
    if motor not in MOTORES:
        raise ErrorMotor(f"Motor de voz desconocido: {motor}. Opciones: {', '.join(MOTORES)}")

    texto = Path(guion).read_text(encoding="utf-8") if Path(str(guion)).exists() else str(guion)
    texto = _limpiar_guion(texto)

    salida = Path(salida)
    salida.parent.mkdir(parents=True, exist_ok=True)
    if voz is None and motor == "edge":
        voz = VOZ_EDGE_POR_DEFECTO

    paso(f"Generando voz en off con '{motor}'" + (f" (voz: {voz})" if voz else ""))
    log(f"{len(texto.split())} palabras a leer")
    MOTORES[motor](texto, salida, voz or "", velocidad)

    info = info_medio(salida)
    log(f"Voz lista: {salida.name}  {info.duracion:.1f}s")
    return salida
