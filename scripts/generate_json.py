import os
import json
from pathlib import Path

def generate_json(equipos_dir, img_dir, json_path):
    equipos_path = Path(equipos_dir)
    img_path = Path(img_dir)
    
    productos = []
    
    # Sort for consistency
    team_dirs = sorted([d for d in equipos_path.iterdir() if d.is_dir()])
    
    for idx, team_dir in enumerate(team_dirs, start=1):
        equipo_name = team_dir.name
        
        # Determine price based on name (e.g. Retro vs Fan)
        precio = 150000 if 'retro' in equipo_name.lower() else 120000
        
        # Initialize default stock layout
        tallas = {"S": 0, "M": 5, "L": 5, "XL": 0}
        
        # Find images in the img folder that match this team
        team_clean = equipo_name.replace(' ', '_').lower()
        
        imagenes = []
        # Find all files starting with team_clean
        for out_img in img_path.glob(f"{team_clean}_*"):
            if out_img.suffix.lower() == '.png':
                imagenes.append(f"img/{out_img.name}")
        
        # Sort images so *_1.png is first
        imagenes.sort(key=lambda x: '1.png' not in x.lower())
        
        if not imagenes:
            imagenes = [f"img/{team_clean}_1.png", f"img/{team_clean}_2.png"]
            
        productos.append({
            "id": idx,
            "equipo": equipo_name,
            "precio": precio,
            "tallas": tallas,
            "imagenes": imagenes,
            "descripcion": f"Camiseta de fútbol {equipo_name}. Calidad premium."
        })
    
    # Save the JSON
    json_path.parent.mkdir(parents=True, exist_ok=True)
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(productos, f, indent=4, ensure_ascii=False)
        
    print(f"Generated {len(productos)} products in {json_path}")

if __name__ == "__main__":
    base_dir = Path(__file__).parent.parent
    equipos_dir = base_dir / "EQUIPOS"
    img_dir = base_dir / "web" / "img"
    json_path = base_dir / "web" / "productos.json"
    generate_json(equipos_dir, img_dir, json_path)

