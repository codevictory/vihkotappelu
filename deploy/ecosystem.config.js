// pm2 app definition for Vihkotappelu.
//
// First deploy on a server:
//   pm2 start deploy/ecosystem.config.js
//   pm2 save
//   pm2 startup        # optional: resurrect the process list after reboot
//
// Later deploys are handled by deploy/deploy.sh (pm2 startOrRestart).

const path = require('path');

const repoDir = path.join(__dirname, '..');

module.exports = {
  apps: [
    {
      name: 'vihkotappelu',
      cwd: repoDir,
      script: path.join(repoDir, 'server.js'),
      env: {
        NODE_ENV: 'production',
        PORT: '4200',
        // klapi API hosting the unit/faction data (game server reads it via
        // GET /vihkotappelu/data, site-to-site X-API-Key auth, HTTPS only).
        // KLAPI_SITE_API_KEY is a secret: it is taken from the server's
        // environment (pm2 env), never committed to this file.
        KLAPI_BASE_URL: process.env.KLAPI_BASE_URL || 'https://klapi.tietokonepaja.fi',
        KLAPI_SITE_API_KEY: process.env.KLAPI_SITE_API_KEY || '',
      },
      instances: 1,
      exec_mode: 'fork',
    },
  ],
};
