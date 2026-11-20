'use strict';

/**
 * Vihkotappelu server — zero-dependency Node.js HTTP server.
 *
 * Serves the browser client from public/ and a small JSON API holding the
 * authoritative game state (one Game per room). Today the hotseat client
 * plays both sides in the "local" room; online play against a human later
 * only needs a second client to join another room id and claim the other
 * side — the API below already works per-room.
 *
 *   GET  /api/state?room=ID   -> game state JSON
 *   POST /api/new    {room}          -> reset room
 *   POST /api/move   {room,id,x,y}   -> move one unit (once per unit per turn)
 *   POST /api/attack {room,id,targetId} -> attack with one unit (once per unit per turn)
 *   POST /api/endturn {room}         -> pass; the turn also passes automatically
 *                                        once every unit of the active side is spent
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { getRoom, resetRoom, httpError, I18N } = require('./src/game');

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
}

/* Language for this request: ?lang= query param wins, then body.lang. */
function langOf(url, body) {
  return I18N.normalize(url.searchParams.get('lang') || (body && body.lang) || I18N.DEFAULT_LANG);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1e5) {
        reject(Object.assign(new Error('Body too large'), { status: 413, key: 'err.bodyTooLarge' }));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch {
        reject(Object.assign(new Error('Invalid JSON body'), { status: 400, key: 'err.invalidJson' }));
      }
    });
    req.on('error', reject);
  });
}

function serveStatic(req, res, urlPath) {
  let rel = decodeURIComponent(urlPath === '/' ? '/index.html' : urlPath);
  const filePath = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Not found');
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
    });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  try {
    if (url.pathname === '/api/state' && req.method === 'GET') {
      return sendJson(res, 200, { ok: true, state: getRoom(url.searchParams.get('room')).state(langOf(url)) });
    }

    if (url.pathname === '/api/hints' && req.method === 'GET') {
      const g = getRoom(url.searchParams.get('room'));
      const unit = g.unitById(String(url.searchParams.get('id') || ''));
      if (!unit) throw httpError(404, 'err.noUnit');
      if (unit.side !== g.turn) throw httpError(400, 'err.hintTurn');
      return sendJson(res, 200, {
        ok: true,
        hints: {
          moves: unit.hasMoved ? [] : g.movesFor(unit),
          attacks: unit.hasAttacked
            ? []
            : g.attacksFor(unit).map((u) => ({ id: u.id, x: u.x, y: u.y, type: u.type, side: u.side })),
        },
      });
    }

    if (url.pathname.startsWith('/api/') && req.method === 'POST') {
      const body = await readBody(req);
      const room = url.searchParams.get('room') || body.room;
      const lang = langOf(url, body);
      if (url.pathname === '/api/new') {
        return sendJson(res, 200, { ok: true, state: resetRoom(room).state(lang) });
      }
      if (url.pathname === '/api/move') {
        const g = getRoom(room);
        g.move(String(body.id), body.x, body.y);
        return sendJson(res, 200, { ok: true, state: g.state(lang) });
      }
      if (url.pathname === '/api/attack') {
        const g = getRoom(room);
        g.attack(String(body.id), String(body.targetId));
        return sendJson(res, 200, { ok: true, state: g.state(lang) });
      }
      if (url.pathname === '/api/endturn') {
        const g = getRoom(room);
        g.endTurn();
        return sendJson(res, 200, { ok: true, state: g.state(lang) });
      }
      throw httpError(404, 'err.unknownEndpoint');
    }

    if (req.method === 'GET') return serveStatic(req, res, url.pathname);

    throw httpError(405, 'err.methodNotAllowed');
  } catch (err) {
    const message = err.key ? I18N.t(langOf(url), err.key, err.params) : err.message;
    sendJson(res, err.status || 500, { ok: false, error: message });
  }
});

server.listen(PORT, () => {
  console.log(`Vihkotappelu running at http://localhost:${PORT}`);
});
