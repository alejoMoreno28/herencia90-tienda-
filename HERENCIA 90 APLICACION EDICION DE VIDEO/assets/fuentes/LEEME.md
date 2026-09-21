# Fuentes

FFmpeg lee de aquí los `.ttf` al quemar los subtítulos, así el video se ve igual
en cualquier computador.

**No hay que hacer nada a mano:** `INSTALAR.bat` ejecuta `descargar_fuentes.py`,
que baja Montserrat y la deja lista.

Si alguna vez falta, córrelo suelto:

```
python descargar_fuentes.py
```

> Google Fonts ya solo publica Montserrat como fuente **variable** (un archivo
> con todos los grosores dentro), y libass no elige bien el grosor ahí: saldría
> el texto en peso normal en vez de ExtraBold. Por eso el script la "congela"
> en dos pesos fijos, ExtraBold (800) y SemiBold (600).
