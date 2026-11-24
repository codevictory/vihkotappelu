'use strict';

// Server-to-server client for the klapi API (.NET 10).
//
// Site-to-site authentication: every klapi call sends the shared API key in
// the X-API-Key header (validated server-side with a fixed-time hash
// comparison). The key never appears in code or logs — set it via env:
//   KLAPI_BASE_URL       e.g. http://localhost:5013 (dev) or https://klapi.tietokonepaja.fi (prod)
//   KLAPI_SITE_API_KEY   must match Auth:SiteToSite:ApiKey on the klapi host
//                        (env var KLAPI_SITE_API_KEY there)
//   KLAPI_TIMEOUT_MS     per-request timeout (default 10000)
//
// Security: in production (NODE_ENV=production) the API key is REQUIRED and
// KLAPI_BASE_URL must be https://, so the key never travels in plaintext;
// the process refuses to start with a misconfiguration. In development the
// well-known local dev key is the fallback so `just dev` works against a
// local klapi out of the box (it only ever works against a dev klapi).

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

const KLAPI_BASE_URL = (process.env.KLAPI_BASE_URL || 'http://localhost:5013').replace(/\/+$/, '');
const SITE_API_KEY = process.env.KLAPI_SITE_API_KEY
  || (IS_PRODUCTION ? '' : 'dev-site-api-key-0123456789abcdef');

if (IS_PRODUCTION) {
  if (!SITE_API_KEY) {
    throw new Error('KLAPI_SITE_API_KEY must be set when NODE_ENV=production (see lib/klapiClient.js)');
  }
  if (!KLAPI_BASE_URL.startsWith('https://')) {
    throw new Error('KLAPI_BASE_URL must be an https:// URL when NODE_ENV=production (see lib/klapiClient.js)');
  }
}

const REQUEST_TIMEOUT_MS = Number(process.env.KLAPI_TIMEOUT_MS || 10_000);

async function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function klapiFetch(path, options = {}) {
  return fetchWithTimeout(`${KLAPI_BASE_URL}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      'X-API-Key': SITE_API_KEY,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });
}

// Fetches the ENTIRE game data (all unit definitions, factions and sprites)
// from klapi in a single request (GET /vihkotappelu/data), never piece by
// piece.
async function fetchGameDataFromKlapi() {
  const res = await klapiFetch('/vihkotappelu/data');
  if (!res.ok) {
    // Never include request headers in the error — they carry the API key.
    throw new Error(`GET /vihkotappelu/data failed: HTTP ${res.status}`);
  }
  const data = await res.json();
  if (!data || !Array.isArray(data.units) || !Array.isArray(data.factions)) {
    throw new Error('GET /vihkotappelu/data returned an unexpected payload');
  }
  if (data.sprites !== undefined && !Array.isArray(data.sprites)) {
    throw new Error('GET /vihkotappelu/data returned an unexpected payload (sprites is not an array)');
  }
  return data;
}

// Pushes the full game data to klapi (PUT /vihkotappelu/data). Returns the
// stored data. Used by tools/sync_to_klapi.js.
async function syncGameDataToKlapi(data) {
  const res = await klapiFetch('/vihkotappelu/data', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`PUT /vihkotappelu/data failed: HTTP ${res.status} ${text}`.trim());
  }
  return res.json();
}

module.exports = {
  KLAPI_BASE_URL,
  fetchGameDataFromKlapi,
  syncGameDataToKlapi,
};
