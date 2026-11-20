'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Game } = require('../src/game');
const I18N = require('../public/i18n');

test('every en string has a fi translation and vice versa', () => {
  assert.deepEqual(Object.keys(I18N.STRINGS.fi).sort(), Object.keys(I18N.STRINGS.en).sort());
});

test('unknown or missing lang falls back to English', () => {
  assert.equal(I18N.normalize('de'), 'en');
  assert.equal(I18N.normalize(undefined), 'en');
  const g = new Game();
  assert.match(g.state('de').log[0].msg, /Battle begins/);
  assert.match(g.state().log[0].msg, /Battle begins/);
});

test('state(lang) localizes side names, unit defs and log entries', () => {
  const g = new Game();
  const fi = g.state('fi');
  assert.equal(fi.sides.dalmen.name, 'Dalmen');
  assert.equal(fi.sides.zhaglon.name, 'Zhaglon');
  assert.equal(fi.defs.knights_of_zhaglon.name, 'Zhaglonin ritarit');
  assert.match(fi.log[0].msg, /Taistelu alkaa\. Dalmen/);
  assert.equal(fi.units[0].def.name, 'Falrothin sotilaat');

  const en = g.state('en');
  assert.equal(en.sides.dalmen.name, 'Dalmen');
  assert.equal(en.sides.zhaglon.name, 'Zhaglon');
  assert.equal(en.defs.catapult.name, 'Catapult');
  assert.match(en.log[0].msg, /Battle begins\. Dalmen/);
});

test('move and attack log entries render in Finnish with localized names', () => {
  const g = new Game();
  const soldier = g.units.find((u) => u.side === 'dalmen' && u.type === 'soldiers_of_falroth' && u.x === 12);
  g.move(soldier.id, 12, 29);
  let fi = g.state('fi');
  assert.match(fi.log.at(-1).msg, /Dalmenin Falrothin sotilaat siirtyi m1 -> m3\./);
  const en = g.state('en');
  assert.match(en.log.at(-1).msg, /Dalmen Soldiers of Falroth moved m1 -> m3\./);

  g.endTurn(); // dalmen has acted; hand the turn to zhaglon
  const knight = g.units.find((u) => u.side === 'zhaglon' && u.type === 'knights_of_zhaglon');
  const target = g.units.find((u) => u.side === 'dalmen' && u.type === 'arbalesters');
  knight.x = target.x; knight.y = target.y + 1;
  g.attack(knight.id, target.id);
  fi = g.state('fi');
  assert.match(fi.log.at(-1).msg, /Zhaglonin Zhaglonin ritarit osui kohteeseen Varsijousimiehet \(Dalmen\)/);
});

test('errors carry i18n keys so the server can localize them per request', () => {
  const g = new Game();
  const zhaglon = g.units.find((u) => u.side === 'zhaglon');
  assert.throws(() => g.move(zhaglon.id, 2, 1), /dalmen/i); // English default kept for direct use
  try {
    g.move(zhaglon.id, 2, 1);
    assert.fail('should have thrown');
  } catch (err) {
    assert.equal(err.key, 'err.turn');
    assert.match(I18N.t('fi', err.key, err.params), /Nyt on Dalmenin vuoro, ei Zhaglonin\./);
  }
});
