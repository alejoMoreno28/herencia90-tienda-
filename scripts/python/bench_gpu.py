"""Mide quitar fondo en GPU vs CPU con una foto real, para saber si vale la pena."""
import time
import sys
import io
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cuda_setup  # noqa: F401  (debe ir antes de rembg/onnxruntime)
from rembg import remove, new_session
from PIL import Image

print('DLLs CUDA registradas:', cuda_setup.CUDA_DLLS_READY)

IMG = sys.argv[1] if len(sys.argv) > 1 else '_test_bgremoval/multi_brasil2004_0.jpg'

with open(IMG, 'rb') as f:
    data = f.read()
print('foto:', IMG, '|', round(len(data) / 1024), 'KB')


def bench(providers, label, runs=3):
    try:
        t0 = time.time()
        session = new_session('birefnet-general', providers=providers)
        load = time.time() - t0
    except Exception as e:
        print(f'{label}: FALLO al crear sesion -> {e}')
        return None

    # comprobar que realmente uso el provider pedido
    try:
        actual = session.inner_session.get_providers()
    except Exception:
        actual = ['?']

    times = []
    for i in range(runs):
        t = time.time()
        try:
            out = remove(data, session=session)
        except Exception as e:
            print(f'{label}: FALLO al procesar -> {e}')
            return None
        times.append(time.time() - t)

    img = Image.open(io.BytesIO(out)).convert('RGBA')
    print(f'{label}:')
    print(f'   providers reales: {actual}')
    print(f'   carga modelo: {load:.1f}s')
    print(f'   por foto: {min(times):.2f}s (mejor de {runs}) | promedio {sum(times)/len(times):.2f}s')
    print(f'   salida: {img.size}')
    return min(times)


cpu = bench(['CPUExecutionProvider'], 'CPU')
gpu = bench(['CUDAExecutionProvider', 'CPUExecutionProvider'], 'GPU (CUDA)')

if cpu and gpu:
    print()
    print(f'ACELERACION: {cpu / gpu:.1f}x mas rapido en GPU')
