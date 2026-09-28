# Nexus Quant 数据库迁移

## 运行原则

`schema_migrations` 是数据库结构版本的唯一事实来源。每条记录保存连续版本号、唯一名称、迁移文件 SHA-256、执行时间和完成时间。

生产环境默认不自动修改结构。新版本进程发现待执行迁移会以 `MIGRATIONS_PENDING` 拒绝启动。部署顺序必须是：

```powershell
npm run db:migrate -- status
npm run db:migrate -- up
npm run db:migrate -- verify
npm run build
npm start
```

`up` 在已有数据库存在且确有待执行迁移时，先使用 SQLite 在线备份 API 写入 `backups/`，再按版本逐项执行。备份成功前不会开始迁移。没有待执行项时不会重复备份。

开发和测试环境会在 `lib/db.js` 首次打开数据库时自动执行待处理迁移。生产只有在明确设置 `NEXUS_AUTO_MIGRATE=1` 时才允许自动迁移；该开关只应用于有人监督的单进程构建或恢复，不应作为常规部署配置。

## 原子性和并发

每个版本在独立 `BEGIN IMMEDIATE` 事务中执行。迁移逻辑和 `schema_migrations` 成功记录处于同一事务：任何语句抛错都会一起回滚。多个进程同时启动时，SQLite 写锁使迁移串行；后获得锁的进程会重新检查版本记录，不会重复执行。

不同版本不会被合并成一个大事务。版本 2 失败时，已成功提交的版本 1 保留，版本 2 的全部结构和数据变化回滚，修复后从版本 2 重试。

## 校验和与不可变历史

迁移文件包含固定 SHA-256。计算时把文件中的 checksum 声明规范化为 64 个零，因此 checksum 值自身不会形成循环依赖。运行器同时比较：

1. 当前文件计算值与文件声明值；
2. 文件声明值与数据库历史值。

已经应用的迁移文件不得编辑、重排、重命名或删除。发现变化会返回 `MIGRATION_FILE_TAMPERED`、`MIGRATION_CHECKSUM_MISMATCH` 或 `MIGRATION_UNKNOWN_APPLIED_VERSION` 并停止启动。

## 新增迁移

1. 复制以下模板为连续编号，例如 `migrations/002-add-example.mjs`：

```js
export const version = 2;
export const name = 'add-example';
export const checksum = '0000000000000000000000000000000000000000000000000000000000000000';

export function up(db) {
  db.exec(`CREATE TABLE example (id INTEGER PRIMARY KEY)`);
}
```

2. 把模块导入 `lib/migrations.js`，按版本追加到 `migrations` 数组。禁止跳号。
3. 计算校验和：

```powershell
npm run db:migrate -- checksum migrations/002-add-example.mjs
```

4. 把输出的 64 位摘要写回 `checksum`。
5. 在全新数据库、生产结构副本和含真实形状但脱敏的数据副本上运行迁移测试。
6. 执行两次 `up`，第二次必须显示 `pending=none` 或 `current=N/N` 且不产生新历史。
7. 提交迁移文件、manifest、测试和操作说明。不要修改旧迁移来满足新需求。

## 状态和完整性检查

```powershell
npm run db:migrate -- status
npm run db:migrate -- verify
```

`verify` 还会运行：

- `PRAGMA quick_check`；
- `PRAGMA foreign_key_check`。

任何非零退出码都应终止部署。

## 恢复

迁移失败会自动回滚当前版本。如果迁移已成功但应用回归要求整体回退：

1. 停止所有应用进程；
2. 保留失败后的数据库和 WAL/SHM 作为调查材料；
3. 找到 `up` 输出的精确备份路径；
4. 在独立临时位置执行 `quick_check` 和业务抽查；
5. 用验证过的备份恢复数据库文件；
6. 部署与该数据库版本匹配的代码；
7. 执行 `status`、`verify` 和关键链路回归后再恢复流量。

当前不提供自动 `down`。包含身份、账本、订单和证据的数据迁移通常无法安全逆转；恢复已验证的完整备份比通用逆向 SQL 更可靠。
