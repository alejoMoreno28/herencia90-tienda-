import json
import os
import base64
from http.server import SimpleHTTPRequestHandler, HTTPServer
from pathlib import Path

# Configuración de rutas
BASE_DIR = Path(__file__).parent.parent
WEB_DIR = BASE_DIR / "web"
JSON_PATH = WEB_DIR / "productos.json"
FINANCE_JSON_PATH = WEB_DIR / "finanzas.json"
IMG_DIR = WEB_DIR / "img"

# Asegurar que finanzas.json existe
if not FINANCE_JSON_PATH.exists():
    with open(FINANCE_JSON_PATH, "w", encoding="utf-8") as f:
        json.dump({"transacciones": []}, f, indent=4, ensure_ascii=False)

class AdminHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(WEB_DIR), **kwargs)

    def check_auth(self):
        auth_header = self.headers.get('Authorization')
        expected_user = os.environ.get('ADMIN_USER', 'admin')
        expected_pass = os.environ.get('ADMIN_PASS', 'herencia2026')
        STATIC_TOKEN = base64.b64encode(f"{expected_user}:{expected_pass}".encode('utf-8')).decode('utf-8')
        
        if auth_header:
            if auth_header.startswith('Bearer '):
                token = auth_header.split(' ')[1]
                if token == STATIC_TOKEN:
                    return True
            elif auth_header.startswith('Basic '):
                encoded = auth_header.split(' ')[1]
                try:
                    decoded = base64.b64decode(encoded).decode('utf-8')
                    u, p = decoded.split(':', 1)
                    if u == expected_user and p == expected_pass:
                        return True
                except:
                    pass
                    
        self.send_response(401)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps({"status": "error", "message": "Unauthorized"}).encode('utf-8'))
        return False

    def do_GET(self):
        if self.path.startswith('/api/'):
            if not self.check_auth():
                return
        super().do_GET()

    def do_POST(self):
        # El endpoint de login es el único POST que no requiere auth previa
        if self.path == '/api/login':
            try:
                content_length = int(self.headers['Content-Length'])
                post_data = self.rfile.read(content_length)
                data = json.loads(post_data.decode('utf-8'))
                u = data.get('username')
                p = data.get('password')
                
                expected_user = os.environ.get('ADMIN_USER', 'admin')
                expected_pass = os.environ.get('ADMIN_PASS', 'herencia2026')
                
                if u == expected_user and p == expected_pass:
                    STATIC_TOKEN = base64.b64encode(f"{u}:{p}".encode('utf-8')).decode('utf-8')
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({"status": "success", "token": STATIC_TOKEN}).encode('utf-8'))
                else:
                    self.send_response(401)
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({"status": "error", "message": "Credenciales inválidas"}).encode('utf-8'))
                return
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "message": str(e)}).encode('utf-8'))
                return

        # Todos los demás POST requieren autenticación
        if not self.check_auth():
            return
            
        try:
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            if self.path == '/api/save':
                data = json.loads(post_data.decode('utf-8'))
                with open(JSON_PATH, 'w', encoding='utf-8') as f:
                    json.dump(data, f, indent=4, ensure_ascii=False)
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "success"}).encode('utf-8'))
                
            elif self.path == '/api/finance/save':
                data = json.loads(post_data.decode('utf-8'))
                with open(FINANCE_JSON_PATH, 'w', encoding='utf-8') as f:
                    json.dump(data, f, indent=4, ensure_ascii=False)
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "success"}).encode('utf-8'))
                
            elif self.path == '/api/upload':
                data = json.loads(post_data.decode('utf-8'))
                filename = data.get('filename')
                b64str = data.get('data')
                
                if not filename or not b64str:
                    raise Exception("Faltan datos de la imagen.")
                
                if ',' in b64str:
                    b64str = b64str.split(',')[1]

                raw_bytes = base64.b64decode(b64str)

                # ── Comprimir a WebP automáticamente ──────────────────────────
                try:
                    from PIL import Image
                    import io

                    MAX_WIDTH = 1200
                    WEBP_QUALITY = 82

                    img = Image.open(io.BytesIO(raw_bytes))

                    if img.mode == "P":
                        img = img.convert("RGBA")
                    elif img.mode == "LA":
                        img = img.convert("RGBA")
                    elif img.mode not in ("RGB", "RGBA"):
                        img = img.convert("RGB")

                    if img.width > MAX_WIDTH:
                        ratio = MAX_WIDTH / img.width
                        img = img.resize((MAX_WIDTH, int(img.height * ratio)), Image.LANCZOS)

                    stem = Path(filename).stem
                    final_name = stem + ".webp"
                    file_path = IMG_DIR / final_name

                    out_buffer = io.BytesIO()
                    img.save(out_buffer, "WEBP", quality=WEBP_QUALITY, method=6)
                    file_bytes = out_buffer.getvalue()

                except Exception as pil_err:
                    print(f"[WARN] Compresión WebP falló ({pil_err}), guardando original.")
                    final_name = filename
                    file_path = IMG_DIR / final_name
                    file_bytes = raw_bytes
                # ──────────────────────────────────────────────────────────────

                with open(file_path, 'wb') as f:
                    f.write(file_bytes)

                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    "status": "success",
                    "filepath": f"img/{final_name}"
                }).encode('utf-8'))

            else:
                self.send_error(404, "Not Found")
                
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"status": "error", "message": str(e)}).encode('utf-8'))

def run():
    port = int(os.environ.get('PORT', 8000))
    server_address = ('0.0.0.0', port)
    httpd = HTTPServer(server_address, AdminHandler)
    print(f"Servidor iniciado en el puerto {port}")
    if port == 8000:
        print(f"Catálogo local: http://localhost:{port}/index.html")
        print(f"Panel Admin: http://localhost:{port}/admin.html")
    print("Presiona Ctrl+C para detener.")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    httpd.server_close()
    print("Servidor detenido.")

if __name__ == '__main__':
    run()
