# Nexus Quant 钱包账本运维说明

## 作用范围

`wallet_transactions` 是按 `user_id` 分链的余额事实记录。当前已接管管理员余额调整、提现冻结和提现驳回退款。付费订单仍关闭，因此 `EA_SALE` 只保留类型和订单唯一约束，尚未连接任何真实支付结算。

每条记录保存业务幂等键、分币金额、变更前后余额、订单或提现引用、操作者、前一条摘要、签名密钥编号和 HMAC。数据库触发器阻止普通 SQL 修改 `users.balance`，也阻止普通 SQL 插入、更新或删除账本记录。

## 配置

生产环境必须设置至少 32 字符的：

```text
LEDGER_INTEGRITY_SECRET=
```

开发环境未设置时会生成 `storage/secrets/ledger-integrity.key`。该文件和生产 Secret 都必须进入受控备份，不能提交版本库。丢失当前及历史密钥后，旧流水将无法通过完整性校验。

密钥轮换时，把新密钥写入 `LEDGER_INTEGRITY_SECRET`，并把旧密钥按逗号分隔放入：

```text
LEDGER_INTEGRITY_PREVIOUS_SECRETS=old-secret-1,old-secret-2
```

旧密钥必须保留到由它签名的所有流水超过法定与业务留存期。轮换不会重签历史记录。

## 对账

在应用同一工作目录和同一生产环境变量下运行：

```bash
npm run ledger:verify
```

成功结果包含 `"valid": true`。校验会逐用户验证：

- HMAC 签名；
- 前后记录的 hash 链；
- 变更前余额与上一条变更后余额；
- `before + amount = after`；
- 最后一条账本余额与 `users.balance`。

任何 `issues` 都应阻断涉及余额、提现和未来结算的操作。先保全数据库、WAL、SHM、应用日志与密钥副本，再查明异常；不得直接删除或重写流水来消除告警。

## 备份与恢复

数据库和账本密钥必须属于同一恢复点。恢复后先运行 `npm run ledger:verify`，校验通过后才能恢复余额相关接口。项目首次迁移前的数据库备份位于 `backups/data-before-p1-009-wallet-ledger-20260926.db`。

代码中的维护写通道只用于受控追加和测试破坏模拟。业务代码必须调用 `applyWalletDelta` 或 `setWalletBalance`，不得直接更新余额或账本。

## 真实支付边界

当前实现不代表付费链路已经完成。正式启用真实资金前，仍需建立 Payment Intent、可信链上或支付服务商核验、支付事件唯一约束、平台佣金、订单结算、退款与链重组流水，并通过 `GO_LIVE_CHECKLIST.md` 的全部支付验收。
