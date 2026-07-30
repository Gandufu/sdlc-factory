# 附录 B：状态、证据与恢复

本附录定义 1.0 的 StateStore、幂等、FactChangeSet、Evidence freshness、Operation 和诊断契约。目录规范见 [附录 D](D-project-document-layout.md)。

## B.1 存储原则

- ProjectFacts 保存在 Git 管理的可阅读文档和结构化接口契约中；
- Task 只保存增量，不复制全量项目事实；
- JSON 保存 ID、状态、哈希、索引和引用，不保存大段需求或对话；
- 大日志只通过 Evidence ref 引用；
- FileStateStore 是 M0 Adapter，不进入 Domain；
- 未来数据库只替换运行索引，不取代 Git 中的 ProjectFacts；
- Secret 明文不进入仓库、状态文件、日志、Evidence 或模型上下文。

## B.2 StateStorePort

Application 只依赖一个小而深的接口：

```text
load(project_ref, task_id) -> TaskEnvelope
commit(TaskCommit) -> CommitResult
recover(project_ref) -> RecoveryReport
```

Application 先通过 Domain Kernel 产生 Event 和结果，再构造 [TaskCommit](../contracts/task-commit.schema.json)。FileStateStore 不接收或解释业务 Command。`commit` 内部统一负责：

- `expected_task_version` CAS；
- 单调 event sequence；
- 领域事件追加；
- idempotency 结果；
- snapshot 刷新意图；
- Evidence/Receipt 引用提交；
- transaction/action/correlation ID。

M0 FileStateStore 必须满足：

- project/task 文件锁和 workspace lease；
- idempotency key 绑定 action 与规范化 request hash；
- 同 key 同 payload 重放原结果；
- 同 key 不同 payload 返回 `IDEMPOTENCY_CONFLICT`；
- 事件先于 snapshot，snapshot 可以从事件重建；
- event schema version 和 checksum/hash chain；
- Evidence 先写临时文件，校验后原子移动；
- 写事件后、写 snapshot 前崩溃可恢复；
- 启动时输出唯一 RecoveryReport。

### B.2.1 Task 事务协议

`StateStorePort` 保持 `load / commit / recover` 三个方法。文件锁、framing、flush、rename、failpoint 和 journal 都是 FileStateStore 内部实现，不能扩散到 Application 调用者。

每次 `commit` 使用以下持久化阶段：

| 阶段 | 必须持久化的内容 | 崩溃恢复 |
|---|---|---|
| `Prepared` | transaction ID、expected version、action、request hash、idempotency key | 尚无完整事件时删除准备记录，不改变 Task |
| `EventDurable` | 带 sequence、transaction ID、request hash、结果和 checksum 的完整事件记录 | 事件完整则确定性 roll-forward；尾部记录不完整则按 framing/checksum 丢弃 |
| `Committed` | commit marker 与可重建的 idempotency result | Task 结果已成立；补建 snapshot 和索引 |
| `Completed` | snapshot version/checksum 与清理结果 | 正常返回或幂等重放 |

约束：

- 事务先获取 project/task 锁，再检查 TaskCommit 中的 CAS 和 idempotency；
- 事件记录必须可检测 torn write；不能把“最后一行能被 JSON parser 读取”当作完整性证明；
- idempotency request hash 和原始结果必须进入可从事件恢复的持久记录，不能只保存在 snapshot；
- snapshot 是投影，不是提交点；必须先写临时文件、校验 version/checksum，再原子替换；
- `commit` 只在 `Committed` 可证明后返回成功；
- `recover(project_ref)` 必须在任何 `load/commit` 暴露项目状态前完成；
- 无法证明 roll-forward 或 rollback 的事务创建 Storage Suspension，并拒绝后续写入。

M0 使用真实临时 NTFS 目录和可注入的 FileOps/Clock/CrashPoint 内部 seam 测试该模块，不用内存 StateStore 替代文件崩溃语义。故障注入至少覆盖每次阶段写入、flush、rename、事件追加和 snapshot 替换之前/之后。

M0 首先承诺受控**进程崩溃**后的恢复，不把 CrashPoint 测试描述为已经证明突然断电、文件系统损坏、磁盘控制器欺骗 flush 或恶意篡改下的完整可靠性。

本地 checksum/hash chain 只能检测一致性或修改迹象，不证明 Operator 身份，也不能抵抗拥有相同文件写权限的攻击者。

## B.3 FactChangeSet

Spec Approval 冻结 Proposal 和 FactChangeSet，但不立即改写当前 ProjectFacts：

```json
{
  "schema_version": "1.0",
  "base_facts_revision": "sha256:...",
  "proposal_hash": "sha256:...",
  "operations": [
    {
      "op": "replace",
      "path": "docs/sdlc/requirements.md",
      "expected_base_hash": "sha256:...",
      "content_ref": "sdlc://artifact/FACT-CONTENT-001",
      "content_hash": "sha256:...",
      "media_type": "text/markdown",
      "encoding": "utf-8",
      "line_endings": "lf",
      "expected_result_hash": "sha256:..."
    }
  ],
  "expected_result_facts_revision": "sha256:...",
  "validation_report_ref": "sdlc://evidence/FACT-VALIDATION-001"
}
```

M0 只允许 `create/replace/delete`，rename 使用同一事务内的 `create + delete`；不实现通用 diff、AST patch 或二进制事实写入。权威字段与约束见 [FactChangeSet Schema](../contracts/fact-change-set.schema.json)。

Agent 执行时，Context Compiler 同时提供当前 ProjectFacts 和已批准增量。Delivery Finalization 才发布新事实：

```text
重检 Revision Vector 和 Delivery Approval
  → FactsPrepared：写 before/after manifest、staging 和 rollback material
  → Publishing：持有 ProjectFacts 独占租约并逐路径替换
  → FactsVerified：校验完整 after manifest
  → DomainCommitted：写 Delivery / Finalized 事件和 Receipt
  → Completed：刷新 snapshot 并清理 transaction material
```

普通文件系统不能把多个权威文件在物理上一次性原子替换。1.0 承诺的是恢复原子性：

- Publishing 期间不向 Context Compiler、Task Open 或其他读者暴露 ProjectFacts；
- 每次目标替换后记录 applied-path ledger；
- 启动时先恢复未完成 Finalization，再开放读取和写入；
- staging 和 after manifest 完整时优先 roll-forward 到新事实；
- staging 不完整但 rollback material 和 before manifest 完整时 rollback 到旧事实；
- 两侧都无法完整证明时创建 Storage Suspension，禁止生成新 `facts_revision`；
- 每个阶段和每个目标文件替换前后都必须存在故障注入点。

这里的 transaction journal 是 FileStateStore 内部轻量 WAL，不引入数据库，也不把 journal 细节加入 `StateStorePort` Interface。

冲突或校验失败不产生 Finalized。恢复必须能判断：

```text
尚未发布
部分发布但可安全 roll-forward
部分发布但只能 rollback
已全部发布但领域事件未补写
已完成
无法证明新旧任一完整版本，需要 Suspension
```

下一 Task 只以完整 Finalization 后的新 `facts_revision` 为基线。

### B.3.1 DeliveryManifest 与 Finalization Operation

Delivery Preview 必须生成 [DeliveryManifest](../contracts/delivery-manifest.schema.json) draft，并冻结源码 WorkspaceManifest、source bundle、FactChangeSet、mandatory GateRun 和全部 Receipt 引用。

`approve_delivery` 只生成绑定 draft digest 的 Operator Receipt，不在 Operator 调用栈内直接替换事实。Application 随后持久化内部 `facts_finalize` Operation：

```text
DeliveryApproved
  → FactsFinalizeOperationRequested
  → FactsPrepared / Publishing / FactsVerified
  → DeliveryManifest sealed
  → ProjectFactsPublished / DeliveryFinalized
```

该 Operation 不暴露给 Agent。Supervisor 重启后可以依照同一 transaction ID 和 approved manifest digest 自动 roll-forward/rollback；任何 manifest 输入变化都会使 Delivery Approval stale。

Finalized 后必须长期保留 manifest 和带 hash 的 source bundle，使当时的 tracked、untracked 和二进制源码状态可以审计或重建。JSON 只保存索引与引用，源码内容留在不可变 artifact。

## B.4 GateInputManifest

每个 GateRun 保存 [GateInputManifest](../contracts/gate-input-manifest.schema.json)。以下是结构示例：

```json
{
  "api_version": "sdlc.dev/gate-input-manifest/v1alpha1",
  "manifest_id": "GINPUT-0007",
  "gate_id": "test.functional",
  "gate_set": "acceptance",
  "revision_vector": {
    "facts_revision": "sha256:...",
    "workspace_revision": "sha256:...",
    "framework_pack_digest": "sha256:...",
    "policy_digest": "sha256:...",
    "environment_binding_digest": "sha256:..."
  },
  "parser_digest": "sha256:...",
  "toolchain_digests": {
    "node": "sha256:..."
  },
  "selected_inputs": [
    {
      "kind": "workspace_path",
      "identity": "src/renderer/App.tsx",
      "digest": "sha256:...",
      "selection_source": "pack"
    }
  ],
  "selection_rule_hash": "sha256:...",
  "input_digest": "sha256:..."
}
```

复用 GateRun 的必要且充分条件：

```text
input_digest 相同
+ GateStatus = Passed
+ Evidence 完整性校验通过
```

失效计算：

1. 从 Git/content manifest 得到 changed paths；
2. 从 Requirement/AC/interface/verification 得到 changed fact nodes；
3. 与 Pack 的 `invalidationInputs`、上游 Gate、Policy、Environment、toolchain 和 parser 求交，冻结为 `selected_inputs`；
4. 命中则 GateStatus=`Stale`，并向下游传播；
5. 未知输入或无法解析的变化默认保守失效；
6. Operation 开始和结束 revision 不一致时，本轮结果直接 Stale。

示例：

- 只改前端代码，输入仅含后端目录的 unit gate 可以复用；
- 覆盖端到端用户流程的 functional gate 必须失效；
- 接口契约变化时，声明依赖该接口的前后端 Gate 都失效；
- Pack、Policy、Environment 或 Parser digest 变化时，相应 Gate 失效。

## B.5 Operation

长 Gate 不依赖 Host 保持同步调用：

```json
{
  "operation_id": "OP-0001",
  "kind": "gate_run",
  "status": "Running",
  "project_id": "PRJ-0001",
  "task_id": "TASK-0001",
  "slice_id": "SLICE-0002",
  "gate_run_id": "GATE-0007",
  "lease_owner": "runner-001",
  "heartbeat_at": "...",
  "cancellation_requested": false,
  "revision_vector": {}
}
```

规则：

- `sdlc_gate_run` 持久化 Operation 后立即返回 `accepted + operation_id`；
- Host 断开不取消 Operation；
- Operation 的持续载体是 [ADR-002](../adr/ADR-002-Local-Core-Runner-Topology.md) 选定的每项目 Core Supervisor，而不是 Host Session；
- `sdlc_status` 查询当前 Operation；
- lease 超时后先检查进程树和 Evidence，再决定接管、失败或人工清理；
- 有副作用步骤不能在未知状态下直接重复；
- cancel 是协作式请求，最终必须有 Cancellation/Cleanup Receipt；
- MCP Tasks 只能映射 Operation，不能取代它。

## B.6 ContextBundle

`sdlc_context_get` 返回 [ContextBundle v1](../contracts/context-bundle.schema.json)。它是当前 Action 和 Revision Vector 下的临时编译视图，不是新的 ProjectFacts，也不依赖 Host transcript。

Context Compiler 必须：

- 只解析带 hash 的 facts、approved increment、Gate/Evidence summary 和 Suspension 引用；
- 同时生成 allowed read/write paths 与 Failure Diagnostic 的 repair_scope；
- 不把 Secret 明文、完整日志或未授权路径放入模型上下文；
- 对截断内容返回 `omitted_refs`，不能无提示截断；
- 返回 redaction report、bundle digest 和 next allowed actions；
- revision 变化后拒绝复用旧 bundle。

## B.7 Operator Receipt

M0 Receipt 最少绑定：

```json
{
  "api_version": "sdlc.dev/operator-receipt/v1alpha1",
  "receipt_id": "APR-...",
  "action": "approve_spec",
  "project_ref": "PRJ-0001",
  "task_id": "TASK-0001",
  "task_version": 8,
  "subject_type": "task_proposal",
  "subject_ref": "sdlc://artifact/PROPOSAL-0001",
  "subject_hash": "sha256:...",
  "revision_vector_ref": "sdlc://artifact/REVISION-VECTOR-0001",
  "revision_vector_hash": "sha256:...",
  "actor_id": "local-operator",
  "actor_roles": ["reviewer"],
  "authn_level": "local_unverified",
  "issued_at": "...",
  "nonce": "...",
  "previous_receipt_hash": "sha256:...",
  "signature": null
}
```

要求：

- Operator Adapter 使用独立 endpoint，且不属于 Agent/Runner 的正常 Interface；
- control endpoint、nonce 和状态写路径不进入 Agent 工具白名单；
- Agent Interface、Framework Pack 和 Runner Worker 不能生成 Receipt；
- `local_unverified` 不证明企业身份，也不抵抗同一 OS 用户已被攻陷；
- 同一 OS 用户拥有任意文件/进程权限时可能绕过本地通道，这不在 M0 保证内；
- 远程 OIDC/RBAC、签名和外部审计锚点不进入 1.0。

因此验收只能表述为：“Agent Interface 及其正常工具权限不能产生 Approval”，不能声称本地敌对进程不可伪造审批。

## B.8 最小可观测性

1.0 区分：

| 类型 | 用途 |
|---|---|
| Debug Log | 定位 Core、Adapter、Runner 和 Pack 问题 |
| Audit Event | 记录谁请求了什么控制动作 |
| Domain Event | 重建 Task/Operation/Gate 状态 |
| Evidence | 支撑 Gate 和 Delivery 结论 |
| Metric | 统计耗时、失败、恢复、返工和清理 |

结构化记录按适用范围包含：

```text
trace_id
correlation_id
action_id
transaction_id
project_id
task_id
slice_id
attempt_id
operation_id
gate_run_id
workspace_id
framework_pack_digest
facts_revision
```

M0 默认启用 JSONL、Secret/Token redaction、日志大小限制和失败诊断包。`sdlc diagnose export` 只能导出脱敏状态、事件、Gate/Evidence 引用、Environment 摘要、revision、有效日志配置、Runner enforcement report 和进程清理报告。

配置合同至少包含：

```text
global log level
Core / Application / Store / Runner / Pack / Adapter component levels
JSONL / console sinks
max file bytes / retained file count
Action request/response summary toggle
state transition summary toggle
Runner process diagnostic toggle
redaction strict mode
diagnose bundle max bytes
```

Audit Event 和 Domain Event 不能被 Debug 配置关闭；Debug Log 可以动态调整。所有 Action result 只返回摘要与 `details_ref`，所有记录携带 correlation ID。完整轮转和动态配置 TCK 属于 M1。
