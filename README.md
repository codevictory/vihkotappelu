# Vihkotappelu

Strategy battle game

Fantasy turn-based strategy battle in the browser. Pixel-art pieces on a 32x32
grid, controlled entirely with the mouse. Two sides — Dalmen vs Zhaglon, from
`factions/*.json` — Dalmen with 3 soldiers, 2 knights, 2 arbalesters and 1
catapult, Zhaglon with 3 riders, 2 knights, 3 archers and 2 chariots, lined up
on the opposite back rows. On your turn every unit may move once and attack
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

```
npm start          # then open http://localhost:3000  (PORT env to change)
npm test           # rule tests (node:test, no dependencies)
```

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

- `units.json` — base unit stats (hp, attack, defence, movement, range), read at startup
- `factions/` — the two sides (Dalmen, Zhaglon); each faction's units are merged into the unit defs at startup
- `src/game.js` — rules engine (pure logic, one `Game` per room)
- `server.js` — zero-dependency Node HTTP server: static client + JSON API
  (`GET /api/state`, `GET /api/hints`, `POST /api/new`, `POST /api/move`, `POST /api/attack`, `POST /api/endturn`)
- `public/` — canvas client with hand-drawn 16x16 pixel sprites
- `public/i18n.js` — EN/FI string dictionary shared by browser and server (no build step)
- `test/` — rule tests
