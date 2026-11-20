# Vihkotappelu task recipes — run with `just <recipe>`
set shell := ["bash", "-cu"]

# Run the dev server (default http://localhost:3000, override with PORT)
dev:
    npm start

# Install dependencies exactly from the lockfile
install:
    npm ci

# Pull latest, install, test and restart the app under pm2 (deploy/deploy.sh)
deploy:
    bash deploy/deploy.sh
