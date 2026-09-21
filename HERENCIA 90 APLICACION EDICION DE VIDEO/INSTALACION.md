# Instalación en Windows

Se hace una sola vez. Calcula 20-30 minutos, casi todo es esperar descargas.

---

## Paso 0 — Solo para escuchar las voces (2 minutos)

Si únicamente quieres oír las voces y decidir cuál te gusta, **no necesitas
instalar nada más**:

1. Instala Python desde [python.org/downloads](https://www.python.org/downloads/)
   → en la primera pantalla del instalador **marca la casilla
   "Add Python to PATH"**. Es el error más común.
2. Doble clic en **`ESCUCHAR_VOCES.bat`**.
3. Se abre sola la carpeta `muestras_voz/` con los audios. Escúchalos.

El resto de esta guía es para cuando vayamos a editar videos de verdad.

---

## Paso 1 — Python 3.11 o superior

[python.org/downloads](https://www.python.org/downloads/) · marca **"Add Python to PATH"**.

Verifica abriendo PowerShell y escribiendo:
```powershell
python --version
```

## Paso 2 — FFmpeg

Es el motor que corta, pega y renderiza. En PowerShell:
```powershell
winget install Gyan.FFmpeg
```
Cierra y vuelve a abrir PowerShell, y comprueba:
```powershell
ffmpeg -version
```

> Si `winget` no existe en tu Windows, baja el ZIP de
> [gyan.dev/ffmpeg/builds](https://www.gyan.dev/ffmpeg/builds/), descomprímelo
> en `C:\ffmpeg` y agrega `C:\ffmpeg\bin` al PATH del sistema.

## Paso 3 — Las librerías del motor

Desde PowerShell, dentro de esta carpeta:
```powershell
cd "RUTA\A\HERENCIA 90 APLICACION EDICION DE VIDEO"
python -m pip install -r requirements.txt
```

## Paso 4 — Aprovechar tu GPU NVIDIA (recomendado)

Sin esto los subtítulos funcionan igual, solo que más lento. Con tu GPU,
transcribir un video de 30 segundos baja de ~1 minuto a ~5 segundos.

```powershell
python -m pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu124
```

Comprueba que la GPU quedó reconocida:
```powershell
python -c "import torch; print('GPU:', torch.cuda.is_available())"
```
Debe imprimir `GPU: True`.

## Paso 5 (opcional) — ElevenLabs para voz premium

Solo si quieres el botón de máxima calidad. Crea un archivo llamado `.env`
en esta carpeta con:
```
ELEVENLABS_API_KEY=tu_clave_aqui
```
Sacas la clave en [elevenlabs.io](https://elevenlabs.io). **Nunca subas ese
archivo a GitHub** — ya está ignorado.

---

## Comprobar que todo quedó bien

```powershell
python -m motor.cli revisar
```
Te dice qué está instalado, qué falta y cómo arreglarlo.

---

## Problemas frecuentes

| Síntoma | Solución |
|---|---|
| `'python' no se reconoce` | No marcaste "Add Python to PATH". Reinstala Python marcando la casilla. |
| `'ffmpeg' no se reconoce` | Cierra y abre PowerShell de nuevo. Si sigue, revisa el PATH del Paso 2. |
| `GPU: False` | Actualiza los drivers NVIDIA desde GeForce Experience y repite el Paso 4. |
| La voz falla con error de red | `edge-tts` necesita internet. Sin internet usa `--motor kokoro`. |
