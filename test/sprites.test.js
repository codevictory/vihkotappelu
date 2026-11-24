'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { setGameData, SPRITE_DEFS } = require('../src/game');
const gameDataFixture = require('./gameData.fixture.json');

/* Seed the klapi-hosted game data from the test fixture (no network). The
 * fixture mirrors the klapi GET /vihkotappelu/data payload, sprites included. */
setGameData(gameDataFixture);

test('fixture sprites load into SPRITE_DEFS as 16x16 per-pixel color grids', () => {
  assert.equal(Object.keys(SPRITE_DEFS).length, gameDataFixture.sprites.length);
  for (const s of gameDataFixture.sprites) {
    const def = SPRITE_DEFS[s.spriteKey];
    assert.equal(def.width, 16);
    assert.equal(def.height, 16);
    assert.equal(def.pixels.length, 16);
    assert.ok(def.pixels.every((row) => row.length === 16));
    for (const row of def.pixels) {
      for (const cell of row) {
        assert.ok(cell === null || cell === 'side' || /^#(?:[0-9a-f]{6}|[0-9a-f]{8})$/.test(cell), `bad cell ${cell}`);
      }
    }
  }
  // spot checks against the canonical klapi seed (reset-vihkotappelu.sql)
  assert.equal(SPRITE_DEFS.soldiers_of_falroth.pixels[1][4], '#92400e'); // wood frame
  assert.equal(SPRITE_DEFS.knights_of_gremloth.pixels[5][6], '#e5e7eb'); // steel
  assert.equal(SPRITE_DEFS.arbalesters.pixels[0][0], null); // transparent
  assert.equal(SPRITE_DEFS.forest.pixels[12][6], '#92400e'); // terrain trunk
  assert.equal(SPRITE_DEFS.range.pixels[0][0], '#facc15a6'); // rgba(250,204,21,0.65) overlay
});

test('every unit in the fixture references an existing sprite', () => {
  for (const u of gameDataFixture.units) {
    assert.ok(SPRITE_DEFS[u.sprite], `unit ${u.unitKey} references missing sprite ${u.sprite}`);
  }
});
