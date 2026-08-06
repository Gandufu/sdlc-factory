# 恢复、治理与机器合同

## 1. 恢复原则

Session、LifecycleStage、StageSubmission、ExecutionRun 和进程调用是不同层次。错误只终止它实际影响的最小层次。

| 错误 | 恢复行为 |
|---|---|
| 认证、网络、限流、模型调用失败 | 保留原 Session、Todo 和草稿；同 Session 重试 |
| OpenCode Server 异常退出 | 重连已持久化 Session；不能删除历史后伪装续接 |
| Requirement/Design 候选退回 | 原主 Session 继续修订；新 Submission 替代旧 Submission |
| Coding/Testing 执行失败 | 保留 Child Session、失败 Run 和 Evidence；操作人员选择继续或放弃 |
| Factory 异常退出 | Reconciler 检查数据库、Git、工作区、进程和 RuntimeLease |
| 测试发现实现缺陷 | Finding 返回 Coding Child Session；修复后重新独立测试 |
| 已批准需求或设计变化 | 创建新 Baseline 版本并执行下游影响分析 |

错误恢复不能自动创建 Gate、批准 Baseline、切换 Model、切换 Host 或执行破坏性 Git reset。

## 2. 工作区与回滚

MVP 仍可串行执行，但 ExecutionRun 的工作区接口必须支持按 CU 或 Slice 隔离。推荐使用 Git worktree 或等价隔离目录：

- 开始前记录 `base_revision` 和干净状态；
- 运行中保存累计 Diff、Handoff 和 Evidence；
- 失败后保留现场供检查；
- “继续”在原 Child Session 和隔离工作区进行；
- “放弃”只丢弃该隔离工作区，不重置项目主工作区；
- 批准后以唯一 Git revision 形成 CodeBaseline。

如果暂时使用单工作目录，任何回滚都必须由操作人员明确确认，并先验证目标 revision 与未提交用户修改。

## 3. 不可变治理事实

- StageSubmission、ReviewRecord、Baseline、Evidence、Handoff 和终态 ExecutionRun 不原地修改；
- Gate 使用 idempotency key 和 expected version；
- 上游 Baseline 变化时，下游历史保留并标记 `STALE` 或 `IMPACT_REVIEW_REQUIRED`；
- SSE、日志和 FactoryTrajectoryEvent 只用于观测，不能推进业务状态；
- 用户全局 OpenCode 私有配置不是项目权威配置，项目只保存明确绑定和非秘密引用。

## 4. 正确的观测关系

Session 与执行是正交关系：

```text
Project
├─ Session
│  ├─ Message
│  ├─ Todo
│  └─ Child Session
├─ LifecycleStage
│  ├─ StageSubmission
│  ├─ Gate
│  └─ Baseline
└─ ExecutionPlan
   └─ CU Task
      └─ ExecutionRun
         ├─ AgentInvocation
         ├─ Tool / Operation
         └─ Evidence
```

Session 与 ExecutionRun 通过关联标识连接，但任何一方都不从属于另一方。一个 Session 可以关联多个 ExecutionRun，一个 ExecutionRun 只能属于一个明确 Stage/CU/Slice。

## 5. 机器合同

核心合同：

- `factory-session.schema.json`：Factory 与 OpenCode 持续 Session 绑定；
- `skill-definition.schema.json`：原生 Skill 的版本、路径、来源和 Hash；
- `stage-submission.schema.json`：Requirement/Design 候选提交；
- `gate-command.schema.json`：正式人工决定；
- `run-request.schema.json`：仅用于受控 ExecutionRun；
- `agent-invocation.schema.json`、`handoff.schema.json`：Host 调用与结构化结果；
- `execution-result.schema.json`、`evidence.schema.json`：确定性执行事实。

CapabilityIndex 不再包含 Skill。ContextExpansionRequest 只加载已登记的权威资料或执行能力；Skill 由 OpenCode 原生发现和按需加载。

PostgreSQL 是唯一权威数据库。所有迁移必须从 V1 顺序回放，Schema 必须同时提供正反样例。Java Core 只依赖 Factory 合同，OpenCode SDK 类型不得越过 Node/TypeScript Host Adapter。
