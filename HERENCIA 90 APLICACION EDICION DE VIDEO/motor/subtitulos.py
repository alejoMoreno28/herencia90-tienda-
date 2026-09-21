"""Subtitulos dinamicos estilo TikTok: palabra por palabra, con resaltado.

Dos etapas:
  1. Obtener el tiempo exacto de CADA palabra de la voz en off.
     WhisperX si esta (error <100 ms), si no faster-whisper, y si no hay
     ninguno se estiman los tiempos a partir del guion.
  2. Escribir un archivo .ass que FFmpeg quema sobre el video.

El .ass es texto plano: si un subtitulo te queda mal, lo abres y lo corriges
a mano sin volver a procesar nada.
"""
from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from pathlib import Path

from .util import ErrorMotor, cargar_config, info_medio, log, paso


@dataclass
class Palabra:
    texto: str
    inicio: float
    fin: float


# --------------------------------------------------------------------------
# Etapa 1: tiempos por palabra
# --------------------------------------------------------------------------

def _con_whisperx(audio: Path, idioma: str) -> list[Palabra] | None:
    try:
        import whisperx
    except ImportError:
        return None
    import torch

    dispositivo = "cuda" if torch.cuda.is_available() else "cpu"
    tipo = "float16" if dispositivo == "cuda" else "int8"
    log(f"WhisperX en {dispositivo}")

    modelo = whisperx.load_model("large-v3", dispositivo, compute_type=tipo, language=idioma)
    onda = whisperx.load_audio(str(audio))
    resultado = modelo.transcribe(onda, batch_size=16, language=idioma)

    alineador, metadatos = whisperx.load_align_model(language_code=idioma, device=dispositivo)
    alineado = whisperx.align(resultado["segments"], alineador, metadatos, onda, dispositivo)

    palabras = []
    for seg in alineado.get("segments", []):
        for p in seg.get("words", []):
            if p.get("start") is None or p.get("end") is None:
                continue
            palabras.append(Palabra(str(p["word"]).strip(), float(p["start"]), float(p["end"])))
    return palabras or None


def _con_faster_whisper(audio: Path, idioma: str) -> list[Palabra] | None:
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        return None

    try:
        import torch
        en_gpu = torch.cuda.is_available()
    except ImportError:
        en_gpu = False

    dispositivo = "cuda" if en_gpu else "cpu"
    log(f"faster-whisper en {dispositivo}")
    modelo = WhisperModel("large-v3" if en_gpu else "small",
                          device=dispositivo,
                          compute_type="float16" if en_gpu else "int8")
    segmentos, _ = modelo.transcribe(str(audio), language=idioma, word_timestamps=True,
                                     vad_filter=True)

    palabras = []
    for seg in segmentos:
        for p in (seg.words or []):
            palabras.append(Palabra(p.word.strip(), float(p.start), float(p.end)))
    return palabras or None


def _estimado(guion: str, duracion: float) -> list[Palabra]:
    """Reparte el guion sobre la duracion del audio, pesando por longitud.

    Es el ultimo recurso cuando no hay ningun motor de transcripcion instalado.
    Sirve para previsualizar, pero los tiempos no son exactos.
    """
    from .voz import _limpiar_guion

    palabras_txt = _limpiar_guion(guion).split()
    if not palabras_txt:
        raise ErrorMotor("El guion no tiene palabras para subtitular.")

    # Las palabras largas y las que cierran frase duran mas.
    pesos = []
    for w in palabras_txt:
        peso = max(1.0, len(w.rstrip(".,;:!?")) * 0.55)
        if w.endswith((".", "!", "?")):
            peso += 2.2   # pausa de fin de frase
        elif w.endswith((",", ";", ":")):
            peso += 1.0
        pesos.append(peso)

    total = sum(pesos)
    palabras, t = [], 0.0
    for texto, peso in zip(palabras_txt, pesos):
        dur = duracion * peso / total
        palabras.append(Palabra(texto, round(t, 3), round(t + dur, 3)))
        t += dur
    return palabras


def tiempos_por_palabra(audio: str | Path, *, guion: str | Path | None = None,
                        idioma: str = "es") -> list[Palabra]:
    """Devuelve la lista de palabras de la voz en off con su inicio y fin."""
    audio = Path(audio)
    paso("Calculando el tiempo de cada palabra")

    for nombre, fn in (("WhisperX", _con_whisperx), ("faster-whisper", _con_faster_whisper)):
        try:
            if palabras := fn(audio, idioma):
                log(f"{len(palabras)} palabras alineadas con {nombre}")
                return palabras
        except Exception as e:
            log(f"{nombre} fallo ({type(e).__name__}: {e}); pruebo el siguiente metodo")

    if guion is None:
        raise ErrorMotor(
            "No hay ningun motor de transcripcion instalado y no me diste el guion.\n"
            "Instala uno con:  pip install faster-whisper"
        )
    texto = Path(str(guion)).read_text(encoding="utf-8") if Path(str(guion)).exists() else str(guion)
    log("Sin motor de transcripcion: estimo los tiempos desde el guion (aproximado)")
    return _estimado(texto, info_medio(audio).duracion)


# --------------------------------------------------------------------------
# Etapa 2: escribir el .ass
# --------------------------------------------------------------------------

def _tc(segundos: float) -> str:
    """Convierte segundos al formato de tiempo de ASS (h:mm:ss.cc)."""
    segundos = max(0.0, segundos)
    h, resto = divmod(segundos, 3600)
    m, s = divmod(resto, 60)
    return f"{int(h)}:{int(m):02d}:{s:05.2f}"


def _color_en_linea(color: str) -> str:
    """Pasa un color de estilo (&HAABBGGRR) al formato de anulacion en linea (&HBBGGRR&).

    libass ignora la anulacion si se le pasan los 8 digitos con alfa.
    """
    digitos = color.upper().removeprefix("&H").rstrip("&")
    return f"&H{digitos[-6:]}&"


def _escapar(texto: str) -> str:
    return texto.replace("\\", "").replace("{", "(").replace("}", ")")


def _agrupar(palabras: list[Palabra], por_bloque: int) -> list[list[Palabra]]:
    """Agrupa palabras en bloques, cortando siempre al final de una frase."""
    bloques, actual = [], []
    for p in palabras:
        actual.append(p)
        fin_de_frase = p.texto.endswith((".", "!", "?"))
        if len(actual) >= por_bloque or fin_de_frase:
            bloques.append(actual)
            actual = []
    if actual:
        bloques.append(actual)
    return bloques


def generar_ass(palabras: list[Palabra], salida: str | Path, *,
                estilo: str | None = None, resolucion: tuple[int, int] = (1080, 1920)) -> Path:
    """Escribe el archivo .ass con la animacion palabra por palabra."""
    conf = cargar_config("estilos_subtitulos.json")
    nombre_estilo = estilo or conf["estilo_por_defecto"]
    if nombre_estilo not in conf["estilos"]:
        raise ErrorMotor(
            f"Estilo de subtitulo desconocido: {nombre_estilo}. "
            f"Disponibles: {', '.join(conf['estilos'])}"
        )
    e = conf["estilos"][nombre_estilo]
    ancho, alto = resolucion
    y = int(alto * e["posicion_y_pct"] / 100)
    escala = int(e["escala_pop"] * 100)
    color_activo = _color_en_linea(e["color_activo"])

    paso(f"Generando subtitulos (estilo '{nombre_estilo}')")

    cabecera = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {ancho}
PlayResY: {alto}
WrapStyle: 2
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.709

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: H90,{e['fuente']},{e['tamano']},{e['color_base']},{e['color_activo']},{e['color_borde']},&H80000000,0,0,0,0,100,100,0,0,1,{e['borde']},{e['sombra']},5,80,80,60,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""

    lineas = []
    for bloque in _agrupar(palabras, e["palabras_por_bloque"]):
        for activa in bloque:
            partes = []
            for p in bloque:
                texto = _escapar(p.texto)
                if e["mayusculas"]:
                    texto = texto.upper()
                if p is activa:
                    # Color de resaltado + un pequeno "pop" de escala al entrar.
                    partes.append(
                        f"{{\\c{color_activo}\\fscx{escala}\\fscy{escala}"
                        f"\\t(0,90,\\fscx100\\fscy100)}}{texto}{{\\r}}"
                    )
                else:
                    partes.append(texto)
            texto_linea = f"{{\\pos({ancho // 2},{y})}}" + " ".join(partes)
            lineas.append(
                f"Dialogue: 0,{_tc(activa.inicio)},{_tc(activa.fin)},H90,,0,0,0,,{texto_linea}"
            )

    salida = Path(salida)
    salida.parent.mkdir(parents=True, exist_ok=True)
    salida.write_text(cabecera + "\n".join(lineas) + "\n", encoding="utf-8")
    log(f"{len(lineas)} eventos escritos en {salida.name}")
    return salida


def guardar_palabras(palabras: list[Palabra], salida: str | Path) -> Path:
    """Guarda los tiempos en JSON para que el agente pueda leerlos y decidir cortes."""
    salida = Path(salida)
    salida.parent.mkdir(parents=True, exist_ok=True)
    salida.write_text(
        json.dumps([asdict(p) for p in palabras], indent=2, ensure_ascii=False),
        encoding="utf-8")
    return salida
