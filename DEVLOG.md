# Pickle the Penguin 🐧 — Bitácora del proyecto

Juego de navegador estilo *endless runner* (como el dino de Chrome) protagonizado
por un pingüino hecho a mano (manualidad con plato de papel, fotografiado y
recortado). Hecho con **HTML5 + Canvas + JavaScript puro**, sin frameworks, sin
servidor y sin dependencias en tiempo de ejecución.

---

## Índice
1. [Cómo jugar](#cómo-jugar)
2. [Cómo ejecutarlo](#cómo-ejecutarlo)
3. [Estructura del proyecto](#estructura-del-proyecto)
4. [Características del juego](#características-del-juego)
5. [El personaje: de la foto al sprite](#el-personaje-de-la-foto-al-sprite)
6. [Audio y voz](#audio-y-voz)
7. [Cómo modificar cosas](#cómo-modificar-cosas)
8. [Historial de lo que hemos hecho](#historial-de-lo-que-hemos-hecho)

---

## Cómo jugar
| Acción | PC | Móvil |
|---|---|---|
| Saltar | `Espacio` o `↑` | tocar mitad superior |
| Agacharse | `↓` (mantener) | tocar mitad inferior |
| Pausar / reanudar | `P` | tocar la pantalla |
| Empezar / reintentar | cualquier tecla de salto | tocar la pantalla |

Recoge los **peces dorados** que aparecen en vuelo o en el suelo para sumar
puntos extra. **Cada 5 peces** se activa un **power-up al azar**:

| Power-up | Efecto |
|---|---|
| 🛡️ **Shield** | Aura azul ~6s: atraviesas y rompes obstáculos sin morir. |
| 🧲 **Fish Magnet** | ~6s: todos los peces vuelan hacia ti (combo de puntos). |
| 🕊️ **Flight** | ~5s: gravedad suave; toca/`Espacio` = aletear y subir. |
| 🐌 **Slow-Mo** | ~5s: el mundo va a mitad de velocidad; tú respondes igual. |

El medidor (arriba a la izquierda) muestra cuántos peces llevas; al activarse
se ve una barra con el tiempo restante. El cielo cambia de **día → atardecer →
noche** cada 450 pts.

Esquiva **témpanos** (salta), **pájaros** rasantes (salta) o medios (agáchate),
los **en picada** (cronometra), la **bola de nieve** (salta) y el **témpano-arco**
(deslízate agachándote). La variedad crece con la puntuación. El récord se guarda
en el navegador (`localStorage`).

## Cómo ejecutarlo
Doble clic en `index.html`, o para que funcione bien en móvil, sirviéndolo:

```bash
cd picklethepinguin
python3 -m http.server
# abre http://localhost:8000
```

Para publicarlo gratis: súbelo a **GitHub Pages** o **Netlify** (es estático).

## Estructura del proyecto
```
picklethepinguin/
├── index.html          # marcado + overlay de inicio/game over
├── style.css           # estilos (responsive PC/móvil, animación del overlay)
├── game.js             # toda la lógica del juego
├── assets/             # sprites del pingüino (PNG con transparencia)
│   ├── penguin_run1.png   # alas extendidas (correr, frame 1)
│   ├── penguin_run2.png   # alas abajo     (correr, frame 2)
│   ├── penguin_jump.png   # alas arriba    (salto / game over)
│   └── penguin_duck.png   # de costado     (agachado)
├── character/          # fotos originales de la manualidad (8 JPEG)
├── process_sprites.py  # script que recorta el fondo y genera los sprites
├── .venv/              # entorno Python para rembg (regenerar sprites; se puede borrar)
├── README.md           # guía breve
└── DEVLOG.md           # este documento
```

## Características del juego
- **Personaje animado**: corre (alterna 2 frames → aleteo), salta y se agacha.
- **Obstáculos** (variedad que escala con la puntuación):
  - *Témpanos de hielo* en el suelo: pequeño, grande y **alto** (salto exigente).
  - *Pájaros* (desde 200 pts) por la acción que obligan: **rasante** (saltar),
    **medio** (agacharse) y **en picada** (baja en onda → cronometrar).
  - *Bola de nieve* rodante, algo más rápida que el suelo (desde 350 pts).
  - *Témpano-arco* que cuelga desde arriba con un hueco a ras de suelo: hay que
    **deslizarse/agacharse** para pasar (desde 350 pts) — da uso al agachado.
- **Dificultad progresiva**: la velocidad de scroll aumenta con la puntuación.
- **Puntuación y récord** (HUD arriba a la derecha, récord persistente).
- **Fondo polar** con montañas en *parallax* y suelo nevado en movimiento.
- **Pantallas** de inicio y *game over* con el pingüino real (flotando) y textos
  en inglés.
- **Hitboxes ajustadas**: la colisión usa el cuerpo, no las alas/gorro que
  sobresalen, para que sea justa.
- **Bucle de paso fijo (60 fps)**: velocidad consistente en cualquier equipo.
- **Nitidez por DPR**: el canvas escala al `devicePixelRatio` de la pantalla.
- **Game feel**: partículas (nieve, polvo, salpicadura), *screen shake* y
  *squash & stretch* del pingüino.
- **Peces coleccionables** que dan puntos extra durante la partida.
- **Power-ups aleatorios** al comer 5 peces: escudo, imán, vuelo o cámara lenta.
- **Biomas día/atardecer/noche** según la puntuación (con estrellas de noche).
- **Pausa** con `P` y automática al perder el foco de la pestaña.
- **Idioma**: interfaz en inglés.

## El personaje: de la foto al sprite
El protagonista son fotos reales de la manualidad (`character/`). El script
`process_sprites.py`:
1. Quita el fondo (la mesa de madera) con **`rembg`** (IA de segmentación, modelo
   `u2net`).
2. Recorta al pingüino (autocrop por caja transparente).
3. Normaliza tamaños: los frames "de pie" comparten lienzo y se alinean por los
   pies para que la animación no salte; el agachado tiene su propio lienzo.

| Sprite | Pose | Foto de origen |
|---|---|---|
| `penguin_run1.png` | alas extendidas | `…065-29…` |
| `penguin_run2.png` | alas abajo | `…a7t…` |
| `penguin_jump.png` | alas arriba | `…035-29…` |
| `penguin_duck.png` | de costado (volteado) | `…at…` |

El juego ajusta solo las proporciones al aspecto real de cada PNG, así que
nunca se deforma aunque cambies las fotos.

### Regenerar / cambiar sprites
```bash
python3 -m venv .venv                                   # solo 1ª vez
.venv/bin/pip install rembg onnxruntime pillow numpy    # solo 1ª vez
# edita el diccionario MAP en process_sprites.py si usas otras fotos
.venv/bin/python process_sprites.py
```
> `.venv/` es pesada; puedes borrarla al terminar y recrearla cuando la necesites.

## Audio y voz
Todo **sintetizado en el navegador** (Web Audio API), sin archivos de sonido:
- **Salto**: "boop" ascendente.
- **Choque**: "POW/splash" (ráfaga de ruido filtrada + golpe grave tonal).
- **Cada 100 puntos**: campanita alegre.
- **Romper récord (en vivo)**: fanfarria ascendente + cartel "★ NEW BEST! ★" +
  **peces** que entran nadando y el pingüino se come (cada uno con un "nom").
- **Voz al chocar**: usa `speechSynthesis` para *decir* una palabra al azar
  (`Punky!`, `Chunky!`, `Wipeout!`, `Bonk!`, `Splash!`, `Oof!`, `Yikes!`,
  `Kaboom!`, `Oopsie!`) y la muestra como título del game over. Selecciona la
  voz más natural disponible (mejor en Chrome, que trae voces de Google) y usa
  tono agudo/variable para sonar juguetón.

> El audio se activa con el primer toque/tecla (requisito de los navegadores).

## Cómo modificar cosas
Casi todo se ajusta desde constantes al inicio de `game.js`:
| Quiero… | Dónde |
|---|---|
| Cambiar las fotos del pingüino | bloque `SPRITES` (rutas) + `process_sprites.py` |
| Usar un PNG para los pájaros | `SPRITES.bird1` / `SPRITES.bird2` (si vacíos, se dibujan) |
| Más/menos salto o gravedad | `JUMP_V`, `GRAVITY` |
| Velocidad inicial/máxima | `BASE_SPEED`, `MAX_SPEED` |
| Frecuencia de obstáculos | `nextSpawnGap()` |
| Cuándo aparecen aves / obstáculos duros | `canFly` (>200) y `canHard` (>350) en `spawnObstacle()` |
| Mezcla / probabilidad de cada obstáculo | umbrales de `r` en `spawnObstacle()` |
| Alturas de las aves (saltar/agachar) | `baseY` en `makeBird()` |
| Hueco del témpano-arco (deslizarse) | `bottom` en `makeOverhang()` |
| Palabras de choque | arreglo `CRASH_WORDS` |
| Intervalo del sonido de puntos | `Math.floor(score / 100)` en `update()` |
| Cantidad de peces de recompensa | bucle en `spawnFishReward()` |
| Peces para activar power-up | `FISH_PER_POWERUP` |
| Duración de cada power-up | `POWER_DUR` (frames a 60fps) |
| Qué power-ups pueden salir | arreglo `POWERS` |
| Fuerza del aleteo al volar | `FLY_FLAP` |

## Historial de lo que hemos hecho
1. **Análisis y arranque**: definimos un *endless runner* en HTML5/Canvas/JS.
   Estructura inicial con pingüino placeholder dibujado, jugable de inmediato,
   con salto/agacharse, obstáculos, puntuación, récord y controles PC + móvil.
2. **Personaje real**: tomamos 8 fotos de la manualidad, recortamos el fondo con
   `rembg` y generamos los 4 sprites (`run1`, `run2`, `jump`, `duck`),
   normalizados y conectados al juego sin deformación.
3. **Pantallas e idioma**: el pingüino real aparece en inicio y game over (con
   animación de flotación) y toda la interfaz pasó a **inglés**.
4. **Audio y voz**: sonido de salto y de choque, y voz que dice palabras
   aleatorias al chocar (`Punky!`, `Chunky!`…).
5. **Más juego (juice)**: voz menos robótica (selección de voz natural + tono
   juguetón), campanita cada 100 pts, y **recompensa de peces** con fanfarria y
   cartel al romper el récord.
6. **Pájaros con forma**: reemplazamos los óvalos por un pájaro dibujado
   (cuerpo, cabeza, pico, ojo, cola y alas que aletean), con slot opcional para
   un PNG propio.
7. **Documentación**: este `DEVLOG.md`.
8. **Pulido y "game feel"**:
   - **Nitidez por `devicePixelRatio`**: el canvas escala su backing store al DPR
     de la pantalla (dibujamos en coords lógicas 800×300), sin pixelado.
   - **Partículas**: nieve de fondo siempre cayendo, polvo al aterrizar y
     salpicadura de hielo al chocar.
   - **Screen shake** breve en la colisión y **squash & stretch** del pingüino
     al saltar/caer.
   - **Pausa** con `P` y automática al cambiar de pestaña (`visibilitychange`).
   - **Peces coleccionables** durante la partida (+25 pts, con "nom" y chispas).
   - **Biomas día/atardecer/noche** (con estrellas titilantes) según la
     puntuación.
9. **Power-ups aleatorios**: al comer 5 peces se activa uno al azar de cuatro
   (escudo, imán de peces, vuelo y cámara lenta), con medidor de progreso,
   cartel al activarse, barra de tiempo restante y un arpegio propio. El escudo
   rompe obstáculos; el imán atrae peces; el vuelo cambia el control a "aletear";
   la cámara lenta ralentiza el mundo (y ajusta el ritmo de spawn para no
   amontonar obstáculos).

10. **Móvil / tablets**: que se vea y juegue bien en pantallas táctiles.
    - **Encaje en pantalla**: el `#game-wrapper` usa `min(ancho, alto·8/3, 800px)`
      con `dvh`, así el lienzo 8:3 siempre cabe (sobre todo en horizontal).
    - **Tocar para empezar**: el overlay ahora tiene `pointer-events: none`, así
      el toque llega al canvas (antes solo arrancaba con teclado en PC).
    - **Aviso de girar**: en teléfonos en vertical (`max-width: 640px`) se oculta
      el juego y aparece "Rotate your device" (un runner se ve diminuto en
      vertical). Las tablets en vertical sí pueden jugar.
    - **Notch / áreas seguras** (`viewport-fit=cover` + `env(safe-area-inset-*)`),
      sin scroll ni rebote (`overflow/overscroll`), y footer oculto en pantallas
      bajas para ganar alto.

11. **PWA (instalable como app)**: `manifest.webmanifest` (pantalla completa,
    horizontal, iconos), `sw.js` (service worker cache-first → funciona offline),
    iconos generados con `make_icons.py` desde el sprite del pingüino, y los
    meta de iOS. Al abrir el link en el móvil se puede "Añadir a pantalla de
    inicio" y se lanza como app, sin barra del navegador. Requiere HTTPS
    (GitHub Pages lo da gratis).

## Publicar como app (PWA)
1. **Hospedar en HTTPS** (obligatorio para PWA). Lo más fácil: **GitHub Pages**
   → repo en GitHub → *Settings → Pages → Source: `main` / `/root`*. Da una URL
   tipo `https://nswsys.github.io/picklethepinguin/`.
2. **Compartir el link**. Quien lo abra en el móvil verá la opción del navegador
   *"Añadir a pantalla de inicio"* (Android/Chrome muestra incluso un banner de
   instalación; en iOS: Compartir → Añadir a pantalla de inicio).
3. **Listo**: el icono del pingüino queda en el inicio y abre el juego a
   pantalla completa y en horizontal, como una app nativa. Funciona sin conexión
   gracias al service worker.

> Para regenerar los iconos: `.venv/bin/python make_icons.py`. Si cambias algún
> archivo del juego, sube el número de versión `CACHE` en `sw.js` para que los
> dispositivos descarguen la versión nueva.

12. **Más variedad de obstáculos**: aves en 3 niveles por acción (rasante=saltar,
    media=agacharse, **en picada** oscilando en vertical), **bola de nieve**
    rodante (más rápida que el suelo), **témpano alto** (salto exigente) y
    **témpano-arco** colgante con hueco a ras de suelo que obliga a
    **deslizarse/agacharse** (le da uso al agachado). Aparición escalonada por
    puntuación (`canFly` >200, `canHard` >350).

### Ideas pendientes / posibles mejoras
- **Grieta en el suelo** (saltar un vacío; caer = perder) — anotada para después.
- Tipografía más "de juego" en los títulos.
- Más tipos de power-up (doble salto, multiplicador x2) o elegirlos en vez de azar.
- Tabla de récords local (top 5) y logros simples.
- Sprite propio para los pájaros (otra manualidad).
- Transición suave entre biomas (en vez del cambio brusco cada 450 pts).
