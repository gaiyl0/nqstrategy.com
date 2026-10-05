#!/usr/bin/env python3
"""Trust Cloudflare's published CIDRs only; never trust arbitrary client headers."""
import datetime
import ipaddress
import json
import pathlib
import shutil
import subprocess
import urllib.request

networks = []
request = urllib.request.Request('https://api.cloudflare.com/client/v4/ips', headers={'User-Agent': 'NexusQuantMaintenance/1.0'})
with urllib.request.urlopen(request, timeout=15) as response:
    published = json.loads(response.read(65536))
if published.get('success') is not True:
    raise SystemExit('Cloudflare IP API failed; no configuration changed.')
for family, minimum in [('v4', 10), ('v6', 5)]:
    values = published['result']['ipv' + family[1] + '_cidrs']
    checked = [ipaddress.ip_network(value.strip(), strict=True) for value in values if value.strip()]
    expected = 4 if family == 'v4' else 6
    if len(checked) < minimum or any(n.version != expected or n.prefixlen == 0 or not n.network_address.is_global for n in checked):
        raise SystemExit('Unexpected Cloudflare CIDR data; no configuration changed.')
    networks.extend(checked)
stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
config = pathlib.Path('/etc/nginx/conf.d/nexus-cloudflare-realip.conf')
backup = pathlib.Path('/var/backups/nexus-quant') / ('cloudflare-realip-' + stamp)
backup.mkdir(parents=True, mode=0o700)
existed = config.exists()
if existed:
    shutil.copy2(config, backup / config.name)
try:
    text = '# Official Cloudflare ranges, refreshed ' + stamp + '\n'
    text += '\n'.join('set_real_ip_from ' + str(n) + ';' for n in networks)
    text += '\nreal_ip_header CF-Connecting-IP;\nreal_ip_recursive on;\n'
    config.write_text(text)
    subprocess.run(['nginx', '-t'], check=True)
    subprocess.run(['systemctl', 'reload', 'nginx'], check=True)
except Exception:
    if existed:
        shutil.copy2(backup / config.name, config)
    else:
        config.unlink(missing_ok=True)
    subprocess.run(['nginx', '-t'], check=True)
    subprocess.run(['systemctl', 'reload', 'nginx'], check=True)
    raise
print('Cloudflare trusted-source restoration enabled for ' + str(len(networks)) + ' CIDRs. Backup: ' + str(backup))
