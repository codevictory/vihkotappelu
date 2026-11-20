# Factions

Each faction is pure data in its own file: `factions/<faction-id>.json`.
`src/game.js` loads every faction file at startup, merges its units into the
unit definitions alongside `units.json`, and uses the factions as the two
sides of a match (Dalmen vs Zhaglon). Adding a third faction file does not
change the running game until it is also wired into the sides and opening
there.

## Prompt model — how to ask the agent for a new faction

Copy this shape (see `zhaglon.json` for a filled-in example):

```
New faction
Name: <Faction name>

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

1. **`factions/<faction-id>.json`** with this schema. The short prompt fields
   map onto the game's unit schema used in `units.json`:

   | Prompt field             | JSON field  |
   | ------------------------ | ----------- |
   | unit name (first line)   | `name.en`   |
   | `fi`                     | `name.fi`   |
   | `hp`                     | `hp`        |
   | `att`                    | `attack`    |
   | `def`                    | `defence`   |
   | `mov`                    | `movement`  |
   | `rng`                    | `range`     |
   | `min`                    | `minRange`  |
   | `icon`                   | `sprite`    |

   ```json
   {
     "faction": { "id": "zhaglon", "name": "Zhaglon", "color": "#a855f7" },
     "units": {
       "<unit_key>": {
         "name": { "en": "<Unit name>", "fi": "<Finnish unit name>" },
         "hp": 13, "attack": 6, "defence": 2,
         "movement": 5, "range": 4, "minRange": 1,
         "sprite": "<unit_key>"
       }
     }
   }
   ```

   - `<unit_key>` is the English unit name lowercased, spaces to underscores
     (e.g. `Soldiers of Falroth` -> `soldiers_of_falroth`).
   - `name` is a per-language object with one entry per language in `LANGS`
     (`public/i18n.js`) — `en` and `fi`.
   - `sprite` always equals the unit key.
   - `faction.color` is any hex color, used when the faction becomes a side.
   - No `description` field (optional in-game, currently omitted).

2. **Sprites** — one 16x16 pixel-art icon per unit, appended to the `SPRITES`
   object in `public/sprites.js` (loaded by `index.html` before `game.js`,
   exposed as `window.SPRITES`). Each row is a 16-char string, one character
   per pixel, `.` = transparent. Keep icons small and simple; draw what the
   `icon:` line describes. Usable palette characters (defined in `PALETTES`
   in the same file): `W` wood brown, `B` brown, `T` light gray, `M` bright
   steel, `O` yellow. (`P` is the side color — avoid it in faction icons.)

3. **Translations in the app** — each unit's `name.en` / `name.fi` is also
   added to `public/i18n.js` as `unit.<unit_key>.name` in both the `en` and
   `fi` tables. The game resolves unit names through those keys
   (`unit.<type>.name` in `src/game.js`, rendered in the unit card and battle
   log), so faction units are localizable the moment they are merged into the
   unit definitions.

4. **Nothing else.** The faction is not added to `src/game.js` (sides,
   openings) or any game flow — unless it is meant to become one of the two
   sides, in which case it is wired into `SIDES` and `ARMIES` there.
