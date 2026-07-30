# SDLC Factory 2.0 演进路线

状态：方向性路线，不是当前实施基线

前置条件：[SDLC Pipeline 1.0](../v1.0/README.md) 已在两个真实项目上稳定运行，并完成 M0、M1 验收。

## 定位

2.0 将 1.0 的单项目 Project Harness 演进为项目软件工厂。它复用 1.0 已验证的 Domain、Action、Evidence、Framework Pack 和 Runner 契约，但不在本页重复这些细节。

当前阶段不实现 2.0，也不因为终局设想扩大 1.0 范围。

![2.0 项目软件工厂方向](SDLC-Pipeline-2.0-Project-Software-Factory.svg)

## 演进阶段

| 阶段 | 主要目标 | 进入下一阶段的条件 |
|---|---|---|
| A. Factory Kernel | 把已验证的 1.0 Core 固化为可部署内核；建立第一方 Agent Runtime | Agent Runtime 与外部 Adapter 使用同一 Action Contract；删除任一 Adapter 不影响 Core |
| B. Project Software Factory MVP | 增加项目控制面、隔离执行面、环境与 Pack Registry | 多个项目可被注册、隔离执行、审计和恢复；控制面不接管项目事实 |
| C. Multi-project Governance | 增加项目组合视图、组织策略、RBAC、配额和合规能力包 | 治理策略可追溯，项目仍能离线工作，跨项目操作有明确授权边界 |
| D. Adaptive Agent Factory | 基于脱敏运行数据改进模板、路由和评估 | 学习结果先经过评估与批准，不能直接改变生产策略或项目事实 |

## 固定演进原则

- 1.0 Core 契约是验证后的种子，不是要求平台照搬本地部署拓扑；
- 控制面优先采用模块化单体，只有独立安全域、故障域或扩缩容需求明确时才拆分；
- 执行不可信项目命令的 Runner 与控制面隔离；
- ProjectFacts 仍以项目仓库为权威来源，平台数据库只保存索引、投影和治理状态；
- commit、push、release、deploy 始终是独立的授权动作；
- CSCI、接口追溯和 SBOM 先在 1.0 M1 以 canary 验证，再在 2.0 产品化为 Capability/Policy Pack；
- 多项目能力不改变 Task、Execution Slice、Operation、Gate 和 Evidence 的核心语义；
- 自动学习不能绕过评估、审批、版本固定和回滚。

## 非路线承诺

本页不承诺：

- 具体云厂商、数据库或消息系统；
- 微服务数量和部署拓扑；
- 某一 MCP、Host 或模型供应商；
- 自动提交、自动发布或无人审批；
- 在 1.0 完成前并行建设平台控制面。

这些选择应在相应阶段开始前通过独立 ADR 和可执行 canary 决定。

## 相关资料

- [1.0 主方案](../v1.0/README.md)
- [1.0 实施与验收](../v1.0/appendices/E-delivery-and-acceptance.md)
- [Agent Harness 与软件工厂技术调研](../research/agent-harness-landscape-2026-07-30.md)
