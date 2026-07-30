# SDLC Factory

面向 AI Agent 的项目软件工厂设计仓库。

本仓库当前处于架构验证阶段，采用 **Core-first、协议可插拔** 的方向：

- 先验证单项目快速迭代和证据闭环；
- OpenCode Plugin、MCP、CLI、SDK 都只是可替换适配器；
- 最终演进为拥有控制面、第一方 Agent Runtime 和执行面的项目软件工厂；
- 框架模板通过版本化 Framework Pack 接口接入，不与某个宿主绑定。

## 设计文档

- [SDLC Pipeline 2.0 与项目软件工厂演进方案](docs/v2.0/SDLC-Pipeline-2.0-Core-First-Agent-Harness-and-Software-Factory.md)
- [两轮架构评审意见处置](docs/v2.0/Review-Disposition-2026-07-30.md)
- [ADR-001：SDLC Pipeline 2.0 Core 切换策略](docs/v2.0/ADR-001-SDLC-Pipeline-2.0-Core-Cutover.md)
- [Agent Harness 与项目软件工厂技术调研](docs/research/agent-harness-landscape-2026-07-30.md)
- [可编辑 Draw.io 架构图](docs/v2.0/SDLC-Pipeline-2.0-Architecture.drawio)

`docs/v2.0` 同时提供四张中文 SVG：

1. 过渡期协议中立的本地智能体执行框架；
2. 项目软件工厂终局架构；
3. Task/Operation/Gate 正交状态模型；
4. 验证反馈闭环。

## 当前边界

当前仓库只保存设计、调研、ADR 候选和架构图，不代表已经批准具体存储、MCP SDK、宿主插件、Core 切换或平台实现。进入实现前，应先确认 P0 验证切片、Task/Operation/Revision 契约、StateStore 与事实发布事务、环境与 Runner 边界、人工审批边界和验收指标，并将 ADR-001 转为 Accepted。
