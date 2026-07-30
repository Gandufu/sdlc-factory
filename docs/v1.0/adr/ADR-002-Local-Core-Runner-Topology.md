# ADR-002：每项目本地 Core Supervisor 与 Runner Worker

状态：Accepted

日期：2026-07-30

## 背景

1.0 要求长 Operation 在 Host 断开后继续存在，同时保留独立 Agent/Operator Interface、项目锁、恢复和 Windows 进程树清理。一次性 CLI、MCP stdio 或嵌入 Host 的 Core 都无法稳定拥有这些责任。

## 决策

每个活动 Project 运行一个本地 `Core Supervisor`。Application、Domain Kernel 和 Port 编排作为 Supervisor 进程内模块；不可信项目命令只在受控 `Runner Worker` 中执行。

```text
Host Adapter ───── Agent IPC ───┐
Reference CLI ──── Agent IPC ───┤
                                ├─ Core Supervisor
Operator CLI ── Operator IPC ───┘    ├─ Application → Domain Kernel
                                     ├─ StateStore / Pack Ports
                                     └─ Runner Control → Runner Worker
```

Supervisor：

- 通过 project identity 和 OS lock 保证单 Project 单实例；
- 启动后先执行 `recover(project_ref)`，完成前不开放 IPC；
- 拥有 Task/Operation lease、Application 编排和本地版本化 IPC；
- 分离 Agent 与 Operator endpoint，但不把同一 OS 用户下的进程隔离冒充安全边界；
- 持久化 Operation 后才启动 Worker，Host 断开不取消 Operation；
- 崩溃重启后根据 StateStore、进程存活和 Evidence 生成唯一 RecoveryReport。

Runner Worker：

- 只接受已校验的 ExecutionPlan 和 capability token；
- Windows 上以 suspended 方式创建业务进程，先加入 Job Object，再恢复执行；
- 不能调用 Agent/Operator Interface，也不能写 `.sdlc/**`；
- Supervisor 退出时由 Job Object 结束进程树；重启后 Core 将未完成 Operation 恢复为可证明的失败、取消或 Suspension，不伪造继续运行。

本地 IPC transport 是 Adapter 细节。M0 可使用 Windows Named Pipe，但消息必须绑定 `protocol_version`、project identity、request ID、correlation ID 和调用角色。

## 调用与依赖方向

```text
Adapter
  → Application Use Case
      → Domain Kernel
      → StateStorePort
      → FrameworkPackPort
      → HarnessRuntimePort
```

Domain Kernel 只包含实体、值对象、Guard、状态转换和领域事件，不依赖文件、Git、Clock、Pack、Runner 或操作系统。Application 先通过 Domain 完成裁决，再把 `TaskCommit` 交给 StateStore；FileStateStore 不解释业务 Command。

## 拒绝方案

- **Core 嵌入 Host**：Host 生命周期和升级会拥有 Operation，违反可替换 Adapter 目标。
- **每次调用启动一次 Core**：没有稳定持有项目锁、IPC 和恢复编排的进程。
- **一次性 Core 启动独立持久 Worker**：状态恢复和 Operation 所有权分散到两个写者，增加竞态和故障面。

## 后果

- M0 增加 Supervisor 启停、IPC 版本和单实例探针；
- Host Adapter 只连接 Supervisor，不加载 Domain 或 StateStore；
- “Host 断开不取消”成为可执行合同；
- Core Supervisor 崩溃仍会中止业务进程，但 Operation 和 Evidence 不丢失，恢复结果必须诚实；
- 同一 OS 用户完全失陷不在 M0 信任保证内。
