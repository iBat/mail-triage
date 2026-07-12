#!/usr/bin/env bash
# Usage: scripts/deploy.sh [ssh-host]     (env overrides: DEPLOY_HOST, DEPLOY_DIR)
set -euo pipefail

host="${1:-${DEPLOY_HOST:-vpn}}"
dir="${DEPLOY_DIR:-mail-triage}"
git push
ssh "$host" "cd \"\$HOME/$dir\" && git pull --ff-only && npm ci --no-audit --no-fund"
echo "Deployed to $host:~/$dir"
