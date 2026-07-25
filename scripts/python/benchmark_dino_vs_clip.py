"""
Compara CLIP vs DINOv2 en los 3 casos reales ya validados del PEDIDO5,
usando exactamente las mismas fotos descargadas de yupoo (no fotos nuevas).

Metrica: que el album correcto (conocido de antemano) quede #1, y que tan
grande es el "gap" contra el segundo lugar (mas gap = el sistema puede
decidir solo sin pedir confirmacion al usuario).
"""
import glob
import os
import sys
import json
import torch
from PIL import Image

CASES = [
    {
        "name": "Brasil 2004 local",
        "ref": "_test_bgremoval/excel_row2.png",
        "dir": "_match_Z0o6DM/candidatos",
        "correct": "album_150704443",
    },
    {
        "name": "AC Milan 2006 visitante",
        "ref": "_test_bgremoval/excel_row4.png",
        "dir": "_match_rroZA7/candidatos",
        "correct": "album_112819903",
    },
    {
        "name": "Liverpool 1995-96 visitante",
        "ref": "_test_bgremoval/excel_row6.png",
        "dir": "_match_L9K098/candidatos",
        "correct": "album_160694828",
    },
]


def load_clip():
    import open_clip
    model, _, preprocess = open_clip.create_model_and_transforms('ViT-B-32', pretrained='openai')
    model = model.eval()

    def embed(path):
        img = Image.open(path).convert("RGB")
        t = preprocess(img).unsqueeze(0)
        with torch.no_grad():
            f = model.encode_image(t)
        return f / f.norm(dim=-1, keepdim=True)

    return embed


def load_dinov2():
    model = torch.hub.load('facebookresearch/dinov2', 'dinov2_vitb14')
    model = model.eval()
    from torchvision import transforms
    preprocess = transforms.Compose([
        transforms.Resize(256),
        transforms.CenterCrop(224),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
    ])

    def embed(path):
        img = Image.open(path).convert("RGB")
        t = preprocess(img).unsqueeze(0)
        with torch.no_grad():
            f = model(t)  # CLS token pooled output, [1, 768]
        return f / f.norm(dim=-1, keepdim=True)

    return embed


def run_model(embed_fn, model_name):
    print(f"\n{'='*60}\nMODELO: {model_name}\n{'='*60}")
    summary = []
    for case in CASES:
        ref_emb = embed_fn(case["ref"])
        groups = sorted([d for d in glob.glob(os.path.join(case["dir"], "*")) if os.path.isdir(d)])
        ranking = []
        for g in groups:
            label = os.path.basename(g)
            photos = glob.glob(os.path.join(g, "*.jp*g")) + glob.glob(os.path.join(g, "*.png"))
            best = -1.0
            for p in photos:
                try:
                    sim = (ref_emb @ embed_fn(p).T).item()
                except Exception:
                    continue
                if sim > best:
                    best = sim
            if best > -1:
                ranking.append((best, label))
        ranking.sort(reverse=True)
        top_label = ranking[0][1] if ranking else None
        gap = ranking[0][0] - ranking[1][0] if len(ranking) > 1 else 1.0
        correct_at_1 = (top_label == case["correct"])
        print(f"\n  {case['name']}:")
        for score, label in ranking[:5]:
            marker = " <-- CORRECTO" if label == case["correct"] else ""
            marker2 = " <-- #1" if label == top_label else ""
            print(f"    {score:.4f}  {label}{marker}{marker2}")
        print(f"    correcto quedo #1: {correct_at_1} | gap: {gap:.4f}")
        summary.append({"case": case["name"], "correct_at_1": correct_at_1, "gap": round(gap, 4)})
    return summary


if __name__ == "__main__":
    which = sys.argv[1] if len(sys.argv) > 1 else "both"
    results = {}
    if which in ("clip", "both"):
        results["clip"] = run_model(load_clip(), "CLIP ViT-B-32 (openai)")
    if which in ("dino", "both"):
        results["dino"] = run_model(load_dinov2(), "DINOv2 ViT-B/14")

    print(f"\n{'='*60}\nRESUMEN\n{'='*60}")
    print(json.dumps(results, indent=2, ensure_ascii=False))
