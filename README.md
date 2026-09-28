# Nexus Quant

Nexus Quant 是面向 EA 策略发布、审核、试用、授权、社区和开发者资产管理的 Next.js 16 应用。

> **当前发布结论：** 代码可以继续用于开发、测试和免费模式部署准备；真实付费能力已主动关闭，未经支付任务组实现与重新验收，不得承载真实资金。任务状态和执行顺序以 [NEXUS_QUANT_UPDATE_LOG.md](NEXUS_QUANT_UPDATE_LOG.md) 为唯一来源，发布判定以 [GO_LIVE_CHECKLIST.md](GO_LIVE_CHECKLIST.md) 为准。

## 当前状态

| 分类 | 状态 | 说明 |
|---|---|---|
| P0 安全封堵 | 已完成 | Session、RBAC、密码、文件、订单、提现、稳定用户身份和幂等边界已完成 |
| P1 服务端安全 | 已完成 | 校验、限流、签名审计、上传、CSRF、账本、迁移、Schema、前端 API 和错误隔离已完成 |
| P2 产品能力 | 已完成代码验收 | 策略指标、MT5 证据、认证、版本、试用、对比、社交、市场和 SEO 已实现；外部 OCR、EA 客户端及生产性能仍需现场联调 |
| P3 工程优化 | 进行中 | P3-001 至 P3-003 已完成；CI、远程 Git、备份恢复和部署文档仍按更新日志执行 |
| 真实付费 | 禁止上线 | Payment Intent、可信到账核验、佣金/退款/链重组账本与生产签字尚未完成 |

## 技术与部署边界

- Next.js 16.3.5、React 19、SQLite、better-sqlite3、Tailwind CSS；
- 当前只支持一个 Next.js 实例和一个本地 SQLite 数据库；
- 公网入口必须经过受信反向代理，源站端口不得直接暴露；
- 当前不支持 Vercel、无共享磁盘 Serverless 或多实例部署；
- 私有 EA、MT5 报告、证据、数据库、审计密钥和账本密钥必须作为同一恢复体系管理。

部署拓扑和代理配置见 [DEPLOYMENT_SECURITY.md](DEPLOYMENT_SECURITY.md)。

## 本地开发

1. 安装 Node.js 和项目依赖：

```powershell
npm install
```

2. 复制环境变量模板：

```powershell
Copy-Item .env.example .env.local
```

3. 至少设置一个 32 字符以上的开发 `JWT_SECRET`。生产环境还必须逐项配置 `.env.example` 中的代理、Origin、审计、账本、授权和上传扫描变量。

4. 检查并应用数据库迁移：

```powershell
npm run db:migrate -- status
npm run db:migrate -- up
npm run db:migrate -- verify
```

5. 启动开发服务：

```powershell
npm run dev
```

浏览器访问 [http://localhost:3000](http://localhost:3000)。

## 验证命令

```powershell
npm run lint
npm run build
npm run db:migrate -- verify
npm run audit:verify
npm run ledger:verify
```

全部 `test:*` 脚本都应在发布前执行。P3-001 已将全仓 ESLint 清零；后续修改仍必须同时保持 `npm run lint`、生产构建和相关回归测试通过。

## 安全与运维文档

| 文档 | 代码状态 | 生产现场状态 |
|---|---|---|
| [DEPLOYMENT_SECURITY.md](DEPLOYMENT_SECURITY.md) | 代理信任和单实例限制已实现 | 反向代理、防火墙、HTTPS、源站隔离待部署验证 |
| [CSRF_SECURITY.md](CSRF_SECURITY.md) | Origin、CORS 和自动化边界已实现 | 真实域名、代理头和跨域行为待部署验证 |
| [UPLOAD_SECURITY.md](UPLOAD_SECURITY.md) | 文件类型、配额、私有存储和失败关闭已实现 | 外部恶意文件扫描、告警和定时清理待部署验证 |
| [AUDIT_INTEGRITY.md](AUDIT_INTEGRITY.md) | HMAC 链、写保护、校验和归档已实现 | 外部不可变副本、轮换和恢复演练待完成 |
| [DATABASE_MIGRATIONS.md](DATABASE_MIGRATIONS.md) | 迁移、校验和、备份前置与并发锁已实现 | 生产副本迁移和回滚演练待完成 |
| [WALLET_LEDGER.md](WALLET_LEDGER.md) | 管理调账和提现账本已实现 | 真实支付、佣金、退款和链重组流水未实现 |
| [GO_LIVE_CHECKLIST.md](GO_LIVE_CHECKLIST.md) | 发布证据总入口 | 尚未签署正式上线结论 |
| [GIT_CI.md](GIT_CI.md) | CI 和远程仓库操作 | 代码已完成，远程仓库与规则待账户侧配置 |
| [PRODUCTION_RUNBOOK.md](PRODUCTION_RUNBOOK.md) | 单实例部署、健康检查和监控 | 目标服务器待现场执行 |
| [BACKUP_RECOVERY.md](BACKUP_RECOVERY.md) | 一致性备份和恢复 | 本机演练通过，异地加密和生产演练待执行 |
| [REAL_PAYMENT_INTEGRATION.md](REAL_PAYMENT_INTEGRATION.md) | 真实支付实施教程 | 教程已完成，支付代码未启动 |

## 发布原则

免费模式可以在付费入口继续关闭的前提下准备部署，但仍须完成上线清单中的生产配置与现场验证。付费模式必须完成真实支付任务组，不能通过修改前端按钮、订单状态或功能开关绕过服务端支付验收。
