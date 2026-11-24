# Factions

Factions (the sides of a match — currently Dalmen vs Zhaglon) are DATA in the
klapi API database, not files in this repo. The game server reads the whole
game data in one bulk `GET /vihkotappelu/data` call at startup (see
`lib/klapiClient.js`) and `src/game.js` receives it via `setGameData()`.

To inspect or change the data:

```
npm run fetch-data -- game-data.json   # dump GET /vihkotappelu/data to a file
# ... edit game-data.json (units[] and/or factions[]) ...
npm run sync-data -- game-data.json    # PUT /vihkotappelu/data (full replace)
```

The canonical seed is `api/Database/reset-vihkotappelu.sql` in the klapi repo
(applied with `just reset-vihkotappelu` there). The payload schema is:

```json
{
  "units": [
    {
      "unitKey": "riders_of_nezek",
      "name": "Riders of Nezek",
      "description": "",
      "hp": 13, "attack": 6, "defence": 2, "movement": 5,
      "range": 4, "minRange": 1,
      "sprite": "riders_of_nezek", "sortOrder": 7,
      "translations": {
        "en": { "name": "Riders of Nezek", "description": "" },
        "fi": { "name": "Nezekin ratsastajat", "description": "" }
      }
    }
  ],
  "factions": [
    {
      "id": "zhaglon",
      "name": "Zhaglon",
      "color": "#a855f7",
      "sortOrder": 1,
      "translations": { "en": { "name": "Zhaglon" }, "fi": { "name": "Zhaglon" } },
      "units": ["riders_of_nezek", "knights_of_zhaglon", "archers_of_grishtalon", "war_chariot"]
    }
  ]
}
```

A faction is a side: `id`, `color` (hex, used on the board), per-language
`name`, and the `units` list (unit keys belonging to the faction). `src/game.js`
turns the factions into `SIDES`; only two sides exist and `START_SIDE` is the
first faction id alphabetically. Adding a third faction does not change the
running game until it is also wired into the sides and opening (`ARMIES`) in
`src/game.js`.

## Prompt model — how to ask the agent for a new faction

Copy this shape (see the Dalmen/Zhaglon entries in the klapi game data for
filled-in examples):

```
New faction
Name: <Faction name>
Color: <hex color, e.g. #a855f7>

Units of this faction — always exactly 4 units:
<Unit name in English>
fi: <Finnish translation of the unit name>
hp: <hit points>
att: <attack>
def: <defence>
mov: <movement>
rng: <max attack range>
min: <min attack range, omit for 1>
icon: <short description of what the sprite should show>

<next unit...> (repeat until the faction has 4 units)
```

Descriptions are not needed — omit them. Every unit needs both an English
name (the first line) and a `fi:` translation.

## What the agent produces from that prompt

1. **Game data in klapi** — the new units appended to `units[]` and the new
   faction to `factions[]` of the game-data payload (`npm run fetch-data` →
   edit → `npm run sync-data`). The short prompt fields map onto the unit
   schema:

   | Prompt field             | JSON field  |
   | ------------------------ | ----------- |
   | unit name (first line)   | `translations.en.name` (and `name`) |
   | `fi`                     | `translations.fi.name` |
   | `hp`                     | `hp`        |
   | `att`                    | `attack`    |
   | `def`                    | `defence`   |
   | `mov`                    | `movement`  |
   | `rng`                    | `range`     |
   | `min`                    | `minRange`  |
   | `icon`                   | `sprite`    |

   - `<unit_key>` is the English unit name lowercased, spaces to underscores
     (e.g. `Soldiers of Falroth` -> `soldiers_of_falroth`); `unitKey`,
     `sprite` and `translations.en.name` all use it, `sprite` always equals
     the unit key.
   - `translations` has one entry per language in `LANGS` (`public/i18n.js`) —
     `en` and `fi`.
   - `faction.color` is any hex color, used when the faction becomes a side.
   - No `description` field (optional in-game, currently omitted).
   - Also add the units to `test/gameData.fixture.json` so the offline tests
     see them.

2. **Sprites** — one 16x16 pixel-art icon per unit, stored in klapi as a
   per-pixel color grid in the payload's `sprites` array (keyed by the unit's
   `sprite` field). Draw the icon directly as a `pixels` grid in the
   game-data JSON — 16 rows of 16 cells, each cell `null` (transparent), a
   hex color (`#rrggbb`, or `#rrggbbaa` for translucency), or `"side"` (the
   owning side's faction color; avoid it in faction icons). Workflow:
   `npm run fetch-data -- game-data.json` → draw the grid in the JSON →
   `npm run sync-data -- game-data.json`. Single pixels can also be tweaked
   in SQL: `UPDATE VihkotappeluSprites SET pixels = json_set(pixels, '$[y][x]', '#ff0000') WHERE spriteKey = '...';`.
   Keep icons small and simple; draw what the `icon:` line describes. Also
   add the sprite to `test/gameData.fixture.json` (`sprites` array) so the
   offline tests see it.

3. **Translations in the app** — each unit's English/Finnish name is also
   added to `public/i18n.js` as `unit.<unit_key>.name` in both the `en` and
   `fi` tables (and the faction name as `side.<faction_id>`). The game
   resolves displayed names through those keys (`unit.<type>.name` /
   `side.<id>` in `src/game.js`, rendered in the unit card and battle log),
   with the klapi-stored name as fallback.

4. **Nothing else.** The faction is not added to `src/game.js` (sides,
   openings) or any game flow — unless it is meant to become one of the two
   sides, in which case it is wired into `SIDES` and `ARMIES` there.
