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
  assert.equal(fi.sides.azure.name, 'Asuuriritarikunta');
  assert.equal(fi.sides.crimson.name, 'Karmiiniliitto');
  assert.equal(fi.defs.mage.name, 'Magi');
  assert.ok(fi.defs.archer.description.length > 0);
  assert.match(fi.log[0].msg, /Taistelu alkaa\. Asuuriritarikunta/);
  assert.equal(fi.units[0].def.name, 'Keihäsmies');

  const en = g.state('en');
  assert.equal(en.sides.azure.name, 'Azure Order');
  assert.match(en.log[0].msg, /Battle begins\. Azure Order/);
});

test('move and attack log entries render in Finnish with localized names', () => {
  const g = new Game();
  const spearman = g.units.find((u) => u.id === 'azure-spearman-1');
  g.move(spearman.id, 1, 5);
  let fi = g.state('fi');
  assert.match(fi.log.at(-1).msg, /Asuuriritarikunnan Keihäsmies siirtyi b1 -> b3\./);
  const en = g.state('en');
  assert.match(en.log.at(-1).msg, /Azure Order Spearman moved b1 -> b3\./);

  const mage = g.units.find((u) => u.side === 'crimson' && u.type === 'mage');
  const target = g.units.find((u) => u.side === 'azure' && u.type === 'archer');
  mage.x = target.x; mage.y = target.y + 1;
  g.attack(mage.id, target.id);
  fi = g.state('fi');
  assert.match(fi.log.at(-1).msg, /Karmiiniliiton Magi osui kohteeseen Jousimies \(Asuuriritarikunta\)/);
});

test('errors carry i18n keys so the server can localize them per request', () => {
  const g = new Game();
  const crimson = g.units.find((u) => u.side === 'crimson');
  assert.throws(() => g.move(crimson.id, 2, 1), /azure/i); // English default kept for direct use
  try {
    g.move(crimson.id, 2, 1);
    assert.fail('should have thrown');
  } catch (err) {
    assert.equal(err.key, 'err.turn');
    assert.match(I18N.t('fi', err.key, err.params), /Nyt on Asuuriritarikunnan vuoro, ei Karmiiniliiton\./);
  }
});
