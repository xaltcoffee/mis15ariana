import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js";

// ---------- Three.js atmospheric background ----------
const mount = document.querySelector("#three-bg");
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 100);
camera.position.z = 17;
const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.8));
renderer.setSize(innerWidth, innerHeight);
renderer.setClearColor(0x000000, 0);
mount.appendChild(renderer.domElement);

const count = 650;
const positions = new Float32Array(count * 3);
const speeds = new Float32Array(count);
for (let i = 0; i < count; i++) {
  positions[i*3] = (Math.random() - .5) * 34;
  positions[i*3+1] = (Math.random() - .5) * 23;
  positions[i*3+2] = (Math.random() - .5) * 18;
  speeds[i] = .15 + Math.random() * .55;
}
const geometry = new THREE.BufferGeometry();
geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
const material = new THREE.PointsMaterial({ color: 0xd8d8df, size: .045, transparent: true, opacity: .78, sizeAttenuation: true });
const stars = new THREE.Points(geometry, material);
scene.add(stars);

const glowGeometry = new THREE.SphereGeometry(4.5, 32, 32);
const glowMaterial = new THREE.MeshBasicMaterial({ color: 0x2f5488, transparent: true, opacity: .14 });
const glow = new THREE.Mesh(glowGeometry, glowMaterial);
glow.position.set(0, -1, -8);
scene.add(glow);

const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const t = clock.getElapsedTime();
  const p = geometry.attributes.position.array;
  for (let i = 0; i < count; i++) {
    p[i*3+1] += speeds[i] * .003;
    p[i*3] += Math.sin(t * .25 + i) * .0008;
    if (p[i*3+1] > 12) p[i*3+1] = -12;
  }
  geometry.attributes.position.needsUpdate = true;
  stars.rotation.y = Math.sin(t * .08) * .08;
  glow.scale.setScalar(1 + Math.sin(t * .35) * .025);
  renderer.render(scene, camera);
}
animate();
addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ---------- RSVP: replace the number with the family's WhatsApp ----------
const WHATSAPP_NUMBER = "59170000000"; // TODO: replace with the real number, country code included
const rsvpText = "Hola, quiero confirmar mi asistencia a los 15 años de Ariana L. Jauja Aguilar.";
document.querySelector("#rsvp-button").href =
  `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(rsvpText)}`;

// Reveal invitation text as each section enters the viewport.
const textRevealTargets = document.querySelectorAll(
  "main section:not(#inicio) :is(h2,h3,p,a,strong,.signature,.detail-icon,.dress-symbol,.gift-symbol,.closing-star)"
);
if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) {
  textRevealTargets.forEach((element) => element.classList.add("text-revealed"));
} else {
  const revealOrder = new Map();
  textRevealTargets.forEach((element) => {
    const section = element.closest("section");
    const order = revealOrder.get(section) || 0;
    element.style.setProperty("--text-reveal-delay", `${Math.min(order, 8) * 55}ms`);
    revealOrder.set(section, order + 1);
    element.classList.add("text-reveal");
  });

  const textObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("text-revealed");
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.14 });
  textRevealTargets.forEach((element) => {
    if (element.classList.contains("text-reveal")) textObserver.observe(element);
  });
}

// ---------- Mini game: a stickman that destroys the invitation website ----------
const modal = document.querySelector("#game-modal");
const canvas = document.querySelector("#game-canvas");
const ctx = canvas.getContext("2d");
const completeEl = document.querySelector("#game-complete");
const progressLabel = document.querySelector("#game-progress");
const videoModal = document.querySelector("#video-modal");
const videoEl = document.querySelector("#surprise-video");
const backgroundMusic = document.querySelector("#background-music");
backgroundMusic.volume = 0.32;

function startBackgroundMusic() {
  if (modal.classList.contains("open")) return;
  if (!backgroundMusic.paused) {
    document.body.classList.add("music-playing");
    return;
  }
  const playback = backgroundMusic.play();
  if (playback && playback.catch) playback.catch(() => {});
}
function pauseBackgroundMusic() {
  backgroundMusic.pause();
}
backgroundMusic.addEventListener("play", () => document.body.classList.add("music-playing"));
backgroundMusic.addEventListener("pause", () => document.body.classList.remove("music-playing"));
document.addEventListener("pointerdown", startBackgroundMusic, { capture: true });
document.addEventListener("keydown", startBackgroundMusic, { capture: true });
startBackgroundMusic();

const VIEW_W = canvas.width;
const VIEW_H = canvas.height;
const WORLD_W = 1720;
const GROUND_H = 54;
const GROUND_Y = VIEW_H - GROUND_H;
const BLOCK = 22;

const GRAVITY = 0.62;
const MOVE_ACC = 0.9;
const MOVE_MAX = 4.4;
const JUMP_V = -11.6;
const FLIP_V = -9.4;
const FLY_THRUST = -0.6;
const FLY_MAX = -6.2;
const BULLET_SPEED = 15;
const FIRE_MS = 78;
const WIN_RATIO = 0.8;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// The destructible "website" is drawn once onto an offscreen canvas and then
// sliced into a grid. Only cells with real content become breakable blocks.
const art = document.createElement("canvas");
art.width = WORLD_W;
art.height = VIEW_H;
const actx = art.getContext("2d");
let blocks = [];
let grid = null;
let gridCols = 0;
let gridRows = 0;

function drawArtwork() {
  const c = actx;
  c.clearRect(0, 0, WORLD_W, VIEW_H);
  c.textAlign = "center";

  const card = (x, y, w, h) => {
    c.fillStyle = "rgba(20,43,80,.92)";
    c.beginPath(); c.roundRect(x, y, w, h, 12); c.fill();
    c.strokeStyle = "rgba(216,216,223,.75)";
    c.lineWidth = 3;
    c.beginPath(); c.roundRect(x, y, w, h, 12); c.stroke();
  };

  // Browser chrome so the "website" reads as a page.
  c.fillStyle = "rgba(6,14,30,.95)";
  c.fillRect(40, 10, WORLD_W - 80, 42);
  ["#d8d8df", "#c8d9e9", "#526b8a"].forEach((col, i) => {
    c.fillStyle = col; c.globalAlpha = .6;
    c.beginPath(); c.arc(70 + i * 24, 31, 5, 0, Math.PI * 2); c.fill();
  });
  c.globalAlpha = 1;
  c.fillStyle = "rgba(216,216,223,.16)";
  c.beginPath(); c.roundRect(200, 20, 340, 22, 11); c.fill();
  c.fillStyle = "#d8d8df";
  c.font = "13px Montserrat, sans-serif";
  c.textAlign = "left";
  c.fillText("https://ariana15.com", 215, 36);
  c.textAlign = "center";

  // Ornaments
  c.fillStyle = "#d7bd91";
  [210, 540, 900, 1270, 1600].forEach((x) => {
    c.save(); c.translate(x, 84); c.rotate(Math.PI / 4); c.fillRect(-9, -9, 18, 18); c.restore();
  });

  // Hero card
  card(600, 96, 520, 372);
  c.fillStyle = "#d8d8df"; c.font = "17px Montserrat, sans-serif";
  c.fillText("OSCAR & NANCY", 860, 152);
  c.fillStyle = "#f8faff"; c.font = "italic 96px Georgia, serif";
  c.fillText("Ariana", 860, 262);
  c.fillStyle = "#d8d8df"; c.font = "25px Georgia, serif";
  c.fillText("J A U J A   A G U I L A R", 860, 306);
  c.fillStyle = "#f8faff"; c.font = "31px Georgia, serif";
  c.fillText("MIS 15 AÑOS", 860, 362);
  c.fillStyle = "#c8d9e9"; c.font = "16px Montserrat, sans-serif";
  c.fillText("21 NOVIEMBRE 2026  ·  7:00 P.M.", 860, 410);
  c.fillText("¡TE ESPERAMOS!", 860, 442);

  // Left column
  card(120, 130, 420, 160);
  c.fillStyle = "#f8faff"; c.font = "20px Georgia, serif";
  c.fillText("Con la bendición de Dios", 330, 196);
  c.fillStyle = "#d8d8df"; c.font = "15px Montserrat, sans-serif";
  c.fillText("y de mis padres", 330, 232);

  card(120, 320, 420, 148);
  c.fillStyle = "#d8d8df"; c.font = "16px Montserrat, sans-serif";
  c.fillText("UNA NOCHE LLENA DE", 330, 378);
  c.fillText("ALEGRÍA Y MAGIA", 330, 412);

  // Right column
  card(1180, 130, 420, 160);
  c.fillStyle = "#d8d8df"; c.font = "16px Montserrat, sans-serif";
  c.fillText("CÓDIGO DE VESTIMENTA", 1390, 196);
  c.fillStyle = "#f8faff"; c.font = "22px Georgia, serif";
  c.fillText("Semi formal", 1390, 238);

  card(1180, 320, 420, 148);
  c.fillStyle = "#d8d8df"; c.font = "16px Montserrat, sans-serif";
  c.fillText("LLUVIA DE SOBRES", 1390, 378);
  c.fillStyle = "#f8faff"; c.font = "17px Georgia, serif";
  c.fillText("Tu presencia es el regalo", 1390, 412);
}

function buildLevel() {
  drawArtwork();
  blocks = [];
  gridCols = Math.ceil(WORLD_W / BLOCK);
  gridRows = Math.ceil(VIEW_H / BLOCK);
  grid = new Int32Array(gridCols * gridRows).fill(-1);
  const img = actx.getImageData(0, 0, WORLD_W, VIEW_H).data;
  const minPixels = BLOCK * BLOCK * 0.12;
  for (let cy = 0; cy < gridRows; cy++) {
    for (let cx = 0; cx < gridCols; cx++) {
      const x0 = cx * BLOCK;
      const y0 = cy * BLOCK;
      let n = 0, r = 0, g = 0, b = 0;
      for (let y = y0; y < y0 + BLOCK && y < VIEW_H; y++) {
        for (let x = x0; x < x0 + BLOCK && x < WORLD_W; x++) {
          const i = (y * WORLD_W + x) * 4;
          if (img[i + 3] > 50) { n++; r += img[i]; g += img[i + 1]; b += img[i + 2]; }
        }
      }
      if (n > minPixels) {
        const idx = blocks.length;
        blocks.push({ x: x0, y: y0, w: BLOCK, h: BLOCK, alive: true, color: `${(r / n) | 0},${(g / n) | 0},${(b / n) | 0}` });
        grid[cy * gridCols + cx] = idx;
      }
    }
  }
}

// --- Sky and ground (screen space, they never scroll vertically) ---
function skyColorAt(y) {
  const t = clamp(y / VIEW_H, 0, 1);
  let r, g, b;
  if (t < 0.55) {
    const k = t / 0.55;
    r = 11 + 7 * k; g = 24 + 11 * k; b = 48 + 15 * k;
  } else {
    const k = (t - 0.55) / 0.45;
    r = 18 + 9 * k; g = 35 + 13 * k; b = 63 + 22 * k;
  }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}
function drawSky() {
  const gd = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  gd.addColorStop(0, "#0B1830");
  gd.addColorStop(0.55, "#12233f");
  gd.addColorStop(1, "#1b3055");
  ctx.fillStyle = gd;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
}
function drawGround() {
  const gd = ctx.createLinearGradient(0, GROUND_Y - 16, 0, VIEW_H);
  gd.addColorStop(0, "rgba(216,216,223,0)");
  gd.addColorStop(1, "rgba(82,107,138,.28)");
  ctx.fillStyle = gd;
  ctx.fillRect(0, GROUND_Y - 16, VIEW_W, VIEW_H - (GROUND_Y - 16));
  ctx.fillStyle = "rgba(216,216,223,.85)";
  ctx.fillRect(0, GROUND_Y - 1.5, VIEW_W, 2);
}

// --- Game state ---
let player, bullets, fragments, holes, destroyed, gameActive, running, lastFire;
let cameraX = 0;
let aimScreen = { x: VIEW_W / 2, y: VIEW_H / 2 };
let firing = false;
let pointerIsMouse = false;
let prevJump = false;
const keys = new Set();
const joy = { active: false, id: null, ox: 0, oy: 0, x: 0, y: 0 };

function resetGame() {
  for (const bl of blocks) bl.alive = true;
  bullets = [];
  fragments = [];
  holes = [];
  destroyed = 0;
  lastFire = 0;
  gameActive = true;
  prevJump = false;
  firing = false;
  joy.active = false;
  joy.id = null;
  player = { x: 90, y: GROUND_Y - 48, w: 26, h: 48, vx: 0, vy: 0, onGround: true, facing: 1, jumps: 0, phase: 0, flying: false };
  cameraX = clamp(player.x + player.w / 2 - VIEW_W / 2, 0, WORLD_W - VIEW_W);
  aimScreen = { x: VIEW_W / 2, y: VIEW_H / 2 };
  completeEl.classList.remove("show");
  progressLabel.textContent = "0% DE MAGIA LIBERADA";
  clearTimeout(videoTimer);
  videoModal.classList.remove("open");
  videoModal.setAttribute("aria-hidden", "true");
}

// --- Input helpers ---
function moveInput() {
  let m = 0;
  if (keys.has("a") || keys.has("arrowleft")) m -= 1;
  if (keys.has("d") || keys.has("arrowright")) m += 1;
  if (!m && joy.active && Math.abs(joy.x) > 10) m = clamp(joy.x / 42, -1, 1);
  return m;
}
function isJumpHeld() {
  return keys.has(" ") || keys.has("w") || keys.has("arrowup") || (joy.active && joy.y < -18);
}
function isDropHeld() {
  return keys.has("s") || keys.has("arrowdown") || (joy.active && joy.y > 18);
}

function updatePlayer() {
  const mv = moveInput();
  if (mv) {
    player.vx = clamp(player.vx + mv * MOVE_ACC, -MOVE_MAX, MOVE_MAX);
    if (mv > 0) player.facing = 1; else if (mv < 0) player.facing = -1;
  } else {
    player.vx *= 0.82;
  }

  const jh = isJumpHeld();
  if (jh && !prevJump) {
    if (player.onGround) { player.vy = JUMP_V; player.jumps = 1; }
    else if (player.jumps < 2) { player.vy = FLIP_V; player.jumps = 2; }
  }
  prevJump = jh;

  player.flying = false;
  if (jh && !player.onGround && player.vy > FLY_MAX) {
    player.vy += FLY_THRUST;
    player.flying = true;
  }
  if (isDropHeld()) player.vy += 0.6;

  player.vy += GRAVITY;
  player.x = clamp(player.x + player.vx, 0, WORLD_W - player.w);
  player.y += player.vy;

  if (player.y + player.h >= GROUND_Y) {
    player.y = GROUND_Y - player.h;
    player.vy = 0;
    player.onGround = true;
    player.jumps = 0;
  } else {
    player.onGround = false;
  }

  player.phase += Math.abs(player.vx) * 0.22 + 0.06;

  const target = clamp(player.x + player.w / 2 - VIEW_W / 2, 0, WORLD_W - VIEW_W);
  cameraX += (target - cameraX) * 0.12;
}

// --- Sonido de disparo (pool de audios para permitir solapamiento en disparo rápido) ---
const SHOT_POOL = [];
let shotCursor = 0;
for (let i = 0; i < 5; i++) {
  const a = new Audio("disparo.mp3");
  a.preload = "auto";
  a.volume = 0.5;
  SHOT_POOL.push(a);
}
function playShotSound() {
  const a = SHOT_POOL[shotCursor];
  shotCursor = (shotCursor + 1) % SHOT_POOL.length;
  try {
    a.currentTime = 0;
    const p = a.play();
    if (p && p.catch) p.catch(() => {});
  } catch (e) {}
}

// --- Shooting ---
function tryShoot(now) {
  if (now - lastFire < FIRE_MS) return;
  lastFire = now;
  playShotSound();
  const ax = aimScreen.x + cameraX;
  const ay = aimScreen.y;
  const gx = player.x + player.w / 2;
  const gy = player.y + 16;
  const dx = ax - gx;
  const dy = ay - gy;
  const m = Math.hypot(dx, dy) || 1;
  bullets.push({ x: gx, y: gy, vx: (dx / m) * BULLET_SPEED, vy: (dy / m) * BULLET_SPEED, life: 70 });
  if (Math.abs(dx) > 6) player.facing = dx > 0 ? 1 : -1;
  // Muzzle sparks
  for (let i = 0; i < 3; i++) {
    fragments.push({ x: gx + (dx / m) * 14, y: gy + (dy / m) * 14, w: 2, h: 2, vx: (Math.random() - .5) * 3, vy: (Math.random() - .5) * 3, rot: 0, vr: 0, color: "216,216,223", life: 10 });
  }
}

function destroyBlock(idx, splash = true) {
  const bl = blocks[idx];
  if (!bl.alive) return;
  bl.alive = false;
  holes.push({ x: bl.x, y: bl.y, w: bl.w, h: bl.h, color: skyColorAt(bl.y) });
  destroyed++;
  spawnFragments(bl);

  if (splash) {
    const cx = Math.floor(bl.x / BLOCK);
    const cy = Math.floor(bl.y / BLOCK);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if ((!dx && !dy) || Math.random() > 0.5) continue;
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || nx >= gridCols || ny < 0 || ny >= gridRows) continue;
        const ni = grid[ny * gridCols + nx];
        if (ni >= 0 && blocks[ni].alive) destroyBlock(ni, false);
      }
    }
  }
}

function spawnFragments(bl) {
  if (fragments.length > 700) return;
  const color = `rgb(${bl.color})`;
  for (let i = 0; i < 4; i++) {
    fragments.push({
      x: bl.x + Math.random() * bl.w,
      y: bl.y + Math.random() * bl.h,
      w: bl.w * (0.4 + Math.random() * 0.4),
      h: bl.h * (0.4 + Math.random() * 0.4),
      vx: (Math.random() - .5) * 7,
      vy: -2 - Math.random() * 4,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - .5) * 0.4,
      color,
      life: 90 + Math.random() * 50,
    });
  }
}

function updateBullets() {
  for (const b of bullets) {
    b.x += b.vx;
    b.y += b.vy;
    b.life--;
    if (b.x < 0 || b.x > WORLD_W || b.y < 0 || b.y > VIEW_H) { b.life = 0; continue; }
    const cx = Math.floor(b.x / BLOCK);
    const cy = Math.floor(b.y / BLOCK);
    if (cx >= 0 && cx < gridCols && cy >= 0 && cy < gridRows) {
      const idx = grid[cy * gridCols + cx];
      if (idx >= 0 && blocks[idx].alive) { destroyBlock(idx); b.life = 0; }
    }
  }
  bullets = bullets.filter((b) => b.life > 0);
}

function updateFragments() {
  for (const f of fragments) {
    f.vy += 0.42;
    f.vx *= 0.99;
    f.x += f.vx;
    f.y += f.vy;
    f.rot += f.vr;
    f.life--;
    if (f.y > GROUND_Y - f.h / 2) {
      f.y = GROUND_Y - f.h / 2;
      f.vy *= -0.36;
      f.vx *= 0.7;
    }
  }
  fragments = fragments.filter((f) => f.life > 0);
}

function update(now) {
  if (gameActive) {
    updatePlayer();
    if (firing) tryShoot(now);
    updateBullets();
    const pct = blocks.length ? destroyed / blocks.length : 0;
    progressLabel.textContent = `${Math.round(pct * 100)}% DE MAGIA LIBERADA`;
    if (pct >= WIN_RATIO) {
      gameActive = false;
      completeEl.classList.add("show");
      for (let i = 0; i < 80; i++) {
        fragments.push({
          x: cameraX + Math.random() * VIEW_W,
          y: Math.random() * VIEW_H * 0.7,
          w: 5, h: 5,
          vx: (Math.random() - .5) * 6,
          vy: (Math.random() - .5) * 6,
          rot: Math.random() * 3,
          vr: (Math.random() - .5) * 0.4,
          color: "215,189,145",
          life: 80,
        });
      }
      clearTimeout(videoTimer);
      videoTimer = setTimeout(openVideo, 1800);
    }
  }
  updateFragments();
}

// --- Rendering ---
function drawPlayer() {
  const p = player;
  const cx = p.x + p.w / 2;
  if (p.onGround) {
    ctx.fillStyle = "rgba(0,0,0,.3)";
    ctx.beginPath();
    ctx.ellipse(cx, GROUND_Y + 2, 16, 4, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.save();
  ctx.translate(cx, 0);
  ctx.scale(p.facing, 1);
  ctx.strokeStyle = "#F8FAFF";
  ctx.fillStyle = "#F8FAFF";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const headR = 7.5;
  const headCy = p.y + headR + 3;
  const shoulderY = headCy + headR + 2;
  const hipY = p.y + p.h - 15;

  ctx.beginPath(); ctx.arc(0, headCy, headR, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, shoulderY); ctx.lineTo(0, hipY); ctx.stroke();

  const air = !p.onGround;
  const swing = air ? 0.25 : Math.sin(p.phase) * 0.85;
  const legLen = 15;
  const armLen = 13;

  ctx.beginPath(); ctx.moveTo(0, hipY); ctx.lineTo(Math.sin(swing) * legLen, hipY + Math.cos(swing) * legLen); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, hipY); ctx.lineTo(Math.sin(-swing) * legLen, hipY + Math.cos(swing) * legLen); ctx.stroke();

  if (p.flying) {
    ctx.beginPath(); ctx.moveTo(0, shoulderY); ctx.lineTo(Math.sin(-2.5) * armLen, shoulderY + Math.cos(-2.5) * armLen); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, shoulderY); ctx.lineTo(Math.sin(2.5) * armLen, shoulderY + Math.cos(2.5) * armLen); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.moveTo(0, shoulderY); ctx.lineTo(Math.sin(-swing - 0.15) * armLen, shoulderY + Math.cos(-swing - 0.15) * armLen); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, shoulderY); ctx.lineTo(Math.sin(swing - 0.15) * armLen, shoulderY + Math.cos(swing - 0.15) * armLen); ctx.stroke();
  }

  ctx.fillStyle = "#D7BD91";
  ctx.fillRect(6, shoulderY - 2, 10, 4);
  ctx.restore();
}

function drawBullets() {
  for (const b of bullets) {
    ctx.strokeStyle = "rgba(200,217,233,.55)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(b.x - b.vx * 1.6, b.y - b.vy * 1.6);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.fillStyle = "#F8FAFF";
    ctx.beginPath(); ctx.arc(b.x, b.y, 3.5, 0, Math.PI * 2); ctx.fill();
  }
}

function drawReticle() {
  if (!pointerIsMouse) return;
  const x = aimScreen.x;
  const y = aimScreen.y;
  ctx.strokeStyle = "rgba(216,216,223,.8)";
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(x, y, 11, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - 16, y); ctx.lineTo(x - 6, y);
  ctx.moveTo(x + 6, y); ctx.lineTo(x + 16, y);
  ctx.moveTo(x, y - 16); ctx.lineTo(x, y - 6);
  ctx.moveTo(x, y + 6); ctx.lineTo(x, y + 16);
  ctx.stroke();
}

function drawJoystick() {
  if (!joy.active) return;
  ctx.fillStyle = "rgba(216,216,223,.12)";
  ctx.strokeStyle = "rgba(216,216,223,.5)";
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(joy.ox, joy.oy, 52, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "rgba(216,216,223,.5)";
  ctx.beginPath(); ctx.arc(joy.ox + joy.x, joy.oy + joy.y, 22, 0, Math.PI * 2); ctx.fill();
}

function render() {
  drawSky();
  drawGround();

  ctx.save();
  ctx.translate(-cameraX, 0);
  ctx.drawImage(art, 0, 0);
  for (const h of holes) {
    ctx.fillStyle = h.color;
    ctx.fillRect(h.x, h.y, h.w, h.h);
  }
  for (const f of fragments) {
    ctx.globalAlpha = Math.min(1, f.life / 35);
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.rotate(f.rot);
    ctx.fillStyle = `rgb(${f.color})`;
    ctx.fillRect(-f.w / 2, -f.h / 2, f.w, f.h);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  drawBullets();
  drawPlayer();
  ctx.restore();

  drawReticle();
  drawJoystick();
}

function loop(now) {
  if (!modal.classList.contains("open")) { running = false; return; }
  update(now || performance.now());
  render();
  requestAnimationFrame(loop);
}

// --- Pointer input: mouse aims + fires, touch splits into joystick + aim ---
function canvasPos(e) {
  const r = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - r.left) * VIEW_W / r.width,
    y: (e.clientY - r.top) * VIEW_H / r.height,
  };
}
canvas.addEventListener("pointermove", (e) => {
  const p = canvasPos(e);
  if (joy.active && e.pointerId === joy.id) {
    let dx = p.x - joy.ox;
    let dy = p.y - joy.oy;
    const m = Math.hypot(dx, dy);
    const max = 52;
    if (m > max) { dx = dx / m * max; dy = dy / m * max; }
    joy.x = dx;
    joy.y = dy;
    return;
  }
  if (e.pointerType === "mouse") {
    aimScreen = p;
    pointerIsMouse = true;
  }
});
canvas.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  const p = canvasPos(e);
  if (e.pointerType !== "mouse" && p.x < VIEW_W * 0.5 && p.y > VIEW_H * 0.42) {
    joy.active = true;
    joy.id = e.pointerId;
    joy.ox = p.x;
    joy.oy = p.y;
    joy.x = 0;
    joy.y = 0;
  } else {
    aimScreen = p;
    firing = true;
    pointerIsMouse = e.pointerType === "mouse";
  }
  if (canvas.setPointerCapture) canvas.setPointerCapture(e.pointerId);
});
function endPointer(e) {
  if (e.pointerId === joy.id) {
    joy.active = false;
    joy.id = null;
  } else {
    firing = false;
  }
}
canvas.addEventListener("pointerup", endPointer);
canvas.addEventListener("pointercancel", endPointer);
canvas.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse") firing = false; });
canvas.addEventListener("contextmenu", (e) => e.preventDefault());

// --- Keyboard ---
addEventListener("keydown", (e) => {
  if (videoModal.classList.contains("open")) {
    if (e.key.toLowerCase() === "escape") closeVideo();
    return;
  }
  const k = e.key.toLowerCase();
  if (k === "escape") { closeGame(); return; }
  if (["arrowleft", "arrowright", "arrowup", "arrowdown", " "].includes(k)) e.preventDefault();
  keys.add(k);
});
addEventListener("keyup", (e) => { keys.delete(e.key.toLowerCase()); });

// --- Video sorpresa (pantalla completa al terminar el juego) ---
let videoTimer = null;
function requestFullscreen(el) {
  const req = el.requestFullscreen || el.webkitRequestFullscreen;
  if (!req) return;
  try { const r = req.call(el); if (r && r.catch) r.catch(() => {}); } catch (e) {}
}
function openVideo() {
  videoModal.classList.add("open");
  videoModal.setAttribute("aria-hidden", "false");
  requestFullscreen(videoModal);
  try { videoEl.currentTime = 0; } catch (e) {}
  const playing = videoEl.play();
  if (playing && playing.catch) playing.catch(() => {});
}
function closeVideo() {
  clearTimeout(videoTimer);
  if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
  else if (document.webkitFullscreenElement && document.webkitExitFullscreen) document.webkitExitFullscreen();
  videoEl.pause();
  videoModal.classList.remove("open");
  videoModal.setAttribute("aria-hidden", "true");
}
document.querySelector("#close-video").addEventListener("click", closeVideo);
videoModal.addEventListener("click", (e) => { if (e.target === videoModal) closeVideo(); });
videoEl.addEventListener("ended", () => {
  if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
});

// --- Open / close / reset ---
function openGame() {
  pauseBackgroundMusic();
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  resetGame();
  if (!running) { running = true; requestAnimationFrame(loop); }
}
function closeGame() {
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
  closeVideo();
  firing = false;
  joy.active = false;
  keys.clear();
  prevJump = false;
  startBackgroundMusic();
}
document.querySelector("#open-game").addEventListener("click", openGame);
document.querySelector("#close-game").addEventListener("click", closeGame);
modal.addEventListener("click", (e) => { if (e.target === modal) closeGame(); });
document.querySelector("#reset-game").addEventListener("click", () => {
  resetGame();
  if (!running) { running = true; requestAnimationFrame(loop); }
});

buildLevel();
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(() => { if (!running) buildLevel(); });
}
