# Vihkotappelu

Strategy battle game

Fantasy turn-based strategy battle in the browser. Pixel-art pieces on an 8x8
grid, controlled entirely with the mouse. Two sides — Azure Order vs Crimson
Pact — each with two spearmen, two archers and one mage (chess-style opening).
One piece acts per turn (a move or an attack); killing the enemy mage wins.

Hotseat mode: the local player commands both sides, alternating turns.
The server keeps authoritative game state per room, so online play against a
human can be layered on later by joining a room and claiming the other side.

## Run

```
npm start          # then open http://localhost:3000  (PORT env to change)
npm test           # rule tests (node:test, no dependencies)
```

## How to play

1. Click a unit of the side whose turn it is (banner at top).
2. Green squares are legal moves, red squares are attackable enemies — click one.
   Your action ends the turn.
3. Damage = attacker ATK − target DEF (minimum 1). Archers cannot shoot
   adjacent squares. Units block movement.

## Layout

- `units.json` — unit stats (hp, attack, defence, movement, range), read at startup
- `src/game.js` — rules engine (pure logic, one `Game` per room)
- `server.js` — zero-dependency Node HTTP server: static client + JSON API
  (`GET /api/state`, `GET /api/hints`, `POST /api/new`, `POST /api/move`, `POST /api/attack`)
- `public/` — canvas client with hand-drawn 16x16 pixel sprites
- `test/` — rule tests
