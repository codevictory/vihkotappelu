# AGENTS.md — Vihkotappelu

Fantasy turn-based strategy battle game in the browser ("fantasia sotapeli").
Hotseat two-player on one machine today; the server API is per-room, so online
duels against a human can be added later on the same API. Zero npm
dependencies, no build step, vanilla JS + canvas.

## Keeping this file up to date

- Whenever code in this repo is changed (rules, API, client, i18n, sprites,
  factions, commands, deploy), amend this AGENTS.md in the same change so it
  keeps describing the repo as it actually is — update the affected sections
  (Commands, Layout, Rules, Conventions, Gotchas), don't leave stale entries.
- If a change makes a section here wrong or incomplete, fix it as part of the
  same commit; if the change introduces a new recurring pattern, add it here.

## Commands

- `npm start` — dev server at http://localhost:3000 (`PORT` env overrides; pm2 production uses 4200)
- `npm test` — rule + i18n tests (`node --test`, no deps). Always run after touching `src/`, `server.js`, `public/i18n.js`, `public/sprites.js` or `factions/`
- `just dev` / `just install` / `just deploy` — justfile recipes. `deploy` = git pull + `npm ci` + `npm test` + pm2 restart (deploy/deploy.sh) — never run this unless explicitly asked
- Quick API check: `curl 'localhost:3000/api/state?room=local&lang=fi'`

## Layout

- `server.js` — zero-dep Node HTTP server. Serves `public/` statically; JSON API with one `Game` per room:
  `GET /api/state?room=`, `GET /api/hints?room=&id=`, `POST /api/new | /api/move | /api/attack | /api/endturn` with JSON body `{room, ...}`.
  Every endpoint accepts `lang=en|fi` (query param wins over `body.lang`) and returns localized names, log entries and errors.
- `src/game.js` — pure rules engine (`Game` class), the only place game rules live. Loads `units.json` and every `factions/*.json` at startup, merges their units into `UNIT_DEFS`. Exports `Game, getRoom, resetRoom, UNIT_DEFS, SIZE, SIDES, OBSTACLE_TYPES, OBSTACLE_CLEARANCE, httpError, I18N`.
- `public/index.html` — page shell; all visible text via `data-i18n` attributes; loads `i18n.js`, `sprites.js`, `game.js` in that order.
- `public/i18n.js` — UMD string dictionary (`window.I18N` in browser, `module.exports` in Node). Single source of truth for all user-facing strings; the `en` and `fi` tables must have identical key sets (test-enforced). Templates use `{name}` placeholders; a param `{ref:'side.dalmen'}` resolves another dictionary key, `{ref:..., form:'gen'}` appends `.gen` (Finnish genitive).
- `public/sprites.js` — UMD; `SPRITES` (16x16 grids, one char per pixel, `'.'` = transparent) and `PALETTES` (per-side palette keyed by faction id, plus `terrain` and `overlay`). Side-palette chars: `W B T M O`, `P` = side color (avoid `P` in faction icons). Terrain palette has its own chars (`G g K W R T B O`); overlay uses `X`.
- `public/game.js` — canvas client (TILE = 24 px, DPR-aware). Renders state and calls the API; never reimplements rules. Note: shares its name with `src/game.js` — don't confuse them.
- `units.json` — base unit defs (spearman, archer, mage). Its plain-string `name` is not what gets rendered: `state()` resolves displayed names through i18n keys `unit.<type>.name`.
- `factions/<id>.json` — one file per faction; a faction is a side. See `factions/README.md` for the schema and the prompt model for adding a new faction: exactly 4 units, `name` as `{en, fi}`, `sprite` = unit key, no description — plus one sprite in `sprites.js` and `unit.<key>.name` in both i18n tables. A new faction file alone does NOT change the game; it must also be wired into `SIDES`/`ARMIES` in `src/game.js` to become a playing side (only two sides exist; `START_SIDE` is the first faction alphabetically).
- `test/game.test.js`, `test/i18n.test.js` — `node:test`. `game.test.js` uses a seeded RNG (mulberry32) for deterministic obstacle layouts and temporarily mutates `UNIT_DEFS` (always restore in `finally`).
- `deploy/` — pm2 config (`ecosystem.config.js`, PORT 4200) and `deploy.sh`.

## Rules as implemented in src/game.js

- 32x32 board. Sides = the two factions; Dalmen starts on its back row (y=31), Zhaglon at y=0; opening armies are hardcoded in `ARMIES`.
- Each turn every unit of the active side may move once and attack once. Movement = BFS, 4-dir, up to `movement`, blocked by units and obstacles. Attack = any enemy within Chebyshev distance `[minRange||1, range]`. Damage = `max(1, ATK − DEF)`. The turn passes automatically when every active unit is spent, or on `endTurn`. Win = destroy every enemy unit. (The mage's "side loses if its mage falls" description is flavor only — not implemented.)
- Obstacles (forest/mountain/house) regenerate randomly on every reset: forests and mountains grow in clusters, houses stay sparse, nothing spawns within Chebyshev distance 3 of an opening unit. Terrain blocks movement only, never attacks.
- Log entries are stored as `{key, params}` and localized in `state(lang)`; errors are thrown as `httpError(status, i18nKey, params)` so the server can render them per-request in the requester's language.

## Conventions

- Every JS file starts with `'use strict'`; CommonJS in `server.js`/`src/`/`test/`; UMD wrapper in `public/i18n.js` and `public/sprites.js`; plain script in `public/game.js`.
- 2-space indent, single quotes, semicolons, minimal diffs, match surrounding style. Do not add npm dependencies — the project is deliberately zero-dep.
- All user-facing strings (UI, log, errors, unit/side names) go through `public/i18n.js` in BOTH languages at once (a test fails on key mismatch). Finnish must be natural. The header EN/FI picker persists to localStorage `vihkotappelu-lang`; the client sends `?lang=` on every API call.
- To rename a unit, edit the i18n tables (`unit.<type>.name` in en + fi), not just the JSON.
- New unit = def in `units.json` or a faction file + sprite in `public/sprites.js` keyed by its `sprite` field + `unit.<key>.name` in both i18n tables. To add it to an opening army, edit `ARMIES` in `src/game.js` and update the opening-setup test counts.
- Board coordinates: x 0..31 left→right, y 0..31 top→bottom. Log notation via `sq()`: files a..z then aa..af, rank = 32 − y.
- Add rule tests to `test/game.test.js`, i18n tests to `test/i18n.test.js`; run `npm test` before finishing any change to game logic, server, i18n, sprites or faction data.

## Gotchas

- `UNIT_DEFS` is module-level shared mutable state; tests mutate it — always restore in `finally`.
- Server: JSON bodies only, 100 KB cap, static path traversal guarded, room ids truncated to 64 chars, default room `local`.
- Don't run `just deploy`, pm2 or `git pull` unless explicitly asked — those are production actions.
