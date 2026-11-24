# Vihkotappelu

Strategy battle game

Fantasy turn-based strategy battle in the browser. Pixel-art pieces on a 32x32
grid, controlled entirely with the mouse. Two sides — Dalmen vs Zhaglon (unit
and faction data stored in the klapi database) — Dalmen with 3 soldiers, 2
knights, 2 arbalesters and 1 catapult, Zhaglon with 3 riders, 2 knights, 3
archers and 2 chariots, lined up on the opposite back rows. On your turn every unit may move once and attack
once (if a target is in range); the turn passes when all your units are spent
or you press End turn. Destroying every enemy unit wins.

Hotseat mode: the local player commands both sides, alternating turns.
The server keeps authoritative game state per room, so online play against a
human can be layered on later by joining a room and claiming the other side.

The UI is available in English and Finnish — use the EN/FI picker in the
header (the choice is remembered in localStorage). All API endpoints accept a
`lang` query parameter (`en` or `fi`) and return localized names, log entries
and error messages.

## Run

The unit and faction data lives in the klapi API database (this repo holds no
data files; the canonical seed is `api/Database/reset-vihkotappelu.sql` in the
klapi repo): the server fetches it in one bulk call from klapi at startup, so
klapi must be running and seeded first.

```
# in the klapi repo: just dev && just reset-vihkotappelu   (API on http://localhost:5013)
npm start          # then open http://localhost:3000  (PORT env to change)
npm test           # rule tests (node:test, no dependencies)
```

To edit the unit/faction data, dump it from klapi, edit, and push it back:

```
npm run fetch-data -- game-data.json   # GET /vihkotappelu/data (one bulk call)
# ... edit game-data.json ...
npm run sync-data -- game-data.json    # PUT /vihkotappelu/data
```

Connection env vars (see `lib/klapiClient.js`): `KLAPI_BASE_URL`,
`KLAPI_SITE_API_KEY` (sent as the `X-API-Key` header; mandatory + `https://`
base URL in production), `KLAPI_TIMEOUT_MS`, `VIHKOTAPPELU_DATA_CACHE_TTL_MS`.

## How to play

1. Click a unit of the side whose turn it is (banner at top).
2. Green squares are legal moves, red squares are attackable enemies — click one.
   A unit can move and then attack in the same turn; units that have both moved
   and attacked are dimmed. Press End turn to pass the remaining units (the turn
   also passes automatically once every unit is spent).
3. Damage = attacker ATK − target DEF (minimum 1). Units with min range 2
   (archers, arbalesters) cannot shoot adjacent squares. Units block movement.
   Forests, mountains and houses are randomly placed obstacles — units cannot
   move onto or through them. Destroying every enemy unit wins the battle.

## Layout

- unit/faction/sprite data — stored in the klapi database (seed: `reset-vihkotappelu.sql` in the klapi repo); the game reads it from klapi at startup. Edit via `npm run fetch-data` / `npm run sync-data`
- `lib/klapiClient.js` — server-to-server klapi client (site-to-site `X-API-Key` auth, env-only key, https in production)
- `tools/` — `fetch_game_data.js` (dump klapi game data to JSON), `sync_to_klapi.js` (push a JSON payload back)
- `src/game.js` — rules engine (pure logic, one `Game` per room; data arrives via `setGameData()`)
- `server.js` — zero-dependency Node HTTP server: static client + JSON API
  (`GET /api/state`, `GET /api/sprites`, `GET /api/hints`, `POST /api/new`, `POST /api/move`, `POST /api/attack`, `POST /api/endturn`); loads game data from klapi at boot
- `public/` — canvas client; sprites are per-pixel color grids served from klapi via `/api/sprites` (klapi is the single source of truth, no bundled copy)
- `public/i18n.js` — EN/FI string dictionary shared by browser and server (no build step)
- `test/` — rule tests (seeded offline from `test/gameData.fixture.json`)
