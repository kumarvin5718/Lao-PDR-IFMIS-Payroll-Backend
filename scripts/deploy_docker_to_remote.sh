#!/usr/bin/env bash
# =============================================================================
# Push ifms-payroll to a remote Ubuntu host and run Docker Compose + first DB apply.
#
# Run from your laptop (where the repo and test-key-payroll.pem live), NOT on the server:
#
#   chmod +x scripts/deploy_docker_to_remote.sh
#   SSH_KEY=/path/to/test-key-payroll.pem ./scripts/deploy_docker_to_remote.sh
#
# Optional environment:
#   REMOTE_HOST=44.203.216.201 REMOTE_USER=ubuntu REMOTE_DIR=/home/ubuntu/ifms-payroll
#   SKIP_FIRST_DEPLOY=1   — only build/up, skip first_deploy_apply_database.sh
#   RSYNC_DELETE=1        — rsync with --delete (use carefully)
#
# Requires: rsync, ssh, docker + compose on the remote host.
# =============================================================================
set -euo pipefail

REMOTE_HOST="${REMOTE_HOST:-44.203.216.201}"
REMOTE_USER="${REMOTE_USER:-ubuntu}"
REMOTE_DIR="${REMOTE_DIR:-/home/ubuntu/ifms-payroll}"
SSH_KEY="${SSH_KEY:?Set SSH_KEY to the path of your .pem file, e.g. SSH_KEY=~/keys/test-key-payroll.pem}"

ROOT="$(cd "$(dirname "${0}")/.." && pwd)"
cd "$ROOT"

if [[ ! -f "$SSH_KEY" ]]; then
  echo "ERROR: SSH_KEY file not found: $SSH_KEY" >&2
  exit 1
fi
chmod 600 "$SSH_KEY" 2>/dev/null || true

RSYNC_FLAGS=(-avz)
if [[ "${RSYNC_DELETE:-0}" == "1" ]]; then
  RSYNC_FLAGS+=(--delete)
fi

echo "==> Syncing $(basename "$ROOT") -> ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}/"
rsync "${RSYNC_FLAGS[@]}" \
  -e "ssh -i \"$SSH_KEY\" -o StrictHostKeyChecking=accept-new" \
  --exclude node_modules \
  --exclude frontend/node_modules \
  --exclude .git \
  --exclude __pycache__ \
  --exclude '*.pyc' \
  --exclude .env \
  --exclude 'db/dumps/*.sql' \
  "$ROOT/" "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}/"

echo "==> Running remote bootstrap..."
ssh -i "$SSH_KEY" -o StrictHostKeyChecking=accept-new "${REMOTE_USER}@${REMOTE_HOST}" \
  REMOTE_DIR="$REMOTE_DIR" SKIP_FIRST_DEPLOY="${SKIP_FIRST_DEPLOY:-0}" \
  bash <<'REMOTE'
set -euo pipefail
cd "$REMOTE_DIR"
if [[ ! -f .env ]]; then
  echo "==> No .env on server — copying from .env.example (edit secrets before production)"
  cp .env.example .env
fi
echo "==> docker compose up -d --build"
docker compose up -d --build
if [[ "${SKIP_FIRST_DEPLOY}" != "1" ]]; then
  chmod +x scripts/first_deploy_apply_database.sh
  ./scripts/first_deploy_apply_database.sh
else
  echo "==> SKIP_FIRST_DEPLOY=1 — not running first_deploy_apply_database.sh"
fi
echo "==> Done. docker compose ps:"
docker compose ps
REMOTE
