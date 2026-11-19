'use strict';

/**
 * Vihkotappelu — core turn-based battle rules.
 *
 * Pure logic module, no I/O except reading units.json once at load.
 * A Game instance is one match. The server keeps one Game per room, so
 * online play later just means creating rooms keyed by room id and letting
 * two human clients claim the two sides.
 */

const fs = require('fs');
const path = require('path');
const I18N = require('../public/i18n.js');

const UNIT_DEFS = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'units.json'), 'utf8')
).units;

const SIZE = 8;

const SIDES = {
  azure: { name: 'Azure Order', color: '#3b82f6', enemy: 'crimson' },
  crimson: { name: 'Crimson Pact', color: '#ef4444', enemy: 'azure' },
};

const START_SIDE = 'azure';

// Chess-style opening: five pieces on each back row, mage in the middle.
// Crimson is point-symmetric to azure (180 degree rotation), like chess.
const OPENING = [
  { side: 'azure', type: 'spearman', x: 1, y: 7 },
  { side: 'azure', type: 'archer', x: 2, y: 7 },
  { side: 'azure', type: 'mage', x: 3, y: 7 },
  { side: 'azure', type: 'archer', x: 4, y: 7 },
  { side: 'azure', type: 'spearman', x: 5, y: 7 },
  { side: 'crimson', type: 'spearman', x: 6, y: 0 },
  { side: 'crimson', type: 'archer', x: 5, y: 0 },
  { side: 'crimson', type: 'mage', x: 4, y: 0 },
  { side: 'crimson', type: 'archer', x: 3, y: 0 },
  { side: 'crimson', type: 'spearman', x: 2, y: 0 },
];

function chebyshev(ax, ay, bx, by) {
  return Math.max(Math.abs(ax - bx), Math.abs(ay - by));
}

class Game {
  constructor() {
    this.reset();
  }

  reset() {
    this.units = [];
    this.turn = START_SIDE;
    this.winner = null;
    this.moveNumber = 1;
    this.log = [];
    let n = 0;
    for (const p of OPENING) {
      const def = UNIT_DEFS[p.type];
      this.units.push({
        id: `${p.side}-${p.type}-${++n}`,
        side: p.side,
        type: p.type,
        x: p.x,
        y: p.y,
        hp: def.hp,
        maxHp: def.hp,
      });
    }
    this.say('log.begin', { side: { ref: 'side.' + this.turn } });
  }

  /* Log entries are stored as {key, params} so state(lang) can render them
   * in any language; {ref: 'side.azure'}-style params resolve to localized
   * names at render time. */
  say(key, params) {
    this.log.push({ n: this.moveNumber, side: this.turn, key, params: params || {} });
    if (this.log.length > 60) this.log.shift();
  }

  unitById(id) {
    return this.units.find((u) => u.id === id) || null;
  }

  unitAt(x, y) {
    return this.units.find((u) => u.x === x && u.y === y) || null;
  }

  inBounds(x, y) {
    return x >= 0 && x < SIZE && y >= 0 && y < SIZE;
  }

  /** Squares the unit can move to this turn (BFS, 4-dir, blocked by units). */
  movesFor(unit) {
    const def = UNIT_DEFS[unit.type];
    const seen = new Map();
    const startKey = `${unit.x},${unit.y}`;
    seen.set(startKey, 0);
    const queue = [{ x: unit.x, y: unit.y, d: 0 }];
    const out = [];
    while (queue.length) {
      const cur = queue.shift();
      if (cur.d >= def.movement) continue;
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (const [dx, dy] of dirs) {
        const nx = cur.x + dx;
        const ny = cur.y + dy;
        const key = `${nx},${ny}`;
        if (!this.inBounds(nx, ny) || seen.has(key)) continue;
        if (this.unitAt(nx, ny)) continue; // cannot pass through or stop on a unit
        seen.set(key, cur.d + 1);
        out.push({ x: nx, y: ny });
        queue.push({ x: nx, y: ny, d: cur.d + 1 });
      }
    }
    return out;
  }

  /** Enemy units this unit can attack this turn (Chebyshev range window). */
  attacksFor(unit) {
    const def = UNIT_DEFS[unit.type];
    const min = def.minRange || 1;
    const max = def.range;
    return this.units.filter((u) => {
      if (u.side === unit.side) return false;
      const d = chebyshev(unit.x, unit.y, u.x, u.y);
      return d >= min && d <= max;
    });
  }

  assertActiveTurn(unit) {
    if (this.winner) throw httpError(400, 'err.over');
    if (unit.side !== this.turn) {
      throw httpError(400, 'err.turn', {
        side: { ref: 'side.' + this.turn },
        other: { ref: 'side.' + unit.side },
        sidegen: { ref: 'side.' + this.turn, form: 'gen' },
        othergen: { ref: 'side.' + unit.side, form: 'gen' },
      });
    }
  }

  move(id, x, y) {
    const unit = this.unitById(id);
    if (!unit) throw httpError(404, 'err.noUnit');
    this.assertActiveTurn(unit);
    if (!Number.isInteger(x) || !Number.isInteger(y) || !this.inBounds(x, y)) {
      throw httpError(400, 'err.offBoard');
    }
    const ok = this.movesFor(unit).some((m) => m.x === x && m.y === y);
    if (!ok) throw httpError(400, 'err.cannotMove', { unit: { ref: 'unit.' + unit.type + '.name' } });
    const from = { x: unit.x, y: unit.y };
    unit.x = x;
    unit.y = y;
    this.say('log.move', {
      side: { ref: 'side.' + unit.side },
      sidegen: { ref: 'side.' + unit.side, form: 'gen' },
      unit: { ref: 'unit.' + unit.type + '.name' },
      from: sq(from),
      to: sq({ x, y }),
    });
    this.endTurn();
    return unit;
  }

  attack(id, targetId) {
    const unit = this.unitById(id);
    if (!unit) throw httpError(404, 'err.noUnit');
    this.assertActiveTurn(unit);
    const target = this.unitById(targetId);
    if (!target) throw httpError(404, 'err.noTarget');
    const ok = this.attacksFor(unit).some((u) => u.id === targetId);
    if (!ok) {
      throw httpError(400, 'err.cannotReach', {
        unit: { ref: 'unit.' + unit.type + '.name' },
        target: { ref: 'unit.' + target.type + '.name' },
      });
    }

    const atk = UNIT_DEFS[unit.type].attack;
    const def = UNIT_DEFS[target.type].defence;
    const dmg = Math.max(1, atk - def);
    target.hp -= dmg;
    this.say('log.hit', {
      side: { ref: 'side.' + unit.side },
      sidegen: { ref: 'side.' + unit.side, form: 'gen' },
      unit: { ref: 'unit.' + unit.type + '.name' },
      targetSide: { ref: 'side.' + target.side },
      targetUnit: { ref: 'unit.' + target.type + '.name' },
      dmg,
      atk,
      def,
    });

    if (target.hp <= 0) {
      this.units = this.units.filter((u) => u.id !== targetId);
      this.say('log.slain', {
        side: { ref: 'side.' + target.side },
        sidegen: { ref: 'side.' + target.side, form: 'gen' },
        unit: { ref: 'unit.' + target.type + '.name' },
      });
      if (target.type === 'mage') {
        this.winner = unit.side;
        this.say('log.win', {
          side: { ref: 'side.' + target.side },
          sidegen: { ref: 'side.' + target.side, form: 'gen' },
          winner: { ref: 'side.' + unit.side },
        });
      }
    }
    this.endTurn();
    return { attacker: unit, target, dmg };
  }

  endTurn() {
    if (this.winner) return;
    this.turn = SIDES[this.turn].enemy;
    if (this.turn === START_SIDE) this.moveNumber += 1;
  }

  /** Serializable state with all human-readable strings localized to lang. */
  state(lang) {
    lang = I18N.normalize(lang || I18N.DEFAULT_LANG);
    const sides = {};
    for (const key of Object.keys(SIDES)) {
      sides[key] = { ...SIDES[key], name: I18N.t(lang, 'side.' + key) };
    }
    const defs = {};
    for (const type of Object.keys(UNIT_DEFS)) {
      defs[type] = {
        ...UNIT_DEFS[type],
        name: I18N.t(lang, 'unit.' + type + '.name'),
        description: I18N.t(lang, 'unit.' + type + '.description'),
      };
    }
    return {
      size: SIZE,
      sides,
      defs,
      turn: this.turn,
      moveNumber: this.moveNumber,
      winner: this.winner,
      gameOver: this.winner !== null,
      units: this.units.map((u) => ({ ...u, def: defs[u.type] })),
      log: this.log.slice(-30).map((e) => ({ n: e.n, side: e.side, msg: I18N.t(lang, e.key, e.params) })),
    };
  }
}

function sq(p) {
  return `${'abcdefgh'[p.x]}${8 - p.y}`;
}

/* Errors carry an i18n key so the server can re-render the message in the
 * requester's language; err.message stays English for direct (test) use. */
function httpError(status, key, params) {
  const err = new Error(I18N.t(I18N.DEFAULT_LANG, key, params));
  err.status = status;
  err.key = key;
  err.params = params || {};
  return err;
}

/** Room registry — one Game per room id. Hotseat uses 'local'. */
const rooms = new Map();
function getRoom(id) {
  const key = String(id || 'local').slice(0, 64);
  if (!rooms.has(key)) rooms.set(key, new Game());
  return rooms.get(key);
}
function resetRoom(id) {
  const g = getRoom(id);
  g.reset();
  return g;
}

module.exports = { Game, getRoom, resetRoom, UNIT_DEFS, SIZE, SIDES, httpError, I18N };
