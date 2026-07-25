"""
scripts/python/visual_match.py

Compara una foto de referencia (la del excel del proveedor) contra grupos de
fotos candidatas (una carpeta por album de yupoo) usando CLIP, y decide si
hay un ganador claro o si hace falta confirmacion humana.

Uso:
    python visual_match.py <foto_referencia> <carpeta_con_subcarpetas_por_candidato>

La carpeta de candidatos debe tener una subcarpeta por album, ej:
    candidatos/
        album_150704443/  foto1.jpg foto2.jpg ...
        album_180013171/  foto1.jpg foto2.jpg ...

Imprime un JSON a stdout:
{
  "ranking": [{"label": "...", "score": 0.87, "best_photo": "..."}, ...],
  "decision": "auto" | "confirm",
  "winner": "album_150704443",
  "gap": 0.08
}

Umbral de decision: si la diferencia entre el 1ro y el 2do es >= GAP_THRESHOLD,
se decide solo (auto). Si no, se pide confirmar entre los top candidatos.
"""
import sys
import json
import glob
import os

GAP_THRESHOLD = 0.03


def main():
    if len(sys.argv) < 3:
        print(json.dumps({"error": "uso: visual_match.py <referencia> <carpeta_candidatos>"}))
        sys.exit(1)

    ref_path = sys.argv[1]
    candidates_dir = sys.argv[2]

    import torch
    import open_clip
    from PIL import Image

    device = "cuda" if torch.cuda.is_available() else "cpu"
    model, _, preprocess = open_clip.create_model_and_transforms('ViT-B-32', pretrained='openai')
    model = model.to(device).eval()

    def embed(path):
        img = Image.open(path).convert("RGB")
        t = preprocess(img).unsqueeze(0).to(device)
        with torch.no_grad():
            feat = model.encode_image(t)
            feat = feat / feat.norm(dim=-1, keepdim=True)
        return feat

    ref_emb = embed(ref_path)

    groups = sorted([d for d in glob.glob(os.path.join(candidates_dir, "*")) if os.path.isdir(d)])
    if not groups:
        print(json.dumps({"error": "no se encontraron subcarpetas de candidatos en " + candidates_dir}))
        sys.exit(1)

    ranking = []
    for group_dir in groups:
        label = os.path.basename(group_dir)
        photos = glob.glob(os.path.join(group_dir, "*.jpg")) + glob.glob(os.path.join(group_dir, "*.jpeg")) + glob.glob(os.path.join(group_dir, "*.png"))
        best_sim, best_photo = -1.0, None
        for p in photos:
            try:
                sim = (ref_emb @ embed(p).T).item()
            except Exception:
                continue
            if sim > best_sim:
                best_sim, best_photo = sim, p
        if best_photo:
            ranking.append({"label": label, "score": round(best_sim, 4), "best_photo": best_photo, "photos_checked": len(photos)})

    ranking.sort(key=lambda r: r["score"], reverse=True)

    if len(ranking) == 0:
        print(json.dumps({"error": "ningun candidato tenia fotos validas"}))
        sys.exit(1)

    gap = ranking[0]["score"] - ranking[1]["score"] if len(ranking) > 1 else 1.0
    decision = "auto" if gap >= GAP_THRESHOLD else "confirm"

    print(json.dumps({
        "ranking": ranking,
        "decision": decision,
        "winner": ranking[0]["label"],
        "gap": round(gap, 4),
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
