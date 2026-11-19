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
      },
      instances: 1,
      exec_mode: 'fork',
    },
  ],
};
