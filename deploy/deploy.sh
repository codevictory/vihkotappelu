#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "==> Pulling latest changes..."
git -C "$REPO_DIR" pull

echo "==> Installing dependencies..."
cd "$REPO_DIR" && npm ci

echo "==> Running tests..."
npm test

echo "==> Restarting app process..."
pm2 startOrRestart "$REPO_DIR/deploy/ecosystem.config.js"
pm2 save

echo "==> Done."
