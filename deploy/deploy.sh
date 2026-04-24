#!/bin/bash
set -e
SERVER_IP="5.189.153.144"
SSH_KEY="$HOME/.ssh/studara_deploy"
if [ ! -f "$SSH_KEY" ]; then
  SSH_KEY="$HOME/.ssh/tawjeeh_deploy"
fi
SSH_OPTS="-i $SSH_KEY -o StrictHostKeyChecking=no"

echo "=== Deploying Studara API to $SERVER_IP ==="

# Build locally first
cd /Users/mohameda/Desktop/studara/api
npm install
npm run build

# Create app directory on server
ssh $SSH_OPTS root@$SERVER_IP "mkdir -p /var/www/studara/api /var/www/studara/admin"

# Sync API files
rsync -avz -e "ssh $SSH_OPTS" \
  --exclude node_modules \
  --exclude .git \
  --exclude .env \
  --exclude .env.* \
  --exclude uploads \
  /Users/mohameda/Desktop/studara/api/ \
  root@$SERVER_IP:/var/www/studara/api/

# Sync ecosystem config so PM2 always knows the correct cwd
rsync -avz -e "ssh $SSH_OPTS" \
  /Users/mohameda/Desktop/studara/deploy/ecosystem.config.js \
  root@$SERVER_IP:/var/www/studara/api/ecosystem.config.js

# Sync admin files
cd /Users/mohameda/Desktop/studara/admin
npm install
npm run build
rsync -avz -e "ssh $SSH_OPTS" dist/ root@$SERVER_IP:/var/www/studara/admin/

# On server: install deps, run migrations, start API
ssh $SSH_OPTS root@$SERVER_IP << 'ENDSSH'
cd /var/www/studara/api
npm install --production
# Run DB migrations using DATABASE_URL from .env
DB_URL=$(grep DATABASE_URL .env | cut -d= -f2-)
for f in $(ls src/db/migrations/*.sql | sort); do
  echo "Running migration: $f"
  psql "$DB_URL" -f "$f" 2>/dev/null || true
done
# Delete legacy tawjeeh-api process if it still exists (old name before rename)
pm2 delete tawjeeh-api 2>/dev/null || true
# Start/reload studara-api using ecosystem.config.js — guarantees cwd=/var/www/studara/api
pm2 startOrRestart /var/www/studara/api/ecosystem.config.js --update-env
pm2 save
ENDSSH

echo "=== Deploy done! API: http://$SERVER_IP:3000 ==="
