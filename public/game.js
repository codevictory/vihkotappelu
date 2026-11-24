'use strict';

/* Vihkotappelu client — mouse-driven canvas renderer.
 * The server owns the rules; this file only renders state and sends actions. */

const SIZE = 32;
const TILE = 24;
const BOARD_PX = SIZE * TILE;

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');

const dpr = window.devicePixelRatio || 1;
canvas.width = BOARD_PX * dpr;
canvas.height = BOARD_PX * dpr;
canvas.style.width = BOARD_PX + 'px';
canvas.style.height = BOARD_PX + 'px';
ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

let state = null;
let selectedId = null;
let hints = { moves: [], attacks: [] };
let hover = null;

/* ---- language ---- */

const I18N = window.I18N;
let lang = I18N.DEFAULT_LANG;
try {
  lang = I18N.normalize(localStorage.getItem('vihkotappelu-lang') || I18N.DEFAULT_LANG);
} catch { /* localStorage unavailable — keep default */ }
const t = (key, params) => I18N.t(lang, key, params);

function applyLang(next) {
  lang = I18N.normalize(next);
  try { localStorage.setItem('vihkotappelu-lang', lang); } catch { /* ignore */ }
  document.documentElement.lang = lang;
  document.title = t('ui.title');
  document.getElementById('langPicker').setAttribute('aria-label', t('ui.langPickerLabel'));
  for (const el of document.querySelectorAll('[data-i18n]')) el.innerHTML = t(el.dataset.i18n);
  for (const btn of document.querySelectorAll('.lang-btn')) {
    btn.classList.toggle('active', btn.dataset.lang === lang);
  }
}

for (const btn of document.querySelectorAll('.lang-btn')) {
  btn.addEventListener('click', () => {
    if (btn.dataset.lang === lang) return;
    applyLang(btn.dataset.lang);
    refresh().catch((err) => showStatus(err.message));
  });
}

/* ---- sprites ----
 * Sprites live ONLY in the klapi database (VihkotappeluSprites, per-pixel
 * hex colors) and arrive via GET /api/sprites as { spriteKey: { width,
 * height, pixels } } where pixels[y][x] is null (transparent),
 * '#rrggbb'/'#rrggbbaa', or 'side' (the owning side's faction color).
 * The server loads them from klapi at boot, so they are always present. */

const DB_SPRITES = {}; // spriteKey -> { width, height, pixels } from /api/sprites
const spriteCache = new Map(); // spriteKey|side -> resolved pixels[y][x] colors

function sideColor(side) {
  return (state && state.sides[side] && state.sides[side].color) || '#ffffff';
}

/* Resolve a sprite to a concrete color grid ('side' -> the side's color). */
function spritePixels(key, side) {
  const cacheKey = key + '|' + (side || '');
  if (spriteCache.has(cacheKey)) return spriteCache.get(cacheKey);
  const db = DB_SPRITES[key];
  const grid = db && Array.isArray(db.pixels)
    ? db.pixels.map((row) => row.map((c) => (c === 'side' ? sideColor(side) : c)))
    : null;
  spriteCache.set(cacheKey, grid);
  return grid;
}

function drawPixels(grid, px, py, scale) {
  if (!grid) return;
  for (let y = 0; y < grid.length; y++) {
    const row = grid[y];
    for (let x = 0; x < row.length; x++) {
      const c = row[x];
      if (!c) continue;
      ctx.fillStyle = c;
      ctx.fillRect(px + x * scale, py + y * scale, scale, scale);
    }
  }
}

async function loadSprites() {
  try {
    const r = await api('/api/sprites');
    for (const k of Object.keys(DB_SPRITES)) delete DB_SPRITES[k];
    Object.assign(DB_SPRITES, r.sprites || {});
    spriteCache.clear();
  } catch { /* keep the bundled fallback sprites */ }
}

/* ---- server API ---- */

async function api(path, body) {
  const sep = path.includes('?') ? '&' : '?';
  const res = await fetch(path + sep + 'lang=' + encodeURIComponent(lang), body
    ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    : undefined);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(data.error || ('HTTP ' + res.status));
  return data;
}

async function refresh() {
  await loadSprites(); // static per game data; re-fetched so server-side klapi refreshes show up
  const r = await api('/api/state');
  state = r.state;
  renderAll();
}

async function selectUnit(id) {
  selectedId = id;
  const h = await api('/api/hints?id=' + encodeURIComponent(id));
  hints = h.hints;
  renderAll();
}

async function newGame() {
  const r = await api('/api/new', {});
  state = r.state;
  selectedId = null;
  hints = { moves: [], attacks: [] };
  document.getElementById('overlay').classList.add('hidden');
  clearStatus();
  renderAll();
}

/* ---- interaction ---- */

function tileFromEvent(e) {
  const r = canvas.getBoundingClientRect();
  const x = Math.floor((e.clientX - r.left) / r.width * SIZE);
  const y = Math.floor((e.clientY - r.top) / r.height * SIZE);
  if (x < 0 || x >= SIZE || y < 0 || y >= SIZE) return null;
  return { x, y };
}

function unitAt(x, y) {
  return state.units.find((u) => u.x === x && u.y === y) || null;
}

function canSelect(u) {
  return !u.hasMoved || !u.hasAttacked;
}

function actionable(t) {
  if (!state || state.gameOver || !t) return false;
  if (selectedId) {
    if (hints.moves.some((m) => m.x === t.x && m.y === t.y)) return true;
    if (hints.attacks.some((a) => a.x === t.x && a.y === t.y)) return true;
  }
  const u = unitAt(t.x, t.y);
  return !!(u && u.side === state.turn && canSelect(u));
}

canvas.addEventListener('click', async (e) => {
  if (!state || state.gameOver) return;
  const t = tileFromEvent(e);
  if (!t) return;
  clearStatus();
  try {
    if (selectedId) {
      const atk = hints.attacks.find((a) => a.x === t.x && a.y === t.y);
      const mv = hints.moves.find((m) => m.x === t.x && m.y === t.y);
      if (atk) {
        const r = await api('/api/attack', { id: selectedId, targetId: atk.id });
        state = r.state;
        await afterAction(selectedId);
      } else if (mv) {
        const r = await api('/api/move', { id: selectedId, x: t.x, y: t.y });
        state = r.state;
        await afterAction(selectedId);
      } else {
        const u = unitAt(t.x, t.y);
        if (u && u.side === state.turn && canSelect(u)) await selectUnit(u.id);
        else { selectedId = null; hints = { moves: [], attacks: [] }; }
      }
    } else {
      const u = unitAt(t.x, t.y);
      if (u && u.side === state.turn && canSelect(u)) await selectUnit(u.id);
    }
  } catch (err) {
    showStatus(err.message);
  }
  renderAll();
});

/* After acting, keep the unit selected if it can still do something this
 * turn (e.g. attack from its new square); otherwise clear the selection. */
async function afterAction(unitId) {
  const u = state.units.find((x) => x.id === unitId);
  if (!state.gameOver && u && u.side === state.turn && canSelect(u)) {
    await selectUnit(unitId);
  } else {
    selectedId = null;
    hints = { moves: [], attacks: [] };
  }
}

canvas.addEventListener('mousemove', (e) => {
  hover = tileFromEvent(e);
  canvas.style.cursor = actionable(hover) ? 'pointer' : 'default';
  renderBoard();
});

canvas.addEventListener('mouseleave', () => {
  hover = null;
  canvas.style.cursor = 'default';
  renderBoard();
});

document.getElementById('newGame').addEventListener('click', () => newGame().catch((err) => showStatus(err.message)));
document.getElementById('overlayNewGame').addEventListener('click', () => newGame().catch((err) => showStatus(err.message)));

document.getElementById('endTurn').addEventListener('click', async () => {
  if (!state || state.gameOver) return;
  try {
    const r = await api('/api/endturn', {});
    state = r.state;
    selectedId = null;
    hints = { moves: [], attacks: [] };
    clearStatus();
  } catch (err) {
    showStatus(err.message);
  }
  renderAll();
});

/* ---- rendering ---- */

function renderAll() {
  renderBoard();
  renderPanel();
}

function renderBoard() {
  if (!state) return;

  ctx.fillStyle = '#2b2444';
  ctx.fillRect(0, 0, BOARD_PX, BOARD_PX);

  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= SIZE; i++) {
    ctx.beginPath(); ctx.moveTo(i * TILE, 0); ctx.lineTo(i * TILE, BOARD_PX); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i * TILE); ctx.lineTo(BOARD_PX, i * TILE); ctx.stroke();
  }

  for (const o of state.obstacles || []) drawObstacle(o);

  if (selectedId) {
    const sel = state.units.find((u) => u.id === selectedId);
    if (sel) drawRangeIndicator(sel);
    for (const m of hints.moves) {
      ctx.fillStyle = 'rgba(74,222,128,0.30)';
      ctx.fillRect(m.x * TILE + 4, m.y * TILE + 4, TILE - 8, TILE - 8);
    }
    for (const a of hints.attacks) {
      ctx.fillStyle = 'rgba(248,113,113,0.38)';
      ctx.fillRect(a.x * TILE + 4, a.y * TILE + 4, TILE - 8, TILE - 8);
    }
    if (sel) {
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 3;
      ctx.strokeRect(sel.x * TILE + 2, sel.y * TILE + 2, TILE - 4, TILE - 4);
    }
  }

  for (const u of state.units) drawUnit(u);

  if (hover) {
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 2;
    ctx.strokeRect(hover.x * TILE + 1, hover.y * TILE + 1, TILE - 2, TILE - 2);
  }
}

/* Range indicator: every square the selected unit could attack from its
 * current square (Chebyshev distance within [minRange, range]), marked with a
 * faint fill and the 'range' bracket sprite. Drawn before the move/attack
 * hints so those stay on top. */
function drawRangeIndicator(sel) {
  const min = sel.def.minRange || 1;
  const max = sel.def.range;
  for (let dy = -max; dy <= max; dy++) {
    for (let dx = -max; dx <= max; dx++) {
      const d = Math.max(Math.abs(dx), Math.abs(dy));
      if (d < min || d > max) continue;
      const x = sel.x + dx;
      const y = sel.y + dy;
      if (x < 0 || x >= SIZE || y < 0 || y >= SIZE) continue;
      ctx.fillStyle = 'rgba(250,204,21,0.08)';
      ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
      drawOverlay('range', x, y);
    }
  }
}

/* Tile overlay sprites (range markers) are side-independent. */
function drawOverlay(type, tx, ty) {
  const scale = Math.max(1, Math.floor((TILE - 4) / 16));
  const px = tx * TILE + (TILE - 16 * scale) / 2;
  const py = ty * TILE + (TILE - 16 * scale) / 2;
  drawPixels(spritePixels(type), px, py, scale);
}

/* Obstacles are side-independent terrain sprites. */
function drawObstacle(o) {
  const scale = Math.max(1, Math.floor((TILE - 4) / 16));
  const px = o.x * TILE + (TILE - 16 * scale) / 2;
  const py = o.y * TILE + (TILE - 16 * scale) / 2;
  drawPixels(spritePixels(o.type), px, py, scale);
}

function drawUnit(u) {
  const scale = Math.max(1, Math.floor((TILE - 8) / 16));
  const px = u.x * TILE + (TILE - 16 * scale) / 2;
  const py = u.y * TILE + 6; // leave the top of the tile for the hp bar
  const grid = spritePixels(u.def.sprite, u.side) || spritePixels('soldiers_of_falroth', u.side);
  const spent = u.hasMoved && u.hasAttacked;
  ctx.save();
  if (spent) ctx.globalAlpha = 0.4;
  drawPixels(grid, px, py, scale);
  ctx.restore();

  /* Moved-status highlight: green = not moved yet, red = already moved.
   * The selected unit is skipped — it already has a yellow selection frame. */
  if (u.id !== selectedId) {
    ctx.strokeStyle = u.hasMoved ? '#f87171' : '#4ade80';
    ctx.lineWidth = 2;
    ctx.strokeRect(u.x * TILE + 1, u.y * TILE + 1, TILE - 2, TILE - 2);
  }

  const frac = Math.max(0, u.hp / u.maxHp);
  const barW = TILE - 6;
  const bx = u.x * TILE + (TILE - barW) / 2;
  const by = u.y * TILE + 1;
  ctx.fillStyle = '#0c0916';
  ctx.fillRect(bx - 1, by, barW + 2, 5);
  ctx.fillStyle = frac > 0.5 ? '#4ade80' : frac > 0.25 ? '#fbbf24' : '#f87171';
  ctx.fillRect(bx, by + 1, barW * frac, 3);
}

function renderPanel() {
  const banner = document.getElementById('turnBanner');
  if (state.gameOver) {
    const w = state.sides[state.winner];
    banner.innerHTML = `<span class="dot" style="background:${w.color}"></span>${t('ui.bannerWin', { side: w.name })}`;
    document.getElementById('overlayTitle').textContent = t('ui.overlayWin', { side: w.name });
    document.getElementById('overlayTitle').style.color = w.color;
    document.getElementById('overlay').classList.remove('hidden');
  } else {
    const s = state.sides[state.turn];
    banner.innerHTML = `<span class="dot" style="background:${s.color}"></span>${t('ui.bannerTurn', { side: s.name, sidegen: { ref: 'side.' + state.turn, form: 'gen' }, move: state.moveNumber })}`;
    document.getElementById('overlay').classList.add('hidden');
  }

  const card = document.getElementById('unitCard');
  const sel = state.units.find((u) => u.id === selectedId);
  if (!sel) {
    card.className = 'unit-card empty';
    card.textContent = t('ui.emptyCard');
  } else {
    const d = sel.def;
    const sideName = state.sides[sel.side].name;
    const acted = [];
    if (sel.hasMoved) acted.push(t('ui.hasMoved'));
    if (sel.hasAttacked) acted.push(t('ui.hasAttacked'));
    card.className = 'unit-card';
    card.innerHTML =
      `<div class="uname">${d.name}</div>` +
      `<div class="uside" style="color:${state.sides[sel.side].color}">${sideName}</div>` +
      `<table>` +
      `<tr><td>${t('ui.statHealth')}</td><td>${sel.hp} / ${sel.maxHp}</td></tr>` +
      `<tr><td>${t('ui.statAttack')}</td><td>${d.attack}</td></tr>` +
      `<tr><td>${t('ui.statDefence')}</td><td>${d.defence}</td></tr>` +
      `<tr><td>${t('ui.statMovement')}</td><td>${d.movement}</td></tr>` +
      `<tr><td>${t('ui.statRange')}</td><td>${d.minRange || 1}&ndash;${d.range}</td></tr>` +
      `</table>` +
      (acted.length ? `<div class="uacted">${acted.join(' · ')}</div>` : '') +
      `<div class="udesc">${d.description || ''}</div>`;
  }

  const log = document.getElementById('log');
  log.innerHTML = state.log
    .map((e) => `<div class="entry"><span class="n">${e.n}.</span>${escapeHtml(e.msg)}</div>`)
    .join('');
  log.scrollTop = log.scrollHeight;
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

let statusTimer = null;
function showStatus(msg) {
  const el = document.getElementById('status');
  el.textContent = msg;
  clearTimeout(statusTimer);
  statusTimer = setTimeout(clearStatus, 4000);
}
function clearStatus() {
  document.getElementById('status').textContent = '';
}

applyLang(lang);
refresh().catch((err) => showStatus(err.message));
