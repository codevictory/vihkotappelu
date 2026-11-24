# AGENTS.md — Vihkotappelu

Fantasy turn-based strategy battle game in the browser ("fantasia sotapeli").
Hotseat two-player on one machine today; the server API is per-room, so online
duels against a human can be added later on the same API. Zero npm
dependencies, no build step, vanilla JS + canvas.

## Keeping this file up to date

- Whenever code in this repo is changed (rules, API, client, i18n, sprites,
  game data, commands, deploy), amend this AGENTS.md in the same change so it
  keeps describing the repo as it actually is — update the affected sections
  (Commands, Layout, Rules, Conventions, Gotchas), don't leave stale entries.
- If a change makes a section here wrong or incomplete, fix it as part of the
  same commit; if the change introduces a new recurring pattern, add it here.

## Commands

- `npm start` — dev server at http://localhost:3000 (`PORT` env overrides; pm2 production uses 4200). The server loads the unit/faction game data from the klapi API at startup (fatal if klapi is unreachable) and refreshes it on API requests once the cache expires. Env: `KLAPI_BASE_URL` (default `http://localhost:5013`), `KLAPI_SITE_API_KEY` (required, and `KLAPI_BASE_URL` must be `https://`, when `NODE_ENV=production`), `KLAPI_TIMEOUT_MS` (default 10000), `VIHKOTAPPELU_DATA_CACHE_TTL_MS` (default 60000). Run klapi dev first (see `/home/veikko/Code/klapi`) and seed its database with `just reset-vihkotappelu` there.
- `npm run fetch-data -- <file.json>` — dump the current klapi game data (`GET /vihkotappelu/data`, one bulk call) into a JSON file.
- `npm run sync-data -- <file.json>` — push an edited game-data payload back into the klapi database (`PUT /vihkotappelu/data`, full replacement). This repo holds NO data files — the canonical seed is `api/Database/reset-vihkotappelu.sql` in the klapi repo; to change units/factions: `fetch-data` → edit the JSON → `sync-data`.
- `npm test` — rule + i18n tests (`node --test`, no deps). Always run after touching `src/`, `server.js`, `lib/`, `tools/`, `public/i18n.js`, `public/sprites.js` or `test/`
- `just dev` / `just install` / `just deploy` — justfile recipes. `deploy` = git pull + `npm ci` + `npm test` + pm2 restart (deploy/deploy.sh) — never run this unless explicitly asked
- Quick API check: `curl 'localhost:3000/api/state?room=local&lang=fi'`

## Layout

- `server.js` — zero-dep Node HTTP server. Serves `public/` statically; JSON API with one `Game` per room:
  `GET /api/state?room=`, `GET /api/hints?room=&id=`, `POST /api/new | /api/move | /api/attack | /api/endturn` with JSON body `{room, ...}`.
  Every endpoint accepts `lang=en|fi` (query param wins over `body.lang`) and returns localized names, log entries and errors.
  At startup it fetches the whole game data from klapi in ONE bulk call (`GET /vihkotappelu/data` via `lib/klapiClient.js`) and feeds it to `setGameData()`; if that fails the server exits (the game cannot start without its data). On later API requests the data is re-fetched once the `VIHKOTAPPELU_DATA_CACHE_TTL_MS` cache expires (a failed refresh keeps the last good data).
- `lib/klapiClient.js` — server-to-server client for the klapi API: site-to-site auth sends the shared key in the `X-API-Key` header; the key comes only from env (`KLAPI_BASE_URL`, `KLAPI_SITE_API_KEY`, `KLAPI_TIMEOUT_MS`) and is never logged or committed. In production (`NODE_ENV=production`) the key is mandatory and the base URL must be `https://` — the process refuses to start otherwise. Exposes `fetchGameDataFromKlapi()` (bulk GET) and `syncGameDataToKlapi()` (bulk PUT).
- `src/game.js` — pure rules engine (`Game` class), the only place game rules live. No I/O: the unit/faction data arrives via `setGameData(payload)` (the `GET /vihkotappelu/data` payload: `{units: [...], factions: [...]}` with per-language `translations`), which validates it and populates `UNIT_DEFS`/`SIDES` in place. Exports `Game, getRoom, resetRoom, setGameData, UNIT_DEFS, SIZE, SIDES, OBSTACLE_TYPES, OBSTACLE_CLEARANCE, httpError, I18N`.
- `public/index.html` — page shell; all visible text via `data-i18n` attributes; loads `i18n.js`, `sprites.js`, `game.js` in that order.
- `public/i18n.js` — UMD string dictionary (`window.I18N` in browser, `module.exports` in Node). Single source of truth for all user-facing strings; the `en` and `fi` tables must have identical key sets (test-enforced). Templates use `{name}` placeholders; a param `{ref:'side.dalmen'}` resolves another dictionary key, `{ref:..., form:'gen'}` appends `.gen` (Finnish genitive).
- `public/sprites.js` — UMD; `SPRITES` (16x16 grids, one char per pixel, `'.'` = transparent) and `PALETTES` (per-side palette keyed by faction id, plus `terrain` and `overlay`). Side-palette chars: `W B T M O`, `P` = side color (avoid `P` in faction icons). Terrain palette has its own chars (`G g K W R T B O`); overlay uses `X`.
- `public/game.js` — canvas client (TILE = 24 px, DPR-aware). Renders state and calls the API; never reimplements rules. Note: shares its name with `src/game.js` — don't confuse them.
- Unit and faction data — lives ONLY in the klapi database (no data files in this repo). klapi side: `GET/PUT /vihkotappelu/data` (`VihkotappeluEndpoints`; tables `VihkotappeluUnits`/`VihkotappeluFactions` + translation/link tables; canonical seed `api/Database/reset-vihkotappelu.sql`, applied with `just reset-vihkotappelu` in the klapi repo). Edit here via `npm run fetch-data -- file.json` → edit → `npm run sync-data -- file.json`. A faction is a side; see `factions/README.md` for the prompt model for adding a new faction. `state()` resolves displayed names through i18n keys `unit.<type>.name` / `side.<id>` (falling back to the klapi-stored name when the key is missing). A new faction alone does NOT change the game; it must also be wired into `SIDES`/`ARMIES` in `src/game.js` to become a playing side (only two sides exist; `START_SIDE` is the first faction alphabetically).
- `tools/fetch_game_data.js`, `tools/sync_to_klapi.js` — `npm run fetch-data` / `npm run sync-data` with a JSON file argument; dump/push the klapi game data (`GET`/`PUT /vihkotappelu/data`), machine-only auth via the site-to-site API key.
- `test/game.test.js`, `test/i18n.test.js`, `test/gameData.fixture.json` — `node:test`. Both test files seed the game data at the top with `setGameData(require('./gameData.fixture.json'))` (a copy of the klapi payload shape, so no network is needed). `game.test.js` uses a seeded RNG (mulberry32) for deterministic obstacle layouts and temporarily mutates `UNIT_DEFS` (always restore in `finally`).
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
- New unit = a unit entry in the klapi game data (`npm run fetch-data` → add the unit → `npm run sync-data`) + sprite in `public/sprites.js` keyed by its `sprite` field + `unit.<key>.name` in both i18n tables + the unit added to `test/gameData.fixture.json`. To add it to an opening army, edit `ARMIES` in `src/game.js` and update the opening-setup test counts.
- Board coordinates: x 0..31 left→right, y 0..31 top→bottom. Log notation via `sq()`: files a..z then aa..af, rank = 32 − y.
- Add rule tests to `test/game.test.js`, i18n tests to `test/i18n.test.js`; run `npm test` before finishing any change to game logic, server, i18n, sprites or faction data.

## Gotchas

- `UNIT_DEFS`/`SIDES` are module-level shared mutable state populated by `setGameData()` (from klapi at runtime; in tests from `test/gameData.fixture.json`); tests also mutate unit stats on them — always restore in `finally`. `setGameData` validates the whole payload before committing, so a failed load never clobbers the previous data. Creating a `Game` before any `setGameData` throws.
- The server needs klapi at boot: without a reachable klapi (env `KLAPI_BASE_URL`/`KLAPI_SITE_API_KEY`) `npm start` exits with an error. In production the site key is mandatory and the klapi URL must be https (enforced in `lib/klapiClient.js`); the key lives in the pm2 env (`deploy/ecosystem.config.js` reads it from `process.env`), never in code or commits.
- Server: JSON bodies only, 100 KB cap, static path traversal guarded, room ids truncated to 64 chars, default room `local`.
- Don't run `just deploy`, pm2 or `git pull` unless explicitly asked — those are production actions.
