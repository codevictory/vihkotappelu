'use strict';

/* Vihkotappelu i18n — one string dictionary shared by server and browser.
 * Loaded as a plain <script> in the client (window.I18N) and via require()
 * in Node (module.exports), so there is no build step.
 *
 * Templates use {name} placeholders. A param value of { ref: 'some.key' }
 * is resolved as another dictionary entry in the same language (used for
 * side and unit names inside log/error templates). */

(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.I18N = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const LANGS = ['en', 'fi'];
  const DEFAULT_LANG = 'en';

  const STRINGS = {
    en: {
      'ui.title': 'Vihkotappelu — fantasy strategy battle',
      'ui.loading': 'Loading...',
      'ui.newGame': 'New Game',
      'ui.overlaySub': 'The enemy mage has fallen.',
      'ui.overlayWin': '{side} wins!',
      'ui.bannerTurn': "{side}'s turn — move {move}. Select a unit, then a highlighted square.",
      'ui.bannerWin': '{side} wins the battle!',
      'ui.selectedUnit': 'Selected unit',
      'ui.emptyCard': 'Click one of your units on the board.',
      'ui.battleLog': 'Battle log',
      'ui.rules': 'Rules',
      'ui.rules1': '8x8 grid, turn based: <strong>one piece acts per turn</strong> (a move or an attack), then the other side goes.',
      'ui.rules2': 'Click a unit of the active side, then a green square to move or a red square to attack.',
      'ui.rules3': "Damage = attacker's ATK minus target's DEF (minimum 1).",
      'ui.rules4': 'Archers cannot shoot adjacent squares (min range 2).',
      'ui.rules5': 'Units block movement. Killing the enemy <strong>mage</strong> wins the battle.',
      'ui.hint': 'Hotseat mode: you command both sides, alternating turns. Game state lives on the server per room, so online duels against a human can be added on top of the same API.',
      'ui.statHealth': 'Health',
      'ui.statAttack': 'Attack',
      'ui.statDefence': 'Defence',
      'ui.statMovement': 'Movement',
      'ui.statRange': 'Range',
      'ui.langPickerLabel': 'Language',

      'side.azure': 'Azure Order',
      'side.crimson': 'Crimson Pact',
      // genitive forms, used by templates that need "X's" (fi appends a suffix)
      'side.azure.gen': 'Azure Order',
      'side.crimson.gen': 'Crimson Pact',

      'unit.spearman.name': 'Spearman',
      'unit.spearman.description': 'Sturdy front-line fighter with a long spear. Hits hard up close and at reach 2.',
      'unit.archer.name': 'Archer',
      'unit.archer.description': 'Fragile but shoots far. Cannot hit targets on adjacent squares.',
      'unit.mage.name': 'Mage',
      'unit.mage.description': "Powerful spellcaster. If a side's mage falls, that side loses the battle.",

      'log.begin': 'Battle begins. {side} to move.',
      'log.move': '{side} {unit} moved {from} -> {to}.',
      'log.hit': '{side} {unit} hit {targetSide} {targetUnit} for {dmg} (ATK {atk} - DEF {def}).',
      'log.slain': '{side} {unit} was slain!',
      'log.win': "{side}'s mage has fallen. {winner} wins the battle!",

      'err.over': 'The battle is already over.',
      'err.turn': "It is {side}'s turn, not {other}'s.",
      'err.noUnit': 'No such unit.',
      'err.offBoard': 'Target square is off the board.',
      'err.cannotMove': '{unit} cannot move there.',
      'err.noTarget': 'No such target.',
      'err.cannotReach': '{unit} cannot reach {target} there.',
      'err.hintTurn': "Not that side's turn.",
      'err.bodyTooLarge': 'Body too large',
      'err.invalidJson': 'Invalid JSON body',
      'err.unknownEndpoint': 'Unknown endpoint',
      'err.methodNotAllowed': 'Method not allowed',
    },
    fi: {
      'ui.title': 'Vihkotappelu — fantasiastrategiataistelu',
      'ui.loading': 'Ladataan...',
      'ui.newGame': 'Uusi peli',
      'ui.overlaySub': 'Vastustajan magi on kaatunut.',
      'ui.overlayWin': '{side} voittaa!',
      'ui.bannerTurn': '{sidegen} vuoro — siirto {move}. Valitse yksikkö ja sitten korostettu ruutu.',
      'ui.bannerWin': '{side} voittaa taistelun!',
      'ui.selectedUnit': 'Valittu yksikkö',
      'ui.emptyCard': 'Klikkaa yhtä yksikköäsi laudalla.',
      'ui.battleLog': 'Taisteluloki',
      'ui.rules': 'Säännöt',
      'ui.rules1': '8x8-ruudukko, vuoropohjainen: <strong>yksi yksikkö toimii vuorossa</strong> (siirto tai hyökkäys), sitten toinen puoli.',
      'ui.rules2': 'Klikkaa aktiivisen puolen yksikköä ja sitten vihreää ruutua siirtyäksesi tai punaista ruutua hyökätäksesi.',
      'ui.rules3': 'Vahinko = hyökkääjän hyökkäys − kohteen puolustus (vähintään 1).',
      'ui.rules4': 'Jousimiehet eivät voi ampua viereiseen ruutuun (min. kantama 2).',
      'ui.rules5': 'Yksiköt estävät liikkumisen. Vastustajan <strong>magi</strong>n tappaminen voittaa taistelun.',
      'ui.hint': 'Hotseat-tila: komennat molempia puolia vuorotellen. Pelin tila on palvelimella huonekohtaisesti, joten kaksinpelit ihmistä vastaan voidaan lisätä saman rajapinnan päälle.',
      'ui.statHealth': 'Terveys',
      'ui.statAttack': 'Hyökkäys',
      'ui.statDefence': 'Puolustus',
      'ui.statMovement': 'Liikkuvuus',
      'ui.statRange': 'Kantama',
      'ui.langPickerLabel': 'Kieli',

      'side.azure': 'Asuuriritarikunta',
      'side.crimson': 'Karmiiniliitto',
      'side.azure.gen': 'Asuuriritarikunnan',
      'side.crimson.gen': 'Karmiiniliiton',

      'unit.spearman.name': 'Keihäsmies',
      'unit.spearman.description': 'Tukeva etulinjan taistelija pitkällä keihäällä. Iskee kovaa lähietäisyydeltä ja kahden ruudun päästä.',
      'unit.archer.name': 'Jousimies',
      'unit.archer.description': 'Hauras mutta ampuu kauas. Ei voi osua viereisen ruudun kohteisiin.',
      'unit.mage.name': 'Magi',
      'unit.mage.description': 'Voimakas loitsija. Jos puolen magi kaatuu, kyseinen puoli häviää taistelun.',

      'log.begin': 'Taistelu alkaa. {side} saa siirron.',
      'log.move': '{sidegen} {unit} siirtyi {from} -> {to}.',
      'log.hit': '{sidegen} {unit} osui kohteeseen {targetUnit} ({targetSide}) ja teki {dmg} vahinkoa (HYÖ {atk} - PUO {def}).',
      'log.slain': '{sidegen} {unit} kaatui!',
      'log.win': '{sidegen} magi on kaatunut. {winner} voittaa taistelun!',

      'err.over': 'Taistelu on jo päättynyt.',
      'err.turn': 'Nyt on {sidegen} vuoro, ei {othergen}.',
      'err.noUnit': 'Yksikköä ei löydy.',
      'err.offBoard': 'Kohderuutu on laudan ulkopuolella.',
      'err.cannotMove': '{unit} ei voi siirtyä sinne.',
      'err.noTarget': 'Kohdetta ei löydy.',
      'err.cannotReach': '{unit}: kohde {target} on liian kaukana.',
      'err.hintTurn': 'Ei ole kyseisen puolen vuoro.',
      'err.bodyTooLarge': 'Pyyntö on liian suuri',
      'err.invalidJson': 'Virheellinen JSON-runko',
      'err.unknownEndpoint': 'Tuntematon päätepiste',
      'err.methodNotAllowed': 'Metodi ei ole sallittu',
    },
  };

  function normalize(lang) {
    return LANGS.includes(lang) ? lang : DEFAULT_LANG;
  }

  function t(lang, key, params) {
    lang = normalize(lang);
    const table = STRINGS[lang] || STRINGS[DEFAULT_LANG];
    let template = table[key];
    if (template === undefined) template = STRINGS[DEFAULT_LANG][key];
    if (template === undefined) return key;
    return template.replace(/\{(\w+)\}/g, (match, name) => {
      const value = params ? params[name] : undefined;
      if (value === undefined || value === null) return match;
      if (typeof value === 'object' && value.ref) {
        const ref = value.form ? value.ref + '.' + value.form : value.ref;
        return t(lang, ref, value.params);
      }
      return String(value);
    });
  }

  return { LANGS, DEFAULT_LANG, STRINGS, normalize, t };
});
