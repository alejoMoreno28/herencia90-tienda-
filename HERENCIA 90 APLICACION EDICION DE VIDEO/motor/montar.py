"""Montaje final con FFmpeg: cortes, encuadre 9:16, musica con ducking y subtitulos.

Todo se decide en un archivo 'plan.json' que el agente escribe y tu puedes
corregir a mano. Volver a renderizar despues de un ajuste es un solo comando.

Formato del plan:

    {
      "resolucion": [1080, 1920],
      "fps": 30,
      "voz": "trabajo/voz.wav",
      "subtitulos": "trabajo/subs.ass",
      "musica": {"archivo": "...", "volumen_db": -20, "ducking": true},
      "cortes": [
        {"clip": "crudo/camiseta.mp4", "desde": 2.0, "hasta": 4.2, "efecto": "zoom_in"},
        {"clip": "crudo/escudo.jpg",   "duracion": 2.0, "efecto": "pan_der"}
      ]
    }
"""
from __future__ import annotations

import json
import shutil
import tempfile
from pathlib import Path

from .util import ErrorMotor, correr, ffmpeg_bin, info_medio, log, paso

EFECTOS = ("ninguno", "zoom_in", "zoom_out", "pan_der", "pan_izq")


def _ruta_filtro(ruta: Path) -> str:
    """Escapa una ruta para usarla dentro de un filtro de FFmpeg.

    En Windows 'C:\\x' rompe el parser de filtros: hay que pasar a '/' y
    escapar los dos puntos.
    """
    return str(ruta.resolve()).replace("\\", "/").replace(":", "\\:")


def _filtro_encuadre(ancho: int, alto: int) -> str:
    """Rellena el marco vertical recortando el sobrante, sin deformar la imagen."""
    return (f"scale={ancho}:{alto}:force_original_aspect_ratio=increase,"
            f"crop={ancho}:{alto}")


def _filtro_efecto(efecto: str, dur: float, fps: int, ancho: int, alto: int) -> str:
    """Movimiento de camara sobre la toma. Da vida a las tomas fijas."""
    cuadros = max(1, int(round(dur * fps)))
    if efecto in ("", "ninguno", None):
        return ""
    # Se trabaja al doble de resolucion para que el zoom no se vea escalonado.
    base = f"scale={ancho * 2}:{alto * 2}:force_original_aspect_ratio=increase,crop={ancho * 2}:{alto * 2}"
    if efecto == "zoom_in":
        z = f"zoompan=z='min(1+0.0018*on,1.18)':d={cuadros}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'"
    elif efecto == "zoom_out":
        z = f"zoompan=z='max(1.18-0.0018*on,1.0)':d={cuadros}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'"
    elif efecto == "pan_der":
        z = f"zoompan=z=1.15:d={cuadros}:x='(iw-iw/zoom)*on/{cuadros}':y='ih/2-(ih/zoom/2)'"
    elif efecto == "pan_izq":
        z = f"zoompan=z=1.15:d={cuadros}:x='(iw-iw/zoom)*(1-on/{cuadros})':y='ih/2-(ih/zoom/2)'"
    else:
        raise ErrorMotor(f"Efecto desconocido: {efecto}. Disponibles: {', '.join(EFECTOS)}")
    return f"{base},{z}:s={ancho}x{alto}:fps={fps}"


def _preparar_corte(corte: dict, destino: Path, base: Path,
                    ancho: int, alto: int, fps: int) -> float:
    """Renderiza un corte ya normalizado (misma resolucion, fps y codec)."""
    ruta = Path(corte["clip"])
    if not ruta.is_absolute():
        ruta = base / ruta
    if not ruta.exists():
        raise ErrorMotor(f"El plan apunta a un archivo que no existe: {ruta}")

    es_foto = ruta.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"}
    efecto = corte.get("efecto", "ninguno")

    if es_foto:
        dur = float(corte.get("duracion", 2.0))
        entrada = ["-loop", "1", "-t", f"{dur:.3f}", "-i", str(ruta)]
    else:
        info = info_medio(ruta)
        desde = float(corte.get("desde", 0.0))
        hasta = float(corte.get("hasta", info.duracion))
        if hasta > info.duracion:
            log(f"Aviso: el corte pedia hasta {hasta:.1f}s pero {ruta.name} "
                f"dura {info.duracion:.1f}s; se recorta ahi")
            hasta = info.duracion
        dur = hasta - desde
        if dur <= 0.05:
            raise ErrorMotor(
                f"Corte invalido en {ruta.name}: desde={desde} hasta={hasta}. "
                "El final debe ser mayor que el inicio."
            )
        entrada = ["-ss", f"{desde:.3f}", "-t", f"{dur:.3f}", "-i", str(ruta)]

    filtros = _filtro_efecto(efecto, dur, fps, ancho, alto) or \
        f"{_filtro_encuadre(ancho, alto)},fps={fps}"
    filtros += ",setsar=1,format=yuv420p"

    correr([ffmpeg_bin(), "-y", "-loglevel", "error", *entrada,
            "-vf", filtros, "-an",
            "-c:v", "libx264", "-preset", "medium", "-crf", "18",
            "-pix_fmt", "yuv420p", "-r", str(fps), str(destino)],
           descripcion=f"corte de {ruta.name}")
    return dur


def _cadena_audio(voz: Path, musica: dict | None, base: Path,
                  duracion: float) -> tuple[list[str], str]:
    """Construye las entradas y el filtro de audio (voz + musica con ducking)."""
    entradas = ["-i", str(voz)]
    if not musica or not musica.get("archivo"):
        return entradas, "[1:a]apad,atrim=0:%.3f,aresample=48000[audio]" % duracion

    ruta_mus = Path(musica["archivo"])
    if not ruta_mus.is_absolute():
        ruta_mus = base / ruta_mus
    if not ruta_mus.exists():
        raise ErrorMotor(f"No existe la musica indicada en el plan: {ruta_mus}")

    entradas += ["-stream_loop", "-1", "-i", str(ruta_mus)]
    vol = float(musica.get("volumen_db", -20))

    cadena = (
        f"[1:a]apad,atrim=0:{duracion:.3f},aresample=48000,asplit=2[voz][llave];"
        f"[2:a]atrim=0:{duracion:.3f},aresample=48000,volume={vol}dB[mus];"
    )
    if musica.get("ducking", True):
        # La musica baja automaticamente cuando hay voz.
        cadena += ("[mus][llave]sidechaincompress="
                   "threshold=0.02:ratio=12:attack=15:release=350[musduck];"
                   "[voz][musduck]amix=inputs=2:duration=first:normalize=0,"
                   "afade=t=out:st=%.3f:d=0.5[audio]" % max(0.0, duracion - 0.5))
    else:
        cadena += ("[llave]anull[x];[voz][mus]amix=inputs=2:duration=first:normalize=0,"
                   "afade=t=out:st=%.3f:d=0.5[audio]" % max(0.0, duracion - 0.5))
    return entradas, cadena


def renderizar(plan: str | Path, salida: str | Path) -> Path:
    """Ejecuta el plan y produce el video final."""
    plan_ruta = Path(plan)
    if not plan_ruta.exists():
        raise ErrorMotor(f"No existe el plan: {plan_ruta}")
    datos = json.loads(plan_ruta.read_text(encoding="utf-8"))
    base = plan_ruta.parent

    ancho, alto = datos.get("resolucion", [1080, 1920])
    fps = int(datos.get("fps", 30))
    cortes = datos.get("cortes") or []
    if not cortes:
        raise ErrorMotor("El plan no tiene ningun corte en la lista 'cortes'.")

    voz = Path(datos["voz"]) if datos.get("voz") else None
    if voz and not voz.is_absolute():
        voz = base / voz
    if not voz or not voz.exists():
        raise ErrorMotor(f"No encuentro la voz en off: {voz}")

    temporal = Path(tempfile.mkdtemp(prefix="h90_"))
    try:
        paso(f"Preparando {len(cortes)} corte(s)")
        trozos, total = [], 0.0
        for i, corte in enumerate(cortes, start=1):
            destino = temporal / f"corte{i:03d}.mp4"
            dur = _preparar_corte(corte, destino, base, ancho, alto, fps)
            trozos.append(destino)
            total += dur
            log(f"corte {i:02d}  {Path(corte['clip']).name:28s} {dur:5.2f}s  "
                f"{corte.get('efecto', 'ninguno')}")

        dur_voz = info_medio(voz).duracion
        if total < dur_voz - 0.3:
            log(f"Aviso: los cortes suman {total:.1f}s pero la voz dura "
                f"{dur_voz:.1f}s. El video se cortara antes de que termine de hablar.")

        lista = temporal / "lista.txt"
        lista.write_text(
            "\n".join(f"file '{t.as_posix()}'" for t in trozos) + "\n", encoding="utf-8")

        paso("Uniendo los cortes")
        unido = temporal / "unido.mp4"
        correr([ffmpeg_bin(), "-y", "-loglevel", "error", "-f", "concat", "-safe", "0",
                "-i", str(lista), "-c", "copy", str(unido)], descripcion="union de cortes")

        duracion = min(total, dur_voz) if total >= dur_voz else total
        entradas_audio, filtro_audio = _cadena_audio(voz, datos.get("musica"), base, duracion)

        subs = datos.get("subtitulos")
        if subs:
            ruta_subs = Path(subs)
            if not ruta_subs.is_absolute():
                ruta_subs = base / ruta_subs
            if not ruta_subs.exists():
                raise ErrorMotor(f"No encuentro los subtitulos: {ruta_subs}")
            fuentes = Path(__file__).parent.parent / "assets" / "fuentes"
            filtro_video = (f"[0:v]subtitles='{_ruta_filtro(ruta_subs)}'"
                            f":fontsdir='{_ruta_filtro(fuentes)}'[video]")
        else:
            filtro_video = "[0:v]null[video]"

        paso("Render final")
        salida = Path(salida)
        salida.parent.mkdir(parents=True, exist_ok=True)
        correr([ffmpeg_bin(), "-y", "-loglevel", "error",
                "-i", str(unido), *entradas_audio,
                "-filter_complex", f"{filtro_video};{filtro_audio}",
                "-map", "[video]", "-map", "[audio]",
                "-t", f"{duracion:.3f}",
                "-c:v", "libx264", "-preset", "slow", "-crf", "20",
                "-pix_fmt", "yuv420p", "-profile:v", "high", "-level", "4.1",
                "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
                "-movflags", "+faststart", str(salida)],
               descripcion="render final")

        info = info_medio(salida)
        mb = salida.stat().st_size / 1_048_576
        log(f"Listo: {salida}")
        log(f"{info.duracion:.1f}s  {info.ancho}x{info.alto}  {mb:.1f} MB")
        return salida
    finally:
        shutil.rmtree(temporal, ignore_errors=True)
