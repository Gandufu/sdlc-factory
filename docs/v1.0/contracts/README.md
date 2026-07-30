# SDLC Pipeline 1.0 合同索引

状态：M0 Gate 0 的规范性输入；Schema 和矩阵尚未由实现/TCK 验证

本目录保存机器可解析合同。主方案和附录解释“为什么”，本目录定义实现与测试必须共同遵守的字段、矩阵和算法。合同未通过解析、示例和参数化测试前，不得宣称 Gate 0 完成。

## 合同清单

| 合同 | 权威内容 |
|---|---|
| [domain-transitions.yaml](domain-transitions.yaml) | Command、Actor、允许状态、Guard、Event 和 Task/Slice 转换 |
| [approval-invalidation.yaml](approval-invalidation.yaml) | Spec、Review、Delivery Receipt 的 subject 和失效范围 |
| [failure-routing.yaml](failure-routing.yaml) | failure category、origin、repair scope、责任人与重试规则 |
| [runner-enforcement.yaml](runner-enforcement.yaml) | Windows M0 控制项的 enforced、observed、not_enforced 分级 |
| [agent-action-request.schema.json](agent-action-request.schema.json) | 7 个 Agent Action 的统一请求与逐动作 payload |
| [operator-action-request.schema.json](operator-action-request.schema.json) | Operator 决定、取消、诊断和独立 binding 请求 |
| [action-result.schema.json](action-result.schema.json) | 同步完成、拒绝和异步 Operation 的统一结果 |
| [operator-receipt.schema.json](operator-receipt.schema.json) | Operator 决定对 subject、revision 和本地身份的绑定 |
| [task-commit.schema.json](task-commit.schema.json) | Application 提交给 StateStore 的原子结果 |
| [context-bundle.schema.json](context-bundle.schema.json) | `sdlc_context_get` 返回的最小上下文 |
| [error-envelope.schema.json](error-envelope.schema.json) | Agent、Operator 和 Adapter 统一错误结构 |
| [workspace-manifest.schema.json](workspace-manifest.schema.json) | 工作区内容身份和路径规范化结果 |
| [gate-input-manifest.schema.json](gate-input-manifest.schema.json) | 每个 Gate 的确定性输入选择与 digest |
| [fact-change-set.schema.json](fact-change-set.schema.json) | M0 有限事实操作：create、replace、delete |
| [delivery-manifest.schema.json](delivery-manifest.schema.json) | Finalized 源码、事实、Gate 和 Receipt 的不可变索引 |
| [framework-pack.schema.json](framework-pack.schema.json) | Pack 身份、兼容性、路径策略和声明式 Capability |
| [execution-plan.schema.json](execution-plan.schema.json) | Application 交给 Runner 的冻结执行计划 |
| [execution-receipt.schema.json](execution-receipt.schema.json) | 实际 executable、间接 shell、enforcement、readiness 与 cleanup |
| [interface-catalog.schema.json](interface-catalog.schema.json) | ProjectFacts 拥有的内部/外部接口目录 |
| [environment-binding.schema.json](environment-binding.schema.json) | Operator 拥有的环境值、Secret Ref 和 readiness |

上述合同已形成 Gate 0 draft，但还没有实现、TCK、canary 或故障注入 Evidence。`Policy` 和 `Framework Pack Binding` 的独立 revision/Receipt 已规定所有权；其完整 Schema 仅在 M0 canary 出现第二种实际字段需求时固化，不能被普通 FactChangeSet 代替。

## 依赖方向

```text
Adapter
  → Application Use Case
      → pure Domain Kernel
      → StateStorePort
      → FrameworkPackPort
      → HarnessRuntimePort
```

Application 负责装载 Aggregate、校验 Action、调用 Domain、编排 Port，并生成 `TaskCommit`。Domain 不依赖任何 Port；FileStateStore 只检查 CAS、幂等和持久化一致性。

## Action 合同

- Agent 只能提交 [AgentActionRequest](agent-action-request.schema.json) 中的 7 个动作；Schema 不含批准、豁免、Git 或 Finalization；
- `sdlc_task_open(create)` 的 `task_id` 与 `expected_task_version` 必须为 null；resume 和其余 Task 动作必须带当前 version；
- Operator 只通过独立 endpoint 提交 [OperatorActionRequest](operator-action-request.schema.json)；
- 接受、完成和拒绝统一返回 [ActionResult](action-result.schema.json)；`accepted` 必须带 Operation ID，`rejected` 必须引用 [Error Envelope](error-envelope.schema.json)；
- 会形成可信决定的 Operator Action 必须生成 [OperatorReceipt](operator-receipt.schema.json)；M0 的 `signature` 固定为 null，`authn_level` 固定为 `local_unverified`；
- Action Schema 只验证结构；角色、阶段、Guard、CAS 和 subject freshness 仍由 Domain/Application 依据矩阵裁决，不能下放到 Adapter。

## M0 路径与 digest 算法

所有 digest 使用 `sha256:<lowercase-hex>`。对象 digest 基于 UTF-8 编码的 canonical JSON：对象键按 Unicode code point 排序、无多余空白、整数使用最短十进制、禁止浮点数与 NaN/Infinity；字符串按 NFC 后以 JSON 必需规则转义，拒绝 lone surrogate/NUL，数组顺序有语义。

YAML Manifest 必须先由受限 safe loader 转成同一 JSON 数据模型：只允许字符串 key 和 string/integer/boolean/null/array/object，拒绝自定义 tag、anchor/alias、merge key、重复 key、浮点数及隐式日期时间。随后按相同 canonical JSON 算法计算 digest，不能直接 hash YAML 原始文本。

计算对象自哈希时，省略该对象的自哈希成员：Workspace/Delivery 的 `manifest_digest`、Context 的 `bundle_digest`、GateInput 的 `input_digest`，以及 Framework/Environment 的 `metadata.digest`；其他引用 digest 仍进入计算。每个 Schema 的测试向量必须固定输入字节和预期 hash。

`WorkspaceManifest v1` 使用：

1. 从已解析的 Project root 开始，拒绝 root 外 realpath；
2. 相对路径使用 `/`，去除 `.`，拒绝空段、`..`、绝对路径、盘符、UNC 和 NUL；
3. Windows segment 拒绝 `:`（含 ADS）、控制字符、尾随点/空格、保留设备名和大小写无关的 `.git/.sdlc` 绕过；
4. 路径文本规范化为 Unicode NFC；
5. Windows `comparison_key` 使用规范化路径的 Unicode default case-fold；任何 key 碰撞都 fail closed；
6. 普通文件按工作区原始字节流计算 SHA-256，不规范化换行；
7. tracked、staged、unstaged 和 untracked 文件合并为一个按 `comparison_key` 排序的 entry 集合；
8. tracked `.gitignore` 作为普通文件进入 manifest；被忽略输出只通过版本化 exclusion rules 排除；
9. `.git/**`、`.sdlc/**`、coverage、test-results、临时 profile 和 Pack 声明输出不进入源码 manifest，其规则自身形成 `excluded_paths_digest`；
10. symlink/junction 保存 link 类型与规范化 target；指向 Project root 外或形成环时拒绝；
11. Git submodule 在 M0 受控路径内不支持并拒绝；Git LFS 同时记录 pointer OID 和已检出内容 hash；
12. 大文件流式计算；二进制与文本使用相同原始字节规则。

`environment_binding_digest` 不包含 Secret 明文，必须包含 Secret Ref、Provider identity，以及非秘密 version、etag 或 rotation revision。任何一项变化都会使相关 Gate stale。

## Source bundle v1

Delivery 的 `source_bundle_ref` 指向确定性 ZIP：

1. 第一项为本 Delivery 的 canonical `workspace-manifest.json`；
2. 普通文件和 LFS 已检出内容按 `comparison_key` 排序，以 manifest 中的 canonical path 和原始字节写入；
3. ZIP 使用 UTF-8 名称、`ZIP_STORED`、固定时间 `1980-01-01T00:00:00Z`，不写 comment、extra field 或宿主绝对路径；
4. symlink/junction 不在归档中创建可跟随链接，只由 WorkspaceManifest 的类型和 target 描述；受控恢复工具重新校验 root 边界后才可重建；
5. `.git/**`、`.sdlc/**`、Secret 明文和 exclusion outputs 不进入归档；
6. Core 在封存前逐 entry 复算 size/hash，并把最终 ZIP hash 写入 DeliveryManifest 的 artifact ref。

归档自身完整保留即可审计；重建工作区时仍必须以 WorkspaceManifest 为权威，不能盲目解压或信任 ZIP 路径。

## FactChangeSet 限界

M0 不实现通用 diff、JSON Patch、AST Patch 或二进制事实发布。只允许 UTF-8/LF 的 `create`、`replace`、`delete`：

- `replace` 必须匹配 `expected_base_hash` 和 `expected_result_hash`；
- `create` 要求目标不存在；
- `delete` 必须匹配 `expected_base_hash`；
- rename 表达为同一事务内的 `create + delete`；
- operation path 经 Workspace path 规范化后必须唯一，大小写/NFC 碰撞或同一路径多次操作一律拒绝；
- 每个 `content_ref` 都绑定独立 SHA-256；
- 任一操作失败时整个 FactChangeSet 不产生新 facts revision。

## GateSet 与审批

Gate 分为：

| GateSet | 作用 |
|---|---|
| `slice` | 为当前 Execution Slice 提供快速反馈 |
| `review_entry` | 允许 Task 进入 `AwaitingHumanReview` |
| `acceptance` | Review Acceptance 后验证完整业务行为 |
| `delivery` | 生成 Delivery Preview 前验证交付与事实发布条件 |

Project Profile 和 Framework Pack 共同解析 GateSet，Core 冻结最终 gate IDs 和 input digests。Operator 不能通过批准隐式删减 mandatory Gate。

每次 Gate 必须生成 [GateInputManifest](gate-input-manifest.schema.json)。选择规则来自 Pack、Project Profile、Policy 和 Core mandatory inputs；`selection_rule_hash` 也进入 manifest。任一已选输入、选择规则、Parser 或 toolchain digest 改变时 Gate stale；无法判定影响范围时保守 stale，不能沿用旧 Passed 结果。

`approve_delivery` 只生成绑定 DeliveryManifest draft digest 的 Receipt。Application 随后创建不可由 Agent 调用的内部 `facts_finalize` Operation；该 Operation 可在 Supervisor 重启后自动 roll-forward/rollback，但任何输入变化都会使 Delivery Approval stale。

## Workspace 与回滚承诺

M0 Task 是批准与交付边界，不承诺自动撤销普通项目工作区。M0 canary、故障注入和 Shadow Replay 必须在可丢弃的隔离 clone/worktree 内运行；取消 Task 时记录 `rollback_strategy` 和残留变化。

M0 只有 `discard_isolated_workspace` 可声明 `automatic=true`；普通项目的 `manual/apply_source_bundle` 必须为 `automatic=false` 并带操作说明。该字段是审计声明，不授权 Core 自行执行 Git reset、覆盖工作区或远程操作。

M1 才提供正式 Task Workspace Provider、显式丢弃/集成操作和多 Task revision reconciliation，并使 Task 成为可执行的 Workspace 回滚边界。

## Operator 信任模型

M0 能保证：

- Agent Action Schema 不包含审批；
- Framework Pack、Runner Worker 和普通 Adapter 不能生成 Receipt；
- Approval 必须经过独立 Operator endpoint；
- Receipt 绑定 subject、revision、nonce、actor metadata 和前序 hash。

M0 不能保证：

- 同一 OS 用户下的敌对进程无法调用、注入或伪造本地通道；
- 用户级文件/进程权限完全失陷后 Receipt 仍可信。

因此验收用语统一为：“Agent Interface 及其正常工具权限不能产生 Approval；同一 OS 用户完全失陷不在 M0 保证内。”

## 所有权

| 对象 | 所有者 | 变更方式 |
|---|---|---|
| Interface Catalog | ProjectFacts | Agent 提案，Spec Approval，Delivery 发布 |
| Environment Binding | Operator | 独立环境绑定命令、revision 和 Receipt |
| Secret Ref | Operator/Secret Provider | 只保存引用和非秘密版本 |
| Framework Pack Binding | Operator/Core Maintainer | 独立 binding Receipt |
| Policy | Operator/Policy Maintainer | 独立 Policy Revision |

Environment、Pack Binding 和 Policy 不能由普通 FactChangeSet 静默修改。

## 兼容与验证

- 文件内 `apiVersion` 或 Schema `$id` 是兼容身份；
- 任何影响 digest、Guard 或裁决的变化必须升级版本；
- 未知字段默认拒绝，不做旧版 fallback；
- YAML 必须能由安全解析器加载；
- JSON Schema 必须通过 Draft 2020-12 meta-schema；
- 矩阵必须驱动参数化测试，不能由实现重新抄写一份规则。
