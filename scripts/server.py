import json
import os
import base64
from http.server import SimpleHTTPRequestHandler, HTTPServer
from pathlib import Path

# Configuración de rutas
BASE_DIR = Path(__file__).parent.parent
WEB_DIR = BASE_DIR / "web"
JSON_PATH = WEB_DIR / "productos.json"
IMG_DIR = WEB_DIR / "img"

class AdminHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(WEB_DIR), **kwargs)

    def check_auth(self):
        auth_header = self.headers.get('Authorization')
        if auth_header and auth_header.startswith('Basic '):
            encoded = auth_header.split(' ')[1]
            try:
                decoded = base64.b64decode(encoded).decode('utf-8')
                u, p = decoded.split(':', 1)
                expected_user = os.environ.get('ADMIN_USER', 'admin')
                expected_pass = os.environ.get('ADMIN_PASS', 'herencia2026')
                if u == expected_user and p == expected_pass:
                    return True
            except:
                pass
        self.send_response(401)
        self.send_header('WWW-Authenticate', 'Basic realm="Panel Admin Herencia 90"')
        self.end_headers()
        self.wfile.write(b"Acceso denegado. Se requiere cuenta de administrador.")
        return False

    def do_GET(self):
        if '/admin.html' in self.path or self.path.startswith('/api/'):
            if not self.check_auth():
                return
        super().do_GET()

    def do_POST(self):
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
                
            elif self.path == '/api/upload':
                data = json.loads(post_data.decode('utf-8'))
                filename = data.get('filename')
                b64str = data.get('data')
                
                if not filename or not b64str:
                    raise Exception("Faltan datos de la imagen.")
                
                if ',' in b64str:
                    b64str = b64str.split(',')[1]
                    
                file_path = IMG_DIR / filename
                with open(file_path, 'wb') as f:
                    f.write(base64.b64decode(b64str))
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "success", "filepath": f"img/{filename}"}).encode('utf-8'))
            else:
                self.send_error(404, "Not Found")
                
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"status": "error", "message": str(e)}).encode('utf-8'))

def run():
    # Detecta si el servidor en la nube (ej. Railway) asignó un puerto, de lo contrario usa 8000
    port = int(os.environ.get('PORT', 8000))
    # '0.0.0.0' permite que la nube exponga el puerto correctamente hacia internet
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

