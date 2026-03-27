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
from PIL import Image, ImageOps

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
# Usamos rembg en todas las imágenes y medimos cuánto se conservó.
# - > 90% conservado = Acercamiento/Zoom de la tela (no quitamos fondo)
# - < 15% conservado = Error al detectar objeto (no quitamos fondo)
# - 15% - 90% = Borrado exitoso del fondo.
MIN_KEPT_RATIO = 0.15
MAX_KEPT_RATIO = 0.90

# ── Helpers ───────────────────────────────────────────────────────────────────

def process_single_image(img_path: Path) -> tuple[Image.Image, bool]:
    """
    Carga, aplica rembg y decide si quedarse con el resultado o no.
    Retorna (imagen_final, fue_fondo_removido)
    """
    # 1. Cargar imagen original
    img_orig = Image.open(img_path)
    img_orig = ImageOps.exif_transpose(img_orig)
    if img_orig.mode in ("P", "LA"):
        img_orig = img_orig.convert("RGBA")
    elif img_orig.mode not in ("RGB", "RGBA"):
        img_orig = img_orig.convert("RGB")
        
    if not REMBG_AVAILABLE:
        return img_orig, False
        
    # 2. Convertir a raw png en memoria para rembg
    out_buffer = io.BytesIO()
    img_orig.save(out_buffer, format="PNG")
    raw = out_buffer.getvalue()
    
    # 3. Aplicar rembg
    try:
        out_raw = rembg_remove(raw)
        img_rm = Image.open(io.BytesIO(out_raw)).convert("RGBA")
    except Exception as e:
        print(f"      [WARN] rembg falló en {img_path.name}: {e}")
        return img_orig, False
        
    # 4. Analizar cuánto borró
    arr = np.array(img_rm)
    alpha = arr[:, :, 3]
    non_transparent = np.count_nonzero(alpha > 10)
    total_pixels = alpha.size
    kept_ratio = non_transparent / total_pixels
    
    # 5. Decidir
    if MIN_KEPT_RATIO <= kept_ratio <= MAX_KEPT_RATIO:
        return img_rm, True
    else:
        # Es un zoom (>90) o un error (<15)
        return img_orig, False


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
                img, was_removed = process_single_image(img_path)
                
                label = "[R] fondo quitado" if was_removed else "[OK]  sin cambio   "
                if was_removed:
                    total_removed += 1
                else:
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
