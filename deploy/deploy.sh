#!/usr/bin/env bash
# Deploy the API in server/ to the Hetzner box. Invoked by the GitHub Action
# (.github/workflows/deploy-hetzner.yml) and runnable from a laptop.
#
# Required env vars:
#   HETZNER_HOST   - e.g. 178.156.227.13 or 178-156-227-13.sslip.io
#   HETZNER_USER   - SSH user (default: root)
#
# The SSH key must already be loaded into ssh-agent (or available via -i).
set -euo pipefail

HOST="${HETZNER_HOST:?HETZNER_HOST is required}"
USER="${HETZNER_USER:-root}"
SSH_OPTS="-o StrictHostKeyChecking=accept-new -o ConnectTimeout=15"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RELEASE_ID="$(date -u +%Y%m%d-%H%M%S)-$(git -C "$REPO_ROOT" rev-parse --short HEAD 2>/dev/null || echo manual)"
REMOTE_RELEASE="/opt/bfrs-api/releases/$RELEASE_ID"

echo "==> Deploying release $RELEASE_ID to $USER@$HOST"

# 1. Ship server/ to a fresh release directory.
ssh $SSH_OPTS "$USER@$HOST" "install -d -o bfrs -g bfrs -m 0755 '$REMOTE_RELEASE'"
rsync -az --delete \
  -e "ssh $SSH_OPTS" \
  --exclude node_modules --exclude .env \
  "$REPO_ROOT/server/" "$USER@$HOST:$REMOTE_RELEASE/"

# 2. Install deps, atomically flip 'current' symlink, restart service, smoke test.
ssh $SSH_OPTS "$USER@$HOST" bash -se <<EOF
set -euo pipefail
cd '$REMOTE_RELEASE'
chown -R bfrs:bfrs .
sudo -u bfrs npm ci --omit=dev --no-audit --no-fund

# Atomic swap. If systemctl restart fails, we leave the old symlink in place.
PREVIOUS=\$(readlink /opt/bfrs-api/current 2>/dev/null || true)
ln -sfn '$REMOTE_RELEASE' /opt/bfrs-api/current.new
mv -Tf /opt/bfrs-api/current.new /opt/bfrs-api/current

if ! systemctl restart bfrs-api; then
  echo "!! restart failed, rolling back"
  if [[ -n "\$PREVIOUS" ]]; then ln -sfn "\$PREVIOUS" /opt/bfrs-api/current; fi
  systemctl restart bfrs-api || true
  exit 1
fi

# Smoke test the local socket directly (bypasses nginx).
for i in 1 2 3 4 5; do
  if curl -fsS http://127.0.0.1:8080/healthz >/dev/null; then
    echo "OK: bfrs-api healthy"
    break
  fi
  sleep 1
  if [[ \$i -eq 5 ]]; then
    echo "!! healthz never came up"
    exit 1
  fi
done

# Keep the last 5 releases, drop older ones.
ls -1dt /opt/bfrs-api/releases/*/ | tail -n +6 | xargs -r rm -rf
EOF

echo "==> Deploy succeeded."
