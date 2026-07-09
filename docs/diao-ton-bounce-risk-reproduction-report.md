# DIAO TON Bounce Risk Reproduction Report

## 一、测试目标

证明 DIAO TON 合约在异步 Jetton transfer failure / bounce 发生时，是否会出现业务状态已经更新但 Jetton 未到账的账实不一致。

结论分类：Risk reproduced。

## 二、测试范围

测试文件：`contracts/tests/diao_bounce_risk.spec.ts`

覆盖路径：

- `BuyPackage`
- `ClaimBuyer`
- `ClaimReserve`
- `ClaimTeam`
- `EmergencyRescueDiao`
- `InitMint`
- `onBouncedMessage`
- `sendJettonTransfer`

未修改正式合约业务逻辑、主网地址、tokenomics、前端或后端。

## 三、合约状态更新顺序分析

`diao_vesting_controller.tolk` 的 `BuyPackage`、`ClaimBuyer`、`ClaimReserve`、`ClaimTeam`、`EmergencyRescueDiao` 都是先调用 `saveVestingStorage`，再通过 `sendJettonTransfer` 向 vesting jetton wallet 发送异步 `AskToTransfer`。

如果后续 `AskToTransfer` 目标 wallet 不存在、代码异常、gas/action 失败或 bounce，vesting controller 的 `onBouncedMessage` 只执行 `skipBouncedPrefix()`，不会恢复：

- `userPackages.packageCount`
- `totalPackagesSold`
- `highestClaimedRound`
- `reserveAlreadyClaimed`
- `teamClaimedRound`
- `emergencyRescued`

`diao_jetton_minter.tolk` 的 `InitMint` 也是先设置 `totalSupply = TOTAL_SUPPLY` 且 `mintable = false`，再分别异步发送 initial circulation 和 vesting allocation。minter 的 `onBouncedMessage` 也不恢复 `totalSupply` 或 `mintable`。

## 四、测试场景与结果表

| 场景 | 构造方式 | 结果 |
| --- | --- | --- |
| BuyPackage immediate transfer failure / bounce | 使用 failing wallet-code controller，使 vesting 发送到无法正常处理 `AskToTransfer` 的 wallet 地址 | Risk reproduced |
| ClaimBuyer transfer failure / bounce | failing wallet-code controller，购买后解锁 round 1，再 claim | Risk reproduced |
| ClaimReserve transfer failure / bounce | failing wallet-code controller，购买、finalize、解锁 round 1 后 reserve claim | Risk reproduced |
| ClaimTeam transfer failure / bounce | failing wallet-code controller，解锁到 round 16 后 team claim | Risk reproduced |
| EmergencyRescueDiao transfer failure / bounce | failing wallet-code controller，pause 后 emergency rescue | Risk reproduced |
| InitMint partial failure / bounce | vesting allocation TON amount 设置为 `1 nanoTON`，initial allocation 成功，vesting allocation 失败 | Risk reproduced |

说明：测试也尝试了接近最低 TON 的正常 wallet 转账路径；sandbox 中该路径对 claim/rescue 仍能实际到账，未作为最终复现证据。最终测试采用异常 wallet-code/failing recipient 模型来稳定构造 transfer failure / bounce，不改正式合约业务逻辑。

## 五、关键 transaction trace / 断言摘要

关键 trace 断言：

- 每条复现交易均断言入口业务交易 `success: true`。
- 每条复现交易均断言 trace 中存在 failed transaction 或 bounced inbound message。
- 每条复现交易均断言业务状态已增加或推进。
- 每条复现交易均断言目标 Jetton wallet balance 未增加。
- `ClaimBuyer` 和 `ClaimTeam` 额外断言 retry 会失败，说明没有 pending/retry/recovery 状态。

关键状态断言：

- `BuyPackage`: `packageCount = 1`，`totalPackagesSold = 1`，buyer DIAO balance `0`。
- `ClaimBuyer`: `highestClaimedRound = 1`，buyer DIAO balance 未增加，再次 claim 返回 `ERR_NOTHING_TO_CLAIM(117)`。
- `ClaimReserve`: `reserveAlreadyClaimed = (7.5B - 3.2M) / 15`，official reserve DIAO balance 未增加。
- `ClaimTeam`: `teamClaimedRound = 16`，team DIAO balance 未增加，再次 claim 返回 `ERR_NOTHING_TO_CLAIM(117)`。
- `EmergencyRescueDiao`: `emergencyRescued = 1 DIAO`，emergency rescue wallet DIAO balance 未增加。
- `InitMint`: `totalSupply = 10B DIAO`，`mintable = false`，initial circulation received `1B DIAO`，vesting controller `funded = false`，retry `InitMint` 返回 `ERR_MINTER_LOCKED(76)`。

## 六、Risk reproduced / not reproduced / inconclusive

Risk reproduced。

## 七、是否需要合约重构

需要。

当前模式是先更新业务状态，再发异步 Jetton transfer，且 bounce handler 不恢复业务状态。应重构为可恢复/可重试模型，例如：

- 将 claim/purchase/rescue 先记录为 pending transfer，到账确认或明确完成后再推进最终业务状态；
- 或在 bounce handler 中按 queryId / transfer type / recipient / amount 恢复对应业务状态；
- 或改为显式 retryable debt accounting，失败时保留可再次领取的 entitlement；
- `InitMint` 需要避免 `mintable=false` 和 `totalSupply=TOTAL_SUPPLY` 在 allocations 未全部成功前永久锁死，或增加受控恢复流程。

## 八、是否需要重新部署

Redeploy required: likely。

如果已部署合约代码没有可升级或可迁移的安全恢复入口，修复业务状态机通常需要新合约部署和迁移计划。

## 九、当前主网合约是否可以 Production

Staging: restricted

Production: blocked

Redeploy required: likely

当前主网合约是否可以 Production：不建议作为 Production 放量使用，除非审计确认主网配置和运行约束能完全排除这些 async failure / bounce 场景，并接受 `InitMint` partial failure 的不可恢复风险。

## 十、推荐下一步

1. 由合约开发重构 claim/purchase/rescue/mint 的异步状态机，增加 pending/retry/recovery。
2. 为 `onBouncedMessage` 增加可验证的业务恢复逻辑，至少覆盖本报告 6 条路径。
3. 在修复版合约上保留本复现测试，并新增成功路径回归测试。
4. 修复完成前，Production blocked；Staging 仅限受控金额、受控地址、受控演练。
