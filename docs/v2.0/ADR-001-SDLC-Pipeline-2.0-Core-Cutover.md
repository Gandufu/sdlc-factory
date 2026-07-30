# ADR-001：SDLC Pipeline 2.0 Core 切换策略

状态：Proposed，进入实现前必须转为 Accepted

日期：2026-07-30

## 背景

SDLC Pipeline 2.0 是 clean-break 设计。现有 `scripts/sdlc_core/` 的状态、目录、审批和 Gate 语义不是 2.0 的继承契约；但旧 Core 仍可能承载进行中的真实 Task，不能通过一次安装覆盖或双写试验隐式迁移。

切换必须同时满足：

- 不让两个 Core 写同一个 Task、工作区或运行态；
- 不把旧内部状态强行翻译为新领域模型；
- 能用真实输入验证新 Core，而不是只比较单元测试；
- 出现失败时有明确回退路径；
- 不长期维护两套正式 Core。

## 决策候选

采用：

> **Shadow Replay → 新 Task 试点 → 新 Task 切换 → 旧 Core 退役**

### 1. 冻结旧 Core

- 旧 Core 进入 maintenance-only，只修复阻断既有 Task 的缺陷。
- 已开始的旧 Task 继续由旧 Core 完成或由 Operator 明确取消。
- 冻结后不再向旧 Core 引入 2.0 领域语义。

### 2. 隔离 Shadow Replay

- 从同一 Git revision 和同一用户意图创建两个隔离 clone/worktree。
- 旧、新 Core 分别运行，不共享 `.sdlc*`、Evidence、端口、进程或环境写入。
- 比较外部不变量，不要求内部状态、事件名或目录布局相同。

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

Shadow Replay 不向生产仓库、远程分支、发布系统或真实设备写入。

### 3. V2 新 Task 试点

- V2 只在隔离 canary project 上创建新 Task。
- 不迁移旧 Core 的进行中 Task、Attempt、Approval 或 journal。
- 若需要导入既有项目，只导入 Git 中当前有效 ProjectFacts、接口契约和必要 Evidence 引用，并生成一次 `ProjectFactsImport` 校验收据。
- 导入后得到全新的 V2 `facts_revision`；旧 Baseline 编号或内部 ID 不具有 V2 语义。

### 4. 新 Task 切换

满足以下条件后，指定项目的“新 Task 默认入口”才切到 V2：

- 主设计第 10.5 节 P0 黑盒场景全部通过；
- Cutover shadow replay 报告无未决高风险差异；
- canary 的至少一个真实 Task 完成 Spec、Slice、Gate、Review、Delivery 全闭环；
- FileStateStore crash recovery、Runner cleanup 和诊断包均有证据；
- Operator 明确批准切换项目和生效 revision。

切换点只决定“新 Task 用哪个 Core”。已有 Task 不跨 Core 继续。

### 5. 退役旧 Core

- 所有旧 Task 已完成或取消后，停止从默认安装入口分发旧 Core。
- 保留只读归档工具和格式说明，不保留可继续写入的第二套正式生命周期。
- 经过一个明确版本窗口后删除旧写路径；延长窗口必须有新的 ADR。

## 回退

- V2 新 Task 尚未创建：直接把默认入口恢复到固定的旧 Core 版本。
- V2 Task 已创建但未产生外部副作用：Operator 可取消该 Task，并在旧 Core 创建一个新的关联 Task；不得复制 V2 内部状态。
- V2 Task 已产生不可逆外部副作用：禁止自动回退；进入 Suspension，由 Operator 根据 Evidence 决定补偿、继续 V2 或创建恢复 Task。
- 回退不允许两个 Core 对同一工作区双写。

## 明确拒绝

### 同一真实 Task 双写

拒绝。审批、幂等键、Gate、事实发布和进程副作用会互相污染，比较结果也失去意义。

### 强制内部状态一一对应

拒绝。2.0 有意改变 Task、Operation、FactChangeSet、Revision Vector 和 Suspension 语义，只比较可观察不变量。

### 原地迁移进行中 Task

拒绝。没有可证明的事务边界和审批等价性；完成或取消旧 Task 后再创建 V2 Task。

### 长期双轨

拒绝。临时 shadow/canary 有明确退出条件；不能形成两套持续演进的正式 Core。

## 待确认

- 首个 shadow replay 项目和输入 revision；
- 旧 Core maintenance-only 的起始版本；
- canary Task 的业务范围；
- 切换与回退的 Operator 身份和审计位置；
- 旧写路径退役窗口。
