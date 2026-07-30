"""
scripts/python/photo_service.py

Servicio local persistente (no se sube a ningun servidor, corre en el PC del
usuario) que carga UNA VEZ los modelos de IA de fotos y queda escuchando,
para no recargarlos en cada foto (eso seria muy lento).

Expone:
  POST /compare      -> compara una foto de referencia contra varios grupos
                         de fotos candidatas (CLIP), devuelve ranking + decision
  POST /remove-bg    -> quita fondo (BiRefNet) y encuadra a 2048x2048
                         (o el tamano que se pida), devuelve PNG en base64

Todo corre local, sin nube, sin cuenta de terceros.
"""
import io
import os
import sys
import base64
import threading

# Debe ir ANTES de importar onnxruntime/rembg: registra las DLL de CUDA que
# trae torch, para que onnxruntime pueda usar la GPU.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cuda_setup  # noqa: E402

from flask import Flask, request, jsonify  # noqa: E402
from PIL import Image  # noqa: E402
import torch  # noqa: E402
import open_clip  # noqa: E402
import onnxruntime as ort  # noqa: E402
from rembg import remove, new_session  # noqa: E402

app = Flask(__name__)

GAP_THRESHOLD = 0.03

# Por debajo de esta proporcion de pixeles opacos se considera que el recorte
# de fondo se comio la prenda en vez de quitarle el fondo. Calibrado mirando
# fotos reales del proveedor: una camiseta completa sobre fondo claro deja
# entre 0.30 y 0.60, y un recorte fallido baja de 0.10.
MIN_PROPORCION_RECORTE = 0.18

print("Cargando modelos (una sola vez)...")
device = "cuda" if torch.cuda.is_available() else "cpu"
print("  dispositivo CLIP:", device)

_clip_model, _, _clip_preprocess = open_clip.create_model_and_transforms('ViT-B-32', pretrained='openai')
_clip_model = _clip_model.to(device).eval()
print("  CLIP listo")


# Ajustes del proveedor CUDA, medidos en esta maquina (RTX 4070 Ti, 12 GB):
#  - SIN gpu_mem_limit onnxruntime reservaba 11.2 GB de 12.2 y dejaba la GPU
#    sin aire: los tiempos se disparaban a 8-24s por foto de forma erratica.
#    Con tope de 8 GB queda estable en ~0.5s.
#  - NO usar arena_extend_strategy=kSameAsRequested: fragmenta la memoria y el
#    modelo falla al pedir bloques grandes (probado, da error de asignacion).
#  - cudnn_conv_algo_search=HEURISTIC evita el calentamiento inicial de ~60s
#    que provoca EXHAUSTIVE (el valor por defecto).
CUDA_PROVIDER_OPTIONS = {
    'device_id': 0,
    'gpu_mem_limit': 8 * 1024 * 1024 * 1024,
    'cudnn_conv_algo_search': 'HEURISTIC',
    'do_copy_in_default_stream': True,
}


def _make_bg_session():
    """
    Intenta crear la sesion de quitar-fondo en GPU (~15x mas rapido que CPU).
    Si CUDA no esta disponible o falla, cae a CPU sin romper nada.
    """
    if cuda_setup.CUDA_DLLS_READY and 'CUDAExecutionProvider' in ort.get_available_providers():
        try:
            session = new_session(
                "birefnet-general",
                providers=[('CUDAExecutionProvider', CUDA_PROVIDER_OPTIONS), 'CPUExecutionProvider'],
            )
            active = session.inner_session.get_providers()
            if 'CUDAExecutionProvider' in active:
                return session, 'cuda'
            # Se creo pero cayo a CPU: se usa igual, pero avisando
            return session, 'cpu (CUDA no se activo)'
        except Exception as exc:
            print("  aviso: no se pudo usar GPU para quitar fondo ->", exc)
    return new_session("birefnet-general"), 'cpu'


_bg_session, _bg_device = _make_bg_session()
print(f"  BiRefNet listo (quitar fondo en: {_bg_device})")

_lock = threading.Lock()


def _b64_to_image(b64_data):
    raw = base64.b64decode(b64_data)
    return Image.open(io.BytesIO(raw)).convert("RGB")


def _embed(img):
    t = _clip_preprocess(img).unsqueeze(0).to(device)
    with torch.no_grad():
        feat = _clip_model.encode_image(t)
        feat = feat / feat.norm(dim=-1, keepdim=True)
    return feat


# CLIP mira la forma y la composicion, y es flojo para el color: entre la Real
# Madrid 2011-12 blanca y la negra de la misma temporada, las dos colgadas en
# la misma pared, les daba practicamente el mismo puntaje. Y el color es
# justamente lo que separa una version de otra.
#
# Por eso se calcula ademas un histograma de color de la zona central de la
# foto (donde va la camiseta) y se usa para desempatar cuando CLIP no logra
# separar dos candidatos.
_COLOR_BINS = (6, 3, 3)  # tono, saturacion, brillo


def _color_hist(img):
    import numpy as np
    ancho, alto = img.size
    # Recorte central: deja la camiseta y bota buena parte de la pared.
    caja = (int(ancho * 0.2), int(alto * 0.2), int(ancho * 0.8), int(alto * 0.8))
    hsv = img.crop(caja).resize((96, 96)).convert("HSV")
    datos = np.asarray(hsv, dtype=np.float32) / 255.0
    idx = [np.clip((datos[:, :, c] * _COLOR_BINS[c]).astype(int), 0, _COLOR_BINS[c] - 1) for c in range(3)]
    plano = (idx[0] * _COLOR_BINS[1] + idx[1]) * _COLOR_BINS[2] + idx[2]
    hist = np.bincount(plano.ravel(), minlength=int(np.prod(_COLOR_BINS))).astype(np.float32)
    norma = np.linalg.norm(hist)
    return hist / norma if norma else hist


def _color_sim(hist_a, hist_b):
    import numpy as np
    return float(np.dot(hist_a, hist_b))


@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "ok": True,
        "device": device,
        "clipDevice": device,
        "bgDevice": _bg_device,
        "cudaDlls": cuda_setup.CUDA_DLLS_READY,
    })


@app.route("/compare", methods=["POST"])
def compare():
    """
    body: {
      "reference_b64": "...",
      "groups": [ { "label": "...", "photos_b64": ["...", "..."] }, ... ]
    }
    """
    data = request.get_json(force=True)
    ref_b64 = data.get("reference_b64")
    groups = data.get("groups") or []
    if not ref_b64 or not groups:
        return jsonify({"error": "faltan reference_b64 o groups"}), 400

    with _lock:
        ref_img = _b64_to_image(ref_b64)
        ref_emb = _embed(ref_img)
        ref_hist = _color_hist(ref_img)

        ranking = []
        for g in groups:
            label = g.get("label", "")
            photos = g.get("photos_b64") or []
            # Puntaje de CADA foto contra la referencia, no solo el mejor. El
            # album del proveedor mezcla la camiseta completa con primeros
            # planos de la etiqueta o el escudo; como la foto de referencia es
            # la camiseta entera, las que mas se le parecen son justamente las
            # que sirven para publicar en el catalogo.
            photo_scores = []
            for i, p_b64 in enumerate(photos):
                try:
                    img = _b64_to_image(p_b64)
                    sim = (ref_emb @ _embed(img).T).item()
                    color = _color_sim(ref_hist, _color_hist(img))
                except Exception:
                    continue
                photo_scores.append({"index": i, "score": round(sim, 4), "color": round(color, 4)})
            if not photo_scores:
                continue
            mejor = max(photo_scores, key=lambda p: p["score"])
            ranking.append({
                "label": label,
                # El album se juzga por su MEJOR foto: que traiga primeros
                # planos no significa que sea la camiseta equivocada.
                "score": mejor["score"],
                "color": max(p["color"] for p in photo_scores),
                "best_photo_index": mejor["index"],
                "photo_scores": photo_scores,
            })

    # Manda CLIP y nada mas.
    #
    # Hubo un desempate por color aqui y se quito: no medi­a lo que parecia. Las
    # fotos del excel son recortes con otras imagenes alrededor, asi que el
    # histograma sale dominado por el fondo y no por la camiseta. Los valores
    # que devolvia eran 0.7%, 0.9%, 1.5% y de golpe 73.8%: ruido, no una señal.
    #
    # Se habia agregado porque acerto una vez con la Real Madrid 2011-12 blanca,
    # pero al medirlo con mas casos se vio que fue suerte, y de paso rompio la
    # Liverpool 95/96, donde CLIP ya habia elegido bien la visitante.
    #
    # El color se sigue calculando y devolviendo porque sirve para revisar y
    # decidir a ojo, pero no reordena nada.
    ranking.sort(key=lambda r: r["score"], reverse=True)

    gap = ranking[0]["score"] - ranking[1]["score"] if len(ranking) > 1 else 1.0
    decision = "auto" if gap >= GAP_THRESHOLD else "confirm"

    return jsonify({
        "ranking": ranking,
        "decision": decision,
        "winner": ranking[0]["label"] if ranking else None,
        "gap": round(gap, 4),
    })


@app.route("/remove-bg", methods=["POST"])
def remove_bg():
    """
    body: { "image_b64": "..." }
    devuelve: { "image_b64": "<png con fondo transparente, SIN encuadrar>" }

    El encuadre a 1200/640 (igual que preventa-square-assets.mjs) lo hace
    Node despues, no este servicio -- asi se reusa la misma logica ya
    probada para todas las fotos del catalogo, en vez de reinventarla aqui.
    """
    data = request.get_json(force=True)
    image_b64 = data.get("image_b64")
    if not image_b64:
        return jsonify({"error": "falta image_b64"}), 400

    raw = base64.b64decode(image_b64)

    with _lock:
        output_bytes = remove(raw, session=_bg_session)

    # normalizar a RGBA valido (rembg ya devuelve PNG con alpha, esto solo
    # protege contra formatos raros de entrada)
    img = Image.open(io.BytesIO(output_bytes)).convert("RGBA")

    # ── Comprobar que el recorte no se comio la prenda ────────────────────
    #
    # En las fotos de detalle (un primer plano del escudo, del cuello, de la
    # etiqueta) la tela llena todo el encuadre y no hay fondo que quitar. El
    # modelo entonces se confunde y recorta la tela, dejando flotando solo el
    # logo o el escudo. Paso con la Barcelona 08/09: quedo el swoosh de Nike,
    # el escudo y la palabra UNICEF sobre el vacio, sin camiseta.
    #
    # Se mide cuanto queda opaco. Si queda muy poco, el recorte se comio la
    # prenda y se devuelve la foto original sin tocar: mejor una foto con
    # fondo que una foto rota.
    import numpy as np
    alpha = np.asarray(img.getchannel("A"), dtype=np.float32) / 255.0
    proporcion = float((alpha > 0.5).mean())

    # Cuanto del BORDE de la imagen quedo opaco. Es lo que separa una foto de la
    # prenda completa de un primer plano, y la proporcion total no lo hace: el
    # recorte del cuello de la Barcelona 08/09 daba 0.54, igual que una camiseta
    # entera.
    #
    # La idea es simple: si se ve la camiseta completa, alrededor hay fondo y el
    # borde queda vacio. Si es un acercamiento, la tela se sale por los lados.
    # Medido en ese album: las completas dieron 0.000, 0.001 y 0.003, y los
    # primeros planos entre 0.285 y 0.731.
    solido = alpha > 0.5
    borde = np.concatenate([solido[0, :], solido[-1, :], solido[:, 0], solido[:, -1]])
    borde_opaco = float(borde.mean())

    if proporcion < MIN_PROPORCION_RECORTE:
        original = Image.open(io.BytesIO(raw)).convert("RGBA")
        buf = io.BytesIO()
        original.save(buf, "PNG")
        return jsonify({
            "image_b64": base64.b64encode(buf.getvalue()).decode("ascii"),
            "width": original.width,
            "height": original.height,
            "recortada": False,
            "proporcion": round(proporcion, 3),
            "borde_opaco": round(borde_opaco, 3),
            "motivo": "el recorte se comia la prenda, se dejo la foto original",
        })

    buf = io.BytesIO()
    img.save(buf, "PNG")
    out_b64 = base64.b64encode(buf.getvalue()).decode("ascii")

    return jsonify({
        "image_b64": out_b64,
        "width": img.width,
        "height": img.height,
        "recortada": True,
        "proporcion": round(proporcion, 3),
        "borde_opaco": round(borde_opaco, 3),
    })


if __name__ == "__main__":
    port = 5055
    print(f"\nServicio de fotos IA escuchando en http://127.0.0.1:{port}")
    print("(Mantener esta ventana abierta mientras se usa el robot de fotos)\n")
    app.run(host="127.0.0.1", port=port, threaded=True)
