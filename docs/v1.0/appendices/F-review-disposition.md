# 附录 F：评审意见处置

状态：已合并到 1.0 主方案；Conditional Go，仅允许 Gate 0 固化与技术探针

本记录合并处置 Claude 与 ChatGPT Pro 多轮意见。外部评审原文不复制进仓库，只保留决定和权威落点。

## F.1 Claude 意见

| 主题 | 处置 | 设计落点 |
|---|---|---|
| Task 粒度模糊 | 采纳 | Task 固定为批准与交付边界；Execution Slice 提供 Task 内执行与恢复粒度，M1 再提供工作区自动回滚，见[附录 A](A-domain-and-lifecycle.md) |
| 多 Task revision 冲突 | 采纳 | Revision Vector、漂移守卫和 Reconciliation；M0 拒绝漂移，M1 验证多 worktree 协调，见[附录 A](A-domain-and-lifecycle.md)和[附录 E](E-delivery-and-acceptance.md) |
| 10 个工作日偏乐观 | 采纳 | M0 使用五个严格 Gate；Windows x64 风险估算 30–45 人日，另加 5–10 人日稳定化，见[附录 E](E-delivery-and-acceptance.md) |
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
| 长 Operation 缺少进程拓扑 | 采纳 | 每项目 Core Supervisor + Runner Worker，见 [ADR-002](../adr/ADR-002-Local-Core-Runner-Topology.md) |
| Domain 可能依赖基础设施 | 采纳 | Application 编排 pure Domain 与 Ports；StateStore 改收 TaskCommit |
| 生命周期不是可执行合同 | 采纳 | 新增 Command/Guard/Event/Transition、Approval Invalidation 和 Failure Routing YAML |
| digest 算法缺失 | 采纳 | 新增 WorkspaceManifest v1、Windows path/Unicode/link/LFS/exclusion/Secret rotation 规则 |
| FactChangeSet patch 语义不明 | 采纳 | M0 只允许 UTF-8/LF 的 create、replace、delete，rename 为 create+delete |
| M0 Workspace 回滚能力缺失 | 降低承诺 | M0 不承诺普通工作区自动回滚；所有 canary/故障演练使用可丢弃隔离目录，M1 实现 Workspace Provider |
| Delivery 无源码快照 | 采纳 | 新增不可变 DeliveryManifest、WorkspaceManifest 和 source bundle |
| Operator 威胁模型过强 | 采纳 | 只保证 Agent Interface/正常工具不能审批；同 OS 用户完全失陷不在 M0 保证内 |
| Runner 能力表述理想化 | 采纳 | 新增 enforced/observed/not_enforced matrix、toolchain resolver 和间接 shell 记录 |
| Context Compiler 无合同 | 采纳 | 新增 ContextBundle Schema、redaction、size/truncation 和 allowed paths |
| 所有权与可观测配置不完整 | 分阶段采纳 | 所有权进入合同；M0 输出有效配置和 enforcement report，M1 完成动态配置/轮转 TCK |
| scaffold 范围不一致 | 收敛 | M0 明确不提供 scaffold.materialize/workspace.prepare |
| Delivery Approval 与 Finalization 不清 | 采纳 | approve_delivery 只产生 Receipt，Core 创建内部 facts_finalize Operation |
| Human Review 与 Gate 顺序不清 | 采纳 | 固定 slice、review_entry、acceptance、delivery 四类 GateSet |
| M1 计划不完整 | 采纳 | 新增 M1A–M1D、20–35 人日风险估算和量化完整 1.0 验收 |

具体合同分别见：

- [附录 A：领域与生命周期](A-domain-and-lifecycle.md)
- [附录 B：状态、证据与恢复](B-state-evidence-and-recovery.md)
- [附录 C：Framework Pack 与 Runner](C-framework-pack-and-runner.md)
- [附录 E：实施切片与验收](E-delivery-and-acceptance.md)
- [1.0 机器可解析合同](../contracts/README.md)

## F.3 开工门槛

进入 1.0 正式实现前必须完成 Gate 0：

1. [CONTEXT](../../../CONTEXT.md) 和三张机器可解析矩阵固化；
2. Action、ContextBundle、Error、Workspace、FactChangeSet、Delivery 和 TaskCommit Schema 固化；
3. Framework Pack、ExecutionPlan、ExecutionReceipt、Interface 和 Environment Schema 固化；
4. 26 个 M0 场景成为失败测试；
5. ADR-001、ADR-002 保持 Accepted，变更决策必须新建 superseding ADR。

Gate 0 前只允许 Domain、FileStateStore、IPC 和 Windows Job Object 探针。评审分数不作为验收依据；是否继续只由 Schema、矩阵、TCK、黑盒场景和真实 canary Evidence 决定。架构确认也不等同于实施、切换、发布或远程推送授权。
