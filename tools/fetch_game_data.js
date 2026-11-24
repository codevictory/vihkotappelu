#!/usr/bin/env node
'use strict';

// Dumps the current game data from the klapi API (GET /vihkotappelu/data,
// one bulk call) into a JSON file, ready to be edited and pushed back with
// tools/sync_to_klapi.js:
//
//   npm run fetch-data -- game-data.json
//
// Uses the same env vars as the server: KLAPI_BASE_URL, KLAPI_SITE_API_KEY
// (see lib/klapiClient.js).

const fs = require('fs');
const { fetchGameDataFromKlapi, KLAPI_BASE_URL } = require('../lib/klapiClient');

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage: node tools/fetch_game_data.js <out.json>');
    process.exit(1);
  }
  const data = await fetchGameDataFromKlapi();
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
  console.log(`Fetched ${data.units.length} units and ${data.factions.length} factions from ${KLAPI_BASE_URL} into ${file}.`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
