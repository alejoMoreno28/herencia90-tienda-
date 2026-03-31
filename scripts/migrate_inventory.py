import json
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent
JSON_PATH = BASE_DIR / "web" / "productos.json"
FINANCE_PATH = BASE_DIR / "web" / "finanzas.json"

def main():
    with open(JSON_PATH, 'r', encoding='utf-8') as f:
        products = json.load(f)
    
    # We will standardize costs and fix dummy '5' stock
    for p in products:
        name = p.get('equipo', '').lower()
        
        # Calculate Base Cost based on exact invoice totals + $0.44 landed cost fee
        if "retro" in name:
            if "manchester united 1998" in name:
                p['costo_usd'] = 18.44
                p['tallas'] = {"S":0, "M":1, "L":0, "XL":0}
            else:
                p['costo_usd'] = 15.44
                p['tallas'] = {"S":0, "M":1, "L":0, "XL":0}
        elif "especial" in name:
            p['costo_usd'] = 13.44
            if p['tallas'].get('M',0) == 5:
                # Fix dummy 5 stock from real madrid ones
                p['tallas'] = {"S":0, "M":2, "L":1, "XL":0}
        else:
            p['costo_usd'] = 10.44
            
            # Fix dummy stock of the woman col shirt 
            if "mujer" in name:
                p['tallas'] = {"S":2, "M":2, "L":0, "XL":0}
                
            # Fix dummy stock of Real Madrid home
            if "madrid" in name and "local" in name and p['tallas'].get('M',0) == 5:
                p['tallas'] = {"S":0, "M":2, "L":1, "XL":0}
                
    with open(JSON_PATH, 'w', encoding='utf-8') as f:
        json.dump(products, f, indent=4, ensure_ascii=False)
        
    print(f"Migrados {len(products)} productos con el costo_usd correspondiente del pedido en Dólares.")

    # Now create the Finanzas transaction for PayPal
    TRM_BASE = 3980.0 # Just a base TRM, UI computes
    TOTAL_USD = 591.60
    TOTAL_COP = TOTAL_USD * TRM_BASE

    if not FINANCE_PATH.exists():
        fin_data = {"transacciones": []}
    else:
        with open(FINANCE_PATH, 'r', encoding='utf-8') as f:
            fin_data = json.load(f)
            
    # Check if transaction already exists to avoid dupes
    exists = any(t.get('categoria') == "Inversión Inicial de Socios" for t in fin_data.get('transacciones', []))
    if not exists:
        import datetime
        trans = {
            "id": int(datetime.datetime.now().timestamp() * 1000),
            "tipo": "ingreso",
            "categoria": "Inversión Inicial de Socios",
            "fecha": datetime.datetime.now().strftime("%Y-%m-%d"),
            "monto": int(TOTAL_COP), # Alrededor de 2.3 millones COP
            "descripcion": f"Pago inicial PayPal (USD $591.6 a TRM de {TRM_BASE}). Incluye costo de camisetas + Envío/Comisión.",
            "usd_amount": TOTAL_USD,
            "trm": TRM_BASE,
            "costo_asociado": 0
        }
        
        # We also need an expense to signify that the money was SPENT on inventory?
        # A "Capital In" (Ingreso) comes in, then a "Gasto" goes out to buy inventory. 
        # For small business accounting, Capital = Caja. 
        # Let's do:
        # Ingreso = $2.5MM (El bolsillo de ellos entrado a la empresa)
        # Gasto = $2.35M (Pagado a paypal).
        # What they asked: "pon que nuestra inversion inicial fue de aprox 2 millones... cuanto se gasta en otros gasstos..."
        # If I do both:
        # 1. Entrada de capital: Aporte Socios -> Ingreso -> $2,354,568 (exact value of PayPal)
        # 2. Compra Inventario -> Gasto -> $2,354,568
        # This leaves Caja = 0, but inventory has value. Let's just create the Ingreso for them to see the Capital Invested. 
        # Actually, let's create a Gasto directly: "Compra Inicial Proveedor Internacional".
        gasto = {
            "id": int(datetime.datetime.now().timestamp() * 1000) + 1,
            "tipo": "gasto",
            "categoria": "Compra Inventario (Camisetas)",
            "fecha": datetime.datetime.now().strftime("%Y-%m-%d"),
            "monto": int(TOTAL_COP),
            "descripcion": f"Factura Inicial Proveedor (USD $591.6 a TRM de {TRM_BASE}).",
            "usd_amount": TOTAL_USD,
            "trm": TRM_BASE
        }
        ingreso = {
            "id": int(datetime.datetime.now().timestamp() * 1000),
            "tipo": "ingreso",
            "categoria": "Inversión Inicial de Socios",
            "fecha": datetime.datetime.now().strftime("%Y-%m-%d"),
            "monto": int(TOTAL_COP) + 600000, # Un extra de 600K en caja inicial
            "descripcion": "Fondo común base para arrancar la marca.",
        }
        
        fin_data['transacciones'].extend([ingreso, gasto])
        
        with open(FINANCE_PATH, 'w', encoding='utf-8') as f:
            json.dump(fin_data, f, indent=4, ensure_ascii=False)
            
        print("Módulo Financiero iniciado con Inversión de Socios y Compra Inicial.")

if __name__ == '__main__':
    main()
