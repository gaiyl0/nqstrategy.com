# Nexus Quant Git 与 CI 操作手册

> 状态（2026-09-28）：本地 Git 与 GitHub Actions 工作流已经完成；当前仓库没有配置远程地址，因此远程仓库创建、首次推送和 GitHub 分支保护必须由项目所有者在自己的账户中完成。

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

## 创建远程仓库

在 GitHub 新建一个空的私有仓库，不要自动生成 README、许可证或 `.gitignore`。然后在项目目录执行：

```powershell
git remote add origin https://github.com/<你的账号>/<仓库名>.git
git remote -v
git push -u origin feature/p3-004-release-engineering
```

确认远程分支和 Actions 成功后，通过 Pull Request 合并到 `main`。不要把开发数据库、上传文件、备份或 `.env` 强制加入 Git；这些路径已经由 `.gitignore` 排除。

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
