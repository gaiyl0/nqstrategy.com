# Nexus Quant 服务器部署实例教程

> 适用范围：Ubuntu 24.04 LTS、单台 Linux 服务器、一个域名、Nginx、systemd、Node.js 24 LTS、SQLite。
> 当前应用只支持一个 Next.js 实例。不要部署到 Vercel、Serverless 或多台应用服务器。

本教程与 [PRODUCTION_RUNBOOK.md](PRODUCTION_RUNBOOK.md)、[DEPLOYMENT_SECURITY.md](DEPLOYMENT_SECURITY.md) 和 [GO_LIVE_CHECKLIST.md](GO_LIVE_CHECKLIST.md) 配合使用。完成本教程只代表服务器已部署；真实支付仍不得开启。

## 0. 准备清单

准备以下内容：

- 一台 Ubuntu 24.04 LTS 服务器，建议起步配置为 2 vCPU、4 GB 内存、60 GB SSD；
- 已备案或可解析的域名，例如 `nexusquant.example`；
- DNS A 记录指向服务器公网 IPv4；
- GitHub 仓库访问方式：部署密钥或只读访问令牌；
- 管理员可登录邮箱；
- 一台独立备份位置，例如对象存储或另一台服务器；
- 准备好全部生产密钥，绝不使用开发机的 `.env.local`。

公网只需要开放 TCP 22、80、443。应用端口 3000 只能监听本机回环地址。

## 1. 首次登录和系统基础加固

先以云厂商提供的管理员账号登录，然后创建专用运维账户：

```bash
sudo adduser deploy
sudo usermod -aG sudo deploy
```

将自己的 SSH 公钥加入 `/home/deploy/.ssh/authorized_keys` 后，新开一个终端确认能以 `deploy` 登录。确认后再在 `/etc/ssh/sshd_config.d/99-nexus.conf` 设置：

```text
PermitRootLogin no
PasswordAuthentication no
```

检查无误后执行：

```bash
sudo systemctl reload ssh
sudo apt update
sudo apt -y upgrade
sudo apt install -y nginx ufw curl git ca-certificates build-essential
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status verbose
```

不要在尚未验证 SSH 密钥登录前关闭密码登录。

## 2. 安装 Node.js 和创建运行用户

使用 NodeSource 或团队批准的 Node.js 24 LTS 安装源安装 Node。确认版本后创建不能 SSH 登录的应用用户：

```bash
node --version
npm --version
sudo useradd --system --home /var/lib/nexus-quant --create-home --shell /usr/sbin/nologin nexus
sudo install -d -o nexus -g nexus -m 0750 /var/lib/nexus-quant
sudo install -d -o nexus -g nexus -m 0750 /var/lib/nexus-quant/storage
sudo install -d -o nexus -g nexus -m 0750 /var/lib/nexus-quant/public/uploads
sudo install -d -o nexus -g nexus -m 0700 /var/lib/nexus-quant/audit-archives
sudo install -d -o nexus -g nexus -m 0700 /var/backups/nexus-quant
sudo install -d -o root -g nexus -m 0750 /opt/nexus-quant/releases
```

`/var/lib/nexus-quant` 保存数据库、WAL/SHM、私有 EA、证据、报告和审计归档。不要把这些文件放在 Git 工作区或 Nginx 的公开目录。

## 3. 获取代码和安装依赖

以下命令以仓库 `https://github.com/gaiyl0/eashop.git` 为例。生产应固定到已审核的提交 SHA，不应直接部署任意工作区改动。

```bash
sudo mkdir -p /opt/nexus-quant/releases
sudo chown -R deploy:deploy /opt/nexus-quant
sudo -u deploy git clone https://github.com/gaiyl0/eashop.git /opt/nexus-quant/releases/initial
cd /opt/nexus-quant/releases/initial
sudo -u deploy git checkout <已审核的提交SHA>
sudo -u deploy npm ci
```

后续发布创建新目录，例如 `/opt/nexus-quant/releases/<commit-sha>`，构建成功后才更新 `current` 软链接：

```bash
sudo ln -sfn /opt/nexus-quant/releases/initial /opt/nexus-quant/current
```

## 4. 创建生产环境文件和密钥

复制仓库 `.env.example` 的字段到 `/etc/nexus-quant/nexus.env`。这个文件只允许 root 读取：

```bash
sudo install -d -m 0750 /etc/nexus-quant
sudo touch /etc/nexus-quant/nexus.env
sudo chown root:nexus /etc/nexus-quant/nexus.env
sudo chmod 0640 /etc/nexus-quant/nexus.env
sudo -e /etc/nexus-quant/nexus.env
```

至少填写如下内容，并为每个 secret 单独生成 48 字节随机值：

```dotenv
NODE_ENV=production
PORT=3000
NEXUS_DB_PATH=/var/lib/nexus-quant/data.db
NEXUS_STORAGE_ROOT=/var/lib/nexus-quant/storage
NEXUS_EVIDENCE_ROOT=/var/lib/nexus-quant/storage/evidence
NEXUS_REPORT_ROOT=/var/lib/nexus-quant/storage/reports
AUDIT_ARCHIVE_DIR=/var/lib/nexus-quant/audit-archives
NEXUS_BACKUP_ROOT=/var/backups/nexus-quant

APP_ORIGINS=https://nexusquant.example
NEXT_PUBLIC_SITE_URL=https://nexusquant.example
TRUSTED_PROXY_MODE=nginx
TRUSTED_PROXY_SHARED_SECRET=<随机值>
RATE_LIMIT_BACKEND=sqlite
DEPLOYMENT_TOPOLOGY=single-instance

JWT_SECRET=<随机值>
AUDIT_HASH_SECRET=<随机值>
AUDIT_INTEGRITY_SECRET=<随机值>
VERIFICATION_CODE_SECRET=<随机值>
LEDGER_INTEGRITY_SECRET=<随机值>
LICENSE_SIGNING_SECRET=<随机值>
LICENSE_BINDING_SECRET=<随机值>

UPLOAD_SCAN_URL=<外部恶意文件扫描服务地址>
UPLOAD_SCAN_TOKEN=<扫描服务令牌>
EVIDENCE_OCR_URL=<OCR 服务地址或留空并使用人工审核>
EVIDENCE_OCR_TOKEN=<OCR 服务令牌>
NEXUS_AUTO_MIGRATE=0
```

生成随机值的命令：

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

支付配置现在不要加入启用值。`PAYMENTS_ENABLED` 保持 `0`，钱包私钥、助记词和服务商密钥也不能写入该服务器应用进程；未来支付服务应使用服务商托管能力或独立受控签名服务。

## 5. 迁移、验证和构建

以应用用户运行迁移和构建；执行前先备份。先创建仅 root 可写、应用用户可执行的部署辅助脚本 `/usr/local/sbin/nexus-run`：

```bash
sudo tee /usr/local/sbin/nexus-run >/dev/null <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
set -a
. /etc/nexus-quant/nexus.env
set +a
cd /opt/nexus-quant/current
exec runuser -u nexus -- "$@"
EOF
sudo chown root:root /usr/local/sbin/nexus-run
sudo chmod 0750 /usr/local/sbin/nexus-run
```

然后执行：

```bash
sudo /usr/local/sbin/nexus-run npm run db:migrate -- status
sudo /usr/local/sbin/nexus-run npm run backup:create -- /var/backups/nexus-quant/predeploy-initial
sudo /usr/local/sbin/nexus-run npm run db:migrate -- up
sudo /usr/local/sbin/nexus-run npm run db:migrate -- verify
sudo /usr/local/sbin/nexus-run npm run lint
sudo /usr/local/sbin/nexus-run npm run test:all
sudo /usr/local/sbin/nexus-run npm run build
```

辅助脚本只接收要执行的命令，不打印环境变量，也不会把 Secret 拼接到命令行参数中。不要在 shell 里使用 `cat /etc/nexus-quant/nexus.env | xargs`，那会把密钥暴露给进程参数和排障输出。

## 6. 配置 systemd

创建 `/etc/systemd/system/nexus-quant.service`：

```ini
[Unit]
Description=Nexus Quant Next.js service
After=network.target

[Service]
Type=simple
User=nexus
Group=nexus
WorkingDirectory=/opt/nexus-quant/current
EnvironmentFile=/etc/nexus-quant/nexus.env
Environment=HOSTNAME=127.0.0.1
ExecStart=/usr/bin/npm start
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/lib/nexus-quant /var/backups/nexus-quant
ReadWritePaths=/opt/nexus-quant/current/.next/cache
UMask=0077

[Install]
WantedBy=multi-user.target
```

启用并检查：

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now nexus-quant
sudo systemctl status nexus-quant --no-pager
curl --fail --silent --show-error http://127.0.0.1:3000/api/health
```

如服务无法启动，使用 `sudo journalctl -u nexus-quant -n 200 --no-pager` 查看错误。不要把完整 `.env` 内容粘贴进工单、聊天或日志。

## 7. 配置 Nginx

创建 `/etc/nginx/sites-available/nexus-quant`，把域名和代理共享密钥替换为实际值：

```nginx
server {
    listen 80;
    server_name nexusquant.example www.nexusquant.example;
    client_max_body_size 12m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For "";
        proxy_set_header X-Nexus-Proxy-Secret "<同一随机值>";
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
        proxy_send_timeout 60s;
    }
}
```

启用站点并检查：

```bash
sudo ln -s /etc/nginx/sites-available/nexus-quant /etc/nginx/sites-enabled/nexus-quant
sudo nginx -t
sudo systemctl reload nginx
```

确认云厂商安全组和 UFW 都没有开放 TCP 3000。使用外部端口检测工具确认 3000 不可达。

## 8. 申请 HTTPS 证书

DNS 生效后使用 Certbot：

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d nexusquant.example -d www.nexusquant.example
sudo systemctl status certbot.timer --no-pager
```

Certbot 会创建 HTTPS 配置和续期任务。之后必须用 HTTPS 域名复测：

```bash
curl --fail --silent --show-error https://nexusquant.example/api/health
```

## 9. 定时维护、备份与监控

为 `nexus` 用户创建受控的 systemd timer 或由 root 调度的脚本，至少运行：

- 每小时 `npm run upload:cleanup`；
- 每日 `npm run audit:verify`、`npm run ledger:verify`；
- 每日 `npm run backup:create`，随后加密并复制到独立位置；
- 每周 `npm run backup:verify`；
- 每月在独立目录执行 `npm run backup:drill`；
- 每分钟从外部和本机检查 `/api/health`。

必须告警的事件：服务重启、连续两次健康检查失败、审计或账本校验失败、24 小时无成功备份、磁盘超过 70%、TLS 即将到期、恶意文件扫描/OCR/SMTP 故障，以及检测到第二个应用实例。

## 10. 首次上线验收

按 [GO_LIVE_CHECKLIST.md](GO_LIVE_CHECKLIST.md) 的“免费模式上线条件”逐项核对。至少测试：注册、登录、改密、免费策略、试用、下载、许可证绑定、上传、社区附件、管理员审计、拒绝来源、备份恢复和移动端。

确认以下事实后才允许对外公布：

1. `/api/health` 在 HTTPS 入口稳定返回 ready；
2. 3000 端口不对公网开放；
3. 生产环境有真实的文件扫描服务；
4. 审计、账本和备份校验成功；
5. 付费按钮和付费订单仍明确显示不可用；
6. 管理员、用户和访客权限边界均通过实际浏览器复测。

真实支付上线必须另行完成 [REAL_PAYMENT_INTEGRATION.md](REAL_PAYMENT_INTEGRATION.md) 的 PAY-001 至 PAY-009，不能通过服务器部署或前端改动绕过。
