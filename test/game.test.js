'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Game, UNIT_DEFS, SIZE } = require('../src/game');

function freshGame() {
  return new Game();
}

test('opening setup: 8x8 board, five pieces per side, mage in the middle, azure starts', () => {
  const g = freshGame();
  assert.equal(SIZE, 8);
  assert.equal(g.units.length, 10);
  for (const side of ['azure', 'crimson']) {
    const units = g.units.filter((u) => u.side === side);
    assert.equal(units.length, 5);
    assert.equal(units.filter((u) => u.type === 'spearman').length, 2);
    assert.equal(units.filter((u) => u.type === 'archer').length, 2);
    assert.equal(units.filter((u) => u.type === 'mage').length, 1);
  }
  const azureMage = g.units.find((u) => u.side === 'azure' && u.type === 'mage');
  assert.deepEqual({ x: azureMage.x, y: azureMage.y }, { x: 3, y: 7 });
  assert.equal(g.turn, 'azure');
  assert.equal(g.winner, null);
});

test('movement is BFS-limited and blocked by occupied squares', () => {
  const g = freshGame();
  const spearman = g.units.find((u) => u.id === 'azure-spearman-1'); // at (1,7)
  const moves = g.movesFor(spearman);
  const has = (x, y) => moves.some((m) => m.x === x && m.y === y);
  assert.ok(has(1, 4), 'can advance three squares up the open file');
  assert.ok(has(0, 7), 'can move sideways');
  assert.ok(!has(1, 3), 'cannot move four squares');
  assert.ok(!has(2, 7), 'cannot move onto own archer');
  assert.ok(!has(3, 7), 'cannot jump over units');
});

test('a legal move ends the turn; illegal moves are rejected', () => {
  const g = freshGame();
  const crimson = g.units.find((u) => u.side === 'crimson');
  assert.throws(() => g.move(crimson.id, 2, 1), /azure/i, 'cannot move on the other side\'s turn');

  const spearman = g.units.find((u) => u.id === 'azure-spearman-1');
  assert.throws(() => g.move(spearman.id, 1, 3), /cannot move there/i);
  assert.throws(() => g.move(spearman.id, 2, 7), /cannot move there/i, 'occupied square');
  assert.throws(() => g.move('nope', 0, 0), /no such unit/i);

  g.move(spearman.id, 1, 5);
  assert.equal(g.turn, 'crimson');
  assert.deepEqual({ x: spearman.x, y: spearman.y }, { x: 1, y: 5 });
});

test('attack damage = max(1, attack - defence) and ends the turn', () => {
  const g = freshGame();
  const mage = g.units.find((u) => u.side === 'azure' && u.type === 'mage');
  const target = g.units.find((u) => u.side === 'crimson' && u.type === 'spearman');
  mage.x = 4; mage.y = 2; // next to crimson spearman at (6,0)? place adjacent instead:
  target.x = 4; target.y = 3;
  const before = target.hp;
  g.attack(mage.id, target.id);
  const expected = Math.max(1, UNIT_DEFS.mage.attack - UNIT_DEFS.spearman.defence);
  assert.equal(before - target.hp, expected);
  assert.equal(g.turn, 'crimson');
});

test('minimum damage is 1 even against huge defence', () => {
  const g = freshGame();
  const orig = UNIT_DEFS.spearman.defence;
  UNIT_DEFS.spearman.defence = 99;
  try {
    const mage = g.units.find((u) => u.side === 'azure' && u.type === 'mage');
    const target = g.units.find((u) => u.side === 'crimson' && u.type === 'spearman');
    mage.x = target.x; mage.y = target.y + 1;
    const before = target.hp;
    g.attack(mage.id, target.id);
    assert.equal(before - target.hp, 1);
  } finally {
    UNIT_DEFS.spearman.defence = orig;
  }
});

test('range window: archer cannot hit adjacent, can hit at 2..4; spearman reaches 2', () => {
  const g = freshGame();
  const archer = g.units.find((u) => u.side === 'azure' && u.type === 'archer');
  const foe = g.units.find((u) => u.side === 'crimson');

  foe.x = archer.x; foe.y = archer.y + 1; // adjacent
  assert.equal(g.attacksFor(archer).length, 0, 'min range 2 blocks adjacent target');

  foe.x = archer.x + 2; foe.y = archer.y; // distance 2
  assert.deepEqual(g.attacksFor(archer).map((u) => u.id), [foe.id]);

  foe.x = archer.x + 4; foe.y = archer.y + 4; // Chebyshev 4
  assert.equal(g.attacksFor(archer).length, 1);

  foe.x = archer.x + 5; foe.y = archer.y; // out of range
  assert.equal(g.attacksFor(archer).length, 0);

  const spearman = g.units.find((u) => u.side === 'azure' && u.type === 'spearman');
  foe.x = spearman.x + 2; foe.y = spearman.y; // spear reach 2
  assert.equal(g.attacksFor(spearman).length, 1);
  foe.x = spearman.x + 3; foe.y = spearman.y;
  assert.equal(g.attacksFor(spearman).length, 0);
});

test('attacking out of range or at own units is rejected', () => {
  const g = freshGame();
  const mage = g.units.find((u) => u.side === 'azure' && u.type === 'mage');
  const farFoe = g.units.find((u) => u.side === 'crimson');
  assert.throws(() => g.attack(mage.id, farFoe.id), /cannot reach/i);
  const friend = g.units.find((u) => u.side === 'azure' && u.type === 'archer');
  mage.x = friend.x; mage.y = friend.y + 1;
  assert.throws(() => g.attack(mage.id, friend.id), /cannot reach/i);
});

test('killing the enemy mage wins the battle and locks further actions', () => {
  const g = freshGame();
  const mage = g.units.find((u) => u.side === 'azure' && u.type === 'mage');
  const enemyMage = g.units.find((u) => u.side === 'crimson' && u.type === 'mage');
  mage.x = enemyMage.x; mage.y = enemyMage.y + 1;
  enemyMage.hp = 5;
  g.attack(mage.id, enemyMage.id);
  assert.equal(g.winner, 'azure');
  assert.equal(g.units.some((u) => u.id === enemyMage.id), false);
  assert.throws(() => g.move(mage.id, mage.x, mage.y - 1), /already over/i);
  const s = g.state();
  assert.equal(s.gameOver, true);
  assert.equal(s.winner, 'azure');
});

test('state is serializable and carries defs, log and turn info', () => {
  const g = freshGame();
  const s = g.state();
  JSON.parse(JSON.stringify(s));
  assert.equal(s.size, 8);
  assert.equal(s.units.length, 10);
  assert.ok(s.units[0].def && typeof s.units[0].def.attack === 'number');
  assert.ok(Array.isArray(s.log) && s.log.length > 0);
});
