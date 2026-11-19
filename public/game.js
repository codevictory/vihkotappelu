'use strict';

/* Vihkotappelu client — mouse-driven canvas renderer.
 * The server owns the rules; this file only renders state and sends actions. */

const SIZE = 8;
const TILE = 80;
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

/* ---- pixel-art sprites, 16x16, one char per pixel ---- */

const SPRITES = {
  spearman: [
    '................',
    '............W...',
    '............M...',
    '......HH....W...',
    '.....HHHH...W...',
    '.....HSEH...W...',
    '......SS....W...',
    '.....AAAA...W...',
    '....AAAAAA..W...',
    '....ADAAAD......',
    '....ADAAAD......',
    '.....A..A.......',
    '.....L..L.......',
    '.....L..L.......',
    '....LL..LL......',
    '................',
  ],
  archer: [
    '................',
    '.B..............',
    '.BB.............',
    '..B.....HH......',
    '..B....HHHH.....',
    '...B...HSEH.....',
    '...B....SS......',
    '..B...AAAA......',
    '.B...AAAAAA.....',
    '.BB..ADAAAD.....',
    '..B..ADAAAD.....',
    '.....A..A.......',
    '.....L..L.......',
    '.....L..L.......',
    '....LL..LL......',
    '................',
  ],
  mage: [
    '.......P........',
    '.......PP.......',
    '.......PP.......',
    '......PPP.......',
    '.....PPPPP......',
    '....PPPPPPP.....',
    '.....HSEH.......',
    'O.....SS........',
    'W....RRRRR......',
    'W...RRRRRRR.....',
    'W...RRRRRRR.....',
    'W...RRRRRRR.....',
    'W...RRRRRRR.....',
    '....RRRRRRR.....',
    '...RRRRRRRRR....',
    '...RRRRRRRRR....',
  ],
};

const PALETTES = {
  azure: {
    H: '#bfdbfe', A: '#3b82f6', D: '#1e40af', S: '#f1c27d', E: '#1f2937',
    L: '#172554', W: '#92400e', M: '#e5e7eb', B: '#92400e', R: '#60a5fa',
    P: '#1d4ed8', O: '#facc15',
  },
  crimson: {
    H: '#fecaca', A: '#ef4444', D: '#7f1d1d', S: '#f1c27d', E: '#1f2937',
    L: '#450a0a', W: '#92400e', M: '#e5e7eb', B: '#92400e', R: '#dc2626',
    P: '#991b1b', O: '#facc15',
  },
};

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

function actionable(t) {
  if (!state || state.gameOver || !t) return false;
  if (selectedId) {
    if (hints.moves.some((m) => m.x === t.x && m.y === t.y)) return true;
    if (hints.attacks.some((a) => a.x === t.x && a.y === t.y)) return true;
  }
  const u = unitAt(t.x, t.y);
  return !!(u && u.side === state.turn);
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
        selectedId = null;
        hints = { moves: [], attacks: [] };
      } else if (mv) {
        const r = await api('/api/move', { id: selectedId, x: t.x, y: t.y });
        state = r.state;
        selectedId = null;
        hints = { moves: [], attacks: [] };
      } else {
        const u = unitAt(t.x, t.y);
        if (u && u.side === state.turn) await selectUnit(u.id);
        else { selectedId = null; hints = { moves: [], attacks: [] }; }
      }
    } else {
      const u = unitAt(t.x, t.y);
      if (u && u.side === state.turn) await selectUnit(u.id);
    }
  } catch (err) {
    showStatus(err.message);
  }
  renderAll();
});

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

/* ---- rendering ---- */

function renderAll() {
  renderBoard();
  renderPanel();
}

function renderBoard() {
  if (!state) return;
  const light = '#3a3157';
  const dark = '#2b2444';

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? light : dark;
      ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
    }
  }

  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= SIZE; i++) {
    ctx.beginPath(); ctx.moveTo(i * TILE, 0); ctx.lineTo(i * TILE, BOARD_PX); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i * TILE); ctx.lineTo(BOARD_PX, i * TILE); ctx.stroke();
  }

  ctx.font = '10px monospace';
  ctx.fillStyle = 'rgba(231,226,245,0.45)';
  for (let x = 0; x < SIZE; x++) ctx.fillText('abcdefgh'[x], x * TILE + 4, BOARD_PX - 6);
  for (let y = 0; y < SIZE; y++) ctx.fillText(String(SIZE - y), 4, y * TILE + 12);

  if (selectedId) {
    for (const m of hints.moves) {
      ctx.fillStyle = 'rgba(74,222,128,0.30)';
      ctx.fillRect(m.x * TILE + 4, m.y * TILE + 4, TILE - 8, TILE - 8);
    }
    for (const a of hints.attacks) {
      ctx.fillStyle = 'rgba(248,113,113,0.38)';
      ctx.fillRect(a.x * TILE + 4, a.y * TILE + 4, TILE - 8, TILE - 8);
    }
    const sel = state.units.find((u) => u.id === selectedId);
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

function drawUnit(u) {
  const px = u.x * TILE + 8;
  const py = u.y * TILE + 8;
  const scale = 4;
  const map = SPRITES[u.def.sprite] || SPRITES.spearman;
  const pal = PALETTES[u.side] || PALETTES.azure;
  for (let y = 0; y < map.length; y++) {
    const row = map[y];
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === '.') continue;
      ctx.fillStyle = pal[ch] || '#ffffff';
      ctx.fillRect(px + x * scale, py + y * scale, scale, scale);
    }
  }

  const frac = Math.max(0, u.hp / u.maxHp);
  const barW = 48;
  const bx = u.x * TILE + (TILE - barW) / 2;
  const by = u.y * TILE + 5;
  ctx.fillStyle = '#0c0916';
  ctx.fillRect(bx - 1, by - 1, barW + 2, 8);
  ctx.fillStyle = frac > 0.5 ? '#4ade80' : frac > 0.25 ? '#fbbf24' : '#f87171';
  ctx.fillRect(bx, by, barW * frac, 6);

  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#0c0916';
  ctx.fillText(`${u.hp}/${u.maxHp}`, u.x * TILE + TILE / 2 + 1, u.y * TILE + TILE - 4 + 1);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`${u.hp}/${u.maxHp}`, u.x * TILE + TILE / 2, u.y * TILE + TILE - 4);
  ctx.textAlign = 'left';
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
