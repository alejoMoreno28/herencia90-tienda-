"""Deteccion de tomas dentro de cada clip, con PySceneDetect.

Un clip grabado de corrido suele traer varias tomas pegadas. Separarlas le da
al agente pedazos limpios para elegir, en vez de un bloque de 40 segundos.
"""
from __future__ import annotations

import json
from pathlib import Path

from .frames import EXTENSIONES_VIDEO, listar_crudo
from .util import ErrorMotor, log, paso


def detectar(carpeta_crudo: str | Path, salida: str | Path,
             *, umbral: float = 27.0, minimo_seg: float = 0.8) -> dict:
    """Devuelve las tomas detectadas en cada clip, con inicio y fin en segundos."""
    try:
        from scenedetect import ContentDetector, detect
    except ImportError:
        raise ErrorMotor(
            "Falta PySceneDetect. Instalalo con:  pip install \"scenedetect[opencv]\""
        )

    archivos = [p for p in listar_crudo(carpeta_crudo)
                if p.suffix.lower() in EXTENSIONES_VIDEO]
    if not archivos:
        raise ErrorMotor("No hay videos en los que detectar tomas (solo fotos).")

    paso(f"Detectando tomas en {len(archivos)} clip(s)")
    resultado: dict = {"umbral": umbral, "clips": []}

    for archivo in archivos:
        try:
            escenas = detect(str(archivo), ContentDetector(threshold=umbral))
        except Exception as e:
            log(f"{archivo.name}: no se pudo analizar ({e}); se trata como una sola toma")
            escenas = []

        tomas = []
        for inicio, fin in escenas:
            a, b = inicio.get_seconds(), fin.get_seconds()
            if b - a >= minimo_seg:
                tomas.append({"desde": round(a, 2), "hasta": round(b, 2),
                              "duracion": round(b - a, 2)})
        if not tomas:
            from .util import info_medio
            dur = info_medio(archivo).duracion
            tomas = [{"desde": 0.0, "hasta": round(dur, 2), "duracion": round(dur, 2)}]

        resultado["clips"].append({"archivo": archivo.name, "tomas": tomas})
        log(f"{archivo.name:30s} {len(tomas)} toma(s)")

    salida = Path(salida)
    salida.parent.mkdir(parents=True, exist_ok=True)
    salida.write_text(json.dumps(resultado, indent=2, ensure_ascii=False), encoding="utf-8")
    log(f"Escrito en {salida}")
    return resultado
