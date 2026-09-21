"""Utilidades compartidas del motor: localizar ffmpeg, ejecutar comandos, leer metadatos."""
from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent


class ErrorMotor(Exception):
    """Fallo esperado del motor; se muestra al usuario sin traceback."""


# --------------------------------------------------------------------------
# Localizacion de binarios
# --------------------------------------------------------------------------

def _buscar_imageio() -> str | None:
    try:
        import imageio_ffmpeg
    except ImportError:
        return None
    try:
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        return None


def ffmpeg_bin() -> str:
    """Ruta a ffmpeg. Prioriza H90_FFMPEG, luego el PATH, luego imageio-ffmpeg."""
    if env := os.environ.get("H90_FFMPEG"):
        return env
    if ruta := shutil.which("ffmpeg"):
        return ruta
    if ruta := _buscar_imageio():
        return ruta
    raise ErrorMotor(
        "No encuentro ffmpeg. Instalalo con 'winget install Gyan.FFmpeg' y reinicia la terminal, "
        "o indica la ruta en la variable de entorno H90_FFMPEG."
    )


def ffprobe_bin() -> str | None:
    """Ruta a ffprobe, o None si no esta (hay fallback por ffmpeg)."""
    if env := os.environ.get("H90_FFPROBE"):
        return env
    return shutil.which("ffprobe")


def correr(cmd: list[str], *, descripcion: str = "") -> subprocess.CompletedProcess:
    """Ejecuta un comando y lanza ErrorMotor con las ultimas lineas si falla."""
    proc = subprocess.run(cmd, capture_output=True, text=True, errors="replace")
    if proc.returncode != 0:
        cola = "\n".join((proc.stderr or "").strip().splitlines()[-15:])
        raise ErrorMotor(f"Fallo {descripcion or cmd[0]}:\n{cola}")
    return proc


# --------------------------------------------------------------------------
# Metadatos de medios
# --------------------------------------------------------------------------

@dataclass
class InfoMedio:
    ruta: Path
    duracion: float
    ancho: int = 0
    alto: int = 0
    tiene_audio: bool = False

    @property
    def es_vertical(self) -> bool:
        return self.alto >= self.ancho


_RE_DUR = re.compile(r"Duration:\s*(\d+):(\d+):(\d+\.?\d*)")
_RE_DIM = re.compile(r"Video:.*?(\d{2,5})x(\d{2,5})")


def info_medio(ruta: str | Path) -> InfoMedio:
    """Lee duracion, dimensiones y presencia de audio. Usa ffprobe si existe."""
    ruta = Path(ruta)
    if not ruta.exists():
        raise ErrorMotor(f"No existe el archivo: {ruta}")

    probe = ffprobe_bin()
    if probe:
        proc = subprocess.run(
            [probe, "-v", "error", "-print_format", "json",
             "-show_format", "-show_streams", str(ruta)],
            capture_output=True, text=True, errors="replace",
        )
        if proc.returncode == 0:
            datos = json.loads(proc.stdout)
            streams = datos.get("streams", [])
            video = next((s for s in streams if s.get("codec_type") == "video"), None)
            audio = next((s for s in streams if s.get("codec_type") == "audio"), None)
            dur = float(datos.get("format", {}).get("duration") or 0.0)
            return InfoMedio(
                ruta=ruta,
                duracion=dur,
                ancho=int(video.get("width", 0)) if video else 0,
                alto=int(video.get("height", 0)) if video else 0,
                tiene_audio=audio is not None,
            )

    # Fallback: parsear la salida de 'ffmpeg -i'
    proc = subprocess.run([ffmpeg_bin(), "-hide_banner", "-i", str(ruta)],
                          capture_output=True, text=True, errors="replace")
    texto = proc.stderr or ""
    dur = 0.0
    if m := _RE_DUR.search(texto):
        h, mi, s = m.groups()
        dur = int(h) * 3600 + int(mi) * 60 + float(s)
    ancho = alto = 0
    if m := _RE_DIM.search(texto):
        ancho, alto = int(m.group(1)), int(m.group(2))
    return InfoMedio(ruta=ruta, duracion=dur, ancho=ancho, alto=alto,
                     tiene_audio="Audio:" in texto)


# --------------------------------------------------------------------------
# Config
# --------------------------------------------------------------------------

def cargar_config(nombre: str) -> dict:
    ruta = RAIZ / "config" / nombre
    if not ruta.exists():
        raise ErrorMotor(f"Falta el archivo de configuracion: {ruta}")
    return json.loads(ruta.read_text(encoding="utf-8"))


def log(mensaje: str) -> None:
    print(f"  {mensaje}", flush=True)


def paso(mensaje: str) -> None:
    print(f"\n>> {mensaje}", flush=True)
