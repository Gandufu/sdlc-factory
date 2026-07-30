# SDLC Factory

面向 AI Agent 的可恢复、可验证 SDLC Harness。

当前只完善 **1.0**：先在单项目、单活动写 Task 下跑通从增量需求到 Delivery Ready 的闭环。**2.0** 是后续软件工厂演进方向，不进入当前实现范围。

## 1.0 主流程

```text
恢复 ProjectFacts
  → 创建或恢复 Task
  → 按 Requirement / AC 拆分 Execution Slice
  → 编辑并校验 Proposal + FactChangeSet
  → Operator 批准 Spec
  → Agent 分 Slice 实现
  → Harness 运行 mandatory gates
  → 失败路由、定向返工或 Suspension
  → Operator 人工验收
  → 生成 Delivery Preview
  → Operator 批准 Delivery
  → Core 执行 facts_finalize
  → 发布 ProjectFacts 与 DeliveryManifest 并 Finalized
```

完成不能由 Agent 自述。每个 Gate 必须绑定当前 Revision Vector 和可复验 Evidence；人工审批只能通过独立 Operator Interface 产生。

## 1.0 具体方案

1.0 由协议中立 Core、可替换 Adapter、Framework Pack 和受限 Runner 组成：

| 模块 | 责任 | 详细设计 |
|---|---|---|
| Domain Kernel | Task、Slice、Operation、Gate、Suspension 和失效规则 | [领域与生命周期](docs/v1.0/appendices/A-domain-and-lifecycle.md) |
| Application | Use Case、审批绑定、Port 编排、事实发布和恢复 | [状态、证据与恢复](docs/v1.0/appendices/B-state-evidence-and-recovery.md) |
| Framework Pack | 把框架差异编译为声明式 ExecutionPlan | [Framework Pack 与 Runner](docs/v1.0/appendices/C-framework-pack-and-runner.md) |
| Harness Runtime | 进程树、readiness、测试、清理、脱敏和 Evidence | [Framework Pack 与 Runner](docs/v1.0/appendices/C-framework-pack-and-runner.md) |
| Agent Interface | 最多 7 个稳定动作；不暴露审批、发布和原始模板命令 | [1.0 主方案](docs/v1.0/README.md) |
| Operator Interface | Spec/Review/Delivery 审批、挂起、协调、取消和诊断 | [1.0 主方案](docs/v1.0/README.md) |

1.0 的当前限制：

- 单 Project、单活动可写 Task；
- 每项目本地 Core Supervisor；Host 断开不取消 Operation；
- Execution Slice 串行，Gate 通过 Operation 长运行；
- 文件 StateStore，不引入 SQLite 或远程控制面；
- 一个真实 Electron Pack、一个 fake Pack、一个最短 Host Adapter；
- Runner 安全等级为 `local_constrained`，不宣称敌对代码隔离；
- M0 Task 不承诺普通工作区自动回滚，canary 使用可丢弃隔离目录；
- commit、push、release、deploy 都需要独立 Operator 授权。

完整 1.0 范围、接口和交付条件见 [SDLC Pipeline 1.0 主方案](docs/v1.0/README.md)。

## 设计图

- [1.0 过渡 Harness](docs/v1.0/diagrams/SDLC-Pipeline-1.0-Transition-Harness.svg)
- [Task / Operation / Gate 正交状态](docs/v1.0/diagrams/SDLC-Pipeline-1.0-Task-State.svg)
- [验证反馈闭环](docs/v1.0/diagrams/SDLC-Pipeline-1.0-Harness-Loop.svg)
- [可编辑 Draw.io](docs/v1.0/diagrams/SDLC-Pipeline-1.0-Architecture.drawio)

## 附录与决策

- [A：领域与生命周期](docs/v1.0/appendices/A-domain-and-lifecycle.md)
- [B：状态、证据与恢复](docs/v1.0/appendices/B-state-evidence-and-recovery.md)
- [C：Framework Pack 与 Runner](docs/v1.0/appendices/C-framework-pack-and-runner.md)
- [D：项目文档与目录规范](docs/v1.0/appendices/D-project-document-layout.md)
- [E：实施切片与验收](docs/v1.0/appendices/E-delivery-and-acceptance.md)
- [F：评审意见处置](docs/v1.0/appendices/F-review-disposition.md)
- [领域词汇表](CONTEXT.md)
- [1.0 机器可解析合同](docs/v1.0/contracts/README.md)
- [ADR-001：Core 切换策略](docs/v1.0/adr/ADR-001-Core-Cutover.md)
- [ADR-002：本地 Core/Runner 运行拓扑](docs/v1.0/adr/ADR-002-Local-Core-Runner-Topology.md)

## 2.0 演进

1.0 在两个真实项目上稳定后，再演进控制面、第一方 Agent Runtime、隔离执行面和多项目治理。这里只保留路线，不把 2.0 平台设计混入 1.0：

- [SDLC Factory 2.0 演进路线](docs/v2.0/README.md)
- [Agent Harness 与软件工厂技术调研](docs/research/agent-harness-landscape-2026-07-30.md)

## 当前状态

仓库仍处于架构验证阶段。1.0 Gate 0 的核心 Schema、矩阵和两项 ADR 已形成规范草案，但 26 个场景尚未成为失败测试，也没有实现、TCK 或 canary Evidence；接受主方案和 ADR 不等同于实施、切换或发布授权。
