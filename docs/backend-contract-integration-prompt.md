# Backend Contract Integration Prompt

Use this prompt after the DIAO TON mainnet contract thread has delivered final contract addresses, metadata URL, ABI/wrapper details, and deployment transaction hashes.

```text
你负责把 Cloudflare 后端与 DIAO TON 主网合约接入收口。不要重新设计合约参数；以合约线程最终交付为准。

当前合约业务参数：
- 单份价格：58 TON
- 单份立即释放：200,000 DIAO
- 单份锁仓权益：3,000,000 DIAO
- 参与者释放：15 轮，每轮 200,000 DIAO / 份
- 单钱包最多：10 份
- 全局最多：2,000 份
- 链上购买校验金额：58 TON * package_count + 0.1 TON 合约执行 buffer
- 第 1-15 轮面向 58 TON 购买参与者；未售额度进入官方储备
- 第 16-18 轮进入团队钱包

必须接入的环境变量：
- DIAO_MINTER_ADDRESS=`EQDO5Wl-jFR2A9UrgZZKqQbV_2Ab56HZqMbVbj3G2noXJq3Y`
- DIAO_VESTING_ADDRESS=`EQCaEIglj5ut5U-y4aMAz45Dj1Gx3JJ_8JUilNs-jvfl_Cot`
- DIAO_JETTON_WALLET_CODE_HASH=`8a4ada81373f783ed0fcb4817b192fdd0dd9bdd6e9b2d2b0f4f482d043960ab7`
- DIAO_METADATA_URL=`https://ivory-keen-perch-796.mypinata.cloud/ipfs/bafkreigsnrrxhqvxhst2xay7pythep5auoprv3ekuzruyp77jwtqjgp4im`
- DIAO_SALE_TON_RECEIVER=`EQCaEIglj5ut5U-y4aMAz45Dj1Gx3JJ_8JUilNs-jvfl_Cot`
- DIAO_INITIAL_CIRCULATION_WALLET=`UQBv9pBWH7R_gv2mGYXKwGX59S6RH7wuramDTRyb8OUqoycQ`
- DIAO_OFFICIAL_RESERVE_WALLET=`UQDo48rWrpPU9ouJk5ZoKzTFPHUfqt1tZEKvtFE73xcyGZFA`
- DIAO_TREASURY_WALLET=`UQDDSkodFARAsYCVSzE9MgMrYk44PF95UyZcYwLDFnkXskXp`
- DIAO_TEAM_WALLET=`UQAXy5kyjrLT2mgIOB_AbhalM4R-ZL_bM2QjyY6hTS1FfktJ`
- DIAO_EMERGENCY_RESCUE_WALLET=`UQDcCX8Vfq5TaR1ZgV7_Za0dsSy0ZxZvhUUYi77gWfHiBG4R`
- DIAO_EMERGENCY_RESCUE_WALLET
- DIAO_ADMIN_WALLET
- DIAO_PRICE_ADMIN_WALLET
- DIAO_MAINNET_DEPLOYER_WALLET
- TONCENTER_ENDPOINT 或官方主网 TON RPC endpoint
- TONCENTER_API_KEY 或对应 RPC API key

任务范围：
1. 读取链上购买记录
   - 从 DIAO_VESTING_ADDRESS 或合约事件/交易中读取购买消息。
   - 识别 buyer wallet、package_count、TON amount、transaction hash、logical time、block seqno、确认状态。
   - 只接受 58 TON * package_count + 0.1 TON 合约执行 buffer 的有效购买。
   - 超过 2,000 份全局销售上限、超过单钱包 10 份、金额不足或金额超出预期的记录不得自动入账。

2. 同步 diao_sale_intents 状态
   - 当前 pending_contract_payment 的 intent 需要与链上购买匹配。
   - 匹配字段至少包含 wallet_address、packages、TON amount、tx hash。
   - 状态建议：
     pending_contract_payment -> chain_seen -> confirmed -> settled
     pending_contract_payment -> rejected / expired / mismatch
   - 所有状态更新必须幂等。

3. 建立 allocation ledger
   - 新增 D1 表记录每个钱包的购买权益：
     user_id, wallet_address, packages, immediate_diao, locked_diao, per_round_diao, release_rounds, tx_hash, status, created_at, updated_at
   - 每个 tx_hash 只能入账一次。
   - 每个 wallet_address 累计不得超过 10 份。
   - 全局累计不得超过 2,000 份。
   - ledger 不负责私钥转账，只记录链上合约已经确认的权益。

4. 交易哈希幂等与重放防护
   - tx_hash + logical time 或 tx_hash + message hash 必须唯一。
   - 重复 webhook、重复轮询、重复用户提交不能重复入账。
   - 如果同一个 tx_hash 被不同用户或不同钱包绑定，必须进入异常队列，不得自动结算。

5. API 接口
   - 增加查询购买确认状态接口，例如 GET /api/token-sale/intent/:id 或 POST /api/token-sale/sync。
   - 返回前端需要的状态、确认数、tx hash、ledger 记录摘要。
   - 错误态不能让前端空白，返回明确 pending/mismatch/expired/rejected。

6. 后台任务/轮询
   - 在 Cloudflare 环境中实现可重复运行的同步任务。
   - 可以用 Pages Function 手动触发接口或 Worker Cron，必须有鉴权。
   - 不在前端暴露 RPC key。

7. 验证
   - 更新 scripts/verify-backend.cjs 或新增仓库内验证脚本。
   - 覆盖：有效购买入账、重复 tx 不重复入账、包数超过 10 拒绝、金额不匹配拒绝、wallet 不匹配进入异常状态。
   - 运行 pnpm lint、pnpm typecheck、verify 脚本、/api/health。

8. 文档
   - 更新 docs/api-contract.md。
   - 更新 docs/launch-checklist.md。
   - 明确哪些字段是 server-only，不能进入 NEXT_PUBLIC。

验收标准：
- 不保存、不打印、不提交 mnemonic、私钥、seed phrase。
- 主网钱包签名只在合约部署线程或人工操作中完成，后端只读取链上结果和记录 ledger。
- 所有 Cloudflare secrets 通过环境变量配置，不写入代码。
- diao_sale_intents 与 allocation ledger 在重复运行同步任务时结果一致。
```
