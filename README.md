# Pickle the Penguin 🐧

Juego de navegador estilo "endless runner" (como el dino de Chrome) con un pingüino.
Hecho con HTML5 + Canvas + JavaScript puro. Sin dependencias, sin servidor.

## Cómo jugar
- **Saltar:** Espacio o flecha ↑ (o toca la mitad superior en móvil)
- **Agacharse:** flecha ↓ (o toca la mitad inferior en móvil)
- Esquiva los témpanos de hielo y los pájaros. La velocidad sube con el tiempo.

## Jugar online / instalar como app
Está publicado como PWA: **https://nswsys.github.io/picklethepinguin/**
(ábrelo en el móvil y "Añadir a pantalla de inicio"). Detalles de publicación
y **el recordatorio de subir la versión del cache al actualizar** están en
[`DEPLOY.md`](DEPLOY.md).

## Cómo ejecutarlo
Abre `index.html` con doble clic en tu navegador. Para móvil, súbelo a GitHub
Pages / Netlify (gratis) o usa un servidor local:

```bash
python3 -m http.server
# luego abre http://localhost:8000
```

## El pingüino (ya integrado)
El personaje son TUS fotos de la manualidad. Las fotos originales están en
`character/` y los sprites ya recortados (fondo transparente) en `assets/`:

| Sprite | Pose | Foto de origen |
|---|---|---|
| `penguin_run1.png` | alas extendidas | 065-29 |
| `penguin_run2.png` | alas abajo | a7t |
| `penguin_jump.png` | alas arriba (salto) | 035-29 |
| `penguin_duck.png` | de costado (agachado) | at (volteado) |

Los frames `run1` y `run2` se alternan para simular el aleteo al correr.

## Cambiar / regenerar los sprites
Para usar otras fotos o rehacer el recorte:

1. Pon las fotos en `character/`.
2. Ajusta el diccionario `MAP` (foto → sprite) en `process_sprites.py`.
3. Ejecútalo con el entorno virtual incluido:

```bash
python3 -m venv .venv          # solo la primera vez
.venv/bin/pip install rembg onnxruntime pillow numpy   # solo la primera vez
.venv/bin/python process_sprites.py
```

El script quita el fondo con IA (`rembg`), recorta al pingüino y normaliza
los tamaños. Los `.png` resultantes van a `assets/`.

> El juego lee las rutas desde el bloque `SPRITES` al inicio de `game.js`.
> Si una ruta queda vacía o la imagen no carga, dibuja un pingüino de
> respaldo automáticamente, así que nunca se rompe.

> Nota: la carpeta `.venv/` es pesada; puedes borrarla cuando termines de
> generar sprites y recrearla cuando la necesites.
