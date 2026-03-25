"""
compress_images.py
==================
Convierte todas las imágenes PNG/JPEG de web/img/ a formato WebP optimizado.
- Redimensiona a máx. 1200px de ancho (mantiene proporción)
- Calidad WebP: 82 (excelente balance calidad/tamaño)
- Borra el archivo original tras convertir exitosamente
- Informa el ahorro total de espacio

Uso:
    pip install Pillow
    python scripts/compress_images.py
"""

from pathlib import Path
from PIL import Image
import os

IMG_DIR = Path(__file__).parent.parent / "web" / "img"
MAX_WIDTH = 1200
WEBP_QUALITY = 82

VALID_EXTENSIONS = {".png", ".jpg", ".jpeg"}

def compress_all():
    images = [f for f in IMG_DIR.iterdir() if f.suffix.lower() in VALID_EXTENSIONS]
    
    if not images:
        print("No se encontraron imágenes para comprimir.")
        return

    total_original = 0
    total_compressed = 0
    converted = []

    print(f"\n{'='*60}")
    print(f"  HERENCIA90 — Compresión de imágenes ({len(images)} archivos)")
    print(f"{'='*60}\n")

    for img_path in sorted(images):
        original_size = img_path.stat().st_size
        total_original += original_size

        try:
            with Image.open(img_path) as img:
                # Convertir a RGB si tiene canal alpha (PNG con transparencia)
                if img.mode in ("RGBA", "P", "LA"):
                    # Crear fondo blanco para imágenes con transparencia
                    background = Image.new("RGB", img.size, (255, 255, 255))
                    if img.mode == "P":
                        img = img.convert("RGBA")
                    background.paste(img, mask=img.split()[-1] if img.mode in ("RGBA", "LA") else None)
                    img = background
                elif img.mode != "RGB":
                    img = img.convert("RGB")

                # Redimensionar si es más ancha que MAX_WIDTH
                if img.width > MAX_WIDTH:
                    ratio = MAX_WIDTH / img.width
                    new_height = int(img.height * ratio)
                    img = img.resize((MAX_WIDTH, new_height), Image.LANCZOS)

                # Guardar como WebP
                webp_path = img_path.with_suffix(".webp")
                img.save(webp_path, "WEBP", quality=WEBP_QUALITY, method=6)

            new_size = webp_path.stat().st_size
            total_compressed += new_size
            saving_pct = (1 - new_size / original_size) * 100

            print(f"  ✓ {img_path.name}")
            print(f"    {original_size/1024/1024:.1f} MB  →  {new_size/1024:.0f} KB  ({saving_pct:.0f}% reducción)")

            # Borrar el original
            img_path.unlink()
            converted.append(img_path.stem)

        except Exception as e:
            print(f"  ✗ ERROR con {img_path.name}: {e}")

    # Resumen final
    total_saving = (1 - total_compressed / total_original) * 100 if total_original > 0 else 0
    print(f"\n{'='*60}")
    print(f"  RESUMEN")
    print(f"  Archivos convertidos : {len(converted)}")
    print(f"  Tamaño original      : {total_original/1024/1024:.1f} MB")
    print(f"  Tamaño final         : {total_compressed/1024/1024:.1f} MB")
    print(f"  Ahorro total         : {(total_original - total_compressed)/1024/1024:.1f} MB ({total_saving:.0f}%)")
    print(f"{'='*60}\n")
    print("¡Listo! Ahora haz git add + commit + push para subir las imágenes a Railway.\n")

if __name__ == "__main__":
    compress_all()
