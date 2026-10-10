#!/usr/bin/env bash
set -Eeuo pipefail
if [[ "$(id -u)" -ne 0 ]]; then echo "Root is required to install the service units." >&2; exit 2; fi
current=/opt/nexus-quant/current
test -f "$current/scripts/reconcile-recharges.mjs"
test -x /usr/bin/node
test -f /var/lock/nexus-quant-deploy.lock
install -m 0644 "$current/deploy/nexus-quant-recharges.service" /etc/systemd/system/nexus-quant-recharges.service
install -m 0644 "$current/deploy/nexus-quant-recharges.timer" /etc/systemd/system/nexus-quant-recharges.timer
systemctl daemon-reload
systemctl enable --now nexus-quant-recharges.timer
systemctl is-active --quiet nexus-quant-recharges.timer
echo "recharge_timer=active"
