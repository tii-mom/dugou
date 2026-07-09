# DIAO Contract V2 Vesting Async-Safe Implementation Report

## 一、实现范围

本分支只修复 `DIAOVestingController` 对外发起 Jetton transfer 时的 async failure / bounce 账实不一致风险。

覆盖路径：

- `BuyPackage`
- `ClaimBuyer`
- `ClaimReserve`
- `ClaimTeam`
- `EmergencyRescueDiao`

未修改：

- `InitMint`
- `DIAOJettonMinter`
- `DIAOJettonWallet`
- tokenomics
- 主网地址
- 前端
- 后端 API
- 部署脚本

## 二、为什么先修 VestingController，不修 InitMint

PR #5 已证明 VestingController 和 Minter 都存在异步失败风险，但两类风险的修复边界不同。

本分支先修 VestingController，是因为 purchase / claim / reserve / team / rescue 都在 VestingController 内部产生业务状态推进，可以通过 retryable debt / entitlement 模型在 VestingController 内完成恢复。

`InitMint` 风险发生在 Minter 初始化供应和两笔 allocation 阶段，需要新的 Minter 初始化状态机、allocation retry 或 ack 协议，影响 token genesis 和部署流程。本分支明确不处理 `InitMint`，后续需要独立 V2 Minter 分支。

## 三、新增状态字段

在 `VestingControllerStorage` 中新增：

- `pendingBuyerDiao: map<address, coins>`
- `pendingReserveDiao: coins`
- `pendingTeamDiao: coins`
- `pendingRescueDiao: map<address, coins>`
- `pendingTransfers: map<uint64, PendingTransferInfo>`
- `transferNonce: int`

新增结构：

```text
PendingTransferInfo {
  transferType: uint8
  recipient: address
  amount: coins
}
```

`pendingTransfers` 用于把 outgoing `AskToTransfer.queryId` 映射到业务类型、recipient 和 amount。发生 bounce 后，合约只消费匹配的 non-zero pending transfer，并把 amount 转入对应 retryable debt。

## 四、新增消息类型

新增 retry 消息：

- `RetryBuyerTransfer`
- `RetryReserveTransfer`
- `RetryTeamTransfer`
- `RetryRescueTransfer`

权限：

- Buyer pending: 只能 buyer 自己 retry。
- Reserve pending: 只能 `officialReserveAddress` retry。
- Team pending: 只能 `teamAddress` retry。
- Rescue pending: admin 或 pending recipient 可 retry。

## 五、onBouncedMessage 恢复逻辑

V2 `onBouncedMessage` 不再只 `skipBouncedPrefix()`。

当前逻辑：

1. 跳过 bounced prefix。
2. 解析 bounced `AskToTransfer`。
3. 读取 `queryId`。
4. 在 `pendingTransfers` 中查找对应 transfer。
5. 如果不存在或 amount 已为 0，则 no-op，避免 duplicate bounce 重复入账。
6. 根据 `transferType` 把 amount 计入：
   - `pendingBuyerDiao[recipient]`
   - `pendingReserveDiao`
   - `pendingTeamDiao`
   - `pendingRescueDiao[recipient]`
7. 将该 `pendingTransfers[queryId].amount` 标记为 0。

## 六、pending / retry / recovery 设计

本实现采用 retryable debt / entitlement 模型。

业务状态仍按 V1 规则推进，例如：

- purchase 后 `packageCount` 和 `totalPackagesSold` 增加；
- buyer claim 后 `highestClaimedRound` 增加；
- reserve claim 后 `reserveAlreadyClaimed` 增加；
- team claim 后 `teamClaimedRound` 增加；
- rescue 后 `emergencyRescued` 增加。

区别是：每次 outgoing Jetton transfer 发出前，都会创建 in-flight pending transfer。若该 transfer bounce，amount 会进入 retryable debt。用户或授权角色 retry 时，合约先扣减 pending debt，再发起新的 in-flight transfer；如果 retry 再次 bounce，pending debt 会加回。

这样可以保证：

- failure 不吞掉用户权益；
- retry 不会重复发放；
- duplicate bounce 不会重复增加 pending；
- 无成功 ack 的 TON 异步模型下，不依赖 recipient callback。

## 七、每条路径的修复说明

### BuyPackage

`BuyPackage` 仍会登记 package 和 total sold。immediate DIAO transfer 发出前记录 in-flight transfer。若 transfer failure / bounce，`PACKAGE_IMMEDIATE * packageCount` 进入 `pendingBuyerDiao[buyer]`。

buyer 可调用 `RetryBuyerTransfer` 领取 pending immediate DIAO。

### ClaimBuyer

`ClaimBuyer` 仍会推进 `highestClaimedRound`。claim transfer 发出前记录 in-flight transfer。若 bounce，claim amount 进入 `pendingBuyerDiao[buyer]`。

buyer 可调用 `RetryBuyerTransfer` 领取 pending claim DIAO。由于 `highestClaimedRound` 已推进，重复 `ClaimBuyer` 不会重复 claim 同一 round。

### ClaimReserve

`ClaimReserve` 仍会增加 `reserveAlreadyClaimed`。transfer 发出前记录 in-flight transfer。若 bounce，claim amount 进入 `pendingReserveDiao`。

只有 official reserve wallet 可调用 `RetryReserveTransfer`。

### ClaimTeam

`ClaimTeam` 仍会推进 `teamClaimedRound`。transfer 发出前记录 in-flight transfer。若 bounce，claim amount 进入 `pendingTeamDiao`。

只有 team wallet 可调用 `RetryTeamTransfer`。

### EmergencyRescueDiao

`EmergencyRescueDiao` 仍会增加 `emergencyRescued`。transfer 发出前记录 in-flight transfer。若 bounce，rescue amount 进入 `pendingRescueDiao[recipient]`。

admin 或 pending recipient 可调用 `RetryRescueTransfer`。

## 八、测试结果

新增：

- `contracts/tests/diao_vesting_async_safe.spec.ts`

更新：

- `contracts/tests/diao_bounce_risk.spec.ts`

覆盖：

- BuyPackage transfer failure -> pending buyer DIAO -> retry success -> duplicate retry blocked。
- ClaimBuyer transfer failure -> pending buyer DIAO -> retry success -> duplicate claim blocked。
- ClaimReserve transfer failure -> pending reserve DIAO -> retry success -> duplicate retry blocked。
- ClaimTeam transfer failure -> pending team DIAO -> retry success -> duplicate retry blocked。
- EmergencyRescueDiao transfer failure -> pending rescue DIAO -> retry success -> duplicate retry blocked。
- Existing V1 bounce-risk spec converted into pending coverage regression for VestingController paths。
- `InitMint` partial failure remains documented as out of scope。

Verification:

- `npx jest tests/diao_vesting_async_safe.spec.ts --runInBand --verbose`: PASS
- `npx jest tests/diao_bounce_risk.spec.ts --runInBand --verbose`: PASS

Full verification results are recorded in the PR summary.

## 九、剩余风险

- `InitMint` partial failure risk remains open.
- There is still no positive success ack from the Jetton recipient wallet. This implementation is intentionally debt-based: it only reacts to bounced controller-to-vesting-wallet transfers.
- Successful transfers leave historical in-flight records with non-zero amount because there is no ack to safely clear them. They are keyed by unique nonce and cannot be reused by duplicate bounce unless the chain delivers an actual bounce for that query.
- V2 still requires full TON-specialist audit for bounce spoofing, gas thresholds, storage growth, and migration.

## 十、是否仍需要重新部署

需要。

Storage layout changed and new message/getter surface was added. If existing mainnet contracts are immutable, this requires a new VestingController deployment and a migration plan.

`InitMint` still requires a separate Minter V2 / deployment redesign before Production.

## 十一、Production 判断

VestingController async transfer failure risk: fixed

InitMint partial failure risk: still open

Production: blocked until InitMint V2 and full redeploy / migration plan are complete

Staging: restricted; can be used for controlled V2 vesting retry/recovery testing after full test pass.
