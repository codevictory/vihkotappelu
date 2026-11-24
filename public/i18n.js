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
      'ui.endTurn': 'End turn',
      'ui.overlaySub': 'The enemy army has been destroyed.',
      'ui.overlayWin': '{side} wins!',
      'ui.bannerTurn': "{side}'s turn — move {move}. Each unit can move and attack once; End turn to pass.",
      'ui.bannerWin': '{side} wins the battle!',
      'ui.selectedUnit': 'Selected unit',
      'ui.emptyCard': 'Click one of your units on the board.',
      'ui.hasMoved': 'moved',
      'ui.hasAttacked': 'attacked',
      'ui.battleLog': 'Battle log',
      'ui.rules': 'Rules',
      'ui.rules1': '32x32 grid, turn based: on your turn <strong>every unit may move once and attack once</strong> (if a target is in range), then the other side goes.',
      'ui.rules2': 'Click a unit of the active side, then a green square to move and a red square to attack. Spent units are dimmed — press End turn to pass the rest.',
      'ui.rules3': "Damage = attacker's ATK minus target's DEF (minimum 1).",
      'ui.rules4': 'Archers cannot shoot adjacent squares (min range 2).',
      'ui.rules5': 'Units block movement. Destroying every enemy unit wins the battle.',
      'ui.rules6': 'Forests, mountains and houses are obstacles: units cannot move onto or through them.',
      'ui.hint': 'Hotseat mode: you command both sides, alternating turns. Game state lives on the server per room, so online duels against a human can be added on top of the same API.',
      'ui.statHealth': 'Health',
      'ui.statAttack': 'Attack',
      'ui.statDefence': 'Defence',
      'ui.statMovement': 'Movement',
      'ui.statRange': 'Range',
      'ui.langPickerLabel': 'Language',

      'side.dalmen': 'Dalmen',
      'side.zhaglon': 'Zhaglon',
      // genitive forms, used by templates that need "X's" (fi appends a suffix)
      'side.dalmen.gen': 'Dalmen',
      'side.zhaglon.gen': 'Zhaglon',

      'unit.spearman.name': 'Spearman',
      'unit.spearman.description': 'Sturdy front-line fighter with a long spear. Hits hard up close and at reach 2.',
      'unit.archer.name': 'Archer',
      'unit.archer.description': 'Fragile but shoots far. Cannot hit targets on adjacent squares.',
      'unit.mage.name': 'Mage',
      'unit.mage.description': "Powerful spellcaster. If a side's mage falls, that side loses the battle.",

      // faction units (stored in the klapi game data)
      'unit.soldiers_of_falroth.name': 'Soldiers of Falroth',
      'unit.knights_of_gremloth.name': 'Knights of Gremloth',
      'unit.arbalesters.name': 'Arbalesters',
      'unit.catapult.name': 'Catapult',
      'unit.riders_of_nezek.name': 'Riders of Nezek',
      'unit.knights_of_zhaglon.name': 'Knights of Zhaglon',
      'unit.war_chariot.name': 'War chariot',
      'unit.archers_of_grishtalon.name': 'Archers of Grishtalon',

      'log.begin': 'Battle begins. {side} to move.',
      'log.move': '{side} {unit} moved {from} -> {to}.',
      'log.hit': '{side} {unit} hit {targetSide} {targetUnit} for {dmg} (ATK {atk} - DEF {def}).',
      'log.slain': '{side} {unit} was slain!',
      'log.win': '{side} is wiped out. {winner} wins the battle!',
      'log.pass': '{side} ends the turn.',

      'err.over': 'The battle is already over.',
      'err.turn': "It is {side}'s turn, not {other}'s.",
      'err.noUnit': 'No such unit.',
      'err.offBoard': 'Target square is off the board.',
      'err.cannotMove': '{unit} cannot move there.',
      'err.alreadyMoved': '{unit} has already moved this turn.',
      'err.noTarget': 'No such target.',
      'err.cannotReach': '{unit} cannot reach {target} there.',
      'err.alreadyAttacked': '{unit} has already attacked this turn.',
      'err.hintTurn': "Not that side's turn.",
      'err.bodyTooLarge': 'Body too large',
      'err.invalidJson': 'Invalid JSON body',
      'err.unknownEndpoint': 'Unknown endpoint',
      'err.methodNotAllowed': 'Method not allowed',
    },
    fi: {
      'ui.title': 'Vihkotappelu — fantasia sotapeli',
      'ui.loading': 'Ladataan...',
      'ui.newGame': 'Uusi peli',
      'ui.endTurn': 'Lopeta vuoro',
      'ui.overlaySub': 'Vastustajan armeija on tuhottu.',
      'ui.overlayWin': '{side} voittaa!',
      'ui.bannerTurn': '{sidegen} vuoro — siirto {move}. Jokainen yksikkö voi siirtyä ja hyökätä kerran; Lopeta vuoro ohittaa loput.',
      'ui.bannerWin': '{side} voittaa taistelun!',
      'ui.selectedUnit': 'Valittu yksikkö',
      'ui.emptyCard': 'Klikkaa yhtä yksikköäsi laudalla.',
      'ui.hasMoved': 'siirtynyt',
      'ui.hasAttacked': 'hyökännyt',
      'ui.battleLog': 'Taisteluloki',
      'ui.rules': 'Säännöt',
      'ui.rules1': '32x32-ruudukko, vuoropohjainen: vuorollasi <strong>jokainen yksikkö voi siirtyä kerran ja hyökätä kerran</strong> (jos kohde on kantamassa), sitten toinen puoli.',
      'ui.rules2': 'Klikkaa aktiivisen puolen yksikköä ja sitten vihreää ruutua siirtyäksesi tai punaista ruutua hyökätäksesi. Käytetyt yksiköt himmennetään — loput voi ohittaa Lopeta vuoro -painikkeella.',
      'ui.rules3': 'Vahinko = hyökkääjän hyökkäys − kohteen puolustus (vähintään 1).',
      'ui.rules4': 'Jousimiehet eivät voi ampua viereiseen ruutuun (min. kantama 2).',
      'ui.rules5': 'Yksiköt estävät liikkumisen. Vastustajan kaikkien yksiköiden tuhoaminen voittaa taistelun.',
      'ui.rules6': 'Metsät, vuoret ja talot ovat esteitä: yksiköt eivät voi siirtyä niiden päälle tai läpi.',
      'ui.hint': 'Hotseat-tila: komennat molempia puolia vuorotellen.',
      'ui.statHealth': 'Kestävyys',
      'ui.statAttack': 'Hyökkäys',
      'ui.statDefence': 'Puolustus',
      'ui.statMovement': 'Liikkuvuus',
      'ui.statRange': 'Kantama',
      'ui.langPickerLabel': 'Kieli',

      'side.dalmen': 'Dalmen',
      'side.zhaglon': 'Zhaglon',
      'side.dalmen.gen': 'Dalmenin',
      'side.zhaglon.gen': 'Zhaglonin',

      'unit.spearman.name': 'Keihäsmies',
      'unit.spearman.description': 'Tukeva etulinjan taistelija pitkällä keihäällä. Iskee kovaa lähietäisyydeltä ja kahden ruudun päästä.',
      'unit.archer.name': 'Jousimies',
      'unit.archer.description': 'Hauras mutta ampuu kauas. Ei voi osua viereisen ruudun kohteisiin.',
      'unit.mage.name': 'Magi',
      'unit.mage.description': 'Voimakas loitsija. Jos puolen magi kaatuu, kyseinen puoli häviää taistelun.',

      // faction units (stored in the klapi game data)
      'unit.soldiers_of_falroth.name': 'Falrothin sotilaat',
      'unit.knights_of_gremloth.name': 'Gremlothin ritarit',
      'unit.arbalesters.name': 'Varsijousimiehet',
      'unit.catapult.name': 'Katapultti',
      'unit.riders_of_nezek.name': 'Nezekin ratsastajat',
      'unit.knights_of_zhaglon.name': 'Zhaglonin ritarit',
      'unit.war_chariot.name': 'Sotavaunut',
      'unit.archers_of_grishtalon.name': 'Grishtalonin jousimiehet',

      'log.begin': 'Taistelu alkaa. {side} saa siirron.',
      'log.move': '{sidegen} {unit} siirtyi {from} -> {to}.',
      'log.hit': '{sidegen} {unit} osui kohteeseen {targetUnit} ({targetSide}) ja teki {dmg} vahinkoa (HYÖ {atk} - PUO {def}).',
      'log.slain': '{sidegen} {unit} kaatui!',
      'log.win': '{side} on tuhottu. {winner} voittaa taistelun!',
      'log.pass': '{sidegen} päättää vuoron.',

      'err.over': 'Taistelu on jo päättynyt.',
      'err.turn': 'Nyt on {sidegen} vuoro, ei {othergen}.',
      'err.noUnit': 'Yksikköä ei löydy.',
      'err.offBoard': 'Kohderuutu on laudan ulkopuolella.',
      'err.cannotMove': '{unit} ei voi siirtyä sinne.',
      'err.alreadyMoved': '{unit} on jo siirtynyt tällä vuorolla.',
      'err.noTarget': 'Kohdetta ei löydy.',
      'err.cannotReach': '{unit}: kohde {target} on liian kaukana.',
      'err.alreadyAttacked': '{unit} on jo hyökännyt tällä vuorolla.',
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

  /* True when the key exists in the requested language or the fallback. */
  function has(lang, key) {
    lang = normalize(lang);
    return (STRINGS[lang] && STRINGS[lang][key] !== undefined)
      || STRINGS[DEFAULT_LANG][key] !== undefined;
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

  return { LANGS, DEFAULT_LANG, STRINGS, normalize, has, t };
});
