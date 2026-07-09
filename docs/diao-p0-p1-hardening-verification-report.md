# DIAO P0/P1 Hardening & Verification Report

Date: 2026-07-09
Current Branch: `codex/diao-p0-p1-verification-hardening`

---

## 一、 执行摘要

本轮验证对 DIAO / Dugou 项目的本地依赖、接口集成测试、D1 迁移、R2 缺失保护、硬编码密钥及 TON 合约异步风险进行了全面审查与修复。
当前本地编译、TypeScript 类型检查、前端打包、本地 Cloudflare D1 数据库迁移及所有后端接口集成测试（含 mock chain 模式）均已**全部通过**。
对于 TON 智能合约的异步消息处理风险，鉴于其逻辑复杂性与链上稳定性影响，目前定位为 **Production Blocker**，并在本报告中做出了详细的设计风险说明。

---

## 二、 修改文件清单

1. **[app/api/auth/telegram/route.ts](file:///Users/yu1/Desktop/GOU/app/api/auth/telegram/route.ts)**
   - 修复了 `context?.env as CloudflareEnv as AuthEnv` 的 TypeScript 类型转换报错 (TS2352)。
2. **[app/api/loss-proofs/upload/route.ts](file:///Users/yu1/Desktop/GOU/app/api/loss-proofs/upload/route.ts)**
   - 新增生产环境下 R2 Bucket (`LOSS_PROOFS`) 缺失的 Fail-closed 校验，拒绝 mock 上传并返回 `503 Service Unavailable`。
3. **[app/api/loss-proofs/submit/route.ts](file:///Users/yu1/Desktop/GOU/app/api/loss-proofs/submit/route.ts)**
   - 新增生产环境下 R2 Bucket 缺失的 Fail-closed 校验，拒绝提交审核并返回 `503 Service Unavailable`。
4. **[app/api/token-sale/intent/route.ts](file:///Users/yu1/Desktop/GOU/app/api/token-sale/intent/route.ts)**
   - 真正实现了 nano ledger 写入。INSERT 时同时写入 `total_ton_nano`，并增加了捕获 `no such column` 报错的向前/向后兼容策略（支持未执行 0006 迁移的旧 DB）。
5. **[app/api/purchases/confirm/route.ts](file:///Users/yu1/Desktop/GOU/app/api/purchases/confirm/route.ts)**
   - 真正实现了 nano ledger 写入。INSERT 时同时写入 `paid_ton_nano`，并增加了捕获 `no such column` 报错的向前/向后兼容策略（支持未执行 0006 迁移的旧 DB）。
6. **[scripts/verify-backend.cjs](file:///Users/yu1/Desktop/GOU/scripts/verify-backend.cjs)**
   - 将原 EVM 格式（`0x...`）以及含有错误 Checksum 的 mock 钱包地址全部更新为符合 TON 标准格式的 `EQDWNQP48XK-sJOP9WD35N-_M9Y8XWTjIf-DOzpuputLcapJ`。
   - 新增 Test 2b 测试用例，用以验证 TON 钱包地址合法性校验功能 (`Address.parse` 校验)。
7. **[.env](file:///Users/yu1/Desktop/GOU/.env)**
   - 本地联调测试时修改 `CHAIN_INDEXER_MODE` 变量为 `mock`，使本地集成测试能在 mock 模式下正常读取本地数据库，不再因调用外部链而导致 fetch failed。此文件已被 `.gitignore` 忽略，不会提交。

---

## 三、 P0 修复结果

1. **本地依赖与编译环境**
   - 恢复并正确安装了本地 `node_modules` 依赖，消除了 `eslint` 找不到的执行错误。
   - 解决类型强制转换报错，`pnpm typecheck` 及 `pnpm build` (Turbopack) 均实现 100% 编译成功。
2. **后端测试服务与接口验证**
   - 启动本地 Cloudflare Wrangler & D1 测试服务后，通过将链模式调整为 `mock`，消除了与主网链上数据读取的本地隔离阻碍，`pnpm verify:backend` 的全部 31 项集成测试全部高绿通过。
3. **硬编码密钥检查**
   - 确认无硬编码的 `TELEGRAM_BOT_TOKEN`、`AGNES_AI_API_KEY` 或 TON 钱包私钥存在于源码中。
   - 密钥和 Token 均已隔离至外部环境变量或 `.env` 配置文件。

---

## 四、 P1 修复与增强结果

1. **R2 缺失 Fail-closed**
   - 已在 `/api/loss-proofs/upload` and `/api/loss-proofs/submit` 实现了缺失 R2 绑定时的 fail-closed 拦截逻辑，拒绝生产下的模拟或空操作成功。
2. **整型 Nano Ledger 映射**
   - 在 D1 迁移中新增了 `total_ton_nano` 和 `paid_ton_nano` 列。
   - 写入逻辑已在接口层面完全实现，且能够向前兼容旧版数据库，规避 SQLite `REAL` 的浮点数精度截断问题。
3. **速率限制/滥用防护方案（已在 Staging Readiness V2 中实现）**
   - **状态**：Rate Limit V1 已完全实现。
   - **设计实现**：
     - 新建 D1 数据表 `diao_rate_limit` (`ip_or_user TEXT PRIMARY KEY, window_start INTEGER, request_count INTEGER`)。
     - 在 `/api/auth/telegram`、`/api/token-sale/intent` 等高敏感 API 入口编写拦截中间件：每 1 分钟/每用户/IP 限制 20 次请求。
     - 触发后直接返回 `429 Too Many Requests`，Fail-closed 保护。

---

## 五、 D1 迁移与本地验证说明

### 1. 迁移说明
`migrations/0006_production_hardening.sql` 里的字段新增语句：
```sql
ALTER TABLE diao_sale_intents ADD COLUMN total_ton_nano TEXT;
ALTER TABLE diao_purchases ADD COLUMN paid_ton_nano TEXT;
```
**注意**：在 D1 / SQLite 中该修改并不是重复执行安全的。该 D1 Migration 文件由 Wrangler 迁移记录表进行管理，正常情况下只会顺序执行一次，**严禁手动重复对同一个 DB 执行该脚本**，否则会导致列已存在的报错。

### 2. 真实链 Indexer 验证说明 (未进行 / 待执行)
- 当前的 `verify:backend` 集成测试是通过在本地将环境修改为 `CHAIN_INDEXER_MODE=mock` 进行并验证通过的。
- 这仅能验证本地 mock indexer 接口逻辑的连通性，**不能证明**真实的 `toncenter` / 主网 `indexer` 数据获取路径 100% 顺畅。
- **上线前必须完成**：在受控的 Staging 环境中，临时注入真实的主网只读 API，跑一次只读的主网真实链数据拉取冒烟测试（Read-only real chain smoke test），确认链上返回的数据解析无误。

---

## 六、 验证命令结果

| 命令 | 执行路径 | 状态 | 备注 |
|---|---|---|---|
| `pnpm lint` | 根目录 | ✅ PASS | ESLint 静态代码检查无问题。 |
| `pnpm typecheck` | 根目录 | ✅ PASS | 修复 TypeScript TS2352 类型报错后，tsc 顺利通过。 |
| `pnpm build` | 根目录 | ✅ PASS | Next.js 生产优化编译与页面打包成功。 |
| `pnpm verify:backend` | 根目录 | ✅ PASS | 31 项接口测试（包含地址校验、Social 任务、重复 Hash 碰撞、nano ledger 写入）全部通过。 |
| `npm test -- --runInBand` | `contracts` | ✅ PASS | 19 项智能合约单元测试全部通过。 |
| `npx blueprint build --all` | `contracts` | ✅ PASS | 智能合约全套 Tolk 源码编译通过。 |

---

## 七、 仍未完成 / 仍有风险

### TON 异步消息一致性风险 (Production Blocker)
- **智能合约文件**：`diao_jetton_minter.tolk` & `diao_vesting_controller.tolk`
- **问题分析**：
  - 合约在向用户发放 DIAO 代币 (`AskToTransfer` 发送 `op::transfer_jetton`) 之前就直接更新了用户状态（如 `highestClaimedRound` 或购买包数 `userPackages`）。
  - 若在 TON 链的后续异步消息传递中，由于 gas 不足或目的地址反弹等原因导致 Jetton 转移失败，合约将触发 `onBouncedMessage`。
  - 目前的 `onBouncedMessage` 中**没有恢复业务状态**的安全状态机（Rollback），这会导致系统判定用户已成功领取代币，但用户实际上并未收到，产生永久的状态不一致。
- **处理建议**：
  - 目前保留 **方案 A（不改合约，标记 production blocker）**。
  - 主网合约已锁定地址情况下，强行修改逻辑可能需要 redeploy 新合约，这涉及高风险的迁移和地址变更。
  - 建议保留此 Blocker，仅可进入内测，不可在大额真实资金的主网环境上线，直至通过专业 TON 审计确认或重构新版合约。

---

## 八、 上线判断

* **Staging / 内测环境**: **可以**
  - 原因：本地依赖、前端、数据库迁移及所有集成测试均完美通过，可以在受控 Staging/Wrangler Pages Dev 环境中进行内测运营和功能联调。
* **Production 生产发布**: **不可以**
  - 原因：
    1. TON 合约的异步转账 Bounced 状态未作回滚，主网大额代币分发存在资产一致性风险。
    2. 主网正式上线前需要对 Telegram Bot Token 及 Agnes AI Key 等进行安全轮换确认。
    3. 未进行主网真实链的只读冒烟测试（Read-only real chain smoke test）。
