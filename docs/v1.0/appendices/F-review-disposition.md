# 附录 F：评审意见处置

状态：已合并到 1.0 主方案，实施仍待架构确认

本记录合并处置 Claude 与 ChatGPT Pro 两轮意见。外部评审原文不复制进仓库，只保留决定和权威落点。

## F.1 Claude 意见

| 主题 | 处置 | 设计落点 |
|---|---|---|
| Task 粒度模糊 | 采纳 | Task 固定为批准、交付和回滚边界；Execution Slice 提供 Task 内执行与恢复粒度，见[附录 A](A-domain-and-lifecycle.md) |
| 多 Task revision 冲突 | 采纳 | Revision Vector、漂移守卫和 Reconciliation；M0 拒绝漂移，M1 验证多 worktree 协调，见[附录 A](A-domain-and-lifecycle.md)和[附录 E](E-delivery-and-acceptance.md) |
| 10 个工作日偏乐观 | 采纳 | M0 拆为六个独立 timebox；Windows x64 单平台初始规划 20–29 个工作日，见[附录 E](E-delivery-and-acceptance.md) |
| Cutover 留白 | 采纳 | 隔离 Shadow Replay 后只切换新 Task，拒绝同一 Task 双写，见 [ADR-001](../adr/ADR-001-Core-Cutover.md) |
| Gate 失效范围未展开 | 采纳 | GateInputManifest、确定性 input digest、保守失效和 M0 TCK，见[附录 B](B-state-evidence-and-recovery.md) |
| CSCI/合规过晚 | 条件采纳 | M0 验证 Interface/Environment seam，M1 完成合规 canary，2.0 再产品化治理能力 |
| M0 硬骨头集中 | 采纳 | Storage Kernel 独立为 Slice 1A，恢复测试不过则不进入生命周期、Runner 或 Pack |
| Shadow Replay 可比性 | 采纳 | 使用版本化 Replay Fixture 和专用 Driver；差分运行不调用现场 LLM，见 [ADR-001](../adr/ADR-001-Core-Cutover.md) |
| Failure Router 分类可能丢失 | 已有分类，补强合同 | 保留 `test_contract/infrastructure`，新增 fault_origin、repair_scope 和 responsible_actor |
| FileStateStore 风险集中 | 采纳 | 明确 Task/Facts 事务阶段、轻量 WAL、roll-forward/rollback 和逐阶段故障注入 |
| M0 跨平台范围不清 | 补充 | 权威 canary 固定 Windows x64；M1 再验证一个 POSIX 平台 |

Task 仍是业务增量聚合；Execution Slice 只解决 Task 内执行和恢复粒度，不引入第二套生命周期。

## F.2 ChatGPT Pro 意见

| 主题 | 处置 | 设计落点 |
|---|---|---|
| Task 生命周期与运行状态混合 | 采纳 | TaskStage、OperationStatus、GateStatus 正交；Blocked 改为带 `resume_stage` 的 Suspension |
| 当前事实更新没有闭环 | 采纳 | Spec Approval 冻结 FactChangeSet，Delivery Finalization 事务发布 ProjectFacts |
| 文件存储没有事务模型 | 采纳 | StateStorePort 隐藏 CAS、幂等、事件、snapshot 和恢复 |
| Evidence freshness 不足 | 采纳 | Revision Vector 覆盖 facts、workspace、pack、policy 和 environment |
| 外部接口和环境模型过晚 | 采纳并限界 | M0 只做 Interface Catalog、Environment Binding 和 Secret Ref |
| Framework Pack 接口过粗 | 采纳 | Pack 只生成声明式 ExecutionPlan，Harness Runtime 负责执行 |
| `argv` 不等于安全 | 采纳并限界 | M0 Runner 标记 `local_constrained`，不宣称 hostile-code sandbox |
| Operator Receipt 信任过强 | 采纳 | 绑定 revision、actor、authn 和 hash；M0 明确 `local_unverified` |
| Agent 可声称人工反馈 | 采纳 | Agent 只记录 observation；可信人工反馈只走 Operator Interface |
| 长 Gate 缺少 Operation | 采纳 | Gate Action 返回 operation ID；Core 管理 lease、cancel 和恢复 |
| 可观测性过晚 | 采纳并限界 | M0 定义 JSONL、correlation、redaction 和 diagnose bundle |
| 多 Pack 组合 | 预留 | M0 固化 Schema，M1/2.0 用第二技术栈验证 |
| 控制面过早微服务化 | 采纳 | 2.0 控制面优先模块化单体，Runner 独立隔离 |

具体合同分别见：

- [附录 A：领域与生命周期](A-domain-and-lifecycle.md)
- [附录 B：状态、证据与恢复](B-state-evidence-and-recovery.md)
- [附录 C：Framework Pack 与 Runner](C-framework-pack-and-runner.md)
- [附录 E：实施切片与验收](E-delivery-and-acceptance.md)

## F.3 开工门槛

进入 1.0 Core 编码前必须：

1. 固化 Domain vocabulary 与状态、失效、恢复矩阵；
2. 固化 Agent、Operator、Framework Pack、StateStore、Interface 和 Environment Schema；
3. 把 GateInputManifest、事实发布、幂等和 crash recovery 场景写成失败测试；
4. 运行 fake Framework Pack 的 Runner/TCK 场景；
5. 将 ADR-001 转为 Accepted，并确定首个 Shadow Replay/canary。

评审分数不作为验收依据；是否继续只由 Schema、矩阵、TCK、黑盒场景和真实 canary Evidence 决定。架构确认也不等同于实施、切换、发布或远程推送授权。
