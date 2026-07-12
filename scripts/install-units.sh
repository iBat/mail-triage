#!/usr/bin/env bash
# Render and install the systemd units. Run on the server, from the repo root.
# Re-run after changing anything under deploy/.
set -euo pipefail

node_bin="$(command -v node)"
sed -e "s|@USER@|$(id -un)|g" -e "s|@DIR@|$PWD|g" -e "s|@NODE@|$node_bin|g" \
  deploy/mail-triage.service.tmpl | sudo tee /etc/systemd/system/mail-triage.service >/dev/null
sudo cp deploy/mail-triage.timer /etc/systemd/system/mail-triage.timer
sudo systemctl daemon-reload
systemd-analyze calendar --iterations=3 "$(grep '^OnCalendar=' deploy/mail-triage.timer | cut -d= -f2-)"
echo "Installed. Enable with: sudo systemctl enable --now mail-triage.timer"
