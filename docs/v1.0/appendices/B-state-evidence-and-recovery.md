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
load(project_ref, task_id) -> TaskView
transact(TaskCommand, expected_version, idempotency) -> TaskResult
recover(project_ref) -> RecoveryReport
```

`transact` 内部统一负责：

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

本地 checksum/hash chain 只能检测一致性或修改迹象，不证明 Operator 身份，也不能抵抗拥有相同文件写权限的攻击者。

## B.3 FactChangeSet

Spec Approval 冻结 Proposal 和 FactChangeSet，但不立即改写当前 ProjectFacts：

```json
{
  "base_facts_revision": "sha256:...",
  "proposal_hash": "sha256:...",
  "changes": [
    {
      "target": "docs/sdlc/requirements.md",
      "patch_ref": "sdlc://artifact/FACT-PATCH-001"
    }
  ],
  "expected_result_facts_revision": "sha256:...",
  "validation_report_ref": "sdlc://evidence/FACT-VALIDATION-001"
}
```

Agent 执行时，Context Compiler 同时提供当前 ProjectFacts 和已批准增量。Delivery Finalization 才发布新事实：

```text
重检 Revision Vector 和 Delivery Approval
  → 写 FinalizationStarted 事务意图
  → 在临时目录应用并校验全部 FactChangeSet
  → 原子替换可提交文件并记录结果 manifest
  → 写 Delivery / Finalized 事件和 Receipt
  → 刷新 snapshot
```

冲突或校验失败不产生 Finalized。崩溃恢复必须能判断：

```text
尚未发布
已全部发布但事件未补写
已完成
需要人工处理的异常状态
```

下一 Task 只以完整 Finalization 后的新 `facts_revision` 为基线。

## B.4 GateInputManifest

每个 GateRun 保存完整输入：

```json
{
  "gate_id": "test.functional",
  "capability": "test.functional",
  "source_manifest_digest": "sha256:...",
  "fact_refs": {
    "requirements": "sha256:...",
    "interfaces": "sha256:...",
    "verification": "sha256:..."
  },
  "upstream_gate_digests": ["sha256:..."],
  "framework_pack_digest": "sha256:...",
  "policy_digest": "sha256:...",
  "environment_binding_digest": "sha256:...",
  "toolchain_digest": "sha256:...",
  "runner_version": "1.0.0-alpha.1",
  "parser_version": "playwright-json/1.0",
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
3. 与 Pack 的 `invalidationInputs`、上游 Gate、Policy、Environment、toolchain 和 parser 求交；
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
- `sdlc_status` 查询当前 Operation；
- lease 超时后先检查进程树和 Evidence，再决定接管、失败或人工清理；
- 有副作用步骤不能在未知状态下直接重复；
- cancel 是协作式请求，最终必须有 Cancellation/Cleanup Receipt；
- MCP Tasks 只能映射 Operation，不能取代它。

## B.6 Operator Receipt

M0 Receipt 最少绑定：

```json
{
  "receipt_id": "APR-...",
  "action": "approve_spec",
  "project_id": "PRJ-0001",
  "task_id": "TASK-0001",
  "task_version": 8,
  "subject_type": "task_proposal",
  "subject_hash": "sha256:...",
  "revision_vector": {},
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

- Operator Adapter 在 Agent/Runner 权限域之外运行；
- control endpoint、nonce 和状态写路径不进入 Agent 工具白名单；
- 普通项目 shell 直接调用审批命令必须被拒绝；
- `local_unverified` 不证明企业身份，也不抵抗同一 OS 用户已被攻陷；
- 远程 OIDC/RBAC、签名和外部审计锚点不进入 1.0。

## B.7 最小可观测性

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

M0 默认启用 JSONL、Secret/Token redaction、日志大小限制和失败诊断包。`sdlc diagnose export` 只能导出脱敏状态、事件、Gate/Evidence 引用、Environment 摘要、revision 和进程清理报告。
