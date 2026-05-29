// ===========================================================================
//  Pickle the Penguin 🐧  —  endless runner
// ---------------------------------------------------------------------------
//  VERSION: súbela en cada cambio del juego. Se muestra en pantalla (abajo a la
//  izquierda) para confirmar qué versión está corriendo, y debe coincidir con
//  el número de CACHE en sw.js.
const VERSION = "v4";
// ---------------------------------------------------------------------------
//  Para usar TUS fotos: pon los PNG (fondo transparente) en la carpeta
//  /assets y rellena las rutas en SPRITES de abajo. Si una ruta está vacía
//  o la imagen no carga, se dibuja un pingüino placeholder automáticamente.
// ===========================================================================

const SPRITES = {
  run1: "assets/penguin_run1.png",   // alas extendidas
  run2: "assets/penguin_run2.png",   // alas abajo (alterna -> aleteo)
  jump: "assets/penguin_jump.png",   // alas arriba (salto)
  duck: "assets/penguin_duck.png",   // de costado (agachado)
  bird1: "",   // (opcional) pájaro, ala arriba — si está vacío se dibuja
  bird2: "",   // (opcional) pájaro, ala abajo
};

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
const leaderboardEl = document.getElementById("leaderboard");

// ---------------------------------------------------------------------------
//  Carga de imágenes (con fallback)
// ---------------------------------------------------------------------------
const images = {};

function loadImages(done) {
  const entries = Object.entries(SPRITES).filter(([, src]) => src);
  if (entries.length === 0) { done(); return; }
  let pending = entries.length;
  for (const [key, src] of entries) {
    const img = new Image();
    img.onload = () => { images[key] = img; if (--pending === 0) done(); };
    img.onerror = () => { if (--pending === 0) done(); };
    img.src = src;
  }
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

let speed = 6;           // velocidad de scroll (px por frame a 60fps)
const BASE_SPEED = 6;
const MAX_SPEED = 15;

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

// Dimensiones actuales del pingüino (alto y ancho según pose y sprite real).
function penguinDims() {
  if (penguin.ducking) {
    return { h: penguin.duckH, w: penguin.duckH * aspect.duck };
  }
  return { h: penguin.h, w: penguin.h * aspect.stand };
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
let squash = 0;          // squash & stretch (-1 estirado .. 1 aplastado)
let paused = false;

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

function spawnObstacle() {
  const canFly = score > 200;     // aparecen aves
  const canHard = score > 350;    // aparecen picada, bola de nieve y arco
  const r = Math.random();
  let o;
  if (canHard && r < 0.16) o = makeOverhang();
  else if (canHard && r < 0.32) o = makeSnowball();
  else if (canHard && r < 0.44) o = makeBird("swoop");
  else if (canFly && r < 0.64) o = makeBird(Math.random() < 0.5 ? "low" : "mid");
  else o = makeIce();
  obstacles.push(o);
}

function nextSpawnGap() {
  // a mayor velocidad, obstáculos algo más juntos
  const base = 90 - (speed - BASE_SPEED) * 3;
  return base + Math.random() * 60;
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
  if (enteringName) return;   // deja escribir el nombre (Enter lo envía el form)
  if (e.code === "Space" || e.code === "ArrowUp") { e.preventDefault(); jump(); }
  if (e.code === "ArrowDown") { e.preventDefault(); setDuck(true); }
  if (e.code === "KeyP") { e.preventDefault(); togglePause(); }
});
addEventListener("keyup", (e) => {
  if (e.code === "ArrowDown") setDuck(false);
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
  if (yRel > 0.6 && state === State.PLAYING) setDuck(true);
  else jump();
}
function pointerUp() { setDuck(false); }

canvas.addEventListener("touchstart", pointerDown, { passive: false });
canvas.addEventListener("touchend", pointerUp);
canvas.addEventListener("mousedown", pointerDown);
addEventListener("mouseup", pointerUp);

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
  fishEaten = 0;
  power = null;
  powerT = 0;
  timeScale = 1;
  powerBannerT = 0;
  penguin.y = GROUND_Y;
  penguin.vy = 0;
  penguin.onGround = true;
  penguin.ducking = false;
  overlay.classList.remove("show");
}

function gameOver() {
  state = State.OVER;
  playCrash();
  const word = sayRandomWord();

  // sacudida + salpicadura de hielo en el punto del choque
  shake = 14;
  const d0 = penguinDims();
  spawnParticles(penguin.x + d0.w / 2, penguin.y - d0.h / 2, 18,
    { color: "#9fd8f2", speed: 5, life: 34, gravity: 0.25, size: 3, lift: 2 });

  const finalScore = Math.floor(score);
  document.getElementById("overlay-title").textContent = word;
  document.getElementById("overlay-peng").src = SPRITES.jump || "assets/penguin_jump.png";

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

  // power-up activo: cuenta atrás y cámara lenta
  timeScale = power === "slow" ? 0.5 : 1;
  if (power) { if (--powerT <= 0) { power = null; timeScale = 1; } }

  // física del pingüino (gravedad más suave mientras vuela)
  penguin.vy += power === "fly" ? 0.34 : GRAVITY;
  penguin.y += penguin.vy;
  if (penguin.y < 50) { penguin.y = 50; if (penguin.vy < 0) penguin.vy = 0; } // techo
  if (penguin.y >= GROUND_Y) {
    if (!penguin.onGround) {
      // acaba de aterrizar: polvo de nieve + aplastamiento
      const lw = penguinDims().w;
      spawnParticles(penguin.x + lw * 0.45, GROUND_Y, 9,
        { color: "#e3f3fc", speed: 2.6, life: 20, angle: -Math.PI / 2,
          spread: Math.PI, gravity: 0.22, size: 2.4 });
      squash = 0.9;
    }
    penguin.y = GROUND_Y;
    penguin.vy = 0;
    penguin.onGround = true;
  }
  squash *= 0.82;   // vuelve poco a poco a su forma normal

  // velocidad y puntuación
  score += 0.15 * (speed / BASE_SPEED);
  speed = Math.min(MAX_SPEED, BASE_SPEED + score / 120);
  scoreEl.textContent = String(Math.floor(score)).padStart(4, "0");

  // sonidito cada 100 puntos
  const milestone = Math.floor(score / 100);
  if (milestone > lastMilestone) { lastMilestone = milestone; playPoint(); }

  // ¡superaste tu récord! -> recompensa de peces (una vez por partida)
  if (!celebrated && prevBest > 0 && score > prevBest) spawnFishReward();
  updateFishes();

  // spawn (el ritmo se ajusta a la cámara lenta para no amontonar obstáculos)
  spawnTimer -= timeScale;
  if (spawnTimer <= 0) {
    spawnObstacle();
    spawnTimer = nextSpawnGap();
  }

  // mover obstáculos + colisión
  const box = penguinBox();
  for (const o of obstacles) {
    const sp = (speed + (o.type === "snowball" ? o.extra : 0)) * timeScale;
    o.x -= sp;
    if (o.type === "bird") {
      o.wing = (o.wing + 0.2) % (Math.PI * 2);
      // la picada oscila en vertical conforme se acerca
      if (o.behavior === "swoop") o.y = o.baseY + Math.sin((W - o.x) * 0.018) * 52;
    }
    if (o.type === "snowball") o.roll += sp * 0.08;
    if (hit(box, obstacleBox(o))) {
      if (power === "shield") {
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

  // peces coleccionables: aparecen de vez en cuando y suman puntos
  coinTimer -= timeScale;
  if (coinTimer <= 0) { spawnCoin(); coinTimer = 130 + Math.random() * 170; }
  const mouth = penguinMouth();
  for (const c of coins) {
    if (power === "magnet") {
      // el imán atrae todos los peces hacia el pingüino
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
      spawnParticles(c.x, c.y, 8,
        { color: "#ffd34d", speed: 2.4, life: 24, gravity: 0.05, size: 2.4 });
      // progreso hacia el próximo power-up (solo si no hay uno activo)
      if (!power && ++fishEaten >= FISH_PER_POWERUP) {
        fishEaten = 0;
        activatePower();
      }
    }
  }
  coins = coins.filter((c) => !c.collected && c.x + c.r > -10);
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

function draw() {
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  if (shake > 0.5) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
  drawSky();
  drawBackground();
  drawGround();
  for (const c of coins) drawFish(c.x, c.y + Math.sin(c.bob) * 3, c.r);
  for (const o of obstacles) drawObstacle(o);
  drawPenguin();
  drawParticles();
  for (const f of fishes) if (f.delay <= 0) drawFish(f.x, f.y, 11);
  ctx.restore();
  drawSnow();          // nieve por encima de todo (sin sacudida)
  drawPowerHud();
  drawBanner();
  drawPowerBanner();
  drawVersion();
  if (paused) drawPauseScreen();
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
  ["#bfe9ff", "#e8f7ff", "#ffffff"], // día
  ["#ffcaa0", "#ffb3a7", "#ffe7d4"], // atardecer
  ["#15263b", "#21405e", "#41637f"], // noche
];
const BIOME_LEN = 450;   // puntos que dura cada bioma
const BIOME_FADE = 90;   // puntos de fundido suave al final de cada bioma

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
  const curNight = (idx % 3) === 2;
  const nextNight = ((idx + 1) % 3) === 2;
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

// Bola de nieve con marcas de rodadura que giran
function drawSnowball(o) {
  const cx = o.x + o.r, cy = o.y - o.r;
  ctx.save();
  ctx.fillStyle = "#f2fbff";
  ctx.strokeStyle = "#bcd8e6";
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(cx, cy, o.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = "rgba(140, 180, 200, 0.6)";
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 3; i++) {
    const a = o.roll + i * (Math.PI * 2 / 3);
    ctx.beginPath();
    ctx.arc(cx, cy, o.r * 0.55, a, a + 0.9);
    ctx.stroke();
  }
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
  const imgKey = penguin.onGround
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
  ctx.save();
  ctx.translate(dx + w / 2, penguin.y);
  ctx.scale(sx, sy);
  ctx.translate(-(dx + w / 2), -penguin.y);
  if (img) {
    ctx.drawImage(img, dx, dy, w, h);
  } else {
    drawPlaceholderPenguin(dx, dy, w, h, running);
  }
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
    updateParticles();
    shake = shake > 0.5 ? shake * 0.86 : 0;
  }
  draw();
  requestAnimationFrame(loop);
}

loadImages(() => {
  // ajusta el aspecto al de los sprites reales para no deformarlos
  const standImg = images.run1 || images.run2 || images.jump;
  if (standImg) aspect.stand = standImg.width / standImg.height;
  if (images.duck) aspect.duck = images.duck.width / images.duck.height;
  initSnow();
  initStars();
  renderLeaderboard();      // muestra el top 5 en la pantalla de inicio
  overlay.classList.add("show");
  requestAnimationFrame(loop);
});
