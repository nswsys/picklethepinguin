#!/usr/bin/env python3
"""Quita el fondo de las fotos del pinguino y genera los sprites del juego."""
import sys
from pathlib import Path
from PIL import Image
from rembg import remove, new_session

SRC = Path("character")
OUT = Path("assets")
OUT.mkdir(exist_ok=True)

# foto de origen  ->  nombre de sprite
MAP = {
    "WhatsApp Image 2026-065-29 at 10.33.22 AM.jpeg": "run1",   # alas extendidas
    "WhatsApp Image 2026-05-29 a7t 10.33.22 AM.jpeg": "run2",   # alas abajo
    "WhatsApp Image 2026-035-29 at 10.33.22 AM.jpeg": "jump",   # alas arriba (salto)
    "WhatsApp Image 2026-05-29 at 10.33.22 AM.jpeg":  "duck",   # de costado (agachado)
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

cut = {}
for fname, key in MAP.items():
    p = SRC / fname
    if not p.exists():
        print(f"!! no existe: {fname}"); continue
    print(f"procesando {key}  <-  {fname}")
    im = Image.open(p).convert("RGBA")
    out = remove(im, session=session, post_process_mask=True)
    out = autocrop(out)
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
        canvas.save(OUT / f"penguin_{k}.png")
    print(f"\nframes de pie: lienzo {canvas_w}x{canvas_h}  ratio w/h = {canvas_w/canvas_h:.3f}")

# --- duck: lienzo propio (ancho/bajo) ---
if "duck" in cut:
    im = cut["duck"]
    TARGET_H = 150
    s = TARGET_H / im.height
    im = im.resize((max(1, round(im.width * s)), TARGET_H), Image.LANCZOS)
    im.save(OUT / "penguin_duck.png")
    print(f"duck: {im.size}  ratio w/h = {im.width/im.height:.3f}")

print("\nlisto ->", list(OUT.glob("penguin_*.png")))
