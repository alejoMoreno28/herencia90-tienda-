import json
from pathlib import Path

def migrate_categories():
    base_dir = Path(__file__).parent.parent
    json_path = base_dir / "web" / "productos.json"
    
    with open(json_path, 'r', encoding='utf-8') as f:
        productos = json.load(f)
        
    for p in productos:
        name_lower = p.get('equipo', '').lower()
        if 'retro' in name_lower:
            p['categoria'] = "Retros"
        elif any(country in name_lower for country in ['alemania', 'argentina', 'colombia', 'portugal']):
            p['categoria'] = "Equipos Nacionales"
        elif 'mujer' in name_lower or 'woman' in name_lower:
            p['categoria'] = "Mujer"
        else:
            p['categoria'] = "Equipos Actuales"
            
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(productos, f, indent=4, ensure_ascii=False)

if __name__ == '__main__':
    migrate_categories()
    print("Migrated categories successfully.")
