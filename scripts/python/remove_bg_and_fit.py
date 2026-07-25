"""
scripts/python/remove_bg_and_fit.py

Quita el fondo de una foto de producto (BiRefNet via rembg, corre local,
licencia MIT, sin nube) y la encuadra a un lienzo cuadrado maximizando el
contenido sin recortar (igual al proceso manual en Canva).

Uso:
    python remove_bg_and_fit.py <entrada.jpg> <salida.png> [tamano]
"""
import sys
from rembg import remove, new_session
from PIL import Image
import io

def main():
    if len(sys.argv) < 3:
        print("uso: remove_bg_and_fit.py <entrada> <salida> [tamano=2048]")
        sys.exit(1)

    input_path = sys.argv[1]
    output_path = sys.argv[2]
    size = int(sys.argv[3]) if len(sys.argv) > 3 else 2048

    session = new_session("birefnet-general")

    with open(input_path, "rb") as f:
        input_bytes = f.read()

    output_bytes = remove(input_bytes, session=session)
    img = Image.open(io.BytesIO(output_bytes)).convert("RGBA")

    # Encuadrar a size x size manteniendo proporcion, sin recortar
    # (fit "contain": escala al maximo que quepa, centra, rellena transparente)
    ratio = min(size / img.width, size / img.height)
    new_w, new_h = round(img.width * ratio), round(img.height * ratio)
    resized = img.resize((new_w, new_h), Image.LANCZOS)

    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    offset = ((size - new_w) // 2, (size - new_h) // 2)
    canvas.paste(resized, offset, resized)
    canvas.save(output_path, "PNG")
    print(f"Guardado: {output_path} ({size}x{size}, contenido {new_w}x{new_h})")

if __name__ == "__main__":
    main()
