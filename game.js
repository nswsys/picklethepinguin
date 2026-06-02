// ===========================================================================
//  Pickle the Penguin 🐧  —  endless runner
// ---------------------------------------------------------------------------
//  VERSION: súbela en cada cambio del juego. Se muestra en pantalla (abajo a la
//  izquierda) para confirmar qué versión está corriendo, y debe coincidir con
//  el número de CACHE en sw.js.
const VERSION = "v14";
// ---------------------------------------------------------------------------
//  Para usar TUS fotos: pon los PNG (fondo transparente) en la carpeta
//  /assets y rellena las rutas de cada personaje en CHARACTERS. Si una ruta
//  está vacía o la imagen no carga, se dibuja un pingüino placeholder.
//
//  Para AÑADIR un personaje: agrega una entrada a CHARACTERS con sus 4 poses
//  (run1/run2/jump/duck) y un botón en index.html con data-char="<id>".
// ===========================================================================

const CHARACTERS = {
  pickle: {
    name: "Pickle",
    scale: 1,                          // tamaño de referencia
    sprites: {
      run1: "assets/penguin_run1.png",   // alas extendidas
      run2: "assets/penguin_run2.png",   // alas abajo (alterna -> aleteo)
      jump: "assets/penguin_jump.png",   // alas arriba (salto)
      duck: "assets/penguin_duck.png",   // de costado (agachado)
    },
  },
  zynx: {
    name: "Zynx",
    scale: 0.9,                        // zynx es más redondo/ancho; lo bajamos para igualar a Pickle
    sprites: {
      run1: "assets/zynx_run1.png",
      run2: "assets/zynx_run2.png",
      jump: "assets/zynx_jump.png",
      duck: "assets/zynx_duck.png",
    },
  },
};

// Sprites compartidos por todos los personajes (no dependen de la elección).
const SHARED_SPRITES = {
  bird1: "",   // (opcional) pájaro, ala arriba — si está vacío se dibuja
  bird2: "",   // (opcional) pájaro, ala abajo
};

// Personaje activo (persiste entre partidas). Se valida contra CHARACTERS.
const CHAR_KEY = "pickle_char";
let selectedChar = localStorage.getItem(CHAR_KEY) || "pickle";
if (!CHARACTERS[selectedChar]) selectedChar = "pickle";

// ---------------------------------------------------------------------------
//  Setup del canvas
// ---------------------------------------------------------------------------
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const W = 800;            // coordenadas internas (lógicas), no píxeles físicos
const H = 300;
const GROUND_Y = H - 40;  // línea del suelo

// Nitidez en pantallas retina / móvil: el "backing store" del canvas se
// escala por devicePixelRatio, pero seguimos dibujando en coordenadas 800x300.
const DPR = Math.min(window.devicePixelRatio || 1, 2);
canvas.width = W * DPR;
canvas.height = H * DPR;
ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

const scoreEl = document.getElementById("score");
const bestEl = document.getElementById("best");
const overlay = document.getElementById("overlay");
const overlayMsg = document.getElementById("overlay-msg");
const nameForm = document.getElementById("name-form");
const nameInput = document.getElementById("name-input");
const nameSkip = document.getElementById("name-skip");
const btnUp = document.getElementById("btn-up");
const btnDown = document.getElementById("btn-down");
const leaderboardEl = document.getElementById("leaderboard");

// ---------------------------------------------------------------------------
//  Carga de imágenes (con fallback)
// ---------------------------------------------------------------------------
//  `images` = sprites EN USO (poses del personaje activo + compartidos); el
//  resto del juego lee de aquí (images.run1, images.duck, images.bird1, ...).
//  `imagesByChar` guarda las poses ya cargadas de cada personaje.
const images = {};
const imagesByChar = {};

function loadImages(done) {
  const tasks = [];   // [charId|null, key, src]  (charId null = compartido)
  for (const [key, src] of Object.entries(SHARED_SPRITES)) {
    if (src) tasks.push([null, key, src]);
  }
  for (const [cid, cfg] of Object.entries(CHARACTERS)) {
    imagesByChar[cid] = {};
    for (const [key, src] of Object.entries(cfg.sprites)) {
      if (src) tasks.push([cid, key, src]);
    }
  }
  if (tasks.length === 0) { done(); return; }
  let pending = tasks.length;
  for (const [cid, key, src] of tasks) {
    const img = new Image();
    const target = cid ? imagesByChar[cid] : images;
    img.onload = () => { target[key] = img; if (--pending === 0) done(); };
    img.onerror = () => { if (--pending === 0) done(); };
    img.src = src;
  }
}

// Activa un personaje: reapunta los sprites en uso y recalcula su aspecto.
function selectCharacter(id) {
  if (!CHARACTERS[id]) id = "pickle";
  selectedChar = id;
  try { localStorage.setItem(CHAR_KEY, id); } catch (e) {}
  const set = imagesByChar[id] || {};
  for (const key of ["run1", "run2", "jump", "duck"]) {
    if (set[key]) images[key] = set[key]; else delete images[key];
  }
  // ajusta el aspecto (w/h) al de los sprites reales para no deformarlos
  const standImg = images.run1 || images.run2 || images.jump;
  aspect.stand = standImg ? standImg.width / standImg.height : 0.85;
  aspect.duck = images.duck ? images.duck.width / images.duck.height : 1.19;
  // escala propia del personaje (para igualar tamaños entre pingüinos distintos)
  charScale = CHARACTERS[id].scale || 1;
  updateCharUI();
}

// Botones de selección de personaje en la pantalla de inicio (overlay).
const charButtons = Array.from(document.querySelectorAll(".char-btn"));

// Resalta el botón activo y refresca la imagen grande del overlay.
function updateCharUI() {
  for (const btn of charButtons) {
    btn.classList.toggle("active", btn.dataset.char === selectedChar);
  }
  const peng = document.getElementById("overlay-peng");
  if (peng) peng.src = overlayPengSrc();
}

// Imagen del personaje activo para el overlay (jump = pose más "expresiva").
function overlayPengSrc() {
  const s = (CHARACTERS[selectedChar] || CHARACTERS.pickle).sprites;
  return s.jump || s.run1 || "assets/penguin_jump.png";
}

for (const btn of charButtons) {
  // pointerdown + stopPropagation: elegir personaje sin disparar "tap = start"
  btn.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    e.stopPropagation();
    selectCharacter(btn.dataset.char);
  });
}

// Toggle de dificultad en la pantalla de inicio (Normal / Easy).
const diffButtons = Array.from(document.querySelectorAll(".diff-btn"));

function selectDifficulty(id) {
  if (!DIFFS[id]) id = "normal";
  difficulty = id;
  try { localStorage.setItem(DIFF_KEY, id); } catch (e) {}
  const d = DIFFS[id];
  BASE_SPEED = d.base;
  MAX_SPEED = d.max;
  speedRampDiv = d.rampDiv;
  spawnGapMul = d.spawnMul;
  updateDiffUI();
}

function updateDiffUI() {
  for (const btn of diffButtons) {
    btn.classList.toggle("active", btn.dataset.diff === difficulty);
  }
}

for (const btn of diffButtons) {
  btn.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    e.stopPropagation();
    selectDifficulty(btn.dataset.diff);
  });
}

// ---------------------------------------------------------------------------
//  Estado del juego
// ---------------------------------------------------------------------------
const State = { READY: "ready", PLAYING: "playing", OVER: "over" };
let state = State.READY;

let score = 0;
let enteringName = false;          // true mientras se teclea el nombre del récord

// ---------------------------------------------------------------------------
//  Tabla de récords (top 5 en localStorage)
// ---------------------------------------------------------------------------
const SCORES_KEY = "pickle_scores";
const MAX_SCORES = 5;

function loadScores() {
  let arr = [];
  try { arr = JSON.parse(localStorage.getItem(SCORES_KEY)) || []; } catch (e) {}
  if (!Array.isArray(arr)) arr = [];
  // migra el récord antiguo de una sola cifra, si lo hubiera
  const old = Number(localStorage.getItem("pickle_best") || 0);
  if (old > 0 && !arr.some((e) => e && e.score === old)) arr.push({ name: "YOU", score: old });
  return arr
    .filter((e) => e && typeof e.score === "number")
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_SCORES);
}

let scores = loadScores();
let best = scores.length ? scores[0].score : 0;
bestEl.textContent = "HI " + String(best).padStart(4, "0");

function qualifies(s) {
  s = Math.floor(s);
  if (s <= 0) return false;
  return scores.length < MAX_SCORES || s > scores[scores.length - 1].score;
}

function addScore(name, s) {
  const entry = { name: (name || "???").slice(0, 10), score: Math.floor(s) };
  scores.push(entry);
  scores.sort((a, b) => b.score - a.score);
  scores = scores.slice(0, MAX_SCORES);
  localStorage.setItem(SCORES_KEY, JSON.stringify(scores));
  best = scores[0].score;
  bestEl.textContent = "HI " + String(best).padStart(4, "0");
  return scores.indexOf(entry);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

function renderLeaderboard(highlight = -1) {
  if (!scores.length) { leaderboardEl.classList.add("hidden"); return; }
  leaderboardEl.classList.remove("hidden");
  leaderboardEl.innerHTML = scores.map((e, i) =>
    `<li class="${i === highlight ? "you" : ""}">` +
    `<span class="rank">${i + 1}.</span>` +
    `<span class="who">${escapeHtml(e.name)}</span>` +
    `<span class="pts">${String(e.score).padStart(4, "0")}</span></li>`
  ).join("");
}

// guardar el nombre del récord
function submitName() {
  if (!enteringName) return;
  let name = (nameInput.value || "").trim().toUpperCase().slice(0, 10) || "YOU";
  localStorage.setItem("pickle_lastname", name);
  const idx = addScore(name, score);
  enteringName = false;
  nameForm.classList.add("hidden");
  nameInput.blur();
  renderLeaderboard(idx);
  overlayMsg.innerHTML = `Saved! Score: <b>${Math.floor(score)}</b> — tap or press Space to retry`;
}
nameForm.addEventListener("submit", (e) => { e.preventDefault(); submitName(); });

// saltar la entrada de nombre: cierra el formulario sin guardar y deja reintentar
function skipName() {
  if (!enteringName) return;
  enteringName = false;
  nameForm.classList.add("hidden");
  nameInput.blur();
  renderLeaderboard();
  overlayMsg.innerHTML = `Game Over — Score: <b>${Math.floor(score)}</b> — tap or press Space to retry`;
}
nameSkip.addEventListener("click", skipName);

let speed = 6;           // velocidad de scroll (px por frame a 60fps)

// Dificultad: "normal" o "easy" (más lenta y espaciada, para los más peques).
// Se elige con un toggle en la pantalla de inicio y persiste en localStorage.
const DIFF_KEY = "pickle_diff";
const DIFFS = {
  normal: { base: 6, max: 15, rampDiv: 120, spawnMul: 1.0 },
  easy:   { base: 5, max: 10, rampDiv: 210, spawnMul: 1.4 },
};
let difficulty = DIFFS[localStorage.getItem(DIFF_KEY)] ? localStorage.getItem(DIFF_KEY) : "normal";
let BASE_SPEED = DIFFS[difficulty].base;   // velocidad inicial (según dificultad)
let MAX_SPEED = DIFFS[difficulty].max;     // velocidad tope
let speedRampDiv = DIFFS[difficulty].rampDiv;  // a mayor divisor, acelera más lento
let spawnGapMul = DIFFS[difficulty].spawnMul;  // separación entre obstáculos

// El pingüino
const penguin = {
  x: 70,
  y: GROUND_Y,
  h: 60,          // alto de pie (el ancho sale del aspecto real del sprite)
  duckH: 40,      // alto agachado
  vy: 0,
  onGround: true,
  ducking: false,
};

// Aspecto (w/h) de cada sprite; se rellena al cargar las imágenes.
// Valores por defecto pensados para el placeholder dibujado.
const aspect = { stand: 0.85, duck: 1.19 };
let charScale = 1;   // escala del personaje activo (iguala tamaños entre pingüinos)

// Dimensiones actuales del pingüino (alto y ancho según pose y sprite real).
function penguinDims() {
  if (penguin.ducking) {
    const h = penguin.duckH * charScale;
    return { h, w: h * aspect.duck };
  }
  const h = penguin.h * charScale;
  return { h, w: h * aspect.stand };
}
const GRAVITY = 0.7;
const JUMP_V = -13;

let obstacles = [];
let spawnTimer = 0;
let frame = 0;

let lastMilestone = 0;   // último hito de 100 pts alcanzado
let prevBest = best;     // récord al empezar la partida (para detectar superación)
let celebrated = false;  // ya se celebró el récord en esta partida
let fishes = [];         // peces de recompensa (solo visual)
let bannerT = 0;         // fotogramas restantes del cartel "NEW BEST!"

let coins = [];          // peces coleccionables durante la partida (+puntos)
let coinTimer = 0;       // cuenta atrás para soltar el próximo pez
let particles = [];      // polvo al aterrizar, splash al chocar, chispas
const snow = [];         // copos de nieve de fondo (ambiente, siempre activos)
const stars = [];        // estrellas para el bioma nocturno
let shake = 0;           // intensidad restante del "screen shake"
let quakeT = 0;          // frames de temblor SOSTENIDO (al romperse el hielo)
let squash = 0;          // squash & stretch (-1 estirado .. 1 aplastado)
let paused = false;

// --- Modo submarino ---------------------------------------------------------
// Paralelo a `state`: dentro de PLAYING el juego puede estar corriendo por la
// superficie (RUN) o bajo el hielo (SWIM), con dos transiciones cortas.
const Mode = { RUN: "run", DIVE: "dive", SWIM: "swim", RISE: "rise" };
let mode = Mode.RUN;
let modeT = 0;             // fotogramas restantes de la transición (dive/rise)
let swimT = 0;             // fotogramas restantes bajo el agua
let swimSpawnT = 0;        // cuenta atrás para el próximo monstruo marino
let swimCoinT = 0;         // cuenta atrás para el próximo pez submarino
let swimHold = false;      // true mientras se mantiene pulsado para nadar arriba
let swimDown = false;      // true mientras se mantiene pulsado para nadar abajo
const ICE_UNDER = 46;      // borde inferior del techo de hielo (escena submarina)
const SEA_BOTTOM = H - 16; // fondo marino
const DIVE_DUR = 34;       // frames de la zambullida
const RISE_DUR = 36;       // frames del ascenso a la superficie
const SWIM_DUR = 540;      // frames bajo el agua (~9 s)
const SWIM_SPEED = 3.4;    // px/frame de nado vertical (control directo up/down)
const bubbles = [];        // burbujas de fondo bajo el agua

// --- Zona de hielo roto (bioma "frozen") ------------------------------------
// El suelo se rompe en témpanos a distintas alturas separados por agua. Hay que
// brincar de uno a otro: caer al agua congela al pingüino y termina la partida.
let frozen = false;        // ¿estamos en la zona de hielo roto?
let floes = [];            // témpanos: { x, w, topY }
let signs = [];            // letreros "FROZEN ZONE" (decorativos, no chocan)
let warnT = 0;             // frames restantes del cartel de advertencia
let warnText = "";         // texto del cartel (zona helada / oso)
let warnColor = "#9fe3ff"; // color del cartel
let freezing = false;      // animación de congelación en curso (cayó al agua)
let freezeT = 0;           // frames restantes de la congelación
let iceTrap = false;       // dibujar el bloque de hielo sobre el pingüino
const FREEZE_DUR = 46;     // frames de la animación de congelación
const FLOE_LEVELS = [GROUND_Y, GROUND_Y - 18, GROUND_Y - 34]; // alturas posibles (escalones suaves)
// Scroll FIJO en la zona helada: el reto de saltar huecos debe ser justo a
// cualquier puntuación (si usáramos `speed`, a score alto sería imposible).
const FROZEN_SPEED = 7.0;
// Témpanos que se hunden: si te quedas parado en uno marcado, tras un margen
// empieza a bajar y, si no saltas, se sumerge y te congela (premia el ritmo).
const SINK_CHANCE = 0.45;     // proporción de témpanos hundibles
const SINK_DELAY = 40;        // frames parado antes de empezar a hundirse
const SINK_RATE = 1.1;        // px/frame que baja una vez activado
const SINK_SUBMERGE = 10;     // px bajo el suelo a los que se considera sumergido

// --- Persecución de jefe: un OSO POLAR gigante te persigue desde atrás -------
// Aparece por tramos. Durante la persecución los obstáculos NO matan: tropiezas
// y el oso recorta distancia. Si te alcanza (lead <= 0) -> game over. Sobrevive
// al tramo y el oso se rinde. El oso acelera conforme avanza el tramo.
let chasing = false;
let chaseT = 0;            // frames restantes del tramo
let chaseLead = 0;        // distancia (px) hasta el oso; 0 = atrapado
let chaseInvT = 0;        // i-frames tras un tropiezo (evita multi-golpe)
let lastChaseScore = 0;   // score del último inicio (ritmo entre persecuciones)
const CHASE_DUR = 900;        // ~15 s de persecución
const CHASE_START_LEAD = 210; // distancia inicial
const CHASE_MAX_LEAD = 240;   // tope (no se aleja más)
const CHASE_EVERY = 650;      // puntos mínimos entre persecuciones
const CHASE_HIT_COST = 70;    // distancia perdida al tropezar con un obstáculo
const CHASE_FISH_GAIN = 22;   // distancia recuperada al comer un pez
const BEAR_W = 150, BEAR_H = 120;

// Power-ups: al comer FISH_PER_POWERUP peces se activa uno AL AZAR.
let fishEaten = 0;       // peces comidos hacia el próximo power-up
let power = null;        // power-up activo: "shield" | "magnet" | "fly" | "slow"
let powerT = 0;          // fotogramas restantes del power-up activo
let timeScale = 1;       // 1 normal, 0.5 en cámara lenta (afecta al mundo)
let powerBannerT = 0;    // cartel "¡SHIELD!" al activar
let powerBannerText = "";
let powerBannerColor = "#fff";
const FISH_PER_POWERUP = 5;
const FLY_FLAP = -7.5;   // impulso de cada aleteo durante el vuelo
const POWERS = ["shield", "magnet", "fly", "slow"];
const POWER_DUR   = { shield: 360, magnet: 360, fly: 300, slow: 300 }; // frames @60fps
const POWER_LABEL = { shield: "SHIELD!", magnet: "FISH MAGNET!", fly: "FLIGHT!", slow: "SLOW-MO!" };
const POWER_COLOR = { shield: "#5fd0ff", magnet: "#ffd34d", fly: "#a98bff", slow: "#7dff9b" };

// ---------------------------------------------------------------------------
//  Obstáculos
// ---------------------------------------------------------------------------
// Témpano de hielo (suelo): pequeño, grande o alto (salto más exigente)
function makeIce() {
  const k = Math.random();
  let w, h;
  if (k < 0.45) { w = 24; h = 36; }       // pequeño
  else if (k < 0.8) { w = 34; h = 50; }   // grande
  else { w = 28; h = 64; }                // alto
  return { type: "ice", x: W + 20, y: GROUND_Y, w, h };
}

// Pájaro según la acción que obliga: rasante (saltar), media (agacharse),
// en picada (baja en onda hacia ti → cronometrar).
function makeBird(behavior) {
  // alturas calibradas a la hitbox: de pie la cabeza llega a ~211px y agachado
  // a ~227px, así "low" obliga a saltar y "mid" obliga a agacharse.
  const baseY = { low: GROUND_Y - 14, mid: GROUND_Y - 38, swoop: GROUND_Y - 80 }[behavior];
  return { type: "bird", behavior, x: W + 20, y: baseY, baseY, w: 40, h: 30, wing: 0 };
}

// Bola de nieve que rueda algo más rápido que el suelo (saltar)
function makeSnowball() {
  const r = 16;
  return { type: "snowball", x: W + 20, y: GROUND_Y, w: r * 2, h: r * 2, r, roll: 0, extra: 2.6 };
}

// Témpano-arco: cuelga desde arriba y deja un hueco a ras de suelo
// (hay que DESLIZARSE / agacharse para pasar).
function makeOverhang() {
  return { type: "overhang", x: W + 20, top: -10, bottom: GROUND_Y - 44, w: 42 };
}

// Charco de agua: hueco ancho en el hielo. Si lo pisas (no lo saltas) caes
// dentro y empieza la fase submarina. NUNCA mata.
function makePuddle() {
  return { type: "puddle", x: W + 20, y: GROUND_Y, w: 70 + Math.random() * 46, h: 12, ripple: 0 };
}

// Monstruo marino (fase submarina): entra por la derecha a una altura y se
// mueve en onda vertical. Chocar SÍ es game over.
function makeMonster() {
  const amp = 18 + Math.random() * 30;
  const baseY = ICE_UNDER + 50 + Math.random() * (SEA_BOTTOM - ICE_UNDER - 110);
  return { type: "seamonster", x: W + 30, baseY, y: baseY, w: 66, h: 40, amp, wig: Math.random() * Math.PI * 2 };
}

function spawnObstacle() {
  const canFly = score > 200;     // aparecen aves
  const canHard = score > 350;    // aparecen picada, bola de nieve y arco
  const canDive = score > 150;    // aparecen charcos (fase submarina)
  const r = Math.random();
  let o;
  if (canDive && r < 0.12) o = makePuddle();
  else if (canHard && r < 0.27) o = makeOverhang();
  else if (canHard && r < 0.41) o = makeSnowball();
  else if (canHard && r < 0.52) o = makeBird("swoop");
  else if (canFly && r < 0.70) o = makeBird(Math.random() < 0.5 ? "low" : "mid");
  else o = makeIce();
  obstacles.push(o);
}

function nextSpawnGap() {
  // a mayor velocidad, obstáculos algo más juntos; en fácil van más espaciados
  const base = 90 - (speed - BASE_SPEED) * 3;
  return (base + Math.random() * 60) * spawnGapMul;
}

// pez coleccionable: da puntos extra al recogerlo en el aire o en el suelo
function spawnCoin() {
  const heights = [GROUND_Y - 18, GROUND_Y - 52, GROUND_Y - 84];
  coins.push({
    x: W + 20,
    y: heights[Math.floor(Math.random() * heights.length)],
    r: 11,
    bob: Math.random() * Math.PI * 2,
  });
}

// pez submarino: bonus durante la fase de nado, en cualquier altura del agua
function spawnSwimCoin() {
  coins.push({
    x: W + 20,
    y: ICE_UNDER + 30 + Math.random() * (SEA_BOTTOM - ICE_UNDER - 50),
    r: 11,
    bob: Math.random() * Math.PI * 2,
  });
}

// ---------------------------------------------------------------------------
//  Partículas (polvo al aterrizar, splash al chocar, chispas al comer)
// ---------------------------------------------------------------------------
function spawnParticles(x, y, n, opts = {}) {
  for (let i = 0; i < n; i++) {
    const ang = (opts.angle ?? Math.random() * Math.PI * 2)
      + (Math.random() - 0.5) * (opts.spread ?? Math.PI * 2);
    const sp = (opts.speed ?? 3) * (0.4 + Math.random());
    const life = (opts.life ?? 28) * (0.7 + Math.random() * 0.6);
    particles.push({
      x, y,
      vx: Math.cos(ang) * sp,
      vy: Math.sin(ang) * sp - (opts.lift ?? 0),
      life, max: life,
      size: (opts.size ?? 3) * (0.6 + Math.random() * 0.8),
      color: opts.color ?? "#ffffff",
      gravity: opts.gravity ?? 0.15,
    });
  }
}
function updateParticles() {
  for (const p of particles) {
    p.x += p.vx; p.y += p.vy; p.vy += p.gravity; p.life--;
  }
  particles = particles.filter((p) => p.life > 0);
}

// ---------------------------------------------------------------------------
//  Nieve y estrellas de fondo (ambiente)
// ---------------------------------------------------------------------------
function initSnow() {
  for (let i = 0; i < 42; i++) {
    snow.push({
      x: Math.random() * W, y: Math.random() * H,
      r: 1 + Math.random() * 2,
      sp: 0.3 + Math.random() * 0.8,
      drift: Math.random() * Math.PI * 2,
    });
  }
}
function updateSnow() {
  for (const s of snow) {
    s.y += s.sp; s.drift += 0.02;
    s.x += Math.sin(s.drift) * 0.4;
    if (s.y > H + 4) { s.y = -4; s.x = Math.random() * W; }
    if (s.x < -4) s.x = W + 4; else if (s.x > W + 4) s.x = -4;
  }
}
function initStars() {
  for (let i = 0; i < 32; i++) {
    stars.push({
      x: Math.random() * W, y: Math.random() * GROUND_Y * 0.7,
      r: 0.4 + Math.random() * 1.2, ph: Math.random() * Math.PI * 2,
    });
  }
}
function initBubbles() {
  if (bubbles.length) return;
  for (let i = 0; i < 30; i++) {
    bubbles.push({
      x: Math.random() * W, y: Math.random() * H,
      r: 1 + Math.random() * 3,
      sp: 0.4 + Math.random() * 0.9,
      drift: Math.random() * Math.PI * 2,
    });
  }
}
function updateBubbles() {
  for (const b of bubbles) {
    b.y -= b.sp; b.drift += 0.03;
    b.x += Math.sin(b.drift) * 0.4;
    if (b.y < -4) { b.y = H + 4; b.x = Math.random() * W; }
  }
}

// ---------------------------------------------------------------------------
//  Audio (sintetizado con Web Audio API — sin archivos)
// ---------------------------------------------------------------------------
let actx = null;
function audio() {
  if (!actx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    actx = new AC();
  }
  if (actx.state === "suspended") actx.resume();
  return actx;
}

// "boop" ascendente al saltar
function playJump() {
  const a = audio(); if (!a) return;
  const t = a.currentTime;
  const o = a.createOscillator(), g = a.createGain();
  o.type = "square";
  o.frequency.setValueAtTime(420, t);
  o.frequency.exponentialRampToValueAtTime(880, t + 0.12);
  g.gain.setValueAtTime(0.16, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
  o.connect(g).connect(a.destination);
  o.start(t); o.stop(t + 0.2);
}

// "POW / splash" al chocar: ráfaga de ruido + golpe tonal grave
function playCrash() {
  const a = audio(); if (!a) return;
  const t = a.currentTime;

  const dur = 0.35;
  const buf = a.createBuffer(1, Math.floor(a.sampleRate * dur), a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2);
  }
  const noise = a.createBufferSource(); noise.buffer = buf;
  const lp = a.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.setValueAtTime(1400, t);
  const ng = a.createGain(); ng.gain.setValueAtTime(0.45, t);
  noise.connect(lp).connect(ng).connect(a.destination);
  noise.start(t);

  const o = a.createOscillator(), og = a.createGain();
  o.type = "sawtooth";
  o.frequency.setValueAtTime(200, t);
  o.frequency.exponentialRampToValueAtTime(55, t + 0.3);
  og.gain.setValueAtTime(0.32, t);
  og.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
  o.connect(og).connect(a.destination);
  o.start(t); o.stop(t + 0.34);
}

// "ding" alegre al alcanzar un hito de puntos
function playPoint() {
  const a = audio(); if (!a) return;
  const t = a.currentTime;
  [988, 1319].forEach((f, i) => {           // si bemol -> mi: campanita
    const o = a.createOscillator(), g = a.createGain();
    const t0 = t + i * 0.06;
    o.type = "sine";
    o.frequency.setValueAtTime(f, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.13, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.13);
    o.connect(g).connect(a.destination);
    o.start(t0); o.stop(t0 + 0.15);
  });
}

// fanfarria ascendente al romper récord
function playFanfare() {
  const a = audio(); if (!a) return;
  const t = a.currentTime;
  [523, 659, 784, 1047].forEach((f, i) => {  // do mi sol do
    const o = a.createOscillator(), g = a.createGain();
    const t0 = t + i * 0.12;
    o.type = "triangle";
    o.frequency.setValueAtTime(f, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.2, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.24);
    o.connect(g).connect(a.destination);
    o.start(t0); o.stop(t0 + 0.26);
  });
}

// "nom" corto al comerse un pez
function playChomp() {
  const a = audio(); if (!a) return;
  const t = a.currentTime;
  const o = a.createOscillator(), g = a.createGain();
  o.type = "square";
  o.frequency.setValueAtTime(320, t);
  o.frequency.exponentialRampToValueAtTime(120, t + 0.08);
  g.gain.setValueAtTime(0.12, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
  o.connect(g).connect(a.destination);
  o.start(t); o.stop(t + 0.11);
}

// "plop" de agua al caer al charco (ruido filtrado grave + breve burbujeo)
function playSplash() {
  const a = audio(); if (!a) return;
  const t = a.currentTime;
  const dur = 0.3;
  const buf = a.createBuffer(1, Math.floor(a.sampleRate * dur), a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 1.5);
  }
  const noise = a.createBufferSource(); noise.buffer = buf;
  const bp = a.createBiquadFilter(); bp.type = "bandpass";
  bp.frequency.setValueAtTime(900, t);
  bp.frequency.exponentialRampToValueAtTime(300, t + 0.25);
  const ng = a.createGain(); ng.gain.setValueAtTime(0.4, t);
  ng.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
  noise.connect(bp).connect(ng).connect(a.destination);
  noise.start(t); noise.stop(t + dur);

  const o = a.createOscillator(), og = a.createGain();
  o.type = "sine";
  o.frequency.setValueAtTime(500, t);
  o.frequency.exponentialRampToValueAtTime(180, t + 0.18);
  og.gain.setValueAtTime(0.18, t);
  og.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
  o.connect(og).connect(a.destination);
  o.start(t); o.stop(t + 0.22);
}

// arpegio brillante ascendente al activar un power-up
function playPowerUp() {
  const a = audio(); if (!a) return;
  const t = a.currentTime;
  [659, 880, 1175, 1568].forEach((f, i) => {   // mi la re sol (agudo)
    const o = a.createOscillator(), g = a.createGain();
    const t0 = t + i * 0.07;
    o.type = "triangle";
    o.frequency.setValueAtTime(f, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.18, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.2);
    o.connect(g).connect(a.destination);
    o.start(t0); o.stop(t0 + 0.22);
  });
}

// activa un power-up al azar y lanza su cartel
function activatePower() {
  power = POWERS[Math.floor(Math.random() * POWERS.length)];
  powerT = POWER_DUR[power];
  powerBannerText = POWER_LABEL[power];
  powerBannerColor = POWER_COLOR[power];
  powerBannerT = 95;
  playPowerUp();
  // pequeño estallido de chispas del color del power-up alrededor del pingüino
  const d = penguinDims();
  spawnParticles(penguin.x + d.w / 2, penguin.y - d.h / 2, 16,
    { color: powerBannerColor, speed: 4, life: 26, gravity: 0.04, size: 2.6 });
}

// --- Voz: elegir la más natural disponible (evita el tono robótico básico) ---
let preferredVoice = null;
function pickVoice() {
  if (!("speechSynthesis" in window)) return;
  const voices = speechSynthesis.getVoices();
  if (!voices.length) return;
  const prefer = [
    /Google US English/i, /Google UK English Female/i,
    /Samantha/i, /Microsoft (Aria|Jenny|Ava|Zira)/i,
    /natural/i, /female/i, /Google/i,
  ];
  for (const re of prefer) {
    const v = voices.find((v) => /^en/i.test(v.lang) && re.test(v.name));
    if (v) { preferredVoice = v; return; }
  }
  preferredVoice = voices.find((v) => /^en/i.test(v.lang)) || voices[0];
}
if ("speechSynthesis" in window) {
  pickVoice();
  speechSynthesis.onvoiceschanged = pickVoice;
}

// Palabras divertidas que "dice" el juego al chocar
const CRASH_WORDS = ["Punky!", "Chunky!", "Wipeout!", "Bonk!", "Splash!", "Oof!", "Yikes!", "Kaboom!", "Oopsie!"];
function sayRandomWord() {
  const word = CRASH_WORDS[Math.floor(Math.random() * CRASH_WORDS.length)];
  if ("speechSynthesis" in window) {
    const u = new SpeechSynthesisUtterance(word.replace("!", ""));
    if (preferredVoice) u.voice = preferredVoice;
    u.lang = preferredVoice ? preferredVoice.lang : "en-US";
    u.rate = 0.95;                          // un poco más lento = más claro
    u.pitch = 1.5 + Math.random() * 0.3;    // agudo y variable = juguetón
    u.volume = 1;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  }
  return word;
}

// ---------------------------------------------------------------------------
//  Controles
// ---------------------------------------------------------------------------
function jump() {
  if (enteringName) return;                  // no reiniciar mientras se teclea
  if (paused) { paused = false; return; }   // un toque también reanuda
  if (state === State.READY || state === State.OVER) { start(); return; }
  if (mode === Mode.SWIM) { swimHold = true; return; }  // bajo el agua: nadar arriba
  if (mode !== Mode.RUN) return;                          // ignorar durante transiciones
  if (power === "fly") {       // durante el vuelo: aletear en el aire
    penguin.vy = FLY_FLAP;
    penguin.onGround = false;
    squash = -0.5;
    playJump();
    return;
  }
  if (penguin.onGround) {
    penguin.vy = JUMP_V;
    penguin.onGround = false;
    squash = -0.7;            // se estira al despegar
    playJump();
  }
}

function setDuck(v) {
  if (state !== State.PLAYING || paused) return;
  penguin.ducking = v && penguin.onGround;
}

function togglePause() {
  if (state !== State.PLAYING) return;
  paused = !paused;
}

addEventListener("keydown", (e) => {
  if (enteringName) {         // deja escribir el nombre (Enter lo envía el form)
    if (e.code === "Escape") { e.preventDefault(); skipName(); }  // Esc = saltar
    return;
  }
  if (e.code === "Space" || e.code === "ArrowUp") { e.preventDefault(); swimHold = true; jump(); }
  if (e.code === "ArrowDown") { e.preventDefault(); swimDown = true; setDuck(true); }
  if (e.code === "KeyP") { e.preventDefault(); togglePause(); }
});
addEventListener("keyup", (e) => {
  if (e.code === "Space" || e.code === "ArrowUp") swimHold = false;
  if (e.code === "ArrowDown") { swimDown = false; setDuck(false); }
});
// pausa automática al cambiar de pestaña / minimizar
document.addEventListener("visibilitychange", () => {
  if (document.hidden && state === State.PLAYING) paused = true;
});

// Táctil / ratón: mitad superior = saltar, mitad inferior = agacharse
function pointerDown(e) {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const pt = e.touches ? e.touches[0] : e;
  const yRel = (pt.clientY - rect.top) / rect.height;
  // bajo el agua: tocar arriba = nadar arriba, tocar abajo = nadar abajo
  if (state === State.PLAYING && mode === Mode.SWIM) {
    if (yRel > 0.5) { swimDown = true; swimHold = false; }
    else { swimHold = true; swimDown = false; }
    return;
  }
  if (yRel > 0.6 && state === State.PLAYING && mode === Mode.RUN) setDuck(true);
  else { swimHold = true; jump(); }
}
function pointerUp() { setDuck(false); swimHold = false; swimDown = false; }

canvas.addEventListener("touchstart", pointerDown, { passive: false });
canvas.addEventListener("touchend", pointerUp);
canvas.addEventListener("mousedown", pointerDown);
addEventListener("mouseup", pointerUp);

// Botones táctiles en pantalla (móvil). Mapean a la misma lógica que el teclado:
// ↑ = saltar / nadar arriba (también arranca la partida), ⌄ = agacharse / nadar abajo.
function holdUp(on)   { swimHold = on; if (on) jump(); }
function holdDown(on) { swimDown = on; setDuck(on); }
function bindHoldButton(el, fn) {
  el.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    try { el.setPointerCapture(e.pointerId); } catch (_) {}
    fn(true);
  });
  const release = (e) => { e.preventDefault(); fn(false); };
  el.addEventListener("pointerup", release);
  el.addEventListener("pointercancel", release);
}
bindHoldButton(btnUp, holdUp);
bindHoldButton(btnDown, holdDown);

// ---------------------------------------------------------------------------
//  Ciclo de vida
// ---------------------------------------------------------------------------
function start() {
  audio();              // "despierta" el audio con el gesto del usuario
  state = State.PLAYING;
  score = 0;
  speed = BASE_SPEED;
  obstacles = [];
  spawnTimer = 30;
  lastMilestone = 0;
  prevBest = best;
  celebrated = false;
  fishes = [];
  bannerT = 0;
  coins = [];
  coinTimer = 90;
  particles = [];
  shake = 0;
  squash = 0;
  paused = false;
  quakeT = 0;
  fishEaten = 0;
  power = null;
  powerT = 0;
  timeScale = 1;
  powerBannerT = 0;
  mode = Mode.RUN;
  modeT = 0;
  swimT = 0;
  swimHold = false;
  swimDown = false;
  frozen = false;
  floes = [];
  signs = [];
  warnT = 0;
  warnText = "";
  freezing = false;
  freezeT = 0;
  iceTrap = false;
  chasing = false;
  chaseT = 0;
  chaseLead = 0;
  chaseInvT = 0;
  lastChaseScore = 0;
  penguin.y = GROUND_Y;
  penguin.vy = 0;
  penguin.onGround = true;
  penguin.ducking = false;
  applyTestHash();      // atajos de prueba por URL (#frozen, #bear, #swim, ...)
  overlay.classList.remove("show");
}

// Atajos de prueba: abre la página con un # para saltar directo a un nivel/modo.
// Ej.: index.html#bear  ·  #frozen  ·  #swim  ·  #night  ·  #easy
// Se relee en cada partida, así que al reintentar vuelves al mismo nivel.
function applyTestHash() {
  const h = (location.hash + " " + location.search).toLowerCase();
  if (!h.trim()) return;
  if (/easy/.test(h)) selectDifficulty("easy");
  // bioma de arranque (cambia el cielo / activa la zona helada)
  if (/frozen|ice|hielo/.test(h)) score = BIOME_LEN * 3 - 6;       // justo antes (ver el efecto)
  else if (/sunset|atardecer/.test(h)) score = BIOME_LEN * 1 + 30; // dentro del atardecer
  else if (/night|noche/.test(h)) score = BIOME_LEN * 2 + 30;      // dentro de la noche
  // al saltar a un bioma alto, evita que el oso se dispare al instante
  if (score > 0) lastChaseScore = score;
  // eventos/modos que se activan al instante
  if (/bear|oso|chase/.test(h)) startChase();
  else if (/swim|dive|water|agua/.test(h)) startDive();
}

function gameOver(customWord) {
  state = State.OVER;
  playCrash();
  const word = customWord || sayRandomWord();

  // sacudida + salpicadura de hielo en el punto del choque
  shake = 14;
  const d0 = penguinDims();
  spawnParticles(penguin.x + d0.w / 2, penguin.y - d0.h / 2, 18,
    { color: "#9fd8f2", speed: 5, life: 34, gravity: 0.25, size: 3, lift: 2 });

  const finalScore = Math.floor(score);
  document.getElementById("overlay-title").textContent = word;
  document.getElementById("overlay-peng").src = overlayPengSrc();

  if (qualifies(finalScore)) {
    // ¡entra al top 5! -> pedir el nombre
    enteringName = true;
    overlayMsg.innerHTML = `New Top 5! Score: <b>${finalScore}</b> — enter your name:`;
    nameInput.value = localStorage.getItem("pickle_lastname") || "";
    nameForm.classList.remove("hidden");
    renderLeaderboard();           // muestra el top actual (aún sin la entrada nueva)
    overlay.classList.add("show");
    setTimeout(() => { nameInput.focus(); nameInput.select(); }, 60);
  } else {
    overlayMsg.innerHTML = `Game Over — Score: <b>${finalScore}</b> — tap or press Space to retry`;
    nameForm.classList.add("hidden");
    renderLeaderboard();
    overlay.classList.add("show");
  }
}

// ---------------------------------------------------------------------------
//  Update
// ---------------------------------------------------------------------------
function update() {
  frame++;
  if (state !== State.PLAYING || paused) return;

  // power-up activo: cuenta atrás y cámara lenta (aplica en todos los modos)
  timeScale = power === "slow" ? 0.5 : 1;
  if (power) { if (--powerT <= 0) { power = null; timeScale = 1; } }

  if (mode === Mode.RUN) { if (freezing) updateFreeze(); else updateRun(); }
  else if (mode === Mode.DIVE) updateDive();
  else if (mode === Mode.SWIM) updateSwim();
  else if (mode === Mode.RISE) updateRise();
}

// velocidad y puntuación: avanzan tanto corriendo como nadando
function advanceScore() {
  score += 0.15 * (speed / BASE_SPEED);
  speed = Math.min(MAX_SPEED, BASE_SPEED + score / speedRampDiv);
  scoreEl.textContent = String(Math.floor(score)).padStart(4, "0");
  const milestone = Math.floor(score / 100);
  if (milestone > lastMilestone) { lastMilestone = milestone; playPoint(); }
}

// peces coleccionables: mover, imán y recogida (común a superficie y agua)
function updateCoins(box) {
  const mouth = penguinMouth();
  for (const c of coins) {
    if (power === "magnet") {
      const dx = mouth.x - c.x, dy = mouth.y - c.y, d = Math.hypot(dx, dy) || 1;
      c.x += (dx / d) * 8;
      c.y += (dy / d) * 8;
    } else {
      c.x -= speed * timeScale;
    }
    c.bob += 0.12;
    const cb = { x: c.x - c.r, y: c.y - c.r, w: c.r * 2, h: c.r * 2 };
    if (hit(box, cb)) {
      c.collected = true;
      score += 25;
      playChomp();
      // durante la persecución, cada pez te da un empujón de ventaja sobre el oso
      if (chasing) chaseLead = Math.min(CHASE_MAX_LEAD, chaseLead + CHASE_FISH_GAIN);
      spawnParticles(c.x, c.y, 8,
        { color: "#ffd34d", speed: 2.4, life: 24, gravity: 0.05, size: 2.4 });
      if (!power && ++fishEaten >= FISH_PER_POWERUP) {
        fishEaten = 0;
        activatePower();
      }
    }
  }
  coins = coins.filter((c) => !c.collected && c.x + c.r > -10);
}

// --- Modo RUN: el endless runner (suelo continuo o zona de hielo roto) -------
function updateRun() {
  // física del pingüino (gravedad más suave mientras vuela)
  penguin.vy += power === "fly" ? 0.34 : GRAVITY;
  penguin.y += penguin.vy;
  if (penguin.y < 50) { penguin.y = 50; if (penguin.vy < 0) penguin.vy = 0; } // techo

  // ¿entrar o salir del bioma de hielo roto?
  const wantFrozen = terrainAt(biomeIndex()) === "floes";
  if (wantFrozen && !frozen) enterFrozen();
  else if (!wantFrozen && frozen && penguin.onGround && penguin.y >= GROUND_Y - 0.5) exitFrozen();

  // aterrizaje: sobre témpanos (frozen) o sobre el suelo continuo
  if (frozen) {
    handleFloeLanding();
    if (freezing) return;            // cayó al agua: arranca la congelación
  } else if (penguin.y >= GROUND_Y) {
    if (!penguin.onGround) landFX();
    penguin.y = GROUND_Y;
    penguin.vy = 0;
    penguin.onGround = true;
  }
  squash *= 0.82;   // vuelve poco a poco a su forma normal

  advanceScore();
  if (warnT > 0) warnT--;

  // persecución del oso polar (dispara/avanza; puede terminar la partida)
  updateChase();
  if (state === State.OVER) return;

  // ¡superaste tu récord! -> recompensa de peces (una vez por partida)
  if (!celebrated && prevBest > 0 && score > prevBest) spawnFishReward();
  updateFishes();

  const box = penguinBox();

  if (frozen) {
    // mover témpanos y letreros a velocidad fija (justa); el reto son los huecos
    const sp = FROZEN_SPEED * timeScale;
    for (const f of floes) f.x -= sp;
    floes = floes.filter((f) => f.x + f.w > -40);
    ensureFloes();
    for (const s of signs) s.x -= sp;
    signs = signs.filter((s) => s.x > -90);
  } else {
    // spawn (el ritmo se ajusta a la cámara lenta para no amontonar obstáculos)
    spawnTimer -= timeScale;
    if (spawnTimer <= 0) {
      spawnObstacle();
      spawnTimer = nextSpawnGap();
    }
    // mover obstáculos + colisión
    for (const o of obstacles) {
      const sp = (speed + (o.type === "snowball" ? o.extra : 0)) * timeScale;
      o.x -= sp;
      if (o.type === "bird") {
        o.wing = (o.wing + 0.2) % (Math.PI * 2);
        // la picada oscila en vertical conforme se acerca
        if (o.behavior === "swoop") o.y = o.baseY + Math.sin((W - o.x) * 0.018) * 52;
      }
      if (o.type === "snowball") o.roll += sp * 0.08;
      if (o.type === "puddle") {
        o.ripple += 0.15;
        // caes si los pies pisan el agua; saltando por encima pasas sin problema
        const cx = penguin.x + penguinDims().w * 0.5;
        if (penguin.onGround && cx > o.x && cx < o.x + o.w) { startDive(); return; }
        continue;                       // el charco nunca te mata
      }
      if (hit(box, obstacleBox(o))) {
        if (chasing) {
          // durante la persecución no mueres: tropiezas y el oso recorta
          if (chaseInvT <= 0) {
            o.smashed = true;
            chaseLead -= CHASE_HIT_COST;
            chaseInvT = 36;
            shake = 9;
            playCrash();
            spawnParticles(o.x + o.w / 2, o.y - o.h / 2, 12,
              { color: "#ffd0d0", speed: 4, life: 26, gravity: 0.2, size: 2.6 });
          }
        } else if (power === "shield") {
          // el escudo rompe el obstáculo en vez de matarte
          o.smashed = true;
          shake = 6;
          playCrash();
          spawnParticles(o.x + o.w / 2, o.y - o.h / 2, 12,
            { color: o.type === "bird" ? "#cdd6e6" : "#bfe6f6",
              speed: 4, life: 26, gravity: 0.2, size: 2.6 });
        } else {
          gameOver();
        }
      }
    }
    obstacles = obstacles.filter((o) => !o.smashed && o.x + o.w > -10);
  }

  // peces coleccionables: aparecen de vez en cuando y suman puntos
  coinTimer -= timeScale;
  if (coinTimer <= 0) { spawnCoin(); coinTimer = 130 + Math.random() * 170; }
  updateCoins(box);
}

// Polvo de nieve + aplastamiento al aterrizar (suelo o témpano).
function landFX() {
  const lw = penguinDims().w;
  spawnParticles(penguin.x + lw * 0.45, penguin.y, 9,
    { color: "#e3f3fc", speed: 2.6, life: 20, angle: -Math.PI / 2,
      spread: Math.PI, gravity: 0.22, size: 2.4 });
  squash = 0.9;
}

// --- Persecución del oso polar ----------------------------------------------
function startChase() {
  chasing = true;
  chaseT = CHASE_DUR;
  chaseLead = CHASE_START_LEAD;
  chaseInvT = 0;
  lastChaseScore = score;
  warnT = 150;
  warnText = "⚠ RUN! POLAR BEAR! ⚠";
  warnColor = "#ffd0d0";
  shake = 10;
  playCrash();
}

function endChase() {
  chasing = false;
  chaseLead = 0;
  warnT = 90;
  warnText = "PHEW! YOU ESCAPED! 🐧";
  warnColor = "#9fff9f";
}

function updateChase() {
  if (frozen) return;     // no coexiste con la zona helada
  // dispara una nueva persecución cada cierto avance (no en cuanto arrancas)
  if (!chasing && score > 300 && score - lastChaseScore >= CHASE_EVERY) startChase();
  if (!chasing) return;
  // el oso ACELERA: al principio te dejas algo de distancia y al final recorta
  // fuerte. Sin chocar se sobrevive justo (acaba cerca); cada tropiezo lo acerca.
  const prog = 1 - chaseT / CHASE_DUR;          // 0..1
  chaseLead = Math.min(CHASE_MAX_LEAD, chaseLead + (0.15 - prog * 0.7) * timeScale);
  chaseT -= timeScale;
  if (chaseInvT > 0) chaseInvT--;
  if (chaseLead <= 0) { chasing = false; gameOver("Caught!"); return; }
  if (chaseT <= 0) endChase();
}

// --- Zona de hielo roto: entrada/salida, generación y física ----------------
function enterFrozen() {
  frozen = true;
  obstacles = [];
  floes = [];
  signs = [];
  ensureFloes();                 // primer témpano ancho bajo el pingüino
  chasing = false;               // no coexiste con la persecución del oso
  warnT = 140;                   // cartel de aviso (acompaña la preparación)
  warnText = "⚠ CAUTION — FROZEN ZONE ⚠";
  warnColor = "#9fe3ff";
  signs.push({ x: W + 40 });     // letrero que entra rodando con el escenario
  // efecto "se rompe el hielo": temblor sostenido + crujido + esquirlas por el suelo
  quakeT = 32;          // ~0.5s de sacudida fuerte antes de calmarse
  shake = 22;
  playCrash();
  for (let i = 0; i < 9; i++) {
    spawnParticles(50 + i * 95, GROUND_Y, 7,
      { color: "#dcf0fb", speed: 6, life: 34, angle: -Math.PI / 2,
        spread: Math.PI * 0.9, gravity: 0.32, size: 3.4, lift: 3 });
  }
}

function exitFrozen() {
  frozen = false;
  floes = [];
  signs = [];
  penguin.y = GROUND_Y;
  penguin.vy = 0;
  penguin.onGround = true;
}

// ¿estamos en los últimos puntos del bioma helado? -> pista sólida de salida
function frozenExiting() {
  const within = score - biomeIndex() * BIOME_LEN;
  return within > BIOME_LEN - FLOE_RUNOUT;
}

// Rellena la lista de témpanos hasta cubrir más allá del borde derecho.
function ensureFloes() {
  let right = floes.length ? floes[floes.length - 1].x + floes[floes.length - 1].w : 0;
  // primer témpano: pista LARGA, a ras de suelo y FIRME (no se hunde). Da tiempo
  // de leer el aviso y prepararse antes del primer hueco (~1.8s).
  if (floes.length === 0) {
    floes.push({ x: -40, w: 900, topY: GROUND_Y, sink: false, stood: 0 });
    right = 860;
  }
  while (right < W + 220) {
    let gap, w, topY, sink = false;
    if (frozenExiting()) {
      // tramo final: hielo continuo, plano y firme para volver al suelo normal
      gap = 0; w = 260; topY = GROUND_Y;
    } else {
      // Témpanos anchos + huecos acotados: con el salto (~277px de alcance a
      // velocidad fija) un brinco SIEMPRE cae en el siguiente témpano, nunca lo
      // sobrevuela (gap + ancho >= 290 > 277). El reto es el timing del salto.
      gap = 90 + Math.random() * 40;                 // 90..130 px
      w = 200 + Math.random() * 80;                  // 200..280 px
      topY = FLOE_LEVELS[Math.floor(Math.random() * FLOE_LEVELS.length)];
      sink = Math.random() < SINK_CHANCE;            // algunos se hunden si te paras
    }
    const x = right + gap;
    floes.push({ x, w, topY, sink, stood: 0 });
    right = x + w;
  }
}

// Aterrizaje sobre témpanos. La ÚNICA forma de morir es caer al agua (a un
// hueco): si hay un témpano bajo los pies, se aterriza sobre él (indulgente).
function handleFloeLanding() {
  const footX = penguin.x + penguinDims().w * 0.5;
  let support = null;
  for (const f of floes) {
    // los témpanos ya sumergidos no sostienen
    if (!f.submerged && footX >= f.x && footX <= f.x + f.w) { support = f; break; }
  }
  if (support) {
    if (penguin.vy >= 0 && penguin.y >= support.topY) {
      if (!penguin.onGround) landFX();
      // témpano hundible: si te quedas parado, tras un margen empieza a bajar;
      // si no saltas a tiempo, se sumerge y te congela.
      if (support.sink) {
        support.stood++;
        if (support.stood > SINK_DELAY) {
          support.topY += SINK_RATE;
          if (support.topY >= GROUND_Y + SINK_SUBMERGE) {
            support.submerged = true;
            startFreeze();
            return;
          }
        }
      }
      penguin.y = support.topY;
      penguin.vy = 0;
      penguin.onGround = true;
    } else {
      penguin.onGround = false;    // subiendo o aún por encima del témpano
    }
  } else {
    penguin.onGround = false;      // sobre un hueco
    if (penguin.y >= GROUND_Y + 4) startFreeze();   // tocaste el agua -> congelación
  }
}

// --- Congelación: el pingüino cae al agua y queda atrapado en un bloque ------
function startFreeze() {
  if (freezing) return;
  freezing = true;
  freezeT = FREEZE_DUR;
  iceTrap = true;
  penguin.onGround = false;
  penguin.ducking = false;
  shake = 8;
  playSplash();
  spawnParticles(penguin.x + penguinDims().w * 0.5, GROUND_Y, 20,
    { color: "#bfe6f6", speed: 4.5, life: 30, gravity: 0.25, size: 3, lift: 3 });
}

function updateFreeze() {
  freezeT--;
  // se hunde un poco hasta quedar atrapado en el hielo
  penguin.y = Math.min(penguin.y + 2.2, GROUND_Y + 24);
  if (freezeT <= 0) { freezing = false; gameOver("Frozen!"); }
}

// --- Transición DIVE: el pingüino se hunde tras pisar el charco -------------
function startDive() {
  mode = Mode.DIVE;
  modeT = DIVE_DUR;
  obstacles = [];
  coins = [];
  shake = 8;
  playSplash();
  spawnParticles(penguin.x + penguinDims().w * 0.5, GROUND_Y, 22,
    { color: "#bfe6f6", speed: 5, life: 30, gravity: 0.3, size: 3, lift: 3 });
}
function updateDive() {
  modeT--;
  penguin.ducking = false;
  penguin.onGround = false;
  penguin.y = Math.min(penguin.y + 5, SEA_BOTTOM);
  if (modeT <= 0) startSwim();
}

// --- Modo SWIM: nado bajo el hielo, esquivando monstruos -------------------
function startSwim() {
  mode = Mode.SWIM;
  swimT = SWIM_DUR;
  penguin.ducking = true;        // pose de costado = estilo "nadando"
  penguin.y = SEA_BOTTOM;
  penguin.vy = 0;
  obstacles = [];
  coins = [];
  swimSpawnT = 45;
  swimCoinT = 60;
  initBubbles();
}
function updateSwim() {
  advanceScore();
  swimT -= timeScale;

  // control directo arriba/abajo (como el salto/agacharse del nivel normal):
  // arriba sube, abajo baja, sin entrada se queda quieto.
  const dir = (swimHold ? -1 : 0) + (swimDown ? 1 : 0);
  penguin.vy = dir * SWIM_SPEED;
  penguin.y += penguin.vy * timeScale;
  const topLimit = ICE_UNDER + penguinDims().h;
  if (penguin.y < topLimit) { penguin.y = topLimit; penguin.vy = 0; }
  if (penguin.y > SEA_BOTTOM) { penguin.y = SEA_BOTTOM; penguin.vy = 0; }

  // monstruos marinos
  swimSpawnT -= timeScale;
  if (swimSpawnT <= 0) { obstacles.push(makeMonster()); swimSpawnT = 70 + Math.random() * 70; }

  // peces bonus
  swimCoinT -= timeScale;
  if (swimCoinT <= 0) { spawnSwimCoin(); swimCoinT = 90 + Math.random() * 120; }

  const box = penguinBox();
  for (const o of obstacles) {
    o.x -= speed * timeScale;
    if (o.type === "seamonster") { o.wig += 0.05 * timeScale; o.y = o.baseY + Math.sin(o.wig) * o.amp; }
    if (hit(box, obstacleBox(o))) {
      if (power === "shield") {
        o.smashed = true;
        shake = 6;
        playCrash();
        spawnParticles(o.x + o.w / 2, o.y, 12,
          { color: "#9fe6c8", speed: 4, life: 26, gravity: 0.05, size: 2.6 });
      } else {
        gameOver();
      }
    }
  }
  obstacles = obstacles.filter((o) => !o.smashed && o.x + o.w > -10);

  updateCoins(box);

  if (swimT <= 0) startRise();
}

// --- Transición RISE: el pingüino asciende y rompe la superficie ------------
function startRise() {
  mode = Mode.RISE;
  modeT = RISE_DUR;
  penguin.ducking = false;       // vuelve a la pose de pie para salir
  obstacles = [];
  coins = [];
  playJump();
  spawnParticles(penguin.x + penguinDims().w * 0.5, penguin.y, 16,
    { color: "#d6f3ff", speed: 3, life: 30, gravity: -0.04, size: 2.6, lift: 4 });
}
function updateRise() {
  advanceScore();
  modeT--;
  penguin.y += ((GROUND_Y - 80) - penguin.y) * 0.2;   // asciende hacia la superficie
  if (modeT <= 0) {
    mode = Mode.RUN;
    penguin.onGround = false;
    penguin.vy = -2;            // sale con un saltito y cae al suelo
    obstacles = [];
    spawnTimer = 50;
    spawnParticles(penguin.x + penguinDims().w * 0.5, GROUND_Y, 18,
      { color: "#bfe6f6", speed: 4, life: 26, gravity: 0.3, size: 3, lift: 3 });
  }
}

function penguinBox() {
  const { w, h } = penguinDims();
  // hitbox más estrecha que el sprite (las alas y el gorro sobresalen) para
  // que la colisión sea justa con el cuerpo.
  const padX = w * 0.22;
  const padTop = h * 0.18;
  return {
    x: penguin.x + padX,
    y: penguin.y - h + padTop,
    w: w - padX * 2,
    h: h - padTop,
  };
}

function obstacleBox(o) {
  const pad = 4;
  if (o.type === "overhang") {
    // cuelga desde arriba; el hueco queda bajo o.bottom (hay que agacharse)
    return { x: o.x + pad, y: o.top, w: o.w - pad * 2, h: o.bottom - o.top };
  }
  if (o.type === "seamonster") {
    // el monstruo tiene o.y como centro vertical
    return { x: o.x + pad + 6, y: o.y - o.h / 2 + pad, w: o.w - pad * 2 - 8, h: o.h - pad * 2 };
  }
  return { x: o.x + pad, y: o.y - o.h + pad, w: o.w - pad * 2, h: o.h - pad * 2 };
}

function hit(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// ---------------------------------------------------------------------------
//  Recompensa al romper récord: peces que el pingüino se come (solo visual)
// ---------------------------------------------------------------------------
function spawnFishReward() {
  celebrated = true;
  playFanfare();
  bannerT = 110;
  for (let i = 0; i < 6; i++) {
    fishes.push({
      x: penguin.x + 160 + Math.random() * 240,
      y: 40 + Math.random() * 150,
      delay: i * 10,        // entran de a uno
      eaten: false,
    });
  }
}

function penguinMouth() {
  const { w, h } = penguinDims();
  return { x: penguin.x + w * 0.8, y: penguin.y - h * 0.62 };
}

function updateFishes() {
  if (!fishes.length) return;
  const m = penguinMouth();
  for (const f of fishes) {
    if (f.delay > 0) { f.delay--; continue; }
    const dx = m.x - f.x, dy = m.y - f.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d < 16) {
      f.eaten = true;
      playChomp();
    } else {
      f.x += (dx / d) * 7;
      f.y += (dy / d) * 7;
    }
  }
  fishes = fishes.filter((f) => !f.eaten);
}

// ---------------------------------------------------------------------------
//  Render
// ---------------------------------------------------------------------------
let groundOffset = 0;

// Cuánta "agua" se ve ahora (0 superficie .. 1 sumergido), para el fundido
// entre la escena de correr y la submarina.
function waterFade() {
  if (mode === Mode.SWIM) return 1;
  if (mode === Mode.DIVE) return 1 - modeT / DIVE_DUR;
  if (mode === Mode.RISE) return modeT / RISE_DUR;
  return 0;
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  if (shake > 0.5) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
  const wf = waterFade();
  // escena de superficie
  drawSky();
  drawBackground();
  drawGround();
  // escena submarina superpuesta (con opacidad de transición)
  if (wf > 0) {
    ctx.save();
    ctx.globalAlpha = wf;
    drawUnderwater();
    ctx.restore();
  }
  for (const c of coins) drawFish(c.x, c.y + Math.sin(c.bob) * 3, c.r);
  for (const o of obstacles) drawObstacle(o);
  if (chasing) drawChase();
  drawPenguin();
  drawParticles();
  for (const f of fishes) if (f.delay <= 0) drawFish(f.x, f.y, 11);
  ctx.restore();
  if (wf < 1) { ctx.save(); ctx.globalAlpha = 1 - wf; drawSnow(); ctx.restore(); } // nieve solo fuera del agua
  drawPowerHud();
  drawSwimHud();
  drawBanner();
  drawWarn();
  drawPowerBanner();
  drawVersion();
  if (paused) drawPauseScreen();
}

// Escena submarina: agua en degradado, techo de hielo, rayos de luz y burbujas
function drawUnderwater() {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#1c6a96");
  g.addColorStop(1, "#06243a");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // rayos de luz que bajan desde el hielo
  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = "#cdeeff";
  for (let i = 0; i < 4; i++) {
    const x = ((i * 230 - frame * 0.4) % (W + 200)) + (i % 2 ? 40 : 0);
    ctx.beginPath();
    ctx.moveTo(x, ICE_UNDER);
    ctx.lineTo(x + 50, ICE_UNDER);
    ctx.lineTo(x + 140, H);
    ctx.lineTo(x - 40, H);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  drawBubbles();

  // techo de hielo (parte de abajo dentada, vista desde el agua)
  ctx.fillStyle = "#dff2fb";
  ctx.fillRect(0, 0, W, ICE_UNDER - 8);
  ctx.fillStyle = "#cfe8f5";
  ctx.beginPath();
  ctx.moveTo(0, ICE_UNDER - 8);
  for (let x = 0; x <= W; x += 28) {
    ctx.lineTo(x + 14, ICE_UNDER - 8 + (x % 56 === 0 ? 10 : 4));
    ctx.lineTo(x + 28, ICE_UNDER - 8);
  }
  ctx.lineTo(W, 0); ctx.lineTo(0, 0);
  ctx.closePath();
  ctx.fill();
}

function drawBubbles() {
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.lineWidth = 1;
  for (const b of bubbles) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

// Barra de tiempo bajo el agua (avisa cuándo saldrás a la superficie)
function drawSwimHud() {
  if (mode !== Mode.SWIM) return;
  const w = 130, x = W / 2 - w / 2, y = 16;
  ctx.save();
  ctx.textAlign = "center";
  ctx.font = "bold 10px system-ui, sans-serif";
  ctx.fillStyle = "#eaffff";
  ctx.fillText("SURFACE IN…", W / 2, y - 3);
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  roundRect(x, y, w, 6, 3); ctx.fill();
  ctx.fillStyle = "#7dff9b";
  roundRect(x, y, w * (swimT / SWIM_DUR), 6, 3); ctx.fill();
  ctx.restore();
}

// Número de versión, abajo a la izquierda (legible en cielo claro u oscuro)
function drawVersion() {
  ctx.save();
  ctx.globalAlpha = 0.6;
  ctx.font = "11px system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(255,255,255,0.8)";
  ctx.strokeText(VERSION, 8, H - 8);
  ctx.fillStyle = "#2b4a5e";
  ctx.fillText(VERSION, 8, H - 8);
  ctx.restore();
}

// Esquina superior izquierda: medidor de peces, o barra del power-up activo
function drawPowerHud() {
  if (state !== State.PLAYING) return;
  const x = 14, y = 16;
  ctx.save();
  ctx.textAlign = "left";
  if (power) {
    const frac = powerT / POWER_DUR[power];
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.fillStyle = POWER_COLOR[power];
    ctx.fillText(POWER_LABEL[power], x, y);
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    roundRect(x, y + 6, 96, 6, 3); ctx.fill();
    ctx.fillStyle = POWER_COLOR[power];
    roundRect(x, y + 6, 96 * frac, 6, 3); ctx.fill();
  } else {
    // peces "comidos" hacia el próximo power-up
    for (let i = 0; i < FISH_PER_POWERUP; i++) {
      ctx.globalAlpha = i < fishEaten ? 1 : 0.25;
      drawFish(x + 8 + i * 17, y + 4, 6);
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

// Cartel grande al activar un power-up (se desvanece)
function drawPowerBanner() {
  if (powerBannerT <= 0) return;
  powerBannerT--;
  ctx.save();
  ctx.globalAlpha = Math.min(1, powerBannerT / 25);
  ctx.textAlign = "center";
  ctx.font = "bold 30px system-ui, sans-serif";
  ctx.lineWidth = 6; ctx.strokeStyle = "#fff";
  ctx.strokeText(powerBannerText, W / 2, 116);
  ctx.fillStyle = powerBannerColor;
  ctx.fillText(powerBannerText, W / 2, 116);
  ctx.restore();
}

// --- Cielo con biomas: día → atardecer → noche, cambia cada 450 pts --------
const SKIES = [
  ["#bfe9ff", "#e8f7ff", "#ffffff"], // 0 día
  ["#ffcaa0", "#ffb3a7", "#ffe7d4"], // 1 atardecer
  ["#15263b", "#21405e", "#41637f"], // 2 noche
  ["#cfe8f5", "#e6f4fb", "#ffffff"], // 3 ZONA HELADA (cielo pálido y frío)
];
// Terreno de cada bioma (paralelo a SKIES): suelo continuo o hielo roto.
const TERRAINS = ["solid", "solid", "solid", "floes"];
const NIGHT_IDX = 2;     // índice del bioma nocturno (para las estrellas)
const BIOME_LEN = 450;   // puntos que dura cada bioma
const BIOME_FADE = 90;   // puntos de fundido suave al final de cada bioma
const FLOE_RUNOUT = 130; // últimos puntos del bioma helado: pista sólida de salida

function biomeIndex() { return Math.floor(score / BIOME_LEN); }
function terrainAt(idx) { return TERRAINS[idx % TERRAINS.length]; }

function hexToRgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function lerpColor(a, b, t) {
  const ca = hexToRgb(a), cb = hexToRgb(b);
  const m = (i) => Math.round(ca[i] + (cb[i] - ca[i]) * t);
  return `rgb(${m(0)},${m(1)},${m(2)})`;
}

// Estado del cielo: bioma actual, siguiente y factor de mezcla 0..1 (fundido).
function skyState() {
  if (state !== State.PLAYING) return { cur: SKIES[0], nxt: SKIES[0], t: 0, idx: 0 };
  const idx = Math.floor(score / BIOME_LEN);
  const within = score - idx * BIOME_LEN;
  const cur = SKIES[idx % SKIES.length];
  let t = 0, nxt = cur;
  if (within > BIOME_LEN - BIOME_FADE) {
    t = (within - (BIOME_LEN - BIOME_FADE)) / BIOME_FADE;   // 0..1
    nxt = SKIES[(idx + 1) % SKIES.length];
  }
  return { cur, nxt, t, idx };
}

// Cuán "de noche" está el cielo ahora (0..1), para fundir las estrellas.
function nightness() {
  if (state !== State.PLAYING) return 0;
  const { idx, t } = skyState();
  const curNight = (idx % SKIES.length) === NIGHT_IDX;
  const nextNight = ((idx + 1) % SKIES.length) === NIGHT_IDX;
  if (curNight) return 1 - t;        // de noche, quizá saliendo hacia el día
  if (nextNight) return t;           // entrando a la noche
  return 0;
}

function drawSky() {
  const { cur, nxt, t } = skyState();
  const g = ctx.createLinearGradient(0, -20, 0, H + 20);
  g.addColorStop(0, lerpColor(cur[0], nxt[0], t));
  g.addColorStop(0.7, lerpColor(cur[1], nxt[1], t));
  g.addColorStop(1, lerpColor(cur[2], nxt[2], t));
  ctx.fillStyle = g;
  ctx.fillRect(-20, -20, W + 40, H + 40);
  const n = nightness();
  if (n > 0.01) drawStars(n);
}
function drawStars(alpha) {
  ctx.fillStyle = "#fff";
  for (const s of stars) {
    ctx.globalAlpha = alpha * (0.45 + 0.45 * Math.sin(frame * 0.05 + s.ph));
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}
function drawParticles() {
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}
function drawSnow() {
  ctx.fillStyle = "#ffffff";
  for (const s of snow) {
    ctx.globalAlpha = 0.35 + (s.r / 3) * 0.4;
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}
function drawPauseScreen() {
  ctx.save();
  ctx.fillStyle = "rgba(11, 30, 45, 0.55)";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.font = "bold 34px system-ui, sans-serif";
  ctx.fillText("PAUSED", W / 2, H / 2 - 4);
  ctx.font = "16px system-ui, sans-serif";
  ctx.fillText("Press P to resume", W / 2, H / 2 + 24);
  ctx.restore();
}

function drawFish(x, y, s) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(-1, 1);                 // mira hacia el pingüino (izquierda)
  ctx.fillStyle = "#ff9a3d";
  ctx.strokeStyle = "#e06f1f";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(0, 0, s, s * 0.6, 0, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();
  ctx.beginPath();                  // cola
  ctx.moveTo(s * 0.7, 0);
  ctx.lineTo(s * 1.4, -s * 0.55);
  ctx.lineTo(s * 1.4, s * 0.55);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#fff";           // ojo
  ctx.beginPath(); ctx.arc(-s * 0.45, -s * 0.15, s * 0.18, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#222";
  ctx.beginPath(); ctx.arc(-s * 0.45, -s * 0.15, s * 0.08, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawBanner() {
  if (bannerT <= 0) return;
  bannerT--;
  ctx.save();
  ctx.globalAlpha = Math.min(1, bannerT / 25);
  ctx.textAlign = "center";
  ctx.font = "bold 32px system-ui, sans-serif";
  const txt = "★ NEW BEST! ★";
  ctx.lineWidth = 6; ctx.strokeStyle = "#fff";
  ctx.strokeText(txt, W / 2, 64);
  ctx.fillStyle = "#ff5a8a";
  ctx.fillText(txt, W / 2, 64);
  ctx.restore();
}

function drawBackground() {
  // colinas/montañas lejanas con parallax suave
  ctx.fillStyle = "#cfeeff";
  const off = (frame * speed * timeScale * 0.2) % 300;
  for (let i = -1; i < 4; i++) {
    const x = i * 300 - off;
    ctx.beginPath();
    ctx.moveTo(x, GROUND_Y);
    ctx.lineTo(x + 150, GROUND_Y - 90);
    ctx.lineTo(x + 300, GROUND_Y);
    ctx.closePath();
    ctx.fill();
  }
}

function drawGround() {
  if (frozen) { drawFrozenGround(); return; }
  groundOffset = (groundOffset + speed * timeScale) % 40;
  ctx.strokeStyle = "#8fb8cc";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y);
  ctx.lineTo(W, GROUND_Y);
  ctx.stroke();
  // motitas de nieve que se desplazan
  ctx.fillStyle = "#a9cfe0";
  for (let x = -groundOffset; x < W; x += 40) {
    ctx.fillRect(x, GROUND_Y + 10, 12, 3);
  }
}

// Zona de hielo roto: mar de fondo + témpanos a distintas alturas + letreros.
function drawFrozenGround() {
  // mar
  const g = ctx.createLinearGradient(0, GROUND_Y - 6, 0, H);
  g.addColorStop(0, "#7ec7e6");
  g.addColorStop(1, "#2b7aa3");
  ctx.fillStyle = g;
  ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
  // destellos de la superficie del agua
  ctx.fillStyle = "rgba(255,255,255,0.22)";
  const off = (frame * FROZEN_SPEED * timeScale) % 30;
  for (let x = -off; x < W; x += 30) ctx.fillRect(x, GROUND_Y + 3, 14, 2);
  // témpanos
  for (const f of floes) drawFloe(f);
  // letreros de advertencia
  for (const s of signs) drawSign(s);
}

function drawFloe(f) {
  const sinking = f.sink && f.stood > SINK_DELAY;
  // tiembla justo antes/durante el hundimiento
  const shudder = sinking ? (Math.random() - 0.5) * 2 : 0;
  const bob = Math.sin(frame * 0.05 + f.x * 0.02) * 1.5;
  const top = f.topY + bob + shudder;
  // cuerpo de hielo (los hundibles, más grisáceos como aviso)
  ctx.fillStyle = f.sink ? "#c7dcea" : "#dcf0fb";
  ctx.beginPath();
  ctx.moveTo(f.x - 4, top);
  ctx.lineTo(f.x + f.w + 4, top);
  ctx.lineTo(f.x + f.w - 6, GROUND_Y + 26);
  ctx.lineTo(f.x + 6, GROUND_Y + 26);
  ctx.closePath();
  ctx.fill();
  // superficie nevada
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(f.x - 4, top - 4, f.w + 8, 7);
  // sombra/cara azul bajo la superficie
  ctx.fillStyle = f.sink ? "#9cc0d8" : "#aed6ec";
  ctx.fillRect(f.x + 2, top + 5, f.w - 4, 5);
  // grietas: aviso de que este témpano se hunde si te paras
  if (f.sink) {
    ctx.strokeStyle = "rgba(70,110,140,0.55)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    const cx = f.x + f.w * 0.5;
    ctx.moveTo(cx - 18, top + 2); ctx.lineTo(cx - 4, top + 12); ctx.lineTo(cx - 10, top + 22);
    ctx.moveTo(cx + 16, top + 2); ctx.lineTo(cx + 4, top + 13); ctx.lineTo(cx + 12, top + 22);
    ctx.stroke();
  }
}

function drawSign(s) {
  const x = s.x, base = GROUND_Y;
  // poste
  ctx.fillStyle = "#8a6a44";
  ctx.fillRect(x - 3, base - 58, 6, 58);
  // tabla
  const bw = 130, bh = 36, bx = x - bw / 2, by = base - 96;
  ctx.fillStyle = "#ffd34d";
  ctx.strokeStyle = "#b9810a";
  ctx.lineWidth = 3;
  ctx.fillRect(bx, by, bw, bh);
  ctx.strokeRect(bx, by, bw, bh);
  ctx.fillStyle = "#1c2b3a";
  ctx.font = "bold 13px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("⚠ FROZEN ZONE", x, by + 23);
  ctx.textAlign = "left";
}

// Cartel parpadeante al entrar a la zona helada.
function drawWarn() {
  if (warnT <= 0) return;
  const fade = warnT > 120 ? 1 : warnT / 120;
  const blink = frame % 30 < 15 ? 1 : 0.5;
  ctx.save();
  ctx.globalAlpha = fade * blink;
  ctx.textAlign = "center";
  ctx.font = "bold 26px system-ui, sans-serif";
  const txt = warnText || "⚠ CAUTION ⚠";
  ctx.lineWidth = 6;
  ctx.strokeStyle = "#0b1e2d";
  ctx.strokeText(txt, W / 2, 42);
  ctx.fillStyle = warnColor;
  ctx.fillText(txt, W / 2, 42);
  ctx.restore();
}

// El oso polar perseguidor + viñeta de peligro cuando está cerca.
function drawChase() {
  // El pingüino corre pegado a la izquierda, así que mapeamos la distancia real
  // a los ~64px disponibles: el oso (enorme, saliéndose por el borde) asoma
  // siempre y su cabeza se acerca al pingüino conforme baja el lead.
  const frac = Math.max(0, Math.min(1, chaseLead / CHASE_MAX_LEAD));
  // la cabeza del oso queda SIEMPRE a la vista (acechando) y se acerca al
  // pingüino conforme baja el lead: hocico de ~x40 (lejos) a ~x70 (te atrapa)
  const noseX = penguin.x - frac * 30;
  drawPolarBear(noseX - BEAR_W, GROUND_Y);
  if (chaseLead < 80) {                     // peligro: bordes rojos al acercarse
    const a = (1 - chaseLead / 80) * 0.5;
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.32, W / 2, H / 2, W * 0.7);
    g.addColorStop(0, "rgba(200,0,0,0)");
    g.addColorStop(1, `rgba(190,0,0,${a})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
}

function drawPolarBear(x, base) {
  const cx = x + BEAR_W * 0.5;
  const gallop = Math.sin(frame * 0.4) * 7;
  ctx.save();
  // patas (galope)
  ctx.fillStyle = "#dbe7f2";
  ctx.fillRect(x + 28, base - 34, 20, 34 + gallop * 0.4);
  ctx.fillRect(x + BEAR_W - 58, base - 34, 20, 34 - gallop * 0.4);
  ctx.fillRect(x + 58, base - 30, 18, 30 - gallop * 0.4);
  ctx.fillRect(x + BEAR_W - 88, base - 30, 18, 30 + gallop * 0.4);
  // cuerpo + ancas
  ctx.fillStyle = "#f3f7fc";
  ctx.beginPath(); ctx.ellipse(cx - 6, base - 58, BEAR_W * 0.46, 46, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(x + 34, base - 60, 42, 44, 0, 0, Math.PI * 2); ctx.fill();
  // cabeza (mirando al pingüino, a la derecha)
  const hx = x + BEAR_W - 26, hy = base - 80;
  ctx.beginPath(); ctx.arc(hx, hy, 34, 0, Math.PI * 2); ctx.fill();
  // oreja
  ctx.beginPath(); ctx.arc(hx - 20, hy - 26, 11, 0, Math.PI * 2); ctx.fill();
  // hocico
  ctx.fillStyle = "#e7eff8";
  ctx.beginPath(); ctx.ellipse(hx + 20, hy + 8, 22, 16, 0, 0, Math.PI * 2); ctx.fill();
  // nariz
  ctx.fillStyle = "#2a2a33";
  ctx.beginPath(); ctx.ellipse(hx + 38, hy + 3, 6, 5, 0, 0, Math.PI * 2); ctx.fill();
  // ceja + ojo (gesto fiero)
  ctx.strokeStyle = "#2a2a33"; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(hx - 6, hy - 14); ctx.lineTo(hx + 12, hy - 8); ctx.stroke();
  ctx.fillStyle = "#2a2a33";
  ctx.beginPath(); ctx.arc(hx + 4, hy - 4, 4, 0, Math.PI * 2); ctx.fill();
  // boca abierta con colmillos
  ctx.fillStyle = "#7a1f25";
  ctx.beginPath(); ctx.ellipse(hx + 26, hy + 20, 13, 8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.moveTo(hx + 17, hy + 16); ctx.lineTo(hx + 21, hy + 24); ctx.lineTo(hx + 25, hy + 16);
  ctx.lineTo(hx + 30, hy + 24); ctx.lineTo(hx + 34, hy + 16);
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

function drawObstacle(o) {
  if (o.type === "bird") {
    // si hay PNG propio (bird1/bird2) se usa; si no, se dibuja el pájaro
    const sprite = images.bird1 && (Math.sin(o.wing) > 0 ? images.bird1 : (images.bird2 || images.bird1));
    if (sprite) {
      ctx.drawImage(sprite, o.x, o.y - o.h, o.w, o.h);
    } else {
      drawBird(o);
    }
  } else if (o.type === "snowball") {
    drawSnowball(o);
  } else if (o.type === "overhang") {
    drawOverhang(o);
  } else if (o.type === "puddle") {
    drawPuddle(o);
  } else if (o.type === "seamonster") {
    drawMonster(o);
  } else {
    // témpano de hielo (triangulito)
    ctx.fillStyle = "#7fc7e8";
    ctx.strokeStyle = "#4f9bc4";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(o.x, o.y);
    ctx.lineTo(o.x + o.w / 2, o.y - o.h);
    ctx.lineTo(o.x + o.w, o.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}

// Charco de agua en el hielo: hueco oscuro con brillo y ondas
function drawPuddle(o) {
  const cx = o.x + o.w / 2, cy = GROUND_Y + 3, rx = o.w / 2;
  ctx.save();
  // hueco de agua
  const g = ctx.createLinearGradient(0, cy - 9, 0, cy + 7);
  g.addColorStop(0, "#9fdcff");
  g.addColorStop(1, "#2f7fb0");
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(cx, cy, rx, 9, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#6fb0d4"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(cx, cy, rx, 9, 0, 0, Math.PI * 2); ctx.stroke();
  // ondas / brillo
  ctx.strokeStyle = "rgba(255,255,255,0.55)"; ctx.lineWidth = 1.5;
  const k = 0.5 + 0.5 * Math.sin(o.ripple);
  ctx.beginPath(); ctx.ellipse(cx - rx * 0.2, cy - 1, rx * 0.4 * k, 2.4 * k, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}

// Monstruo marino: cuerpo con cola, fauces abiertas y dientes (centro en o.y)
function drawMonster(o) {
  const w = o.w, h = o.h;
  ctx.save();
  ctx.translate(o.x + w / 2, o.y);
  // cola con aletas (a la derecha)
  ctx.fillStyle = "#2f8f78";
  tri(w * 0.28, -h * 0.12, w * 0.6, -h * 0.42, w * 0.5, h * 0.05);
  tri(w * 0.28, h * 0.12, w * 0.6, h * 0.42, w * 0.5, -h * 0.05);
  // cuerpo
  ctx.fillStyle = "#3aa68a";
  ctx.strokeStyle = "#1f6f5c";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, 0, w * 0.42, h * 0.42, 0, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();
  // aleta dorsal
  ctx.fillStyle = "#2f8f78";
  tri(-w * 0.05, -h * 0.4, w * 0.12, -h * 0.62, w * 0.18, -h * 0.34);
  // fauces abiertas (a la izquierda, hacia el pingüino)
  ctx.fillStyle = "#16302b";
  ctx.beginPath();
  ctx.moveTo(-w * 0.16, -h * 0.2);
  ctx.lineTo(-w * 0.52, 0);
  ctx.lineTo(-w * 0.16, h * 0.2);
  ctx.closePath(); ctx.fill();
  // dientes
  ctx.fillStyle = "#fff";
  for (let i = 0; i < 3; i++) {
    const tx = -w * 0.2 - i * w * 0.1;
    tri(tx, -h * 0.16, tx - 3, -h * 0.04, tx - 7, -h * 0.16);
    tri(tx, h * 0.16, tx - 3, h * 0.04, tx - 7, h * 0.16);
  }
  // ojo
  ctx.fillStyle = "#fff"; ellipse(w * 0.02, -h * 0.16, h * 0.13, h * 0.13);
  ctx.fillStyle = "#111"; ellipse(w * 0.04, -h * 0.16, h * 0.06, h * 0.06);
  ctx.restore();
}

// Bola de hielo azul con marcas de rodadura que giran (resalta sobre el cielo)
function drawSnowball(o) {
  const cx = o.x + o.r, cy = o.y - o.r;
  ctx.save();
  // relleno con degradado azul para dar volumen
  const g = ctx.createRadialGradient(cx - o.r * 0.3, cy - o.r * 0.3, o.r * 0.2, cx, cy, o.r);
  g.addColorStop(0, "#bfeaff");
  g.addColorStop(1, "#3f9bd6");
  ctx.fillStyle = g;
  ctx.strokeStyle = "#1f6ea3";
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(cx, cy, o.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // marcas de rodadura que giran
  ctx.strokeStyle = "rgba(31, 110, 163, 0.7)";
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 3; i++) {
    const a = o.roll + i * (Math.PI * 2 / 3);
    ctx.beginPath();
    ctx.arc(cx, cy, o.r * 0.55, a, a + 0.9);
    ctx.stroke();
  }
  // brillo especular fijo (lectura clara contra fondos claros)
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ellipse(cx - o.r * 0.35, cy - o.r * 0.35, o.r * 0.22, o.r * 0.16);
  ctx.restore();
}

// Témpano-arco que cuelga desde arriba con carámbanos; deja el hueco abajo
function drawOverhang(o) {
  const x = o.x, w = o.w, top = o.top, bot = o.bottom;
  ctx.save();
  ctx.fillStyle = "#9bd6f0";
  ctx.strokeStyle = "#5fa8cc";
  ctx.lineWidth = 2;
  roundRect(x, top, w, bot - top - 6, 6); ctx.fill(); ctx.stroke();
  // carámbanos en el borde inferior
  ctx.fillStyle = "#cdeefb";
  const n = 4;
  for (let i = 0; i < n; i++) {
    const ix = x + 5 + i * (w - 10) / (n - 1);
    tri(ix - 4, bot - 8, ix + 4, bot - 8, ix, bot + 7);
  }
  ctx.restore();
}

// Pájaro dibujado (págalo/gaviota) mirando a la izquierda, con alas que aletean
function drawBird(o) {
  const W = o.w, Hb = o.h;
  const flap = Math.sin(o.wing);          // -1..1
  const dark = "#3c4453", mid = "#525b6e", belly = "#e9eef5", beak = "#f6a623";

  ctx.save();
  ctx.translate(o.x + W / 2, o.y - Hb / 2);

  // ala trasera (más oscura)
  ctx.fillStyle = dark;
  tri(2, -1, W * 0.34, -flap * Hb * 0.55 - 1, W * 0.12, Hb * 0.06);

  // cuerpo + panza
  ctx.fillStyle = mid;
  ellipse(0, 0, W * 0.34, Hb * 0.30);
  ctx.fillStyle = belly;
  ellipse(-W * 0.04, Hb * 0.09, W * 0.24, Hb * 0.17);

  // cola
  ctx.fillStyle = mid;
  tri(W * 0.26, -Hb * 0.02, W * 0.55, -Hb * 0.20, W * 0.52, Hb * 0.16);

  // cabeza
  ellipse(-W * 0.30, -Hb * 0.06, Hb * 0.26, Hb * 0.26);

  // pico
  ctx.fillStyle = beak;
  tri(-W * 0.42, -Hb * 0.12, -W * 0.66, -Hb * 0.02, -W * 0.42, Hb * 0.08);

  // ojo
  ctx.fillStyle = "#fff";
  ellipse(-W * 0.33, -Hb * 0.12, Hb * 0.10, Hb * 0.10);
  ctx.fillStyle = "#1a1a22";
  ellipse(-W * 0.34, -Hb * 0.12, Hb * 0.05, Hb * 0.05);

  // ala delantera (aletea más amplio)
  ctx.fillStyle = mid;
  tri(-2, -1, W * 0.26, -flap * Hb * 0.9 - 1, W * 0.02, Hb * 0.08);

  ctx.restore();
}

function ellipse(x, y, rx, ry) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}
function tri(x1, y1, x2, y2, x3, y3) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.lineTo(x3, y3);
  ctx.closePath();
  ctx.fill();
}

function drawPenguin() {
  const running = penguin.onGround && state === State.PLAYING;
  const imgKey = mode === Mode.SWIM
    ? "duck"                                // pose de costado = nadando
    : penguin.onGround
      ? (penguin.ducking ? "duck" : (frame % 18 < 9 ? "run1" : "run2"))
      : "jump";

  const img = images[imgKey] || images.run1 || images.run2;
  const { w, h } = penguinDims();
  const dx = penguin.x;
  const dy = penguin.y - h;

  // aura del escudo (parpadea en los últimos instantes para avisar)
  if (power === "shield") {
    const cx = dx + w / 2, cy = penguin.y - h / 2;
    const r = Math.max(w, h) * 0.7 + Math.sin(frame * 0.2) * 3;
    const blink = powerT < 60 && (frame % 10 < 5) ? 0.25 : 0.6;
    ctx.save();
    const g = ctx.createRadialGradient(cx, cy, r * 0.4, cx, cy, r);
    g.addColorStop(0, "rgba(95, 208, 255, 0)");
    g.addColorStop(0.8, `rgba(95, 208, 255, ${blink * 0.5})`);
    g.addColorStop(1, "rgba(95, 208, 255, 0)");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = `rgba(160, 230, 255, ${blink})`;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  // squash & stretch anclado en los pies (estira al saltar, aplasta al caer)
  const sx = 1 + squash * 0.16;
  const sy = 1 - squash * 0.22;
  // bajo el agua se inclina según suba o baje
  const swimming = mode === Mode.SWIM || mode === Mode.DIVE || mode === Mode.RISE;
  const tilt = swimming ? Math.max(-0.5, Math.min(0.5, penguin.vy * 0.07)) : 0;
  ctx.save();
  ctx.translate(dx + w / 2, penguin.y);
  ctx.scale(sx, sy);
  if (tilt) ctx.rotate(tilt);
  ctx.translate(-(dx + w / 2), -penguin.y);
  if (img) {
    ctx.drawImage(img, dx, dy, w, h);
  } else {
    drawPlaceholderPenguin(dx, dy, w, h, running);
  }
  // bloque de hielo cuando el pingüino cae al agua en la zona helada
  if (iceTrap) drawIceBlock(dx, dy, w, h);
  ctx.restore();
}

// Cubo de hielo translúcido que atrapa al pingüino al congelarse.
function drawIceBlock(dx, dy, w, h) {
  const pad = 6;
  const x = dx - pad, y = dy - pad, bw = w + pad * 2, bh = h + pad * 2;
  ctx.save();
  ctx.fillStyle = "rgba(178, 228, 248, 0.42)";
  ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, bw, bh, 8);
  else ctx.rect(x, y, bw, bh);
  ctx.fill();
  ctx.stroke();
  // brillos diagonales de hielo
  ctx.strokeStyle = "rgba(255, 255, 255, 0.55)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + bw * 0.18, y + bh - 4); ctx.lineTo(x + bw * 0.5, y + 4);
  ctx.moveTo(x + bw * 0.5, y + bh - 4);  ctx.lineTo(x + bw * 0.82, y + 4);
  ctx.stroke();
  ctx.restore();
}

// Pingüino dibujado a mano mientras no haya sprites reales
function drawPlaceholderPenguin(x, y, w, h, running) {
  const legSwing = running && frame % 16 < 8 ? 4 : -4;

  // patas
  ctx.fillStyle = "#f6a623";
  ctx.fillRect(x + w * 0.28, y + h - 6, 8, 6);
  ctx.fillRect(x + w * 0.58 + legSwing, y + h - 6, 8, 6);

  // cuerpo
  ctx.fillStyle = "#2b2b3a";
  roundRect(x, y, w, h - 4, 14);
  ctx.fill();

  // barriga
  ctx.fillStyle = "#ffffff";
  roundRect(x + w * 0.22, y + h * 0.28, w * 0.56, h * 0.6, 12);
  ctx.fill();

  // ojo
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(x + w * 0.66, y + h * 0.24, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#1a1a22";
  ctx.beginPath();
  ctx.arc(x + w * 0.68, y + h * 0.24, 3, 0, Math.PI * 2);
  ctx.fill();

  // pico
  ctx.fillStyle = "#f6a623";
  ctx.beginPath();
  ctx.moveTo(x + w * 0.8, y + h * 0.3);
  ctx.lineTo(x + w + 6, y + h * 0.36);
  ctx.lineTo(x + w * 0.8, y + h * 0.42);
  ctx.closePath();
  ctx.fill();
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ---------------------------------------------------------------------------
//  Bucle principal (con paso fijo para velocidad consistente)
// ---------------------------------------------------------------------------
let last = performance.now();
let acc = 0;
const STEP = 1000 / 60;

function loop(now) {
  acc += now - last;
  last = now;
  // evita saltos enormes si la pestaña estuvo en segundo plano
  if (acc > 200) acc = STEP;
  while (acc >= STEP) { update(); acc -= STEP; }
  if (!paused) {
    updateSnow();
    if (waterFade() > 0) updateBubbles();
    updateParticles();
    if (quakeT > 0) { quakeT--; shake = 14 + Math.random() * 8; }   // temblor sostenido
    else shake = shake > 0.5 ? shake * 0.86 : 0;
  }
  draw();
  requestAnimationFrame(loop);
}

loadImages(() => {
  // activa el personaje guardado (reapunta sprites + ajusta aspecto al real)
  selectCharacter(selectedChar);
  selectDifficulty(difficulty);   // aplica config + resalta el toggle guardado
  initSnow();
  initStars();
  initBubbles();
  renderLeaderboard();      // muestra el top 5 en la pantalla de inicio
  overlay.classList.add("show");
  requestAnimationFrame(loop);
});
