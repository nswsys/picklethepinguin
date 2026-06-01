#!/usr/bin/env python3
"""Quita el fondo de las fotos de un personaje y genera sus sprites del juego.

Uso:
    python process_sprites.py            # procesa todos los personajes
    python process_sprites.py pickle     # solo pickle
    python process_sprites.py zynx        # solo zynx
"""
import sys
from pathlib import Path
from PIL import Image
from rembg import remove, new_session

OUT = Path("assets")
OUT.mkdir(exist_ok=True)

# personaje -> (carpeta de fotos, prefijo de sprite, pose -> foto de origen).
# Una misma foto puede reutilizarse en varias poses (p.ej. jump = un frame de pie).
CHARACTERS = {
    "pickle": {
        "src": Path("character"),
        "prefix": "penguin",
        "map": {
            "run1": "WhatsApp Image 2026-065-29 at 10.33.22 AM.jpeg",   # alas extendidas
            "run2": "WhatsApp Image 2026-05-29 a7t 10.33.22 AM.jpeg",   # alas abajo
            "jump": "WhatsApp Image 2026-035-29 at 10.33.22 AM.jpeg",   # alas arriba (salto)
            "duck": "WhatsApp Image 2026-05-29 at 10.33.22 AM.jpeg",    # de costado (agachado)
        },
    },
    "zynx": {
        "src": Path("character/zynx"),
        "prefix": "zynx",
        "map": {
            "run1": "WhatsApp Image 2026-06-01 at 11.07.06 AM.jpeg",    # frontal, aletas a los lados
            "run2": "WhatsApp Image 2026-06-01 at 11.047.06 AM.jpeg",   # frontal, aletas adelante
            "jump": "WhatsApp Image 2026-06-01 at 11.047.06 AM.jpeg",   # frontal (vertical = salto)
            "duck": "WhatsApp Image 2026-06-01 at 111.07.06 AM.jpeg",   # horizontal (de costado = deslizándose)
        },
        # NB: NO usamos la foto inclinada con el ala extendida ("...011...") como
        # frame de carrera: es muy ancha e inclinada y hacía que zynx se viera
        # más grande y se "balanceara" al alternar con el frame recto.
        #
        # poses a espejar (la foto del duck mira a la izquierda; el pingüino
        # corre hacia la derecha, así que la volteamos para que deslice de frente)
        "flip": {"duck"},
    },
}

session = new_session("u2net")


def autocrop(im, pad=8):
    bbox = im.getbbox()
    if not bbox:
        return im
    l, t, r, b = bbox
    l = max(0, l - pad); t = max(0, t - pad)
    r = min(im.width, r + pad); b = min(im.height, b + pad)
    return im.crop((l, t, r, b))


def process_character(name, cfg):
    src, prefix, mapping = cfg["src"], cfg["prefix"], cfg["map"]
    flip = cfg.get("flip", set())
    print(f"\n=== {name}  (carpeta {src}, prefijo {prefix}_) ===")
    cut = {}
    for key, fname in mapping.items():
        p = src / fname
        if not p.exists():
            print(f"!! no existe: {fname}"); continue
        print(f"procesando {key}  <-  {fname}")
        im = Image.open(p).convert("RGBA")
        out = remove(im, session=session, post_process_mask=True)
        out = autocrop(out)
        if key in flip:
            out = out.transpose(Image.FLIP_LEFT_RIGHT)
            print("   espejado (FLIP_LEFT_RIGHT)")
        cut[key] = out
        print(f"   recortado a {out.size}")

    # --- normalizar los frames "de pie" al mismo lienzo (alineados por los pies) ---
    standing = [k for k in ("run1", "run2", "jump") if k in cut]
    if standing:
        TARGET_H = 240
        scaled = {}
        for k in standing:
            im = cut[k]
            s = TARGET_H / im.height
            scaled[k] = im.resize((max(1, round(im.width * s)), TARGET_H), Image.LANCZOS)
        canvas_w = max(im.width for im in scaled.values())
        canvas_h = TARGET_H
        for k, im in scaled.items():
            canvas = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
            x = (canvas_w - im.width) // 2          # centrado horizontal
            canvas.paste(im, (x, canvas_h - im.height), im)  # alineado abajo
            canvas.save(OUT / f"{prefix}_{k}.png")
        print(f"frames de pie: lienzo {canvas_w}x{canvas_h}  ratio w/h = {canvas_w/canvas_h:.3f}")

    # --- duck: lienzo propio (ancho/bajo) ---
    if "duck" in cut:
        im = cut["duck"]
        TARGET_H = 150
        s = TARGET_H / im.height
        im = im.resize((max(1, round(im.width * s)), TARGET_H), Image.LANCZOS)
        im.save(OUT / f"{prefix}_duck.png")
        print(f"duck: {im.size}  ratio w/h = {im.width/im.height:.3f}")

    print("listo ->", [p.name for p in OUT.glob(f"{prefix}_*.png")])


if __name__ == "__main__":
    targets = sys.argv[1:] or list(CHARACTERS)
    for name in targets:
        if name not in CHARACTERS:
            print(f"!! personaje desconocido: {name}  (opciones: {', '.join(CHARACTERS)})")
            continue
        process_character(name, CHARACTERS[name])
