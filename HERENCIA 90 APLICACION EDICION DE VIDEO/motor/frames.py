"""Extrae fotogramas del material en crudo para que el agente pueda VER las tomas.

Este es el paso que hace inteligente la edicion: en vez de adivinar con heuristicas,
el agente abre estas imagenes, entiende que hay en cada toma y decide los cortes.
"""
from __future__ import annotations

import json
from pathlib import Path

from .util import ErrorMotor, correr, ffmpeg_bin, info_medio, log, paso

EXTENSIONES_VIDEO = {".mp4", ".mov", ".m4v", ".avi", ".mkv", ".webm"}
EXTENSIONES_FOTO = {".jpg", ".jpeg", ".png", ".webp"}


def listar_crudo(carpeta: str | Path) -> list[Path]:
    """Devuelve los clips y fotos de una carpeta, ordenados por nombre."""
    carpeta = Path(carpeta)
    if not carpeta.is_dir():
        raise ErrorMotor(f"No existe la carpeta de material: {carpeta}")
    archivos = [
        p for p in sorted(carpeta.iterdir())
        if p.suffix.lower() in EXTENSIONES_VIDEO | EXTENSIONES_FOTO
    ]
    if not archivos:
        raise ErrorMotor(
            f"No hay videos ni fotos en {carpeta}. "
            f"Formatos aceptados: {', '.join(sorted(EXTENSIONES_VIDEO | EXTENSIONES_FOTO))}"
        )
    return archivos


def extraer(carpeta_crudo: str | Path, salida: str | Path,
            *, cada_seg: float = 1.0, ancho: int = 480) -> dict:
    """Extrae un fotograma cada `cada_seg` segundos de cada clip.

    Devuelve (y guarda en salida/indice.json) un indice con la duracion de cada
    clip y la lista de fotogramas con su marca de tiempo, para que el agente
    pueda referirse a momentos concretos del material.
    """
    salida = Path(salida)
    salida.mkdir(parents=True, exist_ok=True)
    archivos = listar_crudo(carpeta_crudo)

    paso(f"Extrayendo fotogramas de {len(archivos)} archivo(s)")
    indice: dict = {"cada_seg": cada_seg, "clips": []}

    for n, archivo in enumerate(archivos, start=1):
        etiqueta = f"clip{n:02d}"
        destino = salida / etiqueta
        destino.mkdir(exist_ok=True)

        if archivo.suffix.lower() in EXTENSIONES_FOTO:
            correr([ffmpeg_bin(), "-y", "-loglevel", "error", "-i", str(archivo),
                    "-vf", f"scale={ancho}:-2", str(destino / "t000.0s.jpg")],
                   descripcion=f"copia de {archivo.name}")
            indice["clips"].append({
                "etiqueta": etiqueta, "archivo": archivo.name, "tipo": "foto",
                "duracion": 0.0, "fotogramas": ["t000.0s.jpg"],
            })
            log(f"{etiqueta}  {archivo.name}  (foto)")
            continue

        info = info_medio(archivo)
        if info.duracion <= 0:
            raise ErrorMotor(f"No pude leer la duracion de {archivo.name}; puede estar corrupto.")

        correr([ffmpeg_bin(), "-y", "-loglevel", "error", "-i", str(archivo),
                "-vf", f"fps=1/{cada_seg},scale={ancho}:-2", "-q:v", "3",
                str(destino / "f%04d.jpg")],
               descripcion=f"fotogramas de {archivo.name}")

        brutos = sorted(destino.glob("f*.jpg"))
        nombres = []
        for i, bruto in enumerate(brutos):
            t = i * cada_seg
            nuevo = destino / f"t{t:05.1f}s.jpg"
            bruto.rename(nuevo)
            nombres.append(nuevo.name)

        indice["clips"].append({
            "etiqueta": etiqueta, "archivo": archivo.name, "tipo": "video",
            "duracion": round(info.duracion, 2),
            "resolucion": [info.ancho, info.alto],
            "vertical": info.es_vertical,
            "tiene_audio": info.tiene_audio,
            "fotogramas": nombres,
        })
        orientacion = "vertical" if info.es_vertical else "HORIZONTAL (se recortara)"
        log(f"{etiqueta}  {archivo.name}  {info.duracion:.1f}s  "
            f"{info.ancho}x{info.alto} {orientacion}  {len(nombres)} fotogramas")

    (salida / "indice.json").write_text(
        json.dumps(indice, indent=2, ensure_ascii=False), encoding="utf-8")
    log(f"Indice escrito en {salida / 'indice.json'}")
    return indice
