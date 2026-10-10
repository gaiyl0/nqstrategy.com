#!/usr/bin/env bash
set -Eeuo pipefail

release_id="${1:-}"
archive="${2:-}"
public_origin="${3:-}"

if [[ ! "$release_id" =~ ^[0-9a-f]{12}$ ]]; then echo "Invalid release id" >&2; exit 2; fi
if [[ "$archive" != "/tmp/nexus-quant-$release_id.tar.gz" || ! -f "$archive" ]]; then echo "Release archive is missing" >&2; exit 2; fi
if [[ ! "$public_origin" =~ ^https://[A-Za-z0-9.-]+(:[0-9]+)?$ ]]; then echo "Invalid public origin" >&2; exit 2; fi
if [[ "$(id -u)" -ne 0 ]]; then echo "This runner must execute as root" >&2; exit 2; fi

exec 9>/var/lock/nexus-quant-deploy.lock
if ! flock -w 120 9; then echo "Deployment or reconciliation lock remained busy" >&2; exit 3; fi

release_root="/opt/nexus-quant/releases"
release_dir="$release_root/$release_id"
current_link="/opt/nexus-quant/current"
environment_file="/etc/nexus-quant/nexus.env"
runtime_root="/var/lib/nexus-quant"
backup_dir="/var/backups/nexus-quant/predeploy-$release_id"
old_release="$(readlink -f "$current_link" 2>/dev/null || true)"
switched=0
backup_created=0
downtime_started=0

run_as_nexus() {
  local command="$1"
  runuser -u nexus -- bash -c "set -a; source '$environment_file'; set +a; cd '$release_dir'; $command"
}

rollback() {
  local exit_code=$?
  trap - ERR
  echo "Deployment failed; restoring the previous release." >&2
  if [[ "$downtime_started" -eq 1 ]]; then
    systemctl stop nexus-quant || true
    if [[ "$backup_created" -eq 1 && -f "$backup_dir/database/data.db" ]]; then
      install -o nexus -g nexus -m 0600 "$backup_dir/database/data.db" "$runtime_root/data.db"
      rm -f "$runtime_root/data.db-wal" "$runtime_root/data.db-shm"
    fi
    if [[ -n "$old_release" && -d "$old_release" ]]; then
      ln -sfn "$old_release" "$current_link"
      systemctl start nexus-quant || true
    fi
  fi
  exit "$exit_code"
}
trap rollback ERR

if [[ -e "$release_dir" ]]; then echo "Release already exists: $release_dir" >&2; exit 4; fi
install -d -o nexus -g nexus -m 0750 "$release_dir"
tar --extract --gzip --file "$archive" --directory "$release_dir" --no-same-owner
chown -R nexus:nexus "$release_dir"

run_as_nexus "npm ci --include=dev"
# Next loads database modules during build. Use a separate database so schema
# changes cannot run against the live database before its backup is captured.
run_as_nexus "NEXUS_DB_PATH='$release_dir/.build-data.db' NEXUS_AUTO_MIGRATE=1 DEPLOYMENT_VERSION='$release_id' npm run build"
rm -f "$release_dir/.build-data.db" "$release_dir/.build-data.db-wal" "$release_dir/.build-data.db-shm"
run_as_nexus "npm prune --omit=dev"

if [[ -d "$runtime_root/public/uploads" ]]; then
  chown -R nexus:nexus "$runtime_root/public/uploads"
  chmod 0700 "$runtime_root/public" "$runtime_root/public/uploads"
  install -d -o nexus -g nexus -m 0700 "$release_dir/public/uploads"
  cp -a "$runtime_root/public/uploads/." "$release_dir/public/uploads/"
  chown -R nexus:nexus "$release_dir/public/uploads"
fi
ln -s "$runtime_root/storage" "$release_dir/storage"
chown -h nexus:nexus "$release_dir/storage"

run_as_nexus "npm run db:migrate -- status"
if [[ -e "$backup_dir" ]]; then echo "Backup destination already exists: $backup_dir" >&2; exit 4; fi
if [[ -n "$old_release" && -d "$old_release" ]]; then
  # The previous release validates its own schema, including before an upgrade.
  runuser -u nexus -- bash -c "set -a; source '$environment_file'; set +a; cd '$old_release'; npm run backup:create -- '$backup_dir'"
else
  run_as_nexus "npm run backup:create -- '$backup_dir'"
fi
backup_created=1

downtime_started=1
systemctl stop nexus-quant
run_as_nexus "npm run db:migrate -- up"
run_as_nexus "npm run db:migrate -- verify"
run_as_nexus "npm run audit:verify"
run_as_nexus "npm run ledger:verify"
run_as_nexus "npm run points:verify"

ln -sfn "$release_dir" "$current_link"
switched=1
systemctl start nexus-quant

ready=0
for _ in {1..15}; do
  if curl --fail --silent --show-error http://127.0.0.1:3000/api/health | grep -q '"status":"ready"'; then ready=1; break; fi
  sleep 2
done
if [[ "$ready" -ne 1 ]]; then echo "Local health check failed" >&2; false; fi

reports_headers="$(mktemp)"
reports_body="$(mktemp)"
reports_status="$(curl --silent --show-error --dump-header "$reports_headers" --output "$reports_body" --write-out '%{http_code}' 'http://127.0.0.1:3000/api/reports?status=pending')"
if [[ "$reports_status" != "401" ]] || ! grep -qi '^content-type: application/json' "$reports_headers" || ! grep -q '仅管理员可查看举报' "$reports_body"; then
  echo "Reports API smoke test failed" >&2
  rm -f "$reports_headers" "$reports_body"
  false
fi
rm -f "$reports_headers" "$reports_body"

curl --fail --silent --show-error --output /dev/null "$public_origin/"
curl --fail --silent --show-error --output /dev/null "$public_origin/tianwei"
curl --fail --silent --show-error "$public_origin/api/health" | grep -q '"status":"ready"'
systemctl is-active --quiet nexus-quant

trap - ERR
rm -f "$archive" "$0"
echo "release=$release_id"
echo "previous=${old_release:-none}"
echo "backup=$backup_dir"
echo "status=ready"

