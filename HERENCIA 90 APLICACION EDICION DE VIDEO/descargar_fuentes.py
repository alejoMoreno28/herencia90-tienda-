"""Descarga Montserrat y la deja lista para los subtitulos.

Google Fonts ya solo publica Montserrat como fuente VARIABLE (un archivo con
todos los grosores dentro). libass, que es lo que usa FFmpeg para quemar los
subtitulos, no elige bien el grosor dentro de una fuente variable: saldria el
texto en un peso normal en vez de ExtraBold.

Por eso aqui se descarga la variable y se "congela" en dos pesos fijos:
ExtraBold (800) y SemiBold (600).
"""
from __future__ import annotations

import sys
import urllib.request
from pathlib import Path

VARIABLE = "https://raw.githubusercontent.com/google/fonts/main/ofl/montserrat/Montserrat%5Bwght%5D.ttf"
PESOS = {"Montserrat-ExtraBold.ttf": 800, "Montserrat-SemiBold.ttf": 600}


def _descargar(destino: Path) -> Path:
    variable = destino / "_Montserrat-variable.ttf"
    if variable.exists() and variable.stat().st_size > 100_000:
        print("  ya estaba  la fuente variable")
        return variable
    print("  descargando Montserrat...")
    peticion = urllib.request.Request(VARIABLE, headers={"User-Agent": "Mozilla/5.0"})
    datos = urllib.request.urlopen(peticion, timeout=60).read()
    variable.write_bytes(datos)
    print(f"  descargada la fuente variable ({len(datos) // 1024} KB)")
    return variable


def _congelar(variable: Path, destino: Path) -> None:
    from fontTools import ttLib
    from fontTools.varLib import instancer

    for nombre, peso in PESOS.items():
        ruta = destino / nombre
        if ruta.exists() and ruta.stat().st_size > 10_000:
            print(f"  ya estaba  {nombre}")
            continue
        fuente = ttLib.TTFont(str(variable))
        instancer.instantiateVariableFont(fuente, {"wght": peso}, inplace=True)
        fuente.save(str(ruta))
        print(f"  generada   {nombre}  (peso {peso}, {ruta.stat().st_size // 1024} KB)")


def principal() -> int:
    destino = Path(__file__).parent / "assets" / "fuentes"
    destino.mkdir(parents=True, exist_ok=True)
    try:
        variable = _descargar(destino)
    except Exception as e:
        print(f"\n  No pude descargar la fuente: {e}")
        print("  Bajala a mano desde https://fonts.google.com/specimen/Montserrat")
        print(f"  y copia los .ttf en:\n    {destino}")
        return 1
    try:
        _congelar(variable, destino)
    except ImportError:
        print("\n  Falta fonttools. Instalalo con:  pip install fonttools")
        return 1
    except Exception as e:
        print(f"\n  No pude generar los pesos fijos: {e}")
        return 1
    print("\n  Tipografia lista.")
    return 0


if __name__ == "__main__":
    sys.exit(principal())
