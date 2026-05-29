# Publicación y app móvil (PWA) 🐧📲

Cómo está publicado **Pickle the Penguin** y qué hacer al actualizarlo.

## 🔗 Dónde está
- **Juego en vivo:** https://nswsys.github.io/picklethepinguin/
- **Repo:** https://github.com/nswsys/picklethepinguin (público)
- **Hosting:** GitHub Pages (rama `main`, carpeta raíz `/`)

## 📲 Instalar como app en el móvil
Abre el link y añádelo a la pantalla de inicio:
- **Android / Chrome:** banner *"Instalar app"*, o menú ⋮ → *Añadir a pantalla de inicio*.
- **iPhone / Safari:** botón **Compartir** → *Añadir a pantalla de inicio*.

Queda con icono propio, abre a pantalla completa y en horizontal, y funciona
**offline** tras la primera carga (gracias al service worker).

---

## ⚠️ RECORDATORIO AL MODIFICAR EL JUEGO
Cada vez que cambies **cualquier archivo del juego** (`game.js`, `style.css`,
`index.html`, sprites…), **sube el número de versión del cache** en
[`sw.js`](sw.js). Si no, los móviles que ya instalaron la PWA seguirán
sirviendo la versión vieja desde el cache y **no verán tus cambios**.

```js
// sw.js  — sube el número en cada cambio: v1 -> v2 -> v3 ...
const CACHE = "pickle-v2";
```

Y si **añades o quitas archivos**, actualiza también la lista `ASSETS` de `sw.js`.

## ✅ Checklist para publicar cambios
```bash
# 1. (si cambiaste archivos del juego) sube la versión del cache en sw.js
#    const CACHE = "pickle-vN";

# 2. confirma y sube
git add -A
git commit -m "describe el cambio"
git push

# 3. espera ~1 min: GitHub Pages reconstruye solo.
#    En el móvil, cierra y reabre la app; el service worker baja la versión nueva.
```

> **Iconos:** si cambias el sprite del pingüino y quieres regenerar los iconos:
> `.venv/bin/python make_icons.py` (y luego sube la versión del cache).

---

## Historial de la publicación
1. Convertido en **PWA**: `manifest.webmanifest` (pantalla completa, horizontal),
   `sw.js` (cache offline), iconos generados con `make_icons.py`, y meta-tags de
   iOS + registro del service worker en `index.html`.
2. **Fotos personales fuera del repo:** `character/` dejó de rastrearse (siguen
   en local, añadidas a `.gitignore`) para no exponerlas al hacer el repo público.
3. **Repo público** y **GitHub Pages activado** (rama `main`, raíz).
4. Sitio verificado en vivo por HTTPS (manifest, service worker e iconos OK).
