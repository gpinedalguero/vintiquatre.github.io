// ─── Data ────────────────────────────────────────────────────────────────────
const PIECES = [
  { letter:'一',   points:1,  desc:'Veure una peli' },
  { letter:'二',   points:2,  desc:'Planificar un viatge per l\'estiu' },
  { letter:'三',   points:3,  desc:'Jugar al joc It Takes Two' },
  { letter:'四',   points:4,  desc:'Fer un roadtrip per Nova Zelanda' },
  { letter:'五',   points:5,  desc:'Pujar una muntanya' },
  { letter:'六',   points:6,  desc:'Anar a veure Dune 3 a un cine IMAX' },
  { letter:'七',   points:7,  desc:'Veure una obra de teatre' },
  { letter:'八',   points:8,  desc:'Anar a veure una expo a un museu' },
  { letter:'九',   points:9,  desc:'Regalar-nos flors' },
  { letter:'十',   points:10, desc:'Veure la posta del sol a un mirador' },
  { letter:'十一', points:11, desc:'Anar a mirar el cel una nit estrellada' },
  { letter:'十二', points:12, desc:'Anar a fer fotos' },
  { letter:'十三', points:13, desc:'Sortir a correr junts' },
  { letter:'十四', points:14, desc:'Anar a un concert (i segurament criticarem les llums ;))' },
  { letter:'十五', points:15, desc:'Anar a passar un cap de setmana porai' },
  { letter:'十六', points:16, desc:'Sopar a un restaurant top' },
  { letter:'十七', points:17, desc:'Fer un projecte creatiu conjunt' },
  { letter:'十八', points:18, desc:'Anar a menjar a un xinès' },
  { letter:'十九', points:19, desc:'Sortir de festa o tajar-la junts' },
  { letter:'二十', points:20, desc:'Jugar a padel' },
  { letter:'二十一', points:21, desc:'Fer un cafe a una cafeteria aesthetic d\'especialitat (com si fossim expats forrats)' },
  { letter:'二十二', points:22, desc:'Menjar una pizza a Cadaqués' },
  { letter:'二十三', points:23, desc:'Fer una bakery date jej' },
  { letter:'二十四', points:24, desc:'Cantar a un karaoke' },
];

const TOTAL = PIECES.length; // 24

// ─── Persistence ─────────────────────────────────────────────────────────────
const STORAGE_KEY = 'scrabble-collected-v1';
function loadCollected() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}
function saveCollected() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...collected]));
}
const collected = loadCollected();

// ─── Matter.js ────────────────────────────────────────────────────────────────
const { Engine, Bodies, Body, World, Mouse, MouseConstraint } = Matter;

// ─── DOM refs ─────────────────────────────────────────────────────────────────
const canvas       = document.getElementById('world');
const ctx          = canvas.getContext('2d');
const wrap         = document.getElementById('canvas-wrap');
const overlay      = document.getElementById('overlay');
const ringFill     = document.getElementById('ring-fill');
const progPct      = document.getElementById('prog-pct');
const collCount    = document.getElementById('collection-count');
const collectCheck = document.getElementById('collect-check');
const collectLabel = document.getElementById('collect-label');
const collectText  = document.getElementById('collect-text');
const panelEl      = document.getElementById('collection-panel');
const panelBdrop   = document.getElementById('panel-backdrop');
const panelGrid    = document.getElementById('panel-grid');
const panelEmpty   = document.getElementById('panel-empty');

let W = wrap.clientWidth;
let H = wrap.clientHeight;
canvas.width  = W;
canvas.height = H;

// ─── Engine — zero gravity ────────────────────────────────────────────────────
const engine = Engine.create({
  gravity: { x: 0, y: 0 },
  positionIterations:  4,
  velocityIterations:  3,
  constraintIterations: 1
});
const world = engine.world;

// ─── Tile dimensions ──────────────────────────────────────────────────────────
const TW = 54;
const TH = 54;
const WALL = 60;

// ─── Walls ────────────────────────────────────────────────────────────────────
const wallOpts = { isStatic: true };
let walls = [];
function makeWalls() {
  walls.forEach(w => World.remove(world, w));
  walls = [
    Bodies.rectangle(W/2,     H+WALL/2, W+200, WALL, wallOpts),
    Bodies.rectangle(W/2,    -WALL/2,   W+200, WALL, wallOpts),
    Bodies.rectangle(-WALL/2,  H/2,     WALL,  H+200, wallOpts),
    Bodies.rectangle(W+WALL/2, H/2,     WALL,  H+200, wallOpts),
  ];
  World.add(world, walls);
}
makeWalls();

// ─── Bodies ───────────────────────────────────────────────────────────────────
const bodyMap = new Map();

function makeBody(x, y, idx) {
  const body = Bodies.rectangle(x, y, TW, TH, {
    restitution: 0.6,
    friction:    0.1,
    frictionAir: 0.01,
    angle: (Math.random() - 0.5) * 0.6,
    label: `tile-${idx}`
  });
  body._pieceIndex = idx;
  // Give initial random drift
  Body.setVelocity(body, {
    x: (Math.random() - 0.5) * 1.5,
    y: (Math.random() - 0.5) * 1.5
  });
  return body;
}

PIECES.forEach((piece, i) => {
  if (collected.has(i)) return;
  const col = i % 6;
  const row = Math.floor(i / 6);
  const x   = 80 + col * (W - 160) / 5 + (Math.random() - 0.5) * 30;
  const y   = 120 + row * (H - 200) / 3 + (Math.random() - 0.5) * 20;
  const body = makeBody(x, y, i);
  bodyMap.set(i, body);
  World.add(world, body);
});

function activeBodies() { return [...bodyMap.values()]; }

// ─── Mouse drag ───────────────────────────────────────────────────────────────
const mouse = Mouse.create(canvas);
mouse.element.removeEventListener('mousewheel', mouse.mousewheel);
mouse.element.removeEventListener('DOMMouseScroll', mouse.mousewheel);
const mc = MouseConstraint.create(engine, {
  mouse,
  constraint: { stiffness: 0.2, damping: 0.1, render: { visible: false } }
});
World.add(world, mc);

// ─── Click vs drag ────────────────────────────────────────────────────────────
const DRAG_THRESHOLD_SQ = 36;
const CLICK_MAX_MS = 300;
let mdPos = null, mdTime = null, wasDrag = false;

function tryOpenPiece(clientX, clientY) {
  if (!overlay.classList.contains('hidden')) return;
  const r  = canvas.getBoundingClientRect();
  const mx = (clientX - r.left) * (W / r.width);
  const my = (clientY - r.top)  * (H / r.height);
  const hit = activeBodies().find(b =>
    Matter.Bounds.contains(b.bounds, {x:mx,y:my}) &&
    Matter.Vertices.contains(b.vertices, {x:mx,y:my})
  );
  if (hit) showOverlay(hit._pieceIndex);
}

// ── Mouse ──
canvas.addEventListener('mousedown', e => {
  mdPos = { x: e.clientX, y: e.clientY };
  mdTime = Date.now();
  wasDrag = false;
});
canvas.addEventListener('mousemove', e => {
  if (!mdPos) return;
  const dx = e.clientX - mdPos.x, dy = e.clientY - mdPos.y;
  if (dx*dx + dy*dy > DRAG_THRESHOLD_SQ) wasDrag = true;
});
canvas.addEventListener('mouseup', e => {
  if (!mdPos) return;
  if (!wasDrag && (Date.now() - mdTime) < CLICK_MAX_MS) {
    tryOpenPiece(e.clientX, e.clientY);
  }
  mdPos = mdTime = null;
});

// ── Touch — feed Matter's mouse + detect tap ──
function touchToMouse(e, type) {
  const t = e.touches[0] || e.changedTouches[0];
  if (!t) return;
  const synth = new MouseEvent(type, {
    clientX: t.clientX, clientY: t.clientY,
    bubbles: true, cancelable: true
  });
  // Let Matter.js track the pointer for dragging
  Matter.Mouse._mousemove(mc.mouse, synth);
  if (type === 'mousedown') Matter.Mouse._mousedown(mc.mouse, synth);
  if (type === 'mouseup')   Matter.Mouse._mouseup(mc.mouse, synth);
}

canvas.addEventListener('touchstart', e => {
  e.preventDefault(); // stops double-tap zoom & scroll
  const t = e.touches[0];
  mdPos  = { x: t.clientX, y: t.clientY };
  mdTime = Date.now();
  wasDrag = false;
  touchToMouse(e, 'mousedown');
}, { passive: false });

canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  if (!mdPos) return;
  const t = e.touches[0];
  const dx = t.clientX - mdPos.x, dy = t.clientY - mdPos.y;
  if (dx*dx + dy*dy > DRAG_THRESHOLD_SQ) wasDrag = true;
  touchToMouse(e, 'mousemove');
}, { passive: false });

canvas.addEventListener('touchend', e => {
  e.preventDefault();
  if (!mdPos) return;
  if (!wasDrag && (Date.now() - mdTime) < CLICK_MAX_MS) {
    const t = e.changedTouches[0];
    tryOpenPiece(t.clientX, t.clientY);
  }
  touchToMouse(e, 'mouseup');
  mdPos = mdTime = null;
}, { passive: false });

// ─── Helpers ──────────────────────────────────────────────────────────────────
function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x+r, y);
  c.lineTo(x+w-r, y);
  c.quadraticCurveTo(x+w, y, x+w, y+r);
  c.lineTo(x+w, y+h-r);
  c.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
  c.lineTo(x+r, y+h);
  c.quadraticCurveTo(x, y+h, x, y+h-r);
  c.lineTo(x, y+r);
  c.quadraticCurveTo(x, y, x+r, y);
  c.closePath();
}

// ─── Draw scrabble tile ───────────────────────────────────────────────────────
function drawTile(body) {
  const p  = PIECES[body._pieceIndex];
  const hw = TW / 2, hh = TH / 2;

  ctx.save();
  ctx.translate(body.position.x, body.position.y);
  ctx.rotate(body.angle);

  // Drop shadow
  ctx.shadowColor   = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur    = 8;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 3;

  // Tile body
  ctx.fillStyle = '#f5e6c8';
  roundRect(ctx, -hw, -hh, TW, TH, 5);
  ctx.fill();

  ctx.shadowColor = 'transparent';

  // Outer border
  ctx.strokeStyle = '#d4b97a';
  ctx.lineWidth = 1;
  roundRect(ctx, -hw, -hh, TW, TH, 5);
  ctx.stroke();

  // Inner bevel highlight
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 1;
  roundRect(ctx, -hw+2, -hh+2, TW-4, TH-4, 3);
  ctx.stroke();

  // Chinese numeral — font shrinks for longer strings
  const fontSize = p.letter.length === 1 ? TW * 0.48
                 : p.letter.length === 2 ? TW * 0.34
                 :                         TW * 0.25;
  ctx.fillStyle    = '#2c1a08';
  ctx.font         = `bold ${fontSize}px serif`;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(p.letter, 0, -2);

  // Arabic number — bottom right
  ctx.fillStyle    = '#5a3a12';
  ctx.font         = `${TW * 0.20}px sans-serif`;
  ctx.textAlign    = 'right';
  ctx.textBaseline = 'bottom';
  ctx.fillText(p.points, hw - 4, hh - 3);

  ctx.restore();
}

// ─── Loop — always redraws, no sleep ─────────────────────────────────────────
function loop() {
  requestAnimationFrame(loop);
  Engine.update(engine, 1000 / 60);
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(10,14,26,0.55)';
  ctx.fillRect(0, 0, W, H);
  for (const b of activeBodies()) drawTile(b);
}
requestAnimationFrame(loop);

// ─── Gentle drift — periodic nudges keep tiles floating ──────────────────────
setInterval(() => {
  for (const b of activeBodies()) {
    Body.applyForce(b, b.position, {
      x: (Math.random() - 0.5) * 0.0008,
      y: (Math.random() - 0.5) * 0.0008
    });
    Body.setAngularVelocity(b, b.angularVelocity + (Math.random() - 0.5) * 0.01);
  }
}, 800);

// ─── Progress ring ────────────────────────────────────────────────────────────
const CIRCUMFERENCE = 2 * Math.PI * 96;
const sorpresaBtn   = document.getElementById('sorpresa-btn');
const centerWrap    = document.getElementById('center-progress');

function updateProgress() {
  const n      = collected.size;
  const pct    = Math.round((n / TOTAL) * 100);
  const offset = CIRCUMFERENCE * (1 - n / TOTAL);
  ringFill.style.strokeDashoffset = offset;
  progPct.textContent   = pct + '%';
  collCount.textContent = n;
  const done = n === TOTAL;
  ringFill.classList.toggle('complete', done);
  progPct.classList.toggle('complete', done);
  centerWrap.classList.toggle('complete', done);
  sorpresaBtn.classList.toggle('hidden', !done);
}

// ─── Current overlay piece index ──────────────────────────────────────────────
let currentPieceIndex = -1;

// ─── Overlay ──────────────────────────────────────────────────────────────────
function showOverlay(index) {
  currentPieceIndex = index;
  const p = PIECES[index];
  document.getElementById('ov-name').textContent = p.letter;
  document.getElementById('ov-desc').textContent = p.desc;
  buildPreview(p);
  const isCollected = collected.has(index);
  collectCheck.checked = isCollected;
  collectLabel.classList.toggle('is-collected', isCollected);
  collectText.textContent = isCollected ? 'Col·leccionat ✓' : 'Marca com a col·leccionat';
  overlay.classList.remove('hidden');
}

collectCheck.addEventListener('change', () => {
  if (currentPieceIndex < 0) return;
  const idx = currentPieceIndex;

  if (collectCheck.checked) {
    collected.add(idx);
    collectLabel.classList.add('is-collected');
    collectText.textContent = 'Col·leccionat ✓';
    const body = bodyMap.get(idx);
    if (body) {
      World.remove(world, body);
      bodyMap.delete(idx);
    }
  } else {
    collected.delete(idx);
    collectLabel.classList.remove('is-collected');
    collectText.textContent = 'Marca com a col·leccionat';
    const x = W / 2 + (Math.random() - 0.5) * 100;
    const y = H / 2 + (Math.random() - 0.5) * 100;
    const body = makeBody(x, y, idx);
    bodyMap.set(idx, body);
    World.add(world, body);
  }

  saveCollected();
  updateProgress();
  renderPanel();
  setTimeout(hideOverlay, 320);
});

document.getElementById('overlay-close').addEventListener('click', hideOverlay);
overlay.addEventListener('click', e => { if (e.target === overlay) hideOverlay(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') { hideOverlay(); closePanel(); } });

function hideOverlay() {
  overlay.classList.add('hidden');
  currentPieceIndex = -1;
}

// ─── Preview tile in overlay ──────────────────────────────────────────────────
function buildPreview(piece) {
  const preview = document.getElementById('domino-preview');
  preview.innerHTML = '';
  const S = 80;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  c.style.cssText = 'display:block;background:transparent';
  const cx = c.getContext('2d');
  cx.clearRect(0, 0, S, S);

  const pad = 4, r = 7;
  cx.shadowColor   = 'rgba(0,0,0,0.4)';
  cx.shadowBlur    = 8;
  cx.shadowOffsetX = 2;
  cx.shadowOffsetY = 3;
  cx.fillStyle = '#f5e6c8';
  roundRect(cx, pad, pad, S-pad*2, S-pad*2, r);
  cx.fill();
  cx.shadowColor = 'transparent';
  cx.strokeStyle = '#d4b97a';
  cx.lineWidth = 1.5;
  roundRect(cx, pad, pad, S-pad*2, S-pad*2, r);
  cx.stroke();
  cx.strokeStyle = 'rgba(255,255,255,0.5)';
  cx.lineWidth = 1;
  roundRect(cx, pad+2, pad+2, S-pad*2-4, S-pad*2-4, r-1);
  cx.stroke();

  const fs = piece.letter.length === 1 ? S * 0.48
           : piece.letter.length === 2 ? S * 0.34
           :                             S * 0.25;
  cx.fillStyle    = '#2c1a08';
  cx.font         = `bold ${fs}px serif`;
  cx.textAlign    = 'center';
  cx.textBaseline = 'middle';
  cx.fillText(piece.letter, S/2, S/2 - 2);

  cx.fillStyle    = '#5a3a12';
  cx.font         = `${S * 0.18}px sans-serif`;
  cx.textAlign    = 'right';
  cx.textBaseline = 'bottom';
  cx.fillText(piece.points, S - pad - 4, S - pad - 3);

  preview.appendChild(c);
}

// ─── Collection panel ─────────────────────────────────────────────────────────
function openPanel() {
  renderPanel();
  panelEl.classList.remove('panel-hidden');
  panelBdrop.classList.remove('panel-hidden');
}
function closePanel() {
  panelEl.classList.add('panel-hidden');
  panelBdrop.classList.add('panel-hidden');
}

document.getElementById('collection-btn').addEventListener('click', openPanel);
document.getElementById('panel-close').addEventListener('click', closePanel);
panelBdrop.addEventListener('click', closePanel);

function renderPanel() {
  panelGrid.innerHTML = '';
  const ids = [...collected].sort((a,b) => a - b);
  panelEmpty.style.display = ids.length === 0 ? 'block' : 'none';

  for (const idx of ids) {
    const piece = PIECES[idx];
    const card  = document.createElement('div');
    card.className = 'coll-card';

    const S = 48;
    const miniC = document.createElement('canvas');
    miniC.width = miniC.height = S;
    miniC.style.cssText = 'display:block;background:transparent';
    const mcx = miniC.getContext('2d');
    mcx.clearRect(0, 0, S, S);

    const pad = 3, r = 5;
    mcx.shadowColor   = 'rgba(0,0,0,0.35)';
    mcx.shadowBlur    = 5;
    mcx.shadowOffsetY = 2;
    mcx.fillStyle = '#f5e6c8';
    roundRect(mcx, pad, pad, S-pad*2, S-pad*2, r);
    mcx.fill();
    mcx.shadowColor = 'transparent';
    mcx.strokeStyle = '#d4b97a';
    mcx.lineWidth = 1;
    roundRect(mcx, pad, pad, S-pad*2, S-pad*2, r);
    mcx.stroke();

    const miniFs = piece.letter.length === 1 ? S * 0.48
                 : piece.letter.length === 2 ? S * 0.34
                 :                             S * 0.25;
    mcx.fillStyle    = '#2c1a08';
    mcx.font         = `bold ${miniFs}px serif`;
    mcx.textAlign    = 'center';
    mcx.textBaseline = 'middle';
    mcx.fillText(piece.letter, S/2, S/2 - 1);

    mcx.fillStyle    = '#5a3a12';
    mcx.font         = `${S * 0.20}px sans-serif`;
    mcx.textAlign    = 'right';
    mcx.textBaseline = 'bottom';
    mcx.fillText(piece.points, S - pad - 2, S - pad - 2);

    card.appendChild(miniC);

    const name = document.createElement('div');
    name.className = 'coll-name';
    name.textContent = piece.letter;
    card.appendChild(name);

    const ub = document.createElement('button');
    ub.className = 'uncollect-btn';
    ub.textContent = 'retorna';
    ub.addEventListener('click', e => { e.stopPropagation(); uncollect(idx); });
    card.appendChild(ub);

    card.addEventListener('click', () => { closePanel(); showOverlay(idx); });
    panelGrid.appendChild(card);
  }
}

// ─── Uncollect from panel ─────────────────────────────────────────────────────
function uncollect(idx) {
  collected.delete(idx);
  saveCollected();
  const x = W/2 + (Math.random()-0.5)*120;
  const y = H/2 + (Math.random()-0.5)*120;
  const body = makeBody(x, y, idx);
  bodyMap.set(idx, body);
  World.add(world, body);
  updateProgress();
  renderPanel();
}

// ─── Resize ───────────────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  W = wrap.clientWidth; H = wrap.clientHeight;
  canvas.width = W; canvas.height = H;
  makeWalls();
});

// ─── Init ─────────────────────────────────────────────────────────────────────
updateProgress();
renderPanel();