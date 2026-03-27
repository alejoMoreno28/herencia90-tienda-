#!/usr/bin/env python3
"""
generate_json.py — Genera productos.json desde la carpeta EQUIPOS
==================================================================
- Busca imágenes .webp en web/img/ que coincidan con cada equipo
- Ordena las imágenes numéricamente (_1, _2, ..., _10, ...)
- Preserva precio y stock del JSON existente si el equipo ya existe
- Agrega productos nuevos con precio y stock por defecto

Uso:
    python scripts/generate_json.py
"""

import json
import re
from pathlib import Path

BASE_DIR    = Path(__file__).parent.parent
EQUIPOS_DIR = BASE_DIR / "EQUIPOS"
IMG_DIR     = BASE_DIR / "web" / "img"
JSON_PATH   = BASE_DIR / "web" / "productos.json"

# Valores por defecto para productos nuevos
DEFAULT_TALLAS   = {"S": 5, "M": 5, "L": 5, "XL": 5}
PRECIO_RETRO     = 150000
PRECIO_NORMAL    = 120000

# Mapeo de palabras clave en el nombre de carpeta → categoría
CATEGORIA_MAP = [
    (["mujer", "women", "female", "dama"],                           "Mujer"),
    (["retro", "98", "99", "00", "01", "02", "03", "04", "05"],      "Retros"),
    (["colombia", "argentina", "brasil", "portugal", "alemania",
      "mexico", "england", "france", "spain", "italia"],             "Equipos Nacionales"),
]
DEFAULT_CATEGORIA = "Equipos Actuales"


def get_categoria(name: str) -> str:
    lower = name.lower()
    for keywords, cat in CATEGORIA_MAP:
        if any(kw in lower for kw in keywords):
            return cat
    return DEFAULT_CATEGORIA


def numeric_key(path: Path) -> list:
    """Ordena archivos con números de forma natural: _1, _2, ..., _10, _11."""
    return [int(t) if t.isdigit() else t for t in re.split(r"(\d+)", path.stem)]


def load_existing_json() -> dict:
    """Devuelve un dict {team_clean: producto} del JSON actual."""
    existing = {}
    if JSON_PATH.exists():
        try:
            data = json.loads(JSON_PATH.read_text(encoding="utf-8"))
            for p in data:
                # Intentar derivar team_clean a partir de las imágenes guardadas
                imgs = p.get("imagenes", [])
                if imgs:
                    # img/team_clean_1.webp → team_clean
                    stem = Path(imgs[0]).stem          # team_clean_1
                    key  = re.sub(r"_\d+$", "", stem)  # team_clean
                    existing[key] = p
        except Exception:
            pass
    return existing


def generate():
    team_dirs  = sorted([d for d in EQUIPOS_DIR.iterdir() if d.is_dir()])
    existing   = load_existing_json()
    productos  = []
    next_id    = max((p.get("id", 0) for p in existing.values()), default=0) + 1

    print(f"\n{'='*60}")
    print(f"  Generando productos.json — {len(team_dirs)} equipos")
    print(f"{'='*60}\n")

    for idx, team_dir in enumerate(team_dirs):
        team_name  = team_dir.name
        team_clean = team_name.replace(" ", "_").lower()

        # Buscar imágenes WebP generadas para este equipo
        imagenes = sorted(
            IMG_DIR.glob(f"{team_clean}_*.webp"),
            key=numeric_key
        )

        if not imagenes:
            print(f"  [SKIP] {team_name} — sin imágenes en web/img/")
            continue

        img_paths = [f"img/{p.name}" for p in imagenes]

        # Recuperar datos previos si existen
        prev = existing.get(team_clean)
        if prev:
            precio    = prev.get("precio",    PRECIO_RETRO if "retro" in team_name.lower() else PRECIO_NORMAL)
            tallas    = prev.get("tallas",    DEFAULT_TALLAS.copy())
            categoria = prev.get("categoria", get_categoria(team_name))
            prod_id   = prev.get("id",        next_id)
        else:
            precio    = PRECIO_RETRO if "retro" in team_name.lower() else PRECIO_NORMAL
            tallas    = DEFAULT_TALLAS.copy()
            categoria = get_categoria(team_name)
            prod_id   = next_id
            next_id  += 1

        producto = {
            "id":        prod_id,
            "categoria": categoria,
            "equipo":    team_name,
            "precio":    precio,
            "tallas":    tallas,
            "imagenes":  img_paths,
        }
        productos.append(producto)
        status = "actualizado" if prev else "NUEVO"
        print(f"  [{status:>10}]  {team_name}  ({len(img_paths)} imágenes, ${precio:,})")

    # Guardar
    JSON_PATH.write_text(
        json.dumps(productos, indent=4, ensure_ascii=False),
        encoding="utf-8"
    )

    print(f"\n  ✅ Guardados {len(productos)} productos en {JSON_PATH.name}\n")
    print("  Recuerda ajustar precios, stock y categorías en el panel admin.\n")


if __name__ == "__main__":
    generate()
