# SDLC Pipeline 2.0 评审意见处置

状态：已合并到 2026-07-30 评审修订版，实施仍待架构确认

本记录合并处置两轮意见：

- Claude 对 Task 粒度、revision 冲突、验证窗口、Cutover、Gate 失效和合规阶段的评审；
- ChatGPT Pro 对状态、事实发布、文件事务、Evidence freshness、环境接口、Framework Pack、Runner、Receipt、Operation 和可观测性的评审。

外部评审原文不复制进仓库；本文件只保存决定、理由和落点。

## Claude 意见

| 主题 | 处置 | 设计落点 |
|---|---|---|
| Task 粒度模糊 | 采纳 | Task 固定为批准/交付/回滚边界；新增 Execution Slice，Attempt 绑定 `slice_id + phase` |
| 多 Task revision 冲突 | 采纳 | 新增 Revision Vector、漂移守卫、Reconciliation Receipt 和 Suspension；P0 检测，P1 实现多 worktree 协调 |
| 10 个工作日偏乐观 | 采纳 | 取消共享总窗口；五个 Slice 各自 timebox，完整 P0 初始规划 17–25 个工作日 |
| Cutover 留白 | 采纳并调整 | 新增 ADR-001；采用隔离 shadow replay 和新 Task 切换，拒绝同一 Task 双写 |
| Gate 失效范围未展开 | 采纳 | 新增 GateInputManifest、确定性 input digest、保守失效和 P0 TCK |
| CSCI/合规排到 P4 太晚 | 条件采纳 | P0 验证 Interface/Environment seam，P1 做合规 canary，P2 产品化 Pack，P4 只做组织治理 |

“取消 Change”不是缺陷本身。Task 仍是业务增量聚合；Execution Slice 解决 Task 内执行与恢复粒度，不重新引入重复生命周期。

## ChatGPT Pro 意见

| 主题 | 处置 | 设计落点 |
|---|---|---|
| Task 生命周期与运行状态混合 | 采纳并收敛 | TaskStage、OperationStatus、GateStatus 正交；Blocked 改为带 `resume_stage` 的 Suspension |
| 当前事实更新没有闭环 | 采纳 | 新增 FactChangeSet；Spec Approval 冻结增量，Delivery Finalization 事务发布事实 |
| 文件存储没有事务模型 | 采纳并深化 | 新增小而深的 StateStorePort；FileStateStore 负责 CAS、幂等、事件、snapshot 和恢复 |
| Evidence freshness 版本不足 | 采纳 | Revision Vector 覆盖 facts/workspace/pack/policy/environment；workspace 使用 content manifest |
| 外部接口和环境模型过晚 | 采纳并限界 | P0 只做最小 Interface Catalog、Environment Binding 和 Secret Ref，不建设组织级环境平台 |
| Framework Pack 接口过粗 | 采纳并深化 | Pack 只生成声明式 ExecutionPlan；Harness Runtime 执行；新增标准对象、依赖和 invalidationInputs |
| `argv` 不等于安全 | 采纳并限界 | P0 提供 `local_constrained` Runner；不宣称 hostile-code sandbox |
| Operator Receipt 信任过强 | 采纳 | 扩展 revision/actor/authn/hash 字段；P0 明确 `local_unverified`，hash chain 不等于签名 |
| Agent 可声称人工反馈 | 采纳 | `sdlc_feedback_record` 改为 `sdlc_observation_record`；可信人工反馈只走 Operator Interface |
| 长 Gate 缺少 Operation | 采纳 | Gate Action 立即返回 operation ID；Core 自有 heartbeat/lease/cancel/recovery，MCP Tasks 仅映射 |
| 可观测性不能等到 P3 | 采纳并限界 | P0 定义 JSONL、correlation、redaction 和 diagnose bundle；平台聚合/OTLP 后移 |
| 多 Pack 组合 | 预留并验证 | P0 Schema 预留 Project Profile、依赖和冲突；P2 用第二技术栈证明 |
| 控制面不应过早微服务化 | 采纳 | P2/P3 控制面优先模块化单体，Runner 独立隔离 |

评审中的成熟度分数不作为验收依据；设计是否继续只由 Schema、矩阵、TCK、黑盒场景和真实 canary Evidence 决定。

## 合并后的开工门槛

进入新 Core 编码前必须全部满足：

1. Domain vocabulary 明确 Task、Execution Slice、Attempt、Operation、GateRun、Suspension、FactChangeSet 和 Revision Vector。
2. Event → Guard → TaskStage、Evidence/Approval Invalidation、Suspension → Resume 三张矩阵可执行。
3. Agent、Operator、Framework Pack、StateStore、Interface、Environment Schema 固化。
4. GateInputManifest、事实发布事务、幂等和 crash recovery 场景已写成失败测试。
5. fake Framework Pack 的 Runner/TCK 场景可运行。
6. ADR-001 转为 Accepted，并确定首个 shadow replay/canary。

这仍是架构和实施基线确认，不是发布、迁移、外部写入或远程推送授权。
