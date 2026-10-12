#!/usr/bin/env python3
"""Keep Baidu file and homepage HTML verification accessible on www."""
import pathlib
import re
import shutil
import subprocess
import sys

filename = 'baidu_verify_codeva-bKfmaCfDKs.html'
source = pathlib.Path(sys.argv[1]).resolve(strict=True)
if source.name != filename or source.stat().st_size != 32:
    raise SystemExit('Unexpected verification file')
target = pathlib.Path('/var/www/nexus-quant-verification')
target.mkdir(mode=0o755, exist_ok=True)
shutil.copyfile(source, target / filename)
(target / filename).chmod(0o644)
configs = [p.resolve() for p in pathlib.Path('/etc/nginx/sites-enabled').iterdir()
           if p.is_file() and 'server_name www.nqstrategy.com;' in p.read_text()]
if len(configs) != 1:
    raise SystemExit('Expected one www configuration')
config = configs[0]
original = config.read_text()
marker = f'location = /{filename}'
if marker not in original:
    start = original.index('server_name www.nqstrategy.com;')
    redirect = '    return 301 https://nqstrategy.com$request_uri;'
    offset = original.index(redirect, start)
    replacement = f'''    location = /{filename} {{
        alias {target}/{filename};
        default_type text/html;
        add_header Cache-Control "no-store" always;
    }}
    location / {{
        return 301 https://nqstrategy.com$request_uri;
    }}'''
    updated = original[:offset] + replacement + original[offset + len(redirect):]
else:
    updated = original.replace(f'alias /var/lib/nexus-quant/site-verification/{filename};',
                               f'alias {target}/{filename};')
# HTML verification fetches the www homepage itself and rejects its 301.
# Reuse the canonical origin's proxy directives, including the private trust
# header, without writing credentials to source code or command output.
if 'location = / {' not in updated[updated.index('server_name www.nqstrategy.com;'):]:
    canonical_start = updated.index('server_name nqstrategy.com;')
    www_start = updated.index('server_name www.nqstrategy.com;')
    canonical_proxy = re.search(r'^    location / \{\n(.*?)^    \}',
                                updated[canonical_start:www_start], re.M | re.S)
    if not canonical_proxy or 'proxy_pass http://127.0.0.1:3000;' not in canonical_proxy.group(1):
        raise SystemExit('Expected canonical homepage proxy')
    homepage = '    location = / {\n' + canonical_proxy.group(1) + '    }\n'
    position = updated.index(marker, www_start)
    position = updated.rfind('\n', 0, position) + 1
    updated = updated[:position] + homepage + updated[position:]
if updated != original:
    backup = config.with_name(config.name + '.before-baidu-html-verification')
    if not backup.exists():
        shutil.copy2(config, backup)
    config.write_text(updated)
    try:
        subprocess.run(['nginx', '-t'], check=True)
        subprocess.run(['systemctl', 'reload', 'nginx'], check=True)
    except Exception:
        config.write_text(original)
        subprocess.run(['nginx', '-t'], check=True)
        subprocess.run(['systemctl', 'reload', 'nginx'], check=True)
        raise
print('www_verification_exception=installed')
