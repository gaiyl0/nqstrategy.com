# Nexus Quant 备份与恢复手册

> 状态（2026-09-28）：一致性备份、清单哈希、隔离恢复和数据库/账本/审计校验已经完成一次本机演练。生产异地加密副本、定时任务、保留策略和目标服务器演练仍需现场配置。

## 备份内容

`npm run backup:create` 使用 SQLite 在线备份 API生成一致数据库副本，并收集：

- `data.db`（WAL 已合并进一致副本）；
- `storage/private` 下的 EA、MT5 证据和报告；
- `public/uploads` 下的头像和产品 Logo；
- `storage/audit-archives`；
- 每个文件的大小和 SHA-256 清单。

Secret 被刻意排除。JWT、审计、账本、许可证和代理密钥必须单独保存在 Secret Manager；恢复时使用原密钥，否则 Session 应失效，审计与账本签名校验也会失败。

## 命令

```powershell
npm run backup:create
npm run backup:verify -- C:\path\to\bundle
npm run backup:restore -- C:\path\to\bundle C:\empty\restore-target
npm run backup:drill
```

恢复命令拒绝覆盖非空目录，拒绝软链接、父目录穿越、缺失文件、大小变化、SHA-256 不符、SQLite `quick_check` 失败、外键违规或迁移历史不匹配。

## 加密和异地复制

备份 bundle 是明文暂存区，不能长期留在应用主机。生产作业必须：

1. 创建 bundle；
2. 使用独立备份工具进行客户端加密，例如 restic 仓库；
3. 复制到不同故障域的对象存储，优先启用版本控制和对象锁；
4. 验证远端快照；
5. 删除本机明文 bundle；
6. 记录快照 ID、数据库时间点、文件数、总大小和校验结果。

备份仓库密码和云存储凭据不能与备份放在一起。推荐至少每日备份，保留 7 个日备份、5 个周备份和 12 个每月备份，并根据真实业务与法规调整。

## 恢复验证

在隔离目录恢复后，注入从独立 Secret Manager 取回的原密钥，再执行：

```powershell
$env:NEXUS_DB_PATH = 'C:\restore\data.db'
npm run db:migrate -- verify
npm run ledger:verify
npm run audit:verify
```

随后核对用户、产品、订单、提现、许可证、文件数量和随机抽取文件 SHA-256。不要直接把首次恢复结果覆盖到生产路径。

## 2026-09-28 本机恢复演练

- 第一次演练发现私有资产与审计归档恢复目录少了 `storage/` 层级；数据库、外键和账本通过，审计路径校验失败；
- 修正映射后从头创建新 bundle 并恢复；
- 恢复点：2026-09-28T12:14:58.975Z 后重新生成的同源快照；
- bundle 文件数：26；
- 自动创建与恢复耗时：约 2.9 秒；
- 数据库迁移：3/3；
- `quick_check=ok`；外键违规 0；
- 钱包账本：2 笔交易，签名链有效；
- 审计日志：97 条在线记录，签名链与链头有效；
- 结论：本机隔离恢复成功；生产 RPO/RTO 仍需在目标服务器、真实数据规模和异地存储上测量，不能使用本机 2.9 秒作为生产承诺。
