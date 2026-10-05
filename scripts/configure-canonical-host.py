#!/usr/bin/env python3
"""Apply the production canonical-host redirect without exposing proxy secrets.

Run with sudo on the production host. Existing application/download settings are
preserved; nginx validation and reload failure restore the original configuration.
"""
import datetime
import pathlib
import shutil
import subprocess

config = pathlib.Path('/etc/nginx/sites-available/nexus-quant')
original = config.read_text()
marker = 'server_name nqstrategy.com www.nqstrategy.com;'
if 'server_name www.nqstrategy.com;' in original and 'return 301 https://nqstrategy.com$request_uri;' in original:
    subprocess.run(['nginx', '-t'], check=True)
    print('Canonical-host redirect already configured.')
    raise SystemExit(0)
if original.count(marker) != 2 or original.count('proxy_pass http://127.0.0.1:3000;') != 1:
    raise SystemExit('Unexpected nginx layout; no changes made.')
boundary = original.find('}server {')
if boundary < 0:
    raise SystemExit('Unexpected server block boundary; no changes made.')
application = original[:boundary + 1].replace(marker, 'server_name nqstrategy.com;', 1)
redirects = '''

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name www.nqstrategy.com;
    ssl_certificate /etc/letsencrypt/live/nqstrategy.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/nqstrategy.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
    return 301 https://nqstrategy.com$request_uri;
}

server {
    listen 80;
    listen [::]:80;
    server_name nqstrategy.com www.nqstrategy.com;
    return 301 https://nqstrategy.com$request_uri;
}
'''
stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
backup = pathlib.Path('/var/backups/nexus-quant') / ('canonical-host-' + stamp)
backup.mkdir(parents=True, mode=0o700)
shutil.copy2(config, backup / 'nexus-quant.conf')
try:
    config.write_text(application + redirects)
    subprocess.run(['nginx', '-t'], check=True)
    subprocess.run(['systemctl', 'reload', 'nginx'], check=True)
except Exception:
    shutil.copy2(backup / 'nexus-quant.conf', config)
    subprocess.run(['nginx', '-t'], check=True)
    subprocess.run(['systemctl', 'reload', 'nginx'], check=True)
    raise
print('Canonical-host redirect enabled. Backup: ' + str(backup))
