#!/usr/bin/env python3
"""
process_images.py - Procesador inteligente de imágenes Herencia 90
===================================================================
Para cada equipo en la carpeta EQUIPOS/:
  - Recorre subcarpetas recursivamente (1 o 2 niveles de profundidad)
  - Analiza las esquinas de cada foto para detectar si tiene fondo plano
    (típico de fotos sobre sábana blanca)
  - Fondo plano detectado  -> usa rembg para quitar el fondo
  - Fondo complejo/escena -> convierte directamente sin quitar fondo
  - Redimensiona a máx. 1200px de ancho
  - Guarda en WebP calidad 82

Uso:
    python scripts/process_images.py
"""

import io
import re
from pathlib import Path

import numpy as np
from PIL import Image

try:
    from rembg import remove as rembg_remove
    REMBG_AVAILABLE = True
except ImportError:
    REMBG_AVAILABLE = False
    print("[WARN] rembg no instalado. Instala con: pip install rembg")

# ── Rutas ─────────────────────────────────────────────────────────────────────
BASE_DIR     = Path(__file__).parent.parent
EQUIPOS_DIR  = BASE_DIR / "EQUIPOS"
IMG_DIR      = BASE_DIR / "web" / "img"
MAX_WIDTH    = 1200
WEBP_QUALITY = 82
IMG_EXTS     = {".jpg", ".jpeg", ".png"}

# ── Umbrales de detección de fondo ────────────────────────────────────────────
# Una sábana blanca/crema típica tiene:
#   - Brillo promedio en las esquinas > 175  (escala 0-255)
#   - Desviación estándar < 45              (fondo uniforme)
BRIGHTNESS_THRESHOLD = 175
STD_THRESHOLD        = 45
CORNER_RATIO         = 0.10   # muestrea el 10% de la dimensión menor en cada esquina


# ── Helpers ───────────────────────────────────────────────────────────────────

def needs_background_removal(img_path: Path) -> bool:
    """
    Analiza las 4 esquinas de la imagen.
    Retorna True si parecen ser un fondo plano claro (sábana).
    """
    try:
        with Image.open(img_path) as img:
            rgb   = img.convert("RGB")
            w, h  = rgb.size
            m     = max(1, int(min(w, h) * CORNER_RATIO))

            corners = [
                rgb.crop((0,     0,     m,   m)),
                rgb.crop((w - m, 0,     w,   m)),
                rgb.crop((0,     h - m, m,   h)),
                rgb.crop((w - m, h - m, w,   h)),
            ]
            pixels = np.concatenate([np.array(c).reshape(-1, 3) for c in corners])
            return float(pixels.mean()) > BRIGHTNESS_THRESHOLD and float(pixels.std()) < STD_THRESHOLD
    except Exception as e:
        print(f"      [WARN] No se pudo analizar {img_path.name}: {e}")
        return False


def remove_bg(img_path: Path) -> Image.Image:
    """Quita el fondo con rembg y retorna imagen RGBA."""
    raw      = img_path.read_bytes()
    out_raw  = rembg_remove(raw)
    return Image.open(io.BytesIO(out_raw)).convert("RGBA")


def load_direct(img_path: Path) -> Image.Image:
    """Carga imagen sin quitar fondo y normaliza el modo."""
    img = Image.open(img_path)
    if img.mode in ("P", "LA"):
        img = img.convert("RGBA")
    elif img.mode not in ("RGB", "RGBA"):
        img = img.convert("RGB")
    return img


def save_webp(img: Image.Image, out_path: Path):
    """Redimensiona si supera MAX_WIDTH y guarda como WebP."""
    if img.width > MAX_WIDTH:
        ratio = MAX_WIDTH / img.width
        img   = img.resize((MAX_WIDTH, int(img.height * ratio)), Image.LANCZOS)
    img.save(out_path, "WEBP", quality=WEBP_QUALITY, method=6)


def collect_images(folder: Path) -> list:
    """Recoge recursivamente todas las imágenes de una carpeta."""
    imgs = sorted(
        [p for p in folder.rglob("*") if p.is_file() and p.suffix.lower() in IMG_EXTS],
        key=lambda p: [int(t) if t.isdigit() else t for t in re.split(r"(\d+)", p.name)]
    )
    return imgs


# ── Pipeline principal ────────────────────────────────────────────────────────

def process_all():
    IMG_DIR.mkdir(parents=True, exist_ok=True)

    team_dirs = sorted([d for d in EQUIPOS_DIR.iterdir() if d.is_dir()])
    if not team_dirs:
        print("No se encontraron carpetas en EQUIPOS/")
        return

    total_removed = 0
    total_direct  = 0
    total_errors  = 0

    print(f"\n{'='*65}")
    print(f"  HERENCIA 90 - Procesador de imágenes inteligente")
    print(f"  Equipos encontrados: {len(team_dirs)}")
    print(f"{'='*65}\n")

    for team_dir in team_dirs:
        team_clean = team_dir.name.replace(" ", "_").lower()
        images     = collect_images(team_dir)

        if not images:
            print(f"  [SKIP] {team_dir.name} - sin imágenes")
            continue

        # Borrar WebPs anteriores de este equipo para empezar limpio
        old = list(IMG_DIR.glob(f"{team_clean}_*.webp"))
        for f in old:
            f.unlink()

        print(f"\n  >> {team_dir.name}  ({len(images)} fotos, {len(old)} anteriores eliminadas)")

        for i, img_path in enumerate(images, start=1):
            out_path = IMG_DIR / f"{team_clean}_{i}.webp"
            try:
                should_remove = needs_background_removal(img_path) and REMBG_AVAILABLE
                label         = "[R] fondo quitado" if should_remove else "[OK]  sin cambio   "

                if should_remove:
                    img = remove_bg(img_path)
                    total_removed += 1
                else:
                    img = load_direct(img_path)
                    total_direct += 1

                save_webp(img, out_path)
                print(f"    {i:2d}. {img_path.name:<35}  [{label}]  ->  {out_path.name}")

            except Exception as e:
                print(f"    {i:2d}. [ERROR] {img_path.name}: {e}")
                total_errors += 1

    # Resumen
    print(f"\n{'='*65}")
    print(f"  RESUMEN FINAL")
    print(f"  Con remoción de fondo : {total_removed}")
    print(f"  Sin cambio de fondo   : {total_direct}")
    print(f"  Errores               : {total_errors}")
    print(f"{'='*65}\n")
    print("Siguiente paso: python scripts/generate_json.py\n")


if __name__ == "__main__":
    process_all()
