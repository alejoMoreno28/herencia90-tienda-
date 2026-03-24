import json
from pathlib import Path

def agregar_producto():
    base_dir = Path(__file__).parent.parent
    json_path = base_dir / "web" / "productos.json"
    
    if not json_path.exists():
        productos = []
    else:
        with open(json_path, 'r', encoding='utf-8') as f:
            productos = json.load(f)
            
    print("--- AGREGAR NUEVO PRODUCTO ---")
    equipo = input("Nombre del equipo/producto: ")
    
    try:
        precio = int(input("Precio (en pesos, ej 120000): "))
    except ValueError:
        print("Precio inválido. Debe ser un número.")
        return
        
    tallas_input = input("Tallas separadas por coma (ej: S, M, L, XL): ")
    tallas = [t.strip() for t in tallas_input.split(',')]
    
    imagen_nombre = input("Nombre del archivo de imagen (ej: real_madrid_1.png): ")
    
    # Calculate next ID
    next_id = 1 if not productos else max(p.get("id", 0) for p in productos) + 1
    
    nuevo_producto = {
        "id": next_id,
        "equipo": equipo,
        "precio": precio,
        "tallas": tallas,
        "imagen": f"img/{imagen_nombre}",
        "descripcion": f"Camiseta de fútbol {equipo}. Calidad premium."
    }
    
    productos.append(nuevo_producto)
    
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(productos, f, indent=4, ensure_ascii=False)
        
    print(f"\n¡Producto agregado exitosamente con ID {next_id}!")

if __name__ == "__main__":
    agregar_producto()
