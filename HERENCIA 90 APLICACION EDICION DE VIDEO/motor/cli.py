"""Linea de comandos del motor.

    python -m motor.cli revisar
    python -m motor.cli nuevo "camiseta-colombia-90"
    python -m motor.cli frames proyectos/mi-video/crudo
    python -m motor.cli escenas proyectos/mi-video/crudo
    python -m motor.cli voz proyectos/mi-video/guion.txt
    python -m motor.cli subtitulos proyectos/mi-video/trabajo/voz.wav
    python -m motor.cli montar proyectos/mi-video/plan.json
"""
from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path

from .util import ErrorMotor, RAIZ, ffmpeg_bin, ffprobe_bin, log, paso


def cmd_revisar(args) -> None:
    paso("Revisando el entorno")
    ok = True

    try:
        log(f"OK    ffmpeg      {ffmpeg_bin()}")
    except ErrorMotor as e:
        log(f"FALTA ffmpeg      {e}")
        ok = False
    log(f"{'OK   ' if ffprobe_bin() else 'aviso'} ffprobe     "
        f"{ffprobe_bin() or 'no esta (se usa un metodo alterno, mas lento)'}")

    comprobaciones = [
        ("edge_tts", "voz en off por defecto", "pip install edge-tts", True),
        ("faster_whisper", "tiempos de subtitulo", "pip install faster-whisper", True),
        ("scenedetect", "deteccion de tomas", 'pip install "scenedetect[opencv]"', True),
        ("whisperx", "alineacion de maxima precision", "pip install whisperx", False),
        ("kokoro", "voz local sin internet", "pip install kokoro soundfile", False),
        ("chatterbox", "clonado de tu voz", "pip install chatterbox-tts", False),
        ("elevenlabs", "voz premium", "pip install elevenlabs", False),
    ]
    for modulo, para_que, arreglo, obligatorio in comprobaciones:
        import importlib.util
        if importlib.util.find_spec(modulo):
            log(f"OK    {modulo:16s} ({para_que})")
        elif obligatorio:
            log(f"FALTA {modulo:16s} ({para_que})  ->  {arreglo}")
            ok = False
        else:
            log(f"-     {modulo:16s} ({para_que}, opcional)  ->  {arreglo}")

    try:
        import torch
        log(f"OK    GPU              {'SI, ' + torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'no (todo ira mas lento)'}")
    except ImportError:
        log("-     GPU              torch no instalado (ver INSTALACION.md, paso 4)")

    print("\n  Todo listo.\n" if ok else "\n  Faltan cosas obligatorias. Mira las lineas que dicen FALTA.\n")
    sys.exit(0 if ok else 1)


def cmd_nuevo(args) -> None:
    destino = RAIZ / "proyectos" / args.nombre
    if destino.exists():
        raise ErrorMotor(f"Ya existe el proyecto: {destino}")
    for sub in ("crudo", "trabajo", "salida"):
        (destino / sub).mkdir(parents=True)
    (destino / "guion.txt").write_text(
        "# Escribe aqui tu guion, una frase por linea.\n"
        "# Las lineas que empiezan con # no se leen en voz alta.\n"
        "# Lo que pongas entre [corchetes] o (parentesis) tampoco: usalo para notas de toma.\n\n",
        encoding="utf-8")
    paso(f"Proyecto creado: {destino}")
    log("1. Copia tus videos en la carpeta 'crudo/'")
    log("2. Escribe tu guion en 'guion.txt'")
    log("3. Pideme: 'edita el proyecto " + args.nombre + "'")


def cmd_frames(args) -> None:
    from .frames import extraer
    extraer(args.carpeta, args.salida or Path(args.carpeta).parent / "trabajo" / "frames",
            cada_seg=args.cada)


def cmd_escenas(args) -> None:
    from .escenas import detectar
    detectar(args.carpeta, args.salida or Path(args.carpeta).parent / "trabajo" / "escenas.json")


def cmd_voz(args) -> None:
    from .voz import sintetizar
    salida = args.salida or Path(args.guion).parent / "trabajo" / "voz.wav"
    sintetizar(args.guion, salida, motor=args.motor, voz=args.voz, velocidad=args.velocidad)


def cmd_subtitulos(args) -> None:
    from .subtitulos import generar_ass, guardar_palabras, tiempos_por_palabra
    audio = Path(args.audio)
    trabajo = audio.parent
    palabras = tiempos_por_palabra(audio, guion=args.guion)
    guardar_palabras(palabras, trabajo / "palabras.json")
    generar_ass(palabras, args.salida or trabajo / "subs.ass", estilo=args.estilo)


def cmd_montar(args) -> None:
    from .montar import renderizar
    plan = Path(args.plan)
    renderizar(plan, args.salida or plan.parent / "salida" / "video_final.mp4")


def cmd_revisar_resultado(args) -> None:
    """Saca fotogramas del video terminado para que el agente lo verifique."""
    from .frames import extraer
    video = Path(args.video)
    destino = video.parent / "revision"
    if destino.exists():
        shutil.rmtree(destino)
    destino.mkdir(parents=True)
    temporal = destino / "_entrada"
    temporal.mkdir()
    enlace = temporal / video.name
    shutil.copy2(video, enlace)
    extraer(temporal, destino, cada_seg=args.cada)
    shutil.rmtree(temporal, ignore_errors=True)
    paso("Revisa estas imagenes: deben verse los subtitulos legibles y el encuadre correcto")


def principal(argv=None) -> None:
    p = argparse.ArgumentParser(
        prog="motor", description="Motor de edicion de video de Herencia 90")
    sub = p.add_subparsers(dest="comando", required=True)

    sub.add_parser("revisar", help="Comprueba que todo este instalado").set_defaults(fn=cmd_revisar)

    q = sub.add_parser("nuevo", help="Crea una carpeta de proyecto nueva")
    q.add_argument("nombre")
    q.set_defaults(fn=cmd_nuevo)

    q = sub.add_parser("frames", help="Extrae fotogramas para que el agente vea el material")
    q.add_argument("carpeta")
    q.add_argument("--salida")
    q.add_argument("--cada", type=float, default=1.0, help="segundos entre fotogramas")
    q.set_defaults(fn=cmd_frames)

    q = sub.add_parser("escenas", help="Detecta las tomas dentro de cada clip")
    q.add_argument("carpeta")
    q.add_argument("--salida")
    q.set_defaults(fn=cmd_escenas)

    q = sub.add_parser("voz", help="Genera la voz en off desde el guion")
    q.add_argument("guion")
    q.add_argument("--salida")
    q.add_argument("--motor", default="edge", choices=["edge", "kokoro", "chatterbox", "elevenlabs"])
    q.add_argument("--voz", default=None)
    q.add_argument("--velocidad", type=float, default=1.08)
    q.set_defaults(fn=cmd_voz)

    q = sub.add_parser("subtitulos", help="Calcula tiempos y escribe el .ass")
    q.add_argument("audio")
    q.add_argument("--guion", default=None, help="respaldo si no hay transcriptor")
    q.add_argument("--estilo", default=None, help="viral | limpio | herencia")
    q.add_argument("--salida")
    q.set_defaults(fn=cmd_subtitulos)

    q = sub.add_parser("montar", help="Renderiza el video final desde el plan")
    q.add_argument("plan")
    q.add_argument("--salida")
    q.set_defaults(fn=cmd_montar)

    q = sub.add_parser("revisar-resultado", help="Saca fotogramas del video terminado")
    q.add_argument("video")
    q.add_argument("--cada", type=float, default=1.5)
    q.set_defaults(fn=cmd_revisar_resultado)

    args = p.parse_args(argv)
    try:
        args.fn(args)
    except ErrorMotor as e:
        print(f"\nERROR: {e}\n", file=sys.stderr)
        sys.exit(1)
    except KeyboardInterrupt:
        print("\nCancelado.\n", file=sys.stderr)
        sys.exit(130)


if __name__ == "__main__":
    principal()
