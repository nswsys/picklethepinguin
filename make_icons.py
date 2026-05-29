#!/usr/bin/env python3
"""Genera los iconos de la PWA a partir de un sprite del pingüino.

Usa el entorno virtual incluido:
    .venv/bin/python make_icons.py

Crea en /assets:
  - icon-192.png, icon-512.png        (purpose "any")
  - icon-maskable-512.png             (purpose "maskable", con zona segura)
  - apple-touch-icon.png  (180x180)   (iOS, fondo sólido)
"""
from PIL import Image

SRC = "assets/penguin_jump.png"   # alas arriba: queda simpático como icono
TOP = (191, 233, 255)             # #bfe9ff
BOTTOM = (109, 184, 224)          # #6db8e0


def gradient_bg(size):
    """Fondo cuadrado con degradado vertical azul polar."""
    bg = Image.new("RGB", (size, size))
    px = bg.load()
    for y in range(size):
        t = y / (size - 1)
        r = round(TOP[0] + (BOTTOM[0] - TOP[0]) * t)
        g = round(TOP[1] + (BOTTOM[1] - TOP[1]) * t)
        b = round(TOP[2] + (BOTTOM[2] - TOP[2]) * t)
        for x in range(size):
            px[x, y] = (r, g, b)
    return bg


def make_icon(size, peng_frac, out, mode="RGBA"):
    """peng_frac = fracción del lado que ocupa el alto del pingüino."""
    bg = gradient_bg(size).convert(mode)
    peng = Image.open(SRC).convert("RGBA")
    target_h = round(size * peng_frac)
    target_w = round(peng.width * target_h / peng.height)
    peng = peng.resize((target_w, target_h), Image.LANCZOS)
    pos = ((size - target_w) // 2, (size - target_h) // 2)
    bg.paste(peng, pos, peng)
    bg.save(out)
    print("escrito", out, bg.size, mode)


if __name__ == "__main__":
    # "any": el pingüino ocupa bastante
    make_icon(512, 0.72, "assets/icon-512.png")
    make_icon(192, 0.72, "assets/icon-192.png")
    # "maskable": más margen (la plataforma recorta a círculo/squircle)
    make_icon(512, 0.56, "assets/icon-maskable-512.png")
    # iOS: sin alfa (Apple aplica esquinas redondeadas)
    make_icon(180, 0.70, "assets/apple-touch-icon.png", mode="RGB")
