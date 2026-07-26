"""
scripts/python/cuda_setup.py

onnxruntime-gpu necesita CUDA 13 + cuDNN 9 (cublasLt64_13.dll, cudnn64_9.dll,
cudart64_13.dll...). En vez de instalar el CUDA Toolkit completo del sistema,
se reutilizan las DLL que YA vienen dentro del paquete torch+cu130.

Este modulo debe importarse ANTES que onnxruntime para registrar ese
directorio en la busqueda de DLLs de Windows. Si algo falla, no rompe nada:
onnxruntime simplemente seguira en CPU.
"""
import os
import sys


def enable_cuda_dlls():
    """Registra las DLL de CUDA que trae torch. Devuelve True si lo logro."""
    if sys.platform != 'win32':
        return False
    try:
        import torch
    except ImportError:
        return False

    lib_dir = os.path.join(os.path.dirname(torch.__file__), 'lib')
    if not os.path.isdir(lib_dir):
        return False

    # Comprobar que estan las que pide onnxruntime; si no, no tiene sentido
    required = ['cublasLt64_13.dll', 'cudart64_13.dll', 'cudnn64_9.dll']
    missing = [d for d in required if not os.path.exists(os.path.join(lib_dir, d))]
    if missing:
        return False

    try:
        os.add_dll_directory(lib_dir)
    except (OSError, AttributeError):
        return False

    # Algunas rutas de carga usan PATH en vez del dll directory
    os.environ['PATH'] = lib_dir + os.pathsep + os.environ.get('PATH', '')
    return True


CUDA_DLLS_READY = enable_cuda_dlls()
