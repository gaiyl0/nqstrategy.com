#!/usr/bin/env bash
set -Eeuo pipefail
if [[ "$(id -u)" -ne 0 ]]; then echo "Root is required." >&2; exit 2; fi
current=/opt/nexus-quant/current
test -f "$current/scripts/submit-search.mjs"
test -x /usr/bin/node
test -f /var/lock/nexus-quant-deploy.lock
install -m 0644 "$current/deploy/nexus-quant-search.service" /etc/systemd/system/nexus-quant-search.service
install -m 0644 "$current/deploy/nexus-quant-search.timer" /etc/systemd/system/nexus-quant-search.timer
systemctl daemon-reload
systemctl enable --now nexus-quant-search.timer
systemctl is-active --quiet nexus-quant-search.timer
echo "search_timer=active"
