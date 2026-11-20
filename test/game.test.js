'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Game, UNIT_DEFS, SIZE, OBSTACLE_TYPES, OBSTACLE_CLEARANCE } = require('../src/game');

function freshGame() {
  return new Game();
}

/* Deterministic RNG so obstacle-layout tests are reproducible. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededGame(seed) {
  return new Game(mulberry32(seed));
}

function unitsOf(g, side, type) {
  return g.units.filter((u) => u.side === side && (!type || u.type === type));
}

function dalmenSoldierAt(g, x) {
  return g.units.find((u) => u.side === 'dalmen' && u.type === 'soldiers_of_falroth' && u.x === x);
}

test('opening setup: 32x32 board, Dalmen army of 8 and Zhaglon army of 10 on the back rows, dalmen starts', () => {
  const g = freshGame();
  assert.equal(SIZE, 32);
  assert.equal(g.units.length, 18);
  const dalmen = unitsOf(g, 'dalmen');
  const zhaglon = unitsOf(g, 'zhaglon');
  assert.equal(dalmen.length, 8);
  assert.equal(zhaglon.length, 10);
  assert.equal(unitsOf(g, 'dalmen', 'soldiers_of_falroth').length, 3);
  assert.equal(unitsOf(g, 'dalmen', 'knights_of_gremloth').length, 2);
  assert.equal(unitsOf(g, 'dalmen', 'arbalesters').length, 2);
  assert.equal(unitsOf(g, 'dalmen', 'catapult').length, 1);
  assert.equal(unitsOf(g, 'zhaglon', 'riders_of_nezek').length, 3);
  assert.equal(unitsOf(g, 'zhaglon', 'knights_of_zhaglon').length, 2);
  assert.equal(unitsOf(g, 'zhaglon', 'archers_of_grishtalon').length, 3);
  assert.equal(unitsOf(g, 'zhaglon', 'war_chariot').length, 2);
  assert.ok(dalmen.every((u) => u.y === SIZE - 1), 'dalmen on its back row');
  assert.ok(zhaglon.every((u) => u.y === 0), 'zhaglon on its back row');
  const catapult = unitsOf(g, 'dalmen', 'catapult')[0];
  assert.deepEqual({ x: catapult.x, y: catapult.y }, { x: 19, y: 31 });
  assert.equal(g.turn, 'dalmen');
  assert.equal(g.winner, null);
});

test('movement is BFS-limited and blocked by occupied squares', () => {
  const g = freshGame();
  const soldier = dalmenSoldierAt(g, 12); // at (12,31)
  const moves = g.movesFor(soldier);
  const has = (x, y) => moves.some((m) => m.x === x && m.y === y);
  assert.ok(has(12, 28), 'can advance three squares up the open file');
  assert.ok(has(11, 31), 'can move sideways');
  assert.ok(!has(12, 27), 'cannot move four squares');
  assert.ok(!has(13, 31), 'cannot move onto own soldier');
  assert.ok(!has(14, 31), 'cannot jump over units');
});

test('a legal move is allowed once per unit per turn; illegal moves are rejected', () => {
  const g = freshGame();
  const zhaglonUnit = unitsOf(g, 'zhaglon')[0];
  assert.throws(() => g.move(zhaglonUnit.id, 2, 1), /dalmen/i, 'cannot move on the other side\'s turn');

  const soldier = dalmenSoldierAt(g, 12);
  assert.throws(() => g.move(soldier.id, 12, 27), /cannot move there/i);
  assert.throws(() => g.move(soldier.id, 13, 31), /cannot move there/i, 'occupied square');
  assert.throws(() => g.move('nope', 0, 0), /no such unit/i);

  g.move(soldier.id, 12, 29);
  assert.equal(g.turn, 'dalmen', 'turn continues while other units can still act');
  assert.equal(soldier.hasMoved, true);
  assert.throws(() => g.move(soldier.id, 12, 28), /already moved/i);
  assert.deepEqual({ x: soldier.x, y: soldier.y }, { x: 12, y: 29 });

  g.endTurn();
  assert.equal(g.turn, 'zhaglon');
});

test('attack damage = max(1, attack - defence), once per unit per turn', () => {
  const g = freshGame();
  const knight = unitsOf(g, 'dalmen', 'knights_of_gremloth')[0];
  const target = unitsOf(g, 'zhaglon', 'riders_of_nezek')[0];
  knight.x = 4; knight.y = 2; // place adjacent instead:
  target.x = 4; target.y = 3;
  const before = target.hp;
  g.attack(knight.id, target.id);
  const expected = Math.max(1, UNIT_DEFS.knights_of_gremloth.attack - UNIT_DEFS.riders_of_nezek.defence);
  assert.equal(before - target.hp, expected);
  assert.equal(knight.hasAttacked, true);
  assert.equal(g.turn, 'dalmen', 'turn continues while other units can still act');
  assert.equal(g.winner, null, 'no winner while enemy units remain');
  assert.throws(() => g.attack(knight.id, target.id), /already attacked/i);
});

test('a unit can move and then attack in the same turn if a target is in reach', () => {
  const g = freshGame();
  const soldier = dalmenSoldierAt(g, 12); // at (12,31)
  const foe = unitsOf(g, 'zhaglon')[0];
  foe.x = 12; foe.y = 28; // within reach after moving to (12,29)
  g.move(soldier.id, 12, 29);
  assert.equal(g.turn, 'dalmen', 'the move does not end the turn');
  assert.ok(g.attacksFor(soldier).some((u) => u.id === foe.id), 'target in reach from the new square');
  const before = foe.hp;
  g.attack(soldier.id, foe.id);
  assert.ok(foe.hp < before, 'attack after the move deals damage');
  assert.equal(g.turn, 'dalmen', 'other units may still act');
  assert.equal(g.winner, null, 'battle continues while enemies remain');
});

test('the turn passes automatically once every unit of the active side is spent', () => {
  const g = freshGame();
  const orig = {};
  for (const type of ['soldiers_of_falroth', 'knights_of_gremloth', 'arbalesters', 'catapult']) {
    orig[type] = UNIT_DEFS[type].movement;
    UNIT_DEFS[type].movement = 0;
  }
  try {
    // nobody can move and no enemy is in range, so dalmen is spent immediately
    g.maybeEndTurn();
    assert.equal(g.turn, 'zhaglon');
  } finally {
    for (const type of Object.keys(orig)) UNIT_DEFS[type].movement = orig[type];
  }
});

test('action flags reset when the turn comes back around', () => {
  const g = freshGame();
  const soldier = dalmenSoldierAt(g, 12);
  g.move(soldier.id, 12, 29);
  assert.equal(soldier.hasMoved, true);

  g.endTurn(); // hand the turn to zhaglon
  assert.equal(g.turn, 'zhaglon');
  assert.match(g.state('en').log.at(-1).msg, /ends the turn/);

  g.endTurn(); // back to dalmen
  assert.equal(g.turn, 'dalmen');
  assert.equal(g.moveNumber, 2);
  assert.equal(soldier.hasMoved, false);
  assert.equal(soldier.hasAttacked, false);
  g.move(soldier.id, 12, 28); // the same unit can move again on its next turn
  assert.equal(soldier.hasMoved, true);
});

test('minimum damage is 1 even against huge defence', () => {
  const g = freshGame();
  const orig = UNIT_DEFS.riders_of_nezek.defence;
  UNIT_DEFS.riders_of_nezek.defence = 99;
  try {
    const knight = unitsOf(g, 'dalmen', 'knights_of_gremloth')[0];
    const target = unitsOf(g, 'zhaglon', 'riders_of_nezek')[0];
    knight.x = target.x; knight.y = target.y + 1;
    const before = target.hp;
    g.attack(knight.id, target.id);
    assert.equal(before - target.hp, 1);
  } finally {
    UNIT_DEFS.riders_of_nezek.defence = orig;
  }
});

test('range window: arbalesters cannot hit adjacent, can hit at 2..4; knights reach 1', () => {
  const g = freshGame();
  const arbalester = unitsOf(g, 'dalmen', 'arbalesters')[0]; // at (17,31)
  const foe = unitsOf(g, 'zhaglon')[0];

  foe.x = arbalester.x; foe.y = arbalester.y + 1; // adjacent
  assert.equal(g.attacksFor(arbalester).length, 0, 'min range 2 blocks adjacent target');

  foe.x = arbalester.x + 2; foe.y = arbalester.y; // distance 2
  assert.deepEqual(g.attacksFor(arbalester).map((u) => u.id), [foe.id]);

  foe.x = arbalester.x + 4; foe.y = arbalester.y + 4; // Chebyshev 4
  assert.equal(g.attacksFor(arbalester).length, 1);

  foe.x = arbalester.x + 5; foe.y = arbalester.y; // out of range
  assert.equal(g.attacksFor(arbalester).length, 0);

  const knight = unitsOf(g, 'dalmen', 'knights_of_gremloth')[0]; // at (15,31)
  foe.x = knight.x + 1; foe.y = knight.y; // reach 1
  assert.equal(g.attacksFor(knight).length, 1);
  foe.x = knight.x + 2; foe.y = knight.y;
  assert.equal(g.attacksFor(knight).length, 0);
});

test('attacking out of range or at own units is rejected', () => {
  const g = freshGame();
  const knight = unitsOf(g, 'dalmen', 'knights_of_gremloth')[0];
  const farFoe = unitsOf(g, 'zhaglon')[0];
  assert.throws(() => g.attack(knight.id, farFoe.id), /cannot reach/i);
  const friend = unitsOf(g, 'dalmen', 'arbalesters')[0];
  knight.x = friend.x; knight.y = friend.y + 1;
  assert.throws(() => g.attack(knight.id, friend.id), /cannot reach/i);
});

test('destroying the last enemy unit wins the battle and locks further actions', () => {
  const g = freshGame();
  const knight = unitsOf(g, 'dalmen', 'knights_of_gremloth')[0];
  const last = unitsOf(g, 'zhaglon')[0];
  g.units = g.units.filter((u) => u.side === 'dalmen' || u === last);
  knight.x = last.x; knight.y = last.y + 1;
  last.hp = 5;
  g.attack(knight.id, last.id);
  assert.equal(g.winner, 'dalmen');
  assert.equal(g.units.some((u) => u.id === last.id), false);
  assert.throws(() => g.move(knight.id, knight.x, knight.y - 1), /already over/i);
  const s = g.state();
  assert.equal(s.gameOver, true);
  assert.equal(s.winner, 'dalmen');
});

test('state is serializable and carries defs, log and turn info', () => {
  const g = freshGame();
  const s = g.state();
  JSON.parse(JSON.stringify(s));
  assert.equal(s.size, 32);
  assert.equal(s.units.length, 18);
  assert.ok(s.units[0].def && typeof s.units[0].def.attack === 'number');
  assert.ok(Array.isArray(s.log) && s.log.length > 0);
});

test('obstacles are generated on reset: valid types, in bounds, unique, clear of the opening', () => {
  for (const seed of [1, 42, 1234, 99999]) {
    const g = seededGame(seed);
    assert.ok(g.obstacles.length >= 30, `seed ${seed}: enough obstacles`);
    const keys = new Set();
    for (const o of g.obstacles) {
      assert.ok(OBSTACLE_TYPES.includes(o.type), `unknown obstacle type ${o.type}`);
      assert.ok(g.inBounds(o.x, o.y), 'obstacle in bounds');
      const k = `${o.x},${o.y}`;
      assert.ok(!keys.has(k), 'no two obstacles on one square');
      keys.add(k);
      assert.equal(g.obstacleAt(o.x, o.y), o.type);
      for (const u of g.units) {
        const d = Math.max(Math.abs(u.x - o.x), Math.abs(u.y - o.y));
        assert.ok(d > OBSTACLE_CLEARANCE, 'obstacle keeps clear of opening units');
      }
    }
    for (const t of OBSTACLE_TYPES) {
      assert.ok(g.obstacles.some((o) => o.type === t), `has ${t}`);
    }
  }
});

test('the same seed reproduces the same obstacle layout', () => {
  const a = seededGame(7);
  const b = seededGame(7);
  assert.deepEqual(a.obstacles, b.obstacles);
  const c = seededGame(8);
  assert.notDeepEqual(a.obstacles, c.obstacles);
});

test('forests and mountains grow in clusters; houses stay sparse', () => {
  for (const seed of [1, 42, 1234, 2024, 99999]) {
    const g = seededGame(seed);
    const of = (t) => g.obstacles.filter((o) => o.type === t);
    const touches = (o, t) =>
      [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => g.obstacleAt(o.x + dx, o.y + dy) === t);

    const forests = of('forest');
    const mountains = of('mountain');
    const houses = of('house');

    // clusters: nearly every forest/mountain tile has a same-type neighbour
    assert.ok(forests.length >= 20, `seed ${seed}: several forests`);
    assert.ok(forests.filter((o) => touches(o, 'forest')).length / forests.length > 0.8,
      `seed ${seed}: forests cluster`);
    assert.ok(mountains.length >= 12, `seed ${seed}: several mountains`);
    assert.ok(mountains.filter((o) => touches(o, 'mountain')).length / mountains.length > 0.8,
      `seed ${seed}: mountains cluster`);
    const maxMountainBuddies = Math.max(
      ...mountains.map((o) =>
        [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]
          .filter(([dx, dy]) => g.obstacleAt(o.x + dx, o.y + dy) === 'mountain').length)
    );
    assert.ok(maxMountainBuddies >= 3, `seed ${seed}: mountains pile up in one place`);

    // houses: mostly isolated — at most half of them have a house next door
    assert.ok(houses.length >= 8, `seed ${seed}: enough houses`);
    const near = houses.filter((o) => touches(o, 'house')).length;
    assert.ok(near * 2 <= houses.length, `seed ${seed}: seldom many houses near each other (${near}/${houses.length})`);
  }
});

test('obstacles block movement: no move lands on one, and units cannot pass through', () => {
  const g = seededGame(99);
  for (const u of g.units) {
    for (const m of g.movesFor(u)) {
      assert.equal(g.obstacleAt(m.x, m.y), null, 'move hints never land on an obstacle');
    }
  }

  // wall test: a vertical mountain wall must stop the soldier from crossing
  g.obstacles = [];
  g.obstacleMap = new Map();
  for (let y = 25; y <= 31; y++) g.addObstacle(15, y, 'mountain');
  const soldier = dalmenSoldierAt(g, 14); // at (14,31)
  const moves = g.movesFor(soldier);
  assert.ok(!moves.some((m) => m.x >= 16), 'cannot cross the wall');
  assert.ok(moves.some((m) => m.x === 14 && m.y === 28), 'can still move on its own side');
  assert.throws(() => g.move(soldier.id, 15, 31), /cannot move there/i, 'cannot move onto an obstacle');
});

test('state carries the obstacle layout', () => {
  const g = seededGame(5);
  const s = g.state();
  JSON.parse(JSON.stringify(s));
  assert.deepEqual(s.obstacles, g.obstacles);
  assert.ok(s.obstacles.every((o) => OBSTACLE_TYPES.includes(o.type)));
});
