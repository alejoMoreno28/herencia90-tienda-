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
import base64
import threading

from flask import Flask, request, jsonify
from PIL import Image
import torch
import open_clip
from rembg import remove, new_session

app = Flask(__name__)

GAP_THRESHOLD = 0.03

print("Cargando modelos (una sola vez)...")
device = "cuda" if torch.cuda.is_available() else "cpu"
print("  dispositivo:", device)

_clip_model, _, _clip_preprocess = open_clip.create_model_and_transforms('ViT-B-32', pretrained='openai')
_clip_model = _clip_model.to(device).eval()
print("  CLIP listo")

_bg_session = new_session("birefnet-general")
print("  BiRefNet listo")

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


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"ok": True, "device": device})


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
        ref_emb = _embed(_b64_to_image(ref_b64))

        ranking = []
        for g in groups:
            label = g.get("label", "")
            photos = g.get("photos_b64") or []
            best_sim, best_idx = -1.0, -1
            for i, p_b64 in enumerate(photos):
                try:
                    sim = (ref_emb @ _embed(_b64_to_image(p_b64)).T).item()
                except Exception:
                    continue
                if sim > best_sim:
                    best_sim, best_idx = sim, i
            if best_idx >= 0:
                ranking.append({"label": label, "score": round(best_sim, 4), "best_photo_index": best_idx})

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
    buf = io.BytesIO()
    img.save(buf, "PNG")
    out_b64 = base64.b64encode(buf.getvalue()).decode("ascii")

    return jsonify({"image_b64": out_b64, "width": img.width, "height": img.height})


if __name__ == "__main__":
    port = 5055
    print(f"\nServicio de fotos IA escuchando en http://127.0.0.1:{port}")
    print("(Mantener esta ventana abierta mientras se usa el robot de fotos)\n")
    app.run(host="127.0.0.1", port=port, threaded=True)
