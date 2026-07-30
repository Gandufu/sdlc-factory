# 附录 E：实施阶段门与验收

本附录定义 1.0 M0/M1 的实施顺序、风险 timebox、黑盒场景、成功指标和停止条件。时间用于决策，不是完成 Evidence。

## E.1 M0 技术选择

- 语言：Python；
- 运行拓扑：每项目本地 Core Supervisor + Windows Runner Worker，见 [ADR-002](../adr/ADR-002-Local-Core-Runner-Topology.md)；
- Core：Supervisor 进程内 Application + pure Domain Kernel；
- 状态：StateStorePort `load/commit/recover` + FileStateStore；
- 项目事实：Markdown/YAML + Git；
- Operator：独立本地 endpoint + CLI，信任级别 `local_unverified`；
- Framework Pack：fake + `electron-react`；
- Runner：`local_constrained`；
- canary：已准备、可丢弃的隔离 Electron clone/worktree；
- Host：OpenCode 薄插件、MCP stdio、CLI/SDK 中实测最短的一种；
- 权威平台：Windows x64；Linux/macOS 只保留 Schema 能力，不计入 M0 完成；
- 执行：单 Project、单活动可写 Task，Slice 串行，Gate Operation 可长运行。

M0 不提供通用脚手架、Task 自动工作区回滚、第二 Host、数据库、远程服务、多项目调度或自动发布。

## E.2 M0 严格阶段门

### Gate 0 / Slice 0：Contract Freeze

正式实现前必须完成：

1. [领域词汇表](../../../CONTEXT.md)；
2. Command/Event/Guard/Transition、Approval Invalidation、Failure Routing 三张机器可解析矩阵；
3. Agent 与 Operator Action Schema；
4. ContextBundle 和 Error Envelope；
5. WorkspaceManifest 与 digest 规范；
6. FactChangeSet 有限操作规范；
7. DeliveryManifest；
8. TaskCommit；
9. Framework Pack、ExecutionPlan、ExecutionReceipt Schema；
10. Interface、Environment、Policy、Pack Binding 的所有权与 revision；
11. Runner enforcement matrix；
12. GateSet 与 Finalization Operation 合同；
13. ADR-001 与 ADR-002 已 Accepted，实施不得绕过其边界；
14. 26 个 M0 场景先成为失败测试。

权威入口见 [contracts/README.md](../contracts/README.md)。Gate 0 未完成时，只允许 Domain、FileStateStore、IPC 和 Windows Job Object 技术探针，不允许多个模块并行正式实现。

### Gate 1 / Slice 1A：Storage Kernel Proof

- FileStateStore transaction journal、framed event/checksum 和 snapshot projection；
- project/task OS lock、CAS 和幂等；
- TaskCommit conformance；
- FactPublisher before/after manifest、staging、rollback material 和 applied-path ledger；
- 真实临时 NTFS 目录与 FileOps/Clock/CrashPoint 故障注入；
- M0-11、M0-12、M0-13、M0-25 通过。

M0 只证明受控进程崩溃恢复，不声称已经证明突然断电、文件系统损坏或恶意篡改下的可靠性。

### Gate 1 / Slice 1B：Domain Kernel Proof

- pure Domain Kernel，不引用文件、Git、Clock、Pack、Runner 或 OS；
- 三张矩阵驱动参数化测试；
- TaskStage、SliceStatus、OperationStatus、GateStatus 和单 active Suspension；
- Application 生成 TaskCommit，FileStateStore 不解释业务 Command；
- Operator Receipt、Failure Diagnostic、ContextBundle；
- Delivery Preview 与内部 `facts_finalize` Operation。

Slice 1A、1B 都通过后才能进入 Gate 2。

### Gate 2 / Slice 2：Operation 与 Windows Runner Proof

- Core Supervisor 单实例、恢复前不开放 IPC；
- Agent/Operator versioned local IPC；
- Operation lease、heartbeat、cancel 和 Adapter 断开；
- Windows 业务进程 suspended create → Job Object assign → resume；
- timeout、进程树回收、orphan 检查和 Cleanup Receipt；
- readiness、dynamic port lease、Evidence writer；
- executable/toolchain resolver 与间接 shell 记录；
- redaction、structured logging；
- enforced/observed/not_enforced report。

进程树无法稳定回收时，不接入 Electron Pack。

### Gate 3 / Slice 3：Framework Pack 与 Electron Canary

- fake Pack 完整 TCK；
- 已准备项目的 Electron Pack，不含通用 scaffold；
- pinned toolchain、unit/functional parser；
- start/readiness/functional/cleanup；
- fake external system、Interface Catalog 和 Environment Binding；
- slice/review-entry/acceptance/delivery GateSet；
- Gate invalidation、Evidence freshness 和 DeliveryManifest source bundle。

Electron 只验证 Runner 和 Pack，不反向改变 Domain/Storage 合同。

### Gate 4 / Slice 4：Adapter 与切换演练

- reference CLI/SDK；
- 一个明确选定的 Host Adapter；
- Action/Error/Context conformance；
- Adapter 中断但 Operation 不丢失；
- Shadow Replay Fixture；
- 一个完整 canary Task；
- diagnose bundle；
- ADR-001 切换与回退演练。

Adapter 最后接入；任何把状态机或裁决搬出 Core 的要求都触发停止。

## E.3 风险 Timebox

| Gate | 初始风险 timebox | 退出条件 |
|---|---:|---|
| 0 Contract Freeze | 4–6 个工作日 | Schema、矩阵、ADR 和失败测试可执行 |
| 1 Domain & Storage | 8–12 个工作日 | Domain 参数化测试与 FileStateStore 故障注入通过 |
| 2 Operation & Runner | 7–10 个工作日 | Supervisor、IPC、Job Object、Operation 和诊断通过 |
| 3 Pack & Electron | 6–9 个工作日 | fake + Electron Pack 在真实 canary 通过 |
| 4 Adapter & Cutover | 5–8 个工作日 | reference + 一个 Host Adapter 与切换演练通过 |

Windows x64 单平台 M0 风险估算为 30–45 人日，另预留 5–10 人日缺陷修复和稳定化。它不是固定交付承诺；扩大平台或范围必须重新估算。

到达 timebox 必须记录已通过场景、失败 Evidence、剩余风险，并选择：

```text
passed
scope_adjusted_continue
contract_degraded
stop
```

不能把“已经进入下一 Gate”描述为上一 Gate 通过。

## E.4 M0 黑盒场景

| ID | 场景 | 必须观察到的结果 |
|---|---|---|
| M0-01 | 隔离 canary 创建 Task | 生成 Task、Proposal、Plan、FactChangeSet 和 Revision Vector；无 Baseline 快照 |
| M0-02 | Agent 尝试直接完成 Spec | 没有 Operator Receipt 时保持 `AwaitingSpecApproval` |
| M0-03 | 编译失败后修复 | 只重跑 stale gate；input digest 未变的 passed gate 不重复 |
| M0-04 | 同一失败指纹重复两次 | 创建 Suspension，保留 resume_stage、Evidence 和所需决定 |
| M0-05 | 新 Session 恢复 | 两次 Action 内得到带 digest 的 ContextBundle；不读取 transcript |
| M0-06 | 功能测试需要 Runtime | Supervisor 持久化 Operation；start → readiness → functional → cleanup，失败也 cleanup |
| M0-07 | 项目命令修改 protected path | pre/post manifest 检测变化并使 Gate 失败；不宣称已沙箱阻止同用户进程写入 |
| M0-08 | Delivery Preview | 生成 DeliveryManifest draft，绑定 GateSet、Revision Vector、FactChangeSet 和 mandatory GateRun |
| M0-09 | reference adapter | 不经过 Host 连接 Supervisor，完成状态和 Gate 黑盒测试 |
| M0-10 | Host Adapter 中断 | Schema 与 reference 一致；连接中断不取消已提交 Operation |
| M0-11 | 同一 idempotency key 并发 commit | 只产生一个事件和一个 Operation/GateRun |
| M0-12 | 同 key 不同 payload | 返回 `IDEMPOTENCY_CONFLICT` Error Envelope |
| M0-13 | Prepared、EventDurable、Committed 或 snapshot 替换前后进程崩溃 | 重启先恢复；Task、幂等结果和 event sequence 唯一 |
| M0-14 | GateRun 期间源码变化 | GateStatus=`Stale`，Evidence 不可用于 Delivery |
| M0-15 | symlink/junction 指向项目外或路径大小写碰撞 | WorkspaceManifest 构建失败，Core/Runner 拒绝执行 |
| M0-16 | Windows 后台进程生成子/孙进程后测试失败 | 进程先入 Job 再运行；整棵进程树清理，无 orphan，产生 Cleanup Receipt |
| M0-17 | 日志包含 Token/Secret | Debug Log、Evidence、ContextBundle、诊断包全部脱敏 |
| M0-18 | 外部接口绑定缺失 | Agent 不能修改绑定；运行前创建 Environment Suspension |
| M0-19 | 重放旧 Approval Receipt | subject/task/revision 不匹配，返回拒绝且不写领域事件 |
| M0-20 | Evidence 或 Delivery source bundle 被修改/缺失 | 完整性失败，Delivery Preview/Finalization 拒绝 |
| M0-21 | Pack、Policy、Environment、Toolchain 或 Secret rotation revision 变化 | 相关 GateRun 自动 Stale |
| M0-22 | Host Adapter 被删除 | Core、Action/StateStore/Runner TCK 和 lifecycle 仍通过 |
| M0-23 | 多 AC Task 跨 Session | 从最后 Slice handoff 恢复，不重做已 Accepted Slice |
| M0-24 | Spec Approval 后外部 revision 漂移 | Revision Suspension；按 Invalidation Matrix 失效，无静默 rebase |
| M0-25 | FactsPrepared、逐路径替换、FactsVerified 或 DomainCommitted 前后崩溃 | 开放读取前 roll-forward/rollback；旧事实或新事实完整有效，无部分发布 |
| M0-26 | 同一失败分别来自项目测试与 Pack/parser | 同为 `test_contract`，但 origin、repair_scope、责任人不同；Pack/parser 不开放产品代码修复 |

## E.5 M0 成功指标

- Gate 0 合同均可解析并驱动参数化测试；
- Agent 可见 SDLC Actions 不超过 7；
- 大日志不进入 Action result；
- Session 恢复只依赖 StateStore、ProjectFacts 和 ContextBundle；
- 相同 idempotency 不重复事件、Operation 或 GateRun；
- 所有完成声明绑定当前 Revision Vector 和新鲜 Evidence；
- 每个 Finalized Task 都能导出 DeliveryManifest 和完整 source bundle；
- executable、间接 shell、toolchain 和 Runner enforcement 状态进入 Receipt；
- Agent Interface 及正常工具权限不能产生 Approval；不声明抵抗同 OS 用户完全失陷；
- Adapter 删除后 Core/TCK/lifecycle 仍通过；
- 崩溃恢复、事实发布和 Operation 不依赖 Host Session；
- M0 只对 Windows x64、受信代码和可丢弃 canary 作完成声明；
- 缺 Environment、Runner enforcement、Secret revision 或 mandatory Gate 时 fail closed。

## E.6 M0 停止条件

出现任一情况立即停止增加功能：

- Gate 0 合同仍需由实现自行猜测；
- 同一结构性失败连续三轮没有新证据；
- Adapter 要求把状态机或裁决搬出 Core；
- FileStateStore 开始解释业务 Command；
- Electron 生命周期必须绕过 Core Runner；
- Agent Interface 或正常工具权限能够生成 Approval；
- 跨 Session 恢复必须读取 Host transcript；
- FileStateStore 进程崩溃后无法恢复到唯一状态；
- Runner 无法稳定回收进程树；
- Runner 无法报告 effective enforcement；
- Gate 复用不能由 GateInputManifest 重算；
- 为一个 Feature 被迫先引入数据库、多项目调度或远程控制面。

## E.7 M1 实施切片与 Timebox

| Slice | 范围 | 风险 timebox |
|---|---|---:|
| M1A Workspace & Reconciliation | Task Workspace Provider、丢弃/集成、并发只读、写租约、revision reconciliation | 6–10 人日 |
| M1B Portability & Adapter | 第二 Adapter、一个 POSIX 平台的进程树/路径/cleanup conformance | 5–8 人日 |
| M1C Governance Canary | CSCI/接口追溯或 SBOM、第二 Environment、所有权 Receipt、日志轮转/动态诊断 | 5–8 人日 |
| M1D Real-project Pilot | 两个真实项目、Evidence UX、显式 Git commit 集成、缺陷修复 | 4–9 人日 |

M1 工程风险估算为 20–35 人日；两个真实项目另需 2–4 周自然观察期。Delivery 与 Git commit 必须由 Operator 显式触发，仍不自动 push。

M1 黑盒场景：

| ID | 场景 | 结果 |
|---|---|---|
| M1-01 | 两个 Task 基于同一旧 revision | 首个完成后，第二个必须显式 reconcile |
| M1-02 | 变化不相交 | Reconciliation Receipt + 精确 Gate 失效 |
| M1-03 | 相关事实变化 | Proposal/FactChangeSet 刷新并重新批准 |
| M1-04 | 文本或语义冲突 | Suspension，Operator 合并、拆分或取消 |
| M1-05 | 第二 Adapter/POSIX | 与 reference Action/Error Schema 一致，进程树和 cleanup conformance 通过 |
| M1-06 | 合规 canary | 通过 Pack/Policy/Evidence seam，不修改 Task 核心语义 |

## E.8 完整 1.0 验收

1.0 只有在以下条件全部满足后才完成：

- M0 26 个、M1 6 个场景全部通过；
- 所有 CrashPoint 得到唯一 RecoveryReport；
- 连续至少 50 次 Electron canary 无 orphan process；
- Adapter 中断后 Operation 不丢失；
- 同一输入重复执行得到相同领域裁决；
- 两个真实项目各完成至少 5 个非平凡 Task；
- 每个项目至少验证 2 次跨 Session 恢复；
- 至少验证一次 revision drift/reconcile、Environment Suspension 和旧 Evidence stale；
- 每个 Finalized Task 均能导出完整 DeliveryManifest；
- Shadow Replay 无未解释高风险差异；
- ADR-001、ADR-002 为 Accepted；
- legacy 和 1.0 不对同一真实 Task 双写。
