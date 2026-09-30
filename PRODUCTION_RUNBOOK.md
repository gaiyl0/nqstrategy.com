# Nexus Quant 生产部署与监控手册

> 支持拓扑：一个受信 Nginx 入口、一个 Next.js 进程、一个本地 SQLite 数据库。当前不支持多实例、自动扩容或 Serverless。

## 目录建议

```text
/opt/nexus-quant/releases/<git-sha>   只读代码与构建产物
/var/lib/nexus-quant/data.db          数据库
/var/lib/nexus-quant/storage          私有 EA、证据、报告与审计归档
/var/lib/nexus-quant/public/uploads   公开头像和产品 Logo
/etc/nexus-quant/nexus.env            0600，生产 Secret
/var/backups/nexus-quant              临时备份工作区
```

运行用户应为无登录权限的专用 `nexus` 用户。数据库、存储和环境文件不得由 Nginx 用户或其他普通用户写入。

## 发布顺序

日常发布由 Windows 项目根目录的一键命令执行：

```powershell
npm run deploy:production
```

以下顺序是脚本强制执行的验收基线，也是人工排障时的核对清单：

1. 从受保护的 `main` 签出确定的提交 SHA；
2. `npm ci --omit=dev=false`；
3. 设置 `NEXUS_DB_PATH` 和全部生产环境变量；
4. 停止写流量或进入维护模式；
5. `npm run backup:create -- /var/backups/nexus-quant/predeploy-<sha>`；
6. 加密并复制备份到异地主机/对象锁存储；
7. `npm run db:migrate -- status`；
8. `npm run db:migrate -- up`；
9. `npm run db:migrate -- verify`；
10. `npm run lint && npm run test:all && npm run build`；
11. 以 systemd 启动唯一一个 `npm start` 实例；
12. 访问 `http://127.0.0.1:3000/api/health`，要求 HTTP 200 和 `status=ready`；
13. 通过 HTTPS 公网入口复测健康、登录、免费订单、下载、许可证和管理员审计；
14. 恢复流量并保留上一个 release 与其匹配备份。

## systemd 要点

服务必须设置：

```ini
User=nexus
Group=nexus
WorkingDirectory=/opt/nexus-quant/current
EnvironmentFile=/etc/nexus-quant/nexus.env
ExecStart=/usr/bin/npm start
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ReadWritePaths=/var/lib/nexus-quant
```

确保 `NEXUS_DB_PATH`、`NEXUS_STORAGE_ROOT`、`NEXUS_EVIDENCE_ROOT`、`NEXUS_REPORT_ROOT` 和 `AUDIT_ARCHIVE_DIR` 与可写目录一致。更改 systemd 沙箱项后先在预发布机验证上传、下载、审计归档和备份。

## Nginx 与防火墙

沿用 `DEPLOYMENT_SECURITY.md` 的共享密钥配置。公网只开放 80/443，3000 只允许本机回环访问；Nginx 必须覆盖客户端来源头并注入 `X-Nexus-Proxy-Secret`。配置 TLS 1.2/1.3、自动续期证书、请求体上限和合理超时。

## 监控与告警

每 60 秒从主机本地和外部监控各请求一次：

```bash
curl --fail --silent --show-error https://example.com/api/health
```

还需监控：

- systemd 服务状态、重启次数和 5xx 比率；
- 登录、验证码、上传、订单、提现限流与安全审计失败率；
- `audit:verify`、`ledger:verify`、`db:migrate -- verify` 的退出码；
- 数据库、WAL、私有存储和备份盘使用率；
- 最近一次成功备份、异地复制和恢复演练时间；
- TLS 证书剩余天数；
- 上传恶意文件扫描与 OCR 服务可用性；
- SMTP 投递失败率；
- 单实例约束，发现第二个应用进程立即告警。

建议阈值：磁盘 70% 告警、85% 紧急；连续两次健康检查失败告警；24 小时无成功备份紧急；审计或账本校验一次失败立即停止资金相关操作。

## 故障回退

停止流量和应用，保存故障数据库/WAL/SHM作为调查材料。只恢复经过 `backup:verify` 的备份，并部署与该数据库迁移版本匹配的代码。恢复后执行 `db:migrate -- verify`、`ledger:verify`、`audit:verify` 和关键业务冒烟，再恢复流量。
