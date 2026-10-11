#!/usr/bin/env python3
"""Keep this exact Baidu verification URL accessible without removing canonical redirects."""
import pathlib
import shutil
import subprocess
import sys

filename = 'baidu_verify_codeva-bKfmaCfDKs.html'
source = pathlib.Path(sys.argv[1]).resolve(strict=True)
if source.name != filename or source.stat().st_size != 32:
    raise SystemExit('Unexpected verification file')
target = pathlib.Path('/var/lib/nexus-quant/site-verification')
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
    backup = config.with_name(config.name + '.before-baidu-verification')
    if not backup.exists():
        shutil.copy2(config, backup)
    config.write_text(original[:offset] + replacement + original[offset + len(redirect):])
    try:
        subprocess.run(['nginx', '-t'], check=True)
        subprocess.run(['systemctl', 'reload', 'nginx'], check=True)
    except Exception:
        config.write_text(original)
        subprocess.run(['nginx', '-t'], check=True)
        subprocess.run(['systemctl', 'reload', 'nginx'], check=True)
        raise
print('www_verification_exception=installed')
