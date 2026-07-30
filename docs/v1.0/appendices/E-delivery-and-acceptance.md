# 附录 E：实施切片与验收

本附录定义 1.0 M0/M1 的实施顺序、timebox、黑盒场景、成功指标和停止条件。

## E.1 M0 技术选择

- 语言：Python；
- Core：in-process Application + JSON Schema reference adapter；
- 状态：StateStorePort + FileStateStore；
- 项目事实：Markdown/YAML + Git；
- Operator：本地独立 CLI/control channel；
- Framework Pack：fake + `electron-react`；
- Runner：`local_constrained`；
- canary：隔离 Electron project；
- Host：OpenCode 薄插件、MCP stdio、CLI/SDK 中实测最短的一种；
- 执行：单 Project、单活动可写 Task，Slice 串行，Gate Operation 可长运行。

第二 Host、数据库、远程服务、多项目调度和自动发布都不是 M0 条件。

## E.2 M0 实施切片

### Slice 0：契约与不变量

- Domain vocabulary；
- TaskStage/Operation/Gate/Suspension 三张矩阵；
- Agent、Operator、Framework Pack、Interface、Environment Schema；
- Revision Vector、GateInputManifest、FactChangeSet；
- StateStore transaction、Diagnostic Code；
- 黑盒场景先写成失败测试。

### Slice 1：可靠 Core

- `sdlc_status`、`sdlc_task_open`；
- Proposal/Plan/FactChangeSet validation；
- FileStateStore、workspace lease、幂等、crash recovery；
- Operator Receipt；
- Operation/GateRun/Evidence；
- Failure Router；
- Delivery Preview、事实发布和 Finalization。

### Slice 2：Harness Runtime

- process tree、timeout/cancel、orphan cleanup；
- canonical path、clean environment、Secret/网络白名单；
- resource/log limits；
- background runtime、readiness、cleanup；
- revision manifest、Evidence writer；
- redaction、structured logging；
- Operation lease/heartbeat/recovery。

### Slice 3：Framework Pack 与 canary

- fake Pack 完整 TCK；
- Electron Pack；
- unit/functional parser；
- start/readiness/cleanup；
- Interface Catalog 和 Environment Binding；
- 外部依赖 failure；
- Gate invalidation 和 Evidence freshness。

### Slice 4：Adapter

- reference CLI/SDK；
- Action Interface 黑盒测试；
- 一个 Host Adapter；
- 最小入口 Skill/Command；
- Adapter 不含状态机的静态检查；
- MCP 未入选时只保留探针结论。

## E.3 Timebox

| Slice | 初始 timebox | 退出条件 |
|---|---:|---|
| 0 | 3–4 个工作日 | Schema、矩阵和场景可执行 |
| 1 | 4–6 个工作日 | Core/FileStateStore 在故障注入下通过 |
| 2 | 5–7 个工作日 | Runner、Operation、Evidence 和诊断通过 |
| 3 | 3–5 个工作日 | fake + Electron Pack 在真实 canary 通过 |
| 4 | 2–3 个工作日 | reference + 一个 Host Adapter conformance 通过 |

M0 初始规划为 17–25 个工作日。时间只用于风险控制，不是完成证据。

到达 timebox 仍未满足退出条件时必须记录：

```text
已通过场景
未通过场景
失败 Evidence
剩余风险
缩减、修正或停止决定
```

不能把“已经开始下一个 Slice”描述为当前 Slice 通过。

## E.4 M0 黑盒场景

| ID | 场景 | 必须观察到的结果 |
|---|---|---|
| M0-01 | 新项目创建 Task | 生成 Task、Proposal、Plan、FactChangeSet 和 Revision Vector；无 Baseline 快照 |
| M0-02 | Agent 尝试直接完成 Spec | 没有 Operator Receipt 时保持 `AwaitingSpecApproval` |
| M0-03 | 编译失败后修复 | 只重跑 stale gate；input digest 未变的 passed gate 不重复 |
| M0-04 | 同一失败指纹重复两次 | 创建 Suspension，保留 resume_stage、Evidence 和所需决定 |
| M0-05 | 新 Session 恢复 | 两次 Action 内得到 Task/Slice/Operation、下一步和最小上下文 |
| M0-06 | 功能测试需要 Runtime | start → readiness → functional → cleanup；失败也 cleanup |
| M0-07 | 修改 protected path | Core 拒绝 GateRun，不依赖 Host hook |
| M0-08 | Delivery Preview | 绑定结果 Revision Vector、FactChangeSet 和全部 mandatory gates |
| M0-09 | reference adapter | 不经 Host 完成状态和 Gate 黑盒测试 |
| M0-10 | Host Adapter | Schema 与 reference 一致，Host 不拥有状态 |
| M0-11 | 同一 idempotency key 并发调用 | 只产生一个事件和一个 Operation/GateRun |
| M0-12 | 同 key 不同 payload | 返回 `IDEMPOTENCY_CONFLICT` |
| M0-13 | 事件后、snapshot 前崩溃 | 重启后自动恢复 |
| M0-14 | GateRun 期间源码变化 | GateStatus=`Stale`，Evidence 不可用于 Delivery |
| M0-15 | symlink/junction 指向项目外 | Core/Runner 拒绝执行 |
| M0-16 | 后台子进程后测试失败 | 进程树全部清理，无 orphan，产生 Cleanup Receipt |
| M0-17 | 日志包含 Token/Secret | Debug Log、Evidence、诊断包全部脱敏 |
| M0-18 | 外部接口绑定缺失 | 运行前创建 Environment Suspension |
| M0-19 | 重放旧 Approval Receipt | subject/task/revision 不匹配，拒绝 |
| M0-20 | Evidence 被修改或缺失 | 完整性失败，Delivery Preview 拒绝 |
| M0-21 | Pack digest 变化 | 相关 GateRun stale |
| M0-22 | Adapter 被删除 | Core、Action/StateStore/Runner TCK 和 lifecycle 仍通过 |
| M0-23 | 多 AC Task 跨 Session | 从最后 Slice handoff 恢复，不重做已完成 Slice |
| M0-24 | Spec Approval 后 revision 漂移 | Revision Suspension；相关 Approval/Gate stale，无静默 rebase |
| M0-25 | 事实文件替换中途崩溃 | 恢复后旧事实或新事实完整有效，无部分发布 |

## E.5 M0 成功指标

- Agent 可见 SDLC Actions 不超过 7；
- 大日志不进入 Action result；
- Session 恢复不依赖 transcript；
- 相同 idempotency 不重复事件、Operation 或 GateRun；
- 不同 payload 不误重放；
- 所有完成声明绑定当前 Revision Vector 和新鲜 Evidence；
- Pack 命令、Parser 和 path policy 不能被 Agent 参数覆盖；
- Agent Tool 无法伪造 Operator Approval；
- Adapter 删除后 Core/TCK/lifecycle 仍通过；
- 窄 Feature 修正不重跑 init/spec 全流程；
- 崩溃恢复、事实发布和 Operation 不依赖 Host Session；
- 缺 Environment、Runner 能力或 Secret 时 fail closed。

## E.6 M0 停止条件

出现任一情况立即停止增加功能：

- 同一结构性失败连续三轮没有新证据；
- Adapter 要求把状态机或裁决搬出 Core；
- Electron 生命周期必须绕过 Core Runner；
- Operator Approval 仍可由普通 Agent Tool 伪造；
- 跨 Session 恢复必须读取 Host transcript；
- FileStateStore 故障后无法恢复到唯一状态；
- Runner 无法稳定回收进程树；
- Runner 无法报告未强制的安全限制；
- Gate 复用不能由 GateInputManifest 重算；
- 为一个 Feature 被迫先引入数据库、多项目调度或远程控制面。

## E.7 M1：Local Project Harness

M0 通过后增加：

- Task worktree provider；
- 多 Task 只读并存、单 worktree 写租约；
- revision reconciliation；
- UI/浏览器可读 Evidence；
- 更完整 Failure Router；
- 第二 Adapter conformance；
- Delivery 与 Git commit 的显式 Operator 集成，不自动 push；
- 一个 CSCI/接口追溯或 SBOM canary；
- 第二种真实 Environment Binding。

M1 黑盒补充：

| ID | 场景 | 结果 |
|---|---|---|
| M1-01 | 两个 Task 基于同一旧 revision | 首个完成后，第二个必须显式 reconcile |
| M1-02 | 变化不相交 | Reconciliation Receipt + 精确 Gate 失效 |
| M1-03 | 相关事实变化 | Proposal/FactChangeSet 刷新并重新批准 |
| M1-04 | 文本或语义冲突 | Suspension，Operator 合并、拆分或取消 |
| M1-05 | 第二 Adapter | 与 reference Action Schema/诊断一致 |
| M1-06 | 合规 canary | 通过 Pack/Policy/Evidence seam，不修改 Task 核心语义 |

1.0 只有在 M0 和 M1 均满足退出条件后才完成。
