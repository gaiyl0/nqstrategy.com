# Nexus Quant Git 与 CI 操作手册

> 状态（2026-09-30）：本地 Git、GitHub Actions 工作流和生产远端均已配置。正式仓库为 `https://github.com/gaiyl0/nqstrategy.com`，生产代码使用 `main`。

## 本地 CI

```powershell
npm ci
$env:NEXUS_DB_PATH = "$PWD/.tmp-ci.db"
$env:NODE_ENV = "development"
npm run db:migrate -- up
npm run lint
npm run test:all
npm run db:migrate -- verify
```

生产构建还需要 `.env.example` 中列出的生产必需变量。仓库内 `.github/workflows/ci.yml` 已提供隔离测试值并执行迁移、lint、全部测试、数据库校验和生产构建。

## 远程仓库

检查当前正式远端：

```powershell
git remote -v
git fetch origin main
git rev-parse HEAD
git rev-parse origin/main
```

两个提交哈希必须一致才允许生产部署。不要把开发数据库、上传文件、备份或 `.env` 强制加入 Git；这些路径已经由 `.gitignore` 排除。

## 一键生产发布

Windows 本地工作区干净且已推送 `origin/main` 后运行：

```powershell
npm run deploy:production
```

仅检查 Git、SSH、远端一致性、ESLint 和全部测试，不发布：

```powershell
npm run deploy:production -- -DryRun
```

脚本从当前 Git 提交生成归档，不读取或上传忽略文件；服务器为该提交建立不可变 release，完成构建、在线备份、迁移、审计与账本校验后才切换 `current`。切换或健康检查失败时恢复发布前数据库和旧 release。`-SkipTests` 只用于已由同一提交 CI 验证的紧急恢复发布，日常发布禁止使用。

## `main` 分支保护

GitHub 仓库 Settings → Branches 或 Rules → 新建针对 `main` 的规则：

1. 要求通过 Pull Request 合并；
2. 至少一名审批者；
3. 要求解决全部 review 对话；
4. 要求分支在合并前保持最新；
5. 把 Actions 的 `verify` 设为 required status check；
6. 禁止 force push；
7. 禁止删除 `main`；
8. 管理员也遵守规则；
9. 如启用 Merge Queue，保留工作流中的 `merge_group` 触发器。

完成首次远程 CI 后，把远程 URL、规则截图、成功运行 URL和日期写入发布证据。当前本地没有远程 URL，因此不能把本文件当作远程配置已完成的证明。

## Secret 规则

CI 只使用无业务价值的隔离测试密钥。生产 Secret 只能进入主机 Secret 文件、systemd credentials 或专用 Secret Manager，不能进入：

- Git 文件或历史；
- GitHub Actions 日志；
- Dockerfile/镜像层；
- 普通 ZIP、数据库备份或工单；
- 浏览器环境变量；
- `NEXT_PUBLIC_*`（站点公开 URL 除外）。

若 Secret 曾进入 Git，不要只删除当前文件；必须立即轮换 Secret，再按泄露处理 Git 历史。
