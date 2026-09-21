"""Genera la misma frase con TODAS las voces en espanol para que Alejo escoja con el oido.

En vez de adivinar cual se parece a 'Valentino' o a 'Nandez' de CapCut, este
script pide a Microsoft la lista real de voces disponibles y las graba todas.
Tu las escuchas y decides.

Uso:
    python probar_voces.py                      # voces masculinas (las tuyas)
    python probar_voces.py --todas              # tambien las femeninas
    python probar_voces.py --frase "otra cosa"
"""
from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

FRASE = (
    "Esta camiseta no es una camiseta cualquiera. "
    "Es la del noventa, la que marcó a toda una generación. "
    "Quedan pocas. Link en la bio."
)

# Mi apuesta sobre que voz se acerca a cada una de las tuyas de CapCut.
# Confirmalo con el oido: manda la tuya y la mia, y comparamos.
CANDIDATAS = {
    "es-ES-AlvaroNeural":    "candidata a VALENTINO (locutor maduro y calmado)",
    "es-MX-LibertoNeural":   "candidata a VALENTINO (masculina madura, latina)",
    "es-US-AlonsoNeural":    "candidata a VALENTINO (grave, neutra latina)",
    "es-MX-JorgeNeural":     "candidata a NANDEZ (joven y energica, la viral)",
    "es-CO-GonzaloNeural":   "candidata a NANDEZ (joven colombiana, cercana)",
    "es-MX-YagoNeural":      "candidata a NANDEZ (joven, desenfadada)",
}

# Ritmo extra para las candidatas: en TikTok casi siempre va un poco acelerada.
RITMOS = ["+0%", "+15%"]


async def principal(frase: str, todas: bool) -> None:
    try:
        import edge_tts
    except ImportError:
        print("\nFalta la libreria edge-tts. Instalala con:\n\n    pip install edge-tts\n")
        sys.exit(1)

    print("\nConsultando la lista de voces disponibles...")
    try:
        catalogo = await edge_tts.list_voices()
    except Exception as e:
        print(f"\nNo pude consultar la lista ({e}).")
        print("Revisa tu conexion a internet: edge-tts la necesita.\n")
        sys.exit(1)

    voces = [v for v in catalogo if v["Locale"].startswith("es-")]
    if not todas:
        voces = [v for v in voces if v.get("Gender") == "Male"]
    voces.sort(key=lambda v: (v["ShortName"] not in CANDIDATAS, v["Locale"], v["ShortName"]))

    if not voces:
        print("\nNo aparecio ninguna voz en espanol. Raro. Avisame.\n")
        sys.exit(1)

    destino = Path(__file__).parent / "muestras_voz"
    destino.mkdir(exist_ok=True)
    for viejo in destino.glob("*.mp3"):
        viejo.unlink()

    print(f'\nFrase:\n  "{frase}"\n')
    print(f"Generando muestras de {len(voces)} voz/voces en espanol.")
    print("Las CANDIDATAS van primero y con dos ritmos.\n")

    n = 0
    for v in voces:
        corto = v["ShortName"]
        nota = CANDIDATAS.get(corto, "")
        ritmos = RITMOS if nota else ["+0%"]
        for rate in ritmos:
            n += 1
            sufijo = "_rapida" if rate != "+0%" else ""
            nombre = f"{n:02d}_{corto.replace('Neural', '')}{sufijo}.mp3"
            try:
                await edge_tts.Communicate(frase, corto, rate=rate).save(str(destino / nombre))
                print(f"  OK  {nombre:38s} {nota}")
            except Exception as e:
                print(f"  --  {nombre:38s} fallo: {e}")

    print(f"\nListo, {n} muestras en:\n  {destino}\n")
    print("Escuchalas y dime el nombre de la que mas se parezca a Valentino")
    print("y la que mas se parezca a Nandez. Con esas dos configuramos el motor.\n")


if __name__ == "__main__":
    p = argparse.ArgumentParser(description="Probador de voces de Herencia 90")
    p.add_argument("--frase", default=FRASE)
    p.add_argument("--todas", action="store_true", help="incluir voces femeninas")
    a = p.parse_args()
    asyncio.run(principal(a.frase, a.todas))
