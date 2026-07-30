# ADR-001：SDLC Pipeline 1.0 Core 切换策略

状态：Proposed，进入实现前必须转为 Accepted

日期：2026-07-30

## 背景

1.0 是 clean-break 设计。现有 `scripts/sdlc_core/` 的状态、目录、审批和 Gate 语义不是 1.0 的继承契约；但 legacy Core 仍可能承载进行中的真实 Task，不能通过覆盖安装或双写隐式迁移。

切换必须：

- 不让两个 Core 写同一个 Task、工作区或运行态；
- 不把 legacy 内部状态强行翻译成 1.0 领域模型；
- 用真实输入验证 1.0，而不只比较单元测试；
- 保留明确回退路径；
- 不长期维护两套正式 Core。

## 决策

采用：

> **Shadow Replay → 1.0 新 Task 试点 → 新 Task 切换 → legacy Core 退役**

### 1. 冻结 legacy Core

- legacy Core 进入 maintenance-only，只修复阻断既有 Task 的缺陷；
- 已开始的 legacy Task 继续由原 Core 完成，或由 Operator 明确取消；
- 冻结后不再向 legacy Core 引入 1.0 领域语义。

### 2. 隔离 Shadow Replay

- 从同一 Git revision 和同一用户意图创建两个隔离 clone/worktree；
- legacy、1.0 Core 分别运行，不共享 `.sdlc*`、Evidence、端口、进程或环境写入；
- 只比较可观察不变量，不要求内部状态、事件名或目录布局一致。

Shadow Replay 必须使用版本化的 `Replay Fixture`，不能让 Agent 在两个 Core 上分别现场采样。Fixture 至少固定：

```text
fixture_id / schema_version / digest
Git revision 与 ProjectFacts manifest
用户意图 Markdown artifact + content hash
预制 Proposal、FactChangeSet 和工作区变化
Operator 决定序列
Pack、Policy、Environment 和 toolchain digest
Gate/Runner 受控结果或故障注入
```

Fixture 记录的是与版本无关的高层刺激和制品，不是 legacy Action 的原始调用序列。legacy 与 1.0 各自通过版本专用 Replay Driver 把同一刺激翻译为本版 Interface 调用；Driver 只做字段和调用编排转换，不能补充领域裁决。

比较运行期间：

- 不调用现场 LLM；
- Clock、UUID、临时路径、端口和并发调度必须注入或归一化；
- 每一步保存输入 digest、输出摘要、领域事件和 Evidence ref；
- 无法映射的刺激必须标为 `not_comparable` 并进入人工处置，不能静默跳过；
- 报告必须绑定 Fixture digest、两个 Core 版本和两个起始 revision。

必须比较：

```text
批准是否绑定正确 subject/revision
受保护路径是否被拒绝
mandatory gates 是否完整
失败分类和停止条件是否等价或更严格
Evidence 是否可复验
Delivery 是否只在新鲜证据下成立
进程和临时资源是否清理
```

Shadow Replay 不得写入生产仓库、远程分支、发布系统或真实设备。

Live Agent 只在后续 canary 中验证交互可用性和恢复体验；其结果不能替代 Shadow Replay 的差分判断。

### 3. 1.0 新 Task 试点

- 1.0 只在隔离 canary project 创建新 Task；
- 不迁移 legacy Core 的进行中 Task、Attempt、Approval 或 journal；
- 导入既有项目时，只导入 Git 中当前有效 ProjectFacts、接口契约和必要 Evidence 引用，并生成 `ProjectFactsImport` 校验收据；
- 导入后生成新的 `facts_revision`，legacy Baseline 编号和内部 ID 不具有 1.0 语义。

### 4. 新 Task 切换

只有同时满足以下条件，指定项目的新 Task 默认入口才能切到 1.0：

- [M0 黑盒场景](../appendices/E-delivery-and-acceptance.md#e4-m0-黑盒场景)全部通过；
- 绑定 Replay Fixture digest 的 Shadow Replay 报告无未决高风险差异或未解释的 `not_comparable`；
- canary 至少一个真实 Task 完成 Spec、Slice、Gate、Review、Delivery 全闭环；
- FileStateStore crash recovery、Runner cleanup 和诊断包均有 Evidence；
- Operator 明确批准切换项目和生效 revision。

切换点只决定新 Task 使用哪个 Core，已有 Task 不跨 Core 继续。

### 5. 退役 legacy Core

- 所有 legacy Task 完成或取消后，停止从默认安装入口分发 legacy Core；
- 保留只读归档工具和格式说明，不保留第二套可写生命周期；
- 在明确版本窗口后删除 legacy 写路径；延长窗口必须有新 ADR。

## 回退

- 尚未创建 1.0 新 Task：默认入口恢复到固定的 legacy Core 版本；
- 1.0 Task 已创建但没有外部副作用：Operator 取消该 Task，并在 legacy Core 创建新的关联 Task；不复制 1.0 内部状态；
- 1.0 Task 已产生不可逆外部副作用：禁止自动回退，创建 Suspension，由 Operator 决定补偿、继续或创建恢复 Task；
- 任何回退都不允许两个 Core 对同一工作区双写。

## 明确拒绝

- **同一真实 Task 双写**：审批、幂等、Gate、事实发布和进程副作用会互相污染；
- **内部状态一一对应**：1.0 有意改变领域语义，只比较外部不变量；
- **原地迁移进行中 Task**：无法证明事务边界和审批等价性；
- **长期双轨**：shadow/canary 必须有退出条件，不能形成两套持续演进的正式 Core。

## 待确认

- 首个 Shadow Replay 项目和输入 revision；
- legacy Core maintenance-only 的起始版本；
- canary Task 的业务范围；
- 切换和回退的 Operator 身份与审计位置；
- legacy 写路径退役窗口。
