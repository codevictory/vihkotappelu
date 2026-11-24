#!/usr/bin/env node
'use strict';

// Pushes a game-data payload file to the klapi API (PUT /vihkotappelu/data),
// replacing the whole unit/faction dataset. The canonical data lives in the
// klapi database — there are no local seed files anymore. Workflow:
//
//   npm run fetch-data -- game-data.json   # dump current data from klapi
//   # ... edit game-data.json ...
//   npm run sync-data -- game-data.json    # push it back (PUT /vihkotappelu/data)
//
// Uses the same env vars as the server: KLAPI_BASE_URL, KLAPI_SITE_API_KEY
// (see lib/klapiClient.js).

const fs = require('fs');
const { syncGameDataToKlapi, KLAPI_BASE_URL } = require('../lib/klapiClient');

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage: node tools/sync_to_klapi.js <game-data.json>');
    console.error('Dump the current data first with: npm run fetch-data -- <file>');
    process.exit(1);
  }
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  console.log(`Syncing ${data.units.length} units and ${data.factions.length} factions from ${file} to ${KLAPI_BASE_URL} ...`);
  const stored = await syncGameDataToKlapi(data);
  console.log(`Stored ${stored.units.length} units and ${stored.factions.length} factions.`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
