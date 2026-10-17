#!/usr/bin/env bash
set -euo pipefail
[[ "$(id -u)" == 0 ]] || { echo 'Run as root' >&2; exit 1; }
node_bin="$(command -v node)"
[[ "$node_bin" =~ ^/[A-Za-z0-9/._-]+$ ]] || exit 1
cat > /etc/systemd/system/nexus-referral-rewards.service <<EOF
[Unit]
Description=Nexus Quant invitation reward settlement
After=network.target
[Service]
Type=oneshot
User=nexus
Group=nexus
WorkingDirectory=/opt/nexus-quant/current
EnvironmentFile=/etc/nexus-quant/nexus.env
Environment=NODE_ENV=production
ExecStart=/bin/bash -c 'exec 9</var/lock/nexus-quant-deploy.lock; flock -s -n 9 || exit 0; exec $node_bin scripts/settle-referrals.mjs'
NoNewPrivileges=true
PrivateTmp=true
UMask=0077
TimeoutStartSec=120
EOF
cat > /etc/systemd/system/nexus-referral-rewards.timer <<'EOF'
[Unit]
Description=Settle eligible invitation rewards every five minutes
[Timer]
OnBootSec=3min
OnUnitActiveSec=5min
Persistent=true
[Install]
WantedBy=timers.target
EOF
systemctl daemon-reload
systemctl enable --now nexus-referral-rewards.timer
