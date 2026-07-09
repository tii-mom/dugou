# DIAO Contract V2 Async-Safe Redesign

## 1. 当前 V1 风险复现摘要

PR #5 已新增 `contracts/tests/diao_bounce_risk.spec.ts` 和 `docs/diao-ton-bounce-risk-reproduction-report.md`，结论为 **Risk reproduced**。

V1 的核心问题是：业务状态先落库，Jetton transfer 后异步执行。如果后续 transfer failure / bounce 发生，`onBouncedMessage` 不恢复业务状态。

已复现的不一致包括：

- `BuyPackage`: `userPackages.packageCount` 和 `totalPackagesSold` 已增加，但 buyer 未收到 immediate DIAO。
- `ClaimBuyer`: `highestClaimedRound` 已增加，但 buyer 未收到解锁 DIAO，且无法再次正常领取。
- `ClaimReserve`: `reserveAlreadyClaimed` 已增加，但 official reserve wallet 未收到 DIAO。
- `ClaimTeam`: `teamClaimedRound` 已增加，但 team wallet 未收到 DIAO，且无法再次正常领取。
- `EmergencyRescueDiao`: `emergencyRescued` 已增加，但 emergency rescue wallet 未收到 DIAO。
- `InitMint`: `totalSupply` 已变成 10B 且 `mintable=false`，但 vesting allocation 可能未到账，失败后无法重试。

V2 目标：任何异步 transfer failure / bounce 都必须可恢复、可重试、可审计，不允许出现业务状态表示已完成但资产未到账的状态。

## 2. V2 安全状态机

### 2.1 通用原则

所有会发出 Jetton transfer 的路径都采用两阶段模型：

1. Validate: 校验权限、额度、轮次、暂停状态、TON value 和业务约束。
2. Reserve: 创建 pending transfer 或 pending operation，锁定额度但不推进最终 claimed/sold/rescued 状态。
3. Dispatch: 发送 Jetton transfer，queryId 必须唯一并写入 pending map。
4. Complete: 仅在收到可验证的 completion ack 后推进最终业务状态。
5. Bounce/Fail: 在 `onBouncedMessage` 中定位 pending operation，释放锁定额度，标记为 retryable 或 failed。
6. Retry/Recover: 用户或管理员可用原 pending id 重发，或取消并恢复 entitlement。

V2 不应依赖“入口交易 success”表示资产已到账。入口交易 success 只表示 pending operation 创建成功。

### 2.2 BuyPackage

V1 风险：购买状态和售出数量先增加，immediate DIAO 后发，失败后 package 仍被计入。

V2 状态机：

| 状态 | 含义 |
| --- | --- |
| `None` | buyer 无购买 pending |
| `PurchasePending` | 已收到 TON，已锁定 package quota，immediate transfer 未确认 |
| `ImmediateTransferSent` | 已向 vesting jetton wallet 发起 transfer |
| `Completed` | immediate DIAO transfer 已确认，`packageCount` 和 `totalPackagesSold` 才最终增加 |
| `Retryable` | transfer bounce/fail，TON 和 quota 仍被合约托管，可重试或退款 |
| `Cancelled` | 管理员/用户按规则取消，quota 解锁，TON 退款或进入人工处理 |

推荐实现：

- 新增 `pendingPurchases: map<queryId, PendingPurchase>`。
- `BuyPackage` 先记录 `buyer`, `packageCount`, `paidTon`, `immediateAmount`, `createdAt`, `attempts`, `status`。
- `totalPackagesSold` 不在 pending 阶段增加，或拆成 `soldCommitted` 与 `soldPendingReserved` 两个字段。
- package 上限检查使用 `soldCommitted + soldPendingReserved` 防止并发超卖。
- buyer wallet package 上限检查使用 `packageCountCommitted + pendingPackageCount`。
- immediate transfer 成功确认后再把 pending 转为 committed package。

### 2.3 ClaimBuyer

V1 风险：`highestClaimedRound` 先增加，转账失败后 buyer 无法再次 claim。

V2 状态机：

| 状态 | 含义 |
| --- | --- |
| `Claimable` | buyer 有未领取 round |
| `ClaimPending` | claim amount 和 target round 已锁定 |
| `TransferSent` | 已发起 Jetton transfer |
| `Completed` | transfer 已确认，`highestClaimedRound` 更新到 target round |
| `Retryable` | transfer bounce/fail，`highestClaimedRound` 不变，可重试 |
| `ExpiredRecovery` | pending 超时，允许用户或管理员恢复为 `Claimable` |

推荐实现：

- `highestClaimedRound` 只在 `Completed` 时更新。
- pending 中保存 `buyer`, `fromRound`, `toRound`, `packageCount`, `amount`。
- 同一 buyer 同时只能有一个 active buyer-claim pending。
- bounce 后 pending 进入 `Retryable`，用户可以 `RetryBuyerClaim(queryId)`。
- 超时后可以 `RecoverBuyerClaim(queryId)`，删除 pending，不改变 `highestClaimedRound`。

### 2.4 ClaimReserve

V1 风险：`reserveAlreadyClaimed` 先增加，reserve wallet 未到账后无恢复机制。

V2 状态机：

| 状态 | 含义 |
| --- | --- |
| `ReserveClaimable` | official reserve 有可领取额度 |
| `ReserveClaimPending` | claim amount 已锁定 |
| `TransferSent` | 已发起 Jetton transfer |
| `Completed` | transfer 已确认，`reserveAlreadyClaimed` 增加 |
| `Retryable` | transfer bounce/fail，`reserveAlreadyClaimed` 不变，可重试 |
| `Recovered` | pending 取消，额度回到 claimable |

推荐实现：

- `reserveAlreadyClaimed` 只记录完成到账额度。
- 新增 `reservePendingClaimed` 或从 pending map 聚合，用于防止重复发起超额 pending。
- official reserve 只能有一个 active pending，或必须按 queryId 明确管理多个 pending。
- bounce 时释放 `reservePendingClaimed`。

### 2.5 ClaimTeam

V1 风险：`teamClaimedRound` 先增加，team wallet 未到账后无法再次 claim。

V2 状态机：

| 状态 | 含义 |
| --- | --- |
| `TeamClaimable` | team 有可领取 round |
| `TeamClaimPending` | target round 和 amount 已锁定 |
| `TransferSent` | 已发起 Jetton transfer |
| `Completed` | transfer 已确认，`teamClaimedRound` 更新 |
| `Retryable` | transfer bounce/fail，`teamClaimedRound` 不变，可重试 |
| `Recovered` | pending 取消，round 回到 claimable |

推荐实现：

- `teamClaimedRound` 只在 completion 后更新。
- pending 保存 `fromRound`, `toRound`, `amount`。
- active pending 存在时禁止新 team claim，避免 round 范围重叠。

### 2.6 EmergencyRescueDiao

V1 风险：`emergencyRescued` 先增加，rescue wallet 未到账后 rescueable 被永久减少。

V2 状态机：

| 状态 | 含义 |
| --- | --- |
| `RescueAvailable` | paused 状态下存在可 rescue 额度 |
| `RescuePending` | amount 已锁定 |
| `TransferSent` | 已发起 Jetton transfer |
| `Completed` | transfer 已确认，`emergencyRescued` 增加 |
| `Retryable` | transfer bounce/fail，`emergencyRescued` 不变，可重试 |
| `Recovered` | pending 取消，额度回到 rescueable |

推荐实现：

- `emergencyRescued` 只记录已完成到账额度。
- 新增 `emergencyRescuePending` 或 pending map 聚合，防止多笔 rescue pending 超额。
- 只允许 admin 创建 rescue pending，且 recipient 必须等于 configured emergency rescue wallet。
- bounce 后 pending 进入 `Retryable`，admin 可 retry 或 recover。

### 2.7 InitMint

V1 风险：minter 先设置 `totalSupply=TOTAL_SUPPLY` 和 `mintable=false`，再异步发送两笔 allocation。任一 allocation fail/bounce 后 minter 已锁死。

V2 状态机：

| 状态 | 含义 |
| --- | --- |
| `Mintable` | 尚未开始初始化 |
| `InitMintPending` | init 参数已记录，allocations 尚未全部确认 |
| `InitialSent` | initial circulation allocation 已发起 |
| `VestingSent` | vesting allocation 已发起 |
| `PartiallyConfirmed` | 一笔已确认，另一笔待确认或可重试 |
| `Completed` | 两笔 allocation 均确认，才设置 final supply / locked state |
| `Retryable` | 任一 allocation bounce/fail，可重试失败 allocation |
| `AbortedBeforeSupplyFinalized` | 两笔都未完成且 admin 取消，恢复 mintable |

推荐实现：

- 不在第一笔入口交易中永久锁死 `mintable`。
- 新增 `mintStatus`, `initialAllocationStatus`, `vestingAllocationStatus`。
- `totalSupply` 可采用以下两种安全模型之一：
  - Completion model: 两笔 allocation 确认后才设置 `totalSupply=TOTAL_SUPPLY` 和 `mintable=false`。
  - Reserved supply model: `reservedSupply=TOTAL_SUPPLY`，`totalSupply` 只随 confirmed allocation 增加；全部确认后 `mintable=false`。
- 需要 allocation completion ack。若标准 Jetton wallet 无明确 ack，应使用 V2 wallet/minter 内部消息协议增加 `AllocationAccepted` 回执。
- bounce handler 必须按 allocation type 恢复对应状态。

## 3. pending / retry / recovery 设计

### 3.1 PendingOperation 结构

建议在 V2 vesting controller 中引入统一 pending map：

```text
PendingOperation {
  opType: uint8
  status: uint8
  owner: address
  recipient: address
  amount: coins
  createdAt: uint32
  updatedAt: uint32
  attempts: uint8
  fromRound: uint8
  toRound: uint8
  packageCount: uint8
  paidTon: coins
  transferQueryId: uint64
}
```

`opType` 建议枚举：

- `1 = PurchaseImmediate`
- `2 = BuyerClaim`
- `3 = ReserveClaim`
- `4 = TeamClaim`
- `5 = EmergencyRescue`

`status` 建议枚举：

- `1 = Pending`
- `2 = TransferSent`
- `3 = Retryable`
- `4 = Completed`
- `5 = Cancelled`
- `6 = RecoveryRequired`

### 3.2 QueryId 规则

- 外部用户提供的 `queryId` 不应直接作为内部 transfer identity 的唯一来源。
- V2 应生成内部 `operationId`，并派生 `transferQueryId`。
- `transferQueryId` 必须能从 bounced body 中恢复 pending operation。
- `operationId` 应避免覆盖：可使用 monotonic nonce，加上 op type 和 owner。

### 3.3 Retry 规则

- Retry 不重新计算 entitlement，使用 pending 中锁定的 amount 和 recipient。
- Retry 必须增加 `attempts` 并更新 `updatedAt`。
- 设置最大 attempts 或最小 retry interval，防止 gas griefing。
- Retry 需要调用者支付新的 TON gas。
- Retry 成功 completion 后才推进 final state。

### 3.4 Recovery 规则

- 用户可恢复自己的 buyer claim 或 purchase pending。
- official reserve/team/admin 可恢复对应权限范围内的 pending。
- recovery 不应吞掉 entitlement。
- 对 purchase，recovery 需要明确处理已支付 TON：退款、重新尝试 immediate transfer、或进入 admin escrow。
- 超时阈值建议至少覆盖 TON 网络延迟和 indexer/ops 响应时间，例如 24-72 小时，具体值由审计确认。

## 4. onBouncedMessage 恢复设计

V2 的 `onBouncedMessage` 不能只 `skipBouncedPrefix()`。

建议流程：

1. `skipBouncedPrefix()`。
2. 解析 bounced body 的 op code。
3. 仅处理本合约主动发出的 `AskToTransfer` 或 minter allocation transfer。
4. 读取 `queryId`，映射到 pending operation。
5. 校验 pending status 是 `TransferSent`。
6. 将 pending status 改为 `Retryable` 或 `RecoveryRequired`。
7. 释放对应 pending aggregate，例如 `soldPendingReserved`, `reservePendingClaimed`, `teamPendingRounds`, `emergencyRescuePending`。
8. 不推进 final claimed/sold/rescued 字段。
9. 记录 bounce attempt count 和 last failure timestamp。

必须拒绝或忽略无法匹配 pending 的 bounced message，避免伪造 bounce 破坏状态。

建议对 V2 minter 使用类似恢复逻辑：

- bounced initial allocation: `initialAllocationStatus = Retryable`。
- bounced vesting allocation: `vestingAllocationStatus = Retryable`。
- 两笔 allocation 未全部 confirmed 前不得进入 final locked state。

## 5. 是否需要新 minter

需要，建议部署新 minter。

原因：

- V1 `InitMint` 风险在 minter 内部，无法仅通过新 vesting controller 完整消除。
- V2 需要 allocation pending/confirmation/retry 状态，V1 minter storage 不包含这些字段。
- 若 V1 minter 已 `mintable=false`，无法安全复用其初始化流程。
- 若 Jetton wallet code 或 message protocol 需要 completion ack，新 minter 需要绑定 V2 wallet code。

如果项目必须保留同一 token identity，需要单独评估链上升级能力、包装迁移、burn/mint bridge 或 token swap 方案。不能假设 V1 minter 可原地修复。

## 6. 是否需要新 vesting controller

需要，建议部署新 vesting controller。

原因：

- V1 storage 无 pending operation map、retry counters、pending aggregate 字段。
- V1 已出现或可能出现的状态不一致无法通过简单参数变更修复。
- V2 需要更严格的状态机和 bounce recovery。
- 即使只修 vesting，`InitMint` 仍要求新 minter 或新初始化协议配合。

## 7. 是否需要重新部署

Redeploy required: likely / yes for V2。

如果当前链上合约不可升级，则 V2 需要重新部署：

- new DIAO V2 minter
- new DIAO V2 jetton wallet code
- new DIAO V2 vesting controller

是否需要迁移 token identity 取决于业务是否允许旧 DIAO 与新 DIAO 共存或兑换。Production 前必须完成审计和迁移演练。

## 8. 旧合约资产和状态迁移方案

### 8.1 迁移目标

迁移必须保证：

- 不丢失 buyer package entitlement。
- 不重复发放已完成到账的 DIAO。
- 不把 V1 中失败但状态已推进的 entitlement 永久吞掉。
- 旧合约剩余 DIAO、TON、pending 权益有可审计去向。

### 8.2 状态快照

需要在迁移高度冻结或记录以下数据：

- V1 buyer `packageCount` 和 `highestClaimedRound`。
- V1 `totalPackagesSold`。
- V1 `currentUnlockedRound`。
- V1 `reserveAlreadyClaimed`。
- V1 `teamClaimedRound`。
- V1 `emergencyRescued`。
- V1 vesting jetton wallet balance。
- 已知失败/未到账交易列表，尤其是 PR #5 中覆盖的 6 类风险。

### 8.3 资产迁移

可选方案：

| 方案 | 描述 | 风险 |
| --- | --- | --- |
| Token swap | 用户把 V1 DIAO 换成 V2 DIAO | 需要 swap 合约和防重复兑换 |
| Snapshot airdrop | 按快照直接发 V2 DIAO / V2 entitlement | 需要冻结点和争议处理 |
| Wrapped migration | V1 DIAO 锁定后发行 wrapped V2 | 复杂度较高 |
| Vesting-only migration | V1 liquid token 保留，仅把未释放 vesting 迁到 V2 | token identity 分裂，需要清晰披露 |

推荐初始方案：snapshot + controlled migration dry run。先迁 entitlement，不直接动主网资产，审计通过后再执行正式迁移。

### 8.4 V1 异常状态处理

对 V1 中已推进但未到账的状态，需要用交易 trace 和 wallet balance 证明：

- 若 `highestClaimedRound` 已推进但未到账，V2 应恢复未到账 round 的 claimable entitlement。
- 若 `reserveAlreadyClaimed` 已推进但未到账，V2 应扣减 completed reserve claimed，仅保留真实到账部分。
- 若 `teamClaimedRound` 已推进但未到账，V2 应恢复对应 team rounds。
- 若 `emergencyRescued` 已推进但未到账，V2 应只记录真实到账 rescue amount。
- 若 `InitMint` partial failure，必须确认 initial/vesting allocations 的实际 wallet balance，再决定 V2 genesis allocation。

### 8.5 冻结和切换

上线前建议：

1. 暂停或关闭 V1 sale/claim/rescue。
2. 公布快照高度和状态根。
3. 生成迁移清单。
4. 在 staging sandbox 回放迁移。
5. 审计迁移脚本和 V2 合约。
6. 主网执行迁移。
7. 保留 V1 只读查询和申诉窗口。

## 9. V2 测试计划

必须新增测试：

- `BuyPackage` transfer bounce 后 package 不 committed，quota 可恢复或 retry。
- `BuyPackage` retry 成功后 package committed，immediate DIAO 到账。
- `ClaimBuyer` bounce 后 `highestClaimedRound` 不变，可 retry。
- `ClaimBuyer` retry 成功后 `highestClaimedRound` 推进。
- `ClaimReserve` bounce 后 `reserveAlreadyClaimed` 不变，可 retry。
- `ClaimTeam` bounce 后 `teamClaimedRound` 不变，可 retry。
- `EmergencyRescueDiao` bounce 后 `emergencyRescued` 不变，可 retry。
- `InitMint` initial allocation bounce 后 minter 不 final lock，可 retry。
- `InitMint` vesting allocation bounce 后 minter 不 final lock，可 retry。
- `InitMint` 两笔 allocation 都 confirmed 后才 final lock。
- 伪造 bounced message 不应修改 pending 或 final state。
- 重复 bounce 不应重复释放额度。
- retry attempts 和 timeout recovery 行为正确。
- pending 存在时重复 claim/purchase 不得超额。
- 成功路径仍保持 V1 tokenomics 总量和释放规则。

测试类型：

- Unit/sandbox tests for state machine.
- Failing mock wallet and bounced message tests.
- Property-style accounting tests: committed + pending + wallet balances must conserve allocation.
- Migration snapshot tests with V1 inconsistent examples.
- Gas regression tests for pending map growth and retry paths.

## 10. 上线分阶段路线

### Phase 0: Design freeze

- 本文档评审。
- 明确 V2 状态机、message op codes、storage layout。
- 明确是否采用 completion ack wallet protocol。

### Phase 1: Prototype

- 新增 V2 minter、V2 wallet、V2 vesting controller。
- 不部署主网。
- 完成 sandbox 成功路径和 bounce/retry/recovery 测试。

### Phase 2: Internal audit

- 合约代码审查。
- Storage layout 审查。
- QueryId / pending operation collision 审查。
- Bounce spoofing 审查。
- Accounting conservation 审查。

### Phase 3: External audit / formal review

- 外部 TON 合约审计。
- 重点审计 async message ordering、bounce semantics、gas thresholds、migration correctness。

### Phase 4: Staging deployment

- Staging: allowed only after tests and internal audit pass.
- Staging 限额、限地址、限操作窗口。
- 演练 migration、pause、retry、recovery。

### Phase 5: Mainnet migration decision

- Production: blocked until V2 audit, migration dry run, rollback plan, monitoring plan 全部完成。
- Redeploy required: likely / yes for V2。
- 发布迁移公告和用户验证工具。

### Phase 6: Production rollout

- 冻结 V1 写操作。
- 执行快照。
- 部署 V2。
- 迁移 entitlement / assets。
- 开启小流量 claim/purchase。
- 逐步放量。
- 保留 V1 查询、申诉和监控窗口。

## Final Launch Gate

Staging: restricted until V2 prototype tests pass.

Production: blocked until V2 implementation, full bounce tests, migration dry run, and audit pass.

Redeploy required: likely / yes.
