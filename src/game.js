'use strict';

/**
 * Vihkotappelu — core turn-based battle rules.
 *
 * Pure logic module, no I/O except reading units.json and factions/*.json
 * once at load. A Game instance is one match. The server keeps one Game per
 * room, so online play later just means creating rooms keyed by room id and
 * letting two human clients claim the two sides.
 */

const fs = require('fs');
const path = require('path');
const I18N = require('../public/i18n.js');

/* Factions are pure data in factions/<faction-id>.json; their units are
 * merged into the unit definitions alongside units.json, and the two factions
 * are the two sides of a match. */
const FACTIONS_DIR = path.join(__dirname, '..', 'factions');
const FACTIONS = {};
for (const file of fs.readdirSync(FACTIONS_DIR).filter((f) => f.endsWith('.json')).sort()) {
  const data = JSON.parse(fs.readFileSync(path.join(FACTIONS_DIR, file), 'utf8'));
  FACTIONS[data.faction.id] = data;
}

const UNIT_DEFS = Object.assign(
  {},
  JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'units.json'), 'utf8')).units
);
for (const id of Object.keys(FACTIONS)) Object.assign(UNIT_DEFS, FACTIONS[id].units);

const SIZE = 32;

const SIDE_IDS = Object.keys(FACTIONS);
const SIDES = {};
for (const id of SIDE_IDS) {
  SIDES[id] = {
    name: FACTIONS[id].faction.name,
    color: FACTIONS[id].faction.color,
    enemy: SIDE_IDS.find((other) => other !== id),
  };
}

const START_SIDE = SIDE_IDS[0];

/* Opening armies — each side's units lined up on its own back row, centered
 * on the 32-wide board, facing each other:
 *   Dalmen  (y = 31): 3 soldiers, 2 knights, 2 arbalesters, 1 catapult
 *   Zhaglon (y = 0):  3 riders, 2 knights, 3 archers, 2 chariots */
const ARMIES = {
  dalmen: [
    'soldiers_of_falroth', 'soldiers_of_falroth', 'soldiers_of_falroth',
    'knights_of_gremloth', 'knights_of_gremloth',
    'arbalesters', 'arbalesters',
    'catapult',
  ],
  zhaglon: [
    'riders_of_nezek', 'riders_of_nezek', 'riders_of_nezek',
    'knights_of_zhaglon', 'knights_of_zhaglon',
    'archers_of_grishtalon', 'archers_of_grishtalon', 'archers_of_grishtalon',
    'war_chariot', 'war_chariot',
  ],
};

function buildOpening() {
  const opening = [];
  for (const side of [START_SIDE, SIDES[START_SIDE].enemy]) {
    const types = ARMIES[side];
    const y = side === START_SIDE ? SIZE - 1 : 0;
    const startX = Math.floor((SIZE - types.length) / 2);
    types.forEach((type, i) => opening.push({ side, type, x: startX + i, y }));
  }
  return opening;
}
const OPENING = buildOpening();

function chebyshev(ax, ay, bx, by) {
  return Math.max(Math.abs(ax - bx), Math.abs(ay - by));
}

/* Obstacles — terrain sprites that units cannot move onto or through.
 * Generated randomly on every reset: forests and mountains grow as
 * clusters, houses are scattered far apart with only the occasional pair.
 * Attacks are not blocked — only movement. */
const OBSTACLE_TYPES = ['forest', 'mountain', 'house'];

/* Squares within this Chebyshev distance of an opening piece never get an
 * obstacle, so no unit starts boxed in. */
const OBSTACLE_CLEARANCE = 3;

const OBSTACLE_PLAN = {
  forest: { clusters: 4, minSize: 5, maxSize: 9 },
  mountain: { clusters: 2, minSize: 6, maxSize: 12 },
  house: { count: 10, minGap: 5, pairChance: 0.25, maxPairs: 2 },
};

const DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

class Game {
  constructor(rng) {
    this.rng = rng || Math.random;
    this.reset();
  }

  reset() {
    this.units = [];
    this.obstacles = [];
    this.obstacleMap = new Map();
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
        hasMoved: false,
        hasAttacked: false,
      });
    }
    this.generateObstacles();
    this.say('log.begin', { side: { ref: 'side.' + this.turn } });
  }

  obstacleAt(x, y) {
    return this.obstacleMap.get(`${x},${y}`) || null;
  }

  addObstacle(x, y, type) {
    const o = { x, y, type };
    this.obstacles.push(o);
    this.obstacleMap.set(`${x},${y}`, type);
    return o;
  }

  /** Random obstacle layout: clustered forests and mountains, sparse houses. */
  generateObstacles() {
    const rng = this.rng;
    const taken = new Set();
    for (const p of OPENING) {
      for (let dx = -OBSTACLE_CLEARANCE; dx <= OBSTACLE_CLEARANCE; dx++) {
        for (let dy = -OBSTACLE_CLEARANCE; dy <= OBSTACLE_CLEARANCE; dy++) {
          const x = p.x + dx, y = p.y + dy;
          if (this.inBounds(x, y)) taken.add(`${x},${y}`);
        }
      }
    }
    const isFree = (x, y) => this.inBounds(x, y) && !taken.has(`${x},${y}`);
    const randSquare = () => ({
      x: Math.floor(rng() * SIZE),
      y: Math.floor(rng() * SIZE),
    });
    const take = (x, y, type) => {
      this.addObstacle(x, y, type);
      taken.add(`${x},${y}`);
    };

    // Grow one blob: repeatedly extend a random member of the cluster by a
    // random 4-dir step, so the result is a connected, roughly round group.
    const growCluster = (type, minSize, maxSize) => {
      let seed = randSquare();
      let tries = 0;
      while (!isFree(seed.x, seed.y) && ++tries < 200) seed = randSquare();
      if (!isFree(seed.x, seed.y)) return;
      take(seed.x, seed.y, type);
      const cluster = [seed];
      const target = minSize + Math.floor(rng() * (maxSize - minSize + 1));
      let attempts = 0;
      while (cluster.length < target && attempts < target * 40) {
        attempts++;
        const c = cluster[Math.floor(rng() * cluster.length)];
        const [dx, dy] = DIRS4[Math.floor(rng() * DIRS4.length)];
        const nx = c.x + dx, ny = c.y + dy;
        if (!isFree(nx, ny)) continue;
        take(nx, ny, type);
        cluster.push({ x: nx, y: ny });
      }
    };

    const plan = OBSTACLE_PLAN;
    for (let i = 0; i < plan.forest.clusters; i++) {
      growCluster('forest', plan.forest.minSize, plan.forest.maxSize);
    }
    for (let i = 0; i < plan.mountain.clusters; i++) {
      growCluster('mountain', plan.mountain.minSize, plan.mountain.maxSize);
    }

    // Houses: random squares at least minGap apart from every other house,
    // with a small chance of one adjacent partner (a pair, never a village).
    const houses = [];
    let pairs = 0;
    let attempts = 0;
    while (houses.length < plan.house.count && attempts < plan.house.count * 200) {
      attempts++;
      const s = randSquare();
      if (!isFree(s.x, s.y)) continue;
      if (houses.some((h) => chebyshev(h.x, h.y, s.x, s.y) < plan.house.minGap)) continue;
      take(s.x, s.y, 'house');
      houses.push(s);
      if (pairs < plan.house.maxPairs && rng() < plan.house.pairChance) {
        const [dx, dy] = DIRS4[Math.floor(rng() * DIRS4.length)];
        const nx = s.x + dx, ny = s.y + dy;
        const farEnough = houses.every(
          (h) => h === s || chebyshev(h.x, h.y, nx, ny) >= plan.house.minGap
        );
        if (isFree(nx, ny) && farEnough) {
          take(nx, ny, 'house');
          houses.push({ x: nx, y: ny });
          pairs++;
        }
      }
    }
  }

  /* Log entries are stored as {key, params} so state(lang) can render them
   * in any language; {ref: 'side.dalmen'}-style params resolve to localized
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
        if (this.obstacleAt(nx, ny)) continue; // cannot pass through or stop on an obstacle
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
    if (unit.hasMoved) {
      throw httpError(400, 'err.alreadyMoved', { unit: { ref: 'unit.' + unit.type + '.name' } });
    }
    if (!Number.isInteger(x) || !Number.isInteger(y) || !this.inBounds(x, y)) {
      throw httpError(400, 'err.offBoard');
    }
    const ok = this.movesFor(unit).some((m) => m.x === x && m.y === y);
    if (!ok) throw httpError(400, 'err.cannotMove', { unit: { ref: 'unit.' + unit.type + '.name' } });
    const from = { x: unit.x, y: unit.y };
    unit.x = x;
    unit.y = y;
    unit.hasMoved = true;
    this.say('log.move', {
      side: { ref: 'side.' + unit.side },
      sidegen: { ref: 'side.' + unit.side, form: 'gen' },
      unit: { ref: 'unit.' + unit.type + '.name' },
      from: sq(from),
      to: sq({ x, y }),
    });
    this.maybeEndTurn();
    return unit;
  }

  attack(id, targetId) {
    const unit = this.unitById(id);
    if (!unit) throw httpError(404, 'err.noUnit');
    this.assertActiveTurn(unit);
    const target = this.unitById(targetId);
    if (!target) throw httpError(404, 'err.noTarget');
    if (unit.hasAttacked) {
      throw httpError(400, 'err.alreadyAttacked', { unit: { ref: 'unit.' + unit.type + '.name' } });
    }
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
    unit.hasAttacked = true;
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
      if (!this.units.some((u) => u.side === target.side)) {
        this.winner = unit.side;
        this.say('log.win', {
          side: { ref: 'side.' + target.side },
          winner: { ref: 'side.' + unit.side },
        });
      }
    }
    this.maybeEndTurn();
    return { attacker: unit, target, dmg };
  }

  /** A unit is spent when it has used up every action it can still take. */
  unitDone(unit) {
    if (!unit.hasMoved && this.movesFor(unit).length > 0) return false;
    if (!unit.hasAttacked && this.attacksFor(unit).length > 0) return false;
    return true;
  }

  /** Hand the turn to the other side once every unit of the active side is spent. */
  maybeEndTurn() {
    if (this.winner) return;
    const active = this.units.filter((u) => u.side === this.turn);
    if (active.length > 0 && active.every((u) => this.unitDone(u))) this.switchTurn();
  }

  /** Player-forced pass: end the turn even if units could still act. */
  endTurn() {
    if (this.winner) return;
    this.say('log.pass', {
      side: { ref: 'side.' + this.turn },
      sidegen: { ref: 'side.' + this.turn, form: 'gen' },
    });
    this.switchTurn();
  }

  switchTurn() {
    this.turn = SIDES[this.turn].enemy;
    if (this.turn === START_SIDE) this.moveNumber += 1;
    for (const u of this.units) {
      if (u.side === this.turn) {
        u.hasMoved = false;
        u.hasAttacked = false;
      }
    }
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
      const descKey = 'unit.' + type + '.description';
      defs[type] = {
        ...UNIT_DEFS[type],
        name: I18N.t(lang, 'unit.' + type + '.name'),
        description: I18N.has(lang, descKey) ? I18N.t(lang, descKey) : '',
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
      obstacles: this.obstacles.map((o) => ({ ...o })),
      log: this.log.slice(-30).map((e) => ({ n: e.n, side: e.side, msg: I18N.t(lang, e.key, e.params) })),
    };
  }
}

function sq(p) {
  const file = p.x < 26
    ? String.fromCharCode(97 + p.x)
    : 'a' + String.fromCharCode(97 + p.x - 26); // a..z, then aa..af
  return `${file}${SIZE - p.y}`;
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

module.exports = { Game, getRoom, resetRoom, UNIT_DEFS, SIZE, SIDES, OBSTACLE_TYPES, OBSTACLE_CLEARANCE, httpError, I18N };
