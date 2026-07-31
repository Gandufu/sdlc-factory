# 附录 F：主流 Agent 产品模式与借鉴

## 1. 结论

SDLC Factory 不应再做一个 IDE，也不应复制 Kiro、Codex、Claude Code、GitHub Copilot、
Cursor、TRAE 或 ZCode 的私有会话格式。

这些产品最值得借鉴的共同模式是：

- 复杂工作先规划，确认后再写入；
- 长期项目规则和一次会话上下文分离；
- 计划、任务、变更、工具和验证过程可以检查；
- CLI 或 Headless 模式提供机器可读输出；
- Agent、Skill、Hook、Rule、MCP 按不同职责扩展；
- 长任务具有目标、预算、暂停、恢复和完成检查；
- 多 Agent 只用于可独立的专业工作；
- 运行成功和产物符合需求是两件事。

Factory 的差异化是：

- 跨宿主的权威生命周期；
- 项目级交付计划和工作项地图；
- 人工决定与内容哈希绑定；
- 交付证据与运行遥测分离；
- 阶段耗时、Token、成本和返工可对账；
- 最终产物对需求、UI、协议、安全和测试的独立检查。

完整官方证据见
[主流 AI 编程 Agent 的计划、产物与观测模式调研](../../research/agent-product-patterns-2026-07-31.md)。

## 2. 产品模式对照

| 产品 | 已确认的主要模式 | Factory 借鉴 | Factory 不照搬 |
|---|---|---|---|
| Kiro | Spec 生成需求、设计和任务 Markdown；任务依赖；Steering；Hook；CLI | 可审阅计划、快速/受控规划、依赖图、按需规则 | 每个小需求固定生成三篇正文；`.kiro` 私有状态 |
| Codex | `/plan`、`AGENTS.md`、Skill/Plugin/Hook、`exec --json`、输出 Schema、App Server | 规划与长期规则分离；CLI JSONL；结构化分析；深度界面适配 | 把线程或 rollout 当项目状态；让 Codex 直接审批 |
| Claude Code | 只读 Plan Mode、计划批准、Subagent、Hook、stream-json、Agent SDK Trace | 计划候选加 hash 批准；父子运行；可配置保留 | 把全局临时 plan 文件当权威；默认 Agent Team |
| GitHub Copilot | Plan Mode、Fleet、Instructions、Agents Panel、SDK 用量/预算事件 | 会话预算、项目工作项入口、运行面板 | 用 Issue/PR 状态替代 Factory 生命周期 |
| Cursor | Plan/待办依赖、Background Agent、Headless JSON、Admin 用量和成本 | 实时进度、运行下钻、基线和成本界面 | 用请求数、代码行或 Dashboard 活跃度表示质量 |
| TRAE | Plan/Spec、PRD 到实现预览、专业 Agent、Skills、Rules、MCP、可视工作台 | 计划到交付的操作体验、Diff、预览、中途介入 | 不透明全自动链路直接发布；把 Memory 当正式事实 |
| ZCode | Plan Mode、Goal Mode、任务组、验证迭代、Token/耗时/工具统计 | Plan 与 Goal 分离、长任务预算和暂停、验证时间线 | 不可审阅自动 Memory；仅以会话目标判定产品完成 |

## 3. Kiro

Kiro 的 Spec 是最接近“项目内正式规划产物”的产品模式。标准 Spec 保存
`requirements.md`、`design.md` 和 `tasks.md`，任务可以带依赖并按波次执行；Quick Spec 则减少
阶段审批。[Kiro Specs](https://kiro.dev/docs/specs/)。

Kiro Steering 把产品、技术栈、结构和领域规则保存为 Markdown，并支持始终、按文件、手动和
自动包含。[Kiro Steering](https://kiro.dev/docs/steering/)。

Kiro Hook 能响应会话、工具、文件和 Spec 任务事件，但这也说明 Hook 适合触发和轻量校验，
不应成为另一套状态机。[Kiro Hooks](https://kiro.dev/docs/hooks/)。

Factory 采用：

- 复杂目标先形成可批准计划；
- 工作项有依赖；
- 项目规则按需加载；
- Hook 只做事件和轻量动作。

Factory 不采用：

- 每个 WorkItem 都复制三篇长文；
- 计划、需求和任务清单重复保存同一内容；
- 把 Kiro 私有目录作为 Core 合同。

## 4. Codex

Codex 官方建议复杂、模糊任务使用 `/plan`，长期工程约定放入简洁的 `AGENTS.md`，更长工作可用
执行计划模板。Plan 解决本次任务，`AGENTS.md` 解决跨任务约定，两者不等于项目生命周期。
[Codex 最佳实践](https://learn.chatgpt.com/guides/best-practices)。

`codex exec --json` 提供 JSONL，`--output-schema` 约束最终结果；App Server 提供线程、轮次、
计划、文件变更、工具、Token 和审批等事件。
[Codex 非交互模式](https://learn.chatgpt.com/docs/non-interactive-mode)；
[Codex App Server](https://learn.chatgpt.com/docs/app-server)。

Factory 采用：

- Plan、持久规则和执行目标分离；
- CLI JSONL 和输出 Schema；
- Codex 作为分析提供方；
- App Server 作为未来深度界面 Adapter。

Factory 不采用：

- 直接解析 Codex 私有 rollout；
- 把线程完成当 WorkItem 完成；
- 让分析 Codex 自动修改状态、提交或发布。

## 5. Claude Code

Claude Code Plan Mode 默认只读，完成计划后请求用户批准再进入实现。其 Hook、Subagent、
stream-json 和 Agent SDK Trace 说明“执行模式、专业委派、事件观测”可以分层。
[Claude Code 权限模式](https://code.claude.com/docs/en/permission-modes)；
[Claude Code Agent SDK 可观测性](https://code.claude.com/docs/en/agent-sdk/observability)。

Factory 采用：

- 规划运行显式只读；
- 短期计划候选加 hash 批准；
- 父子运行和工具 Span；
- 运行数据有清理策略。

Factory 不采用：

- 模型再次生成相同计划才能批准；
- 把会话目录中的临时计划当项目权威事实；
- 默认用 Agent Team 处理顺序工作。

## 6. GitHub Copilot 与 Cursor

GitHub Copilot 将 Agent 会话与 Issue、PR、Projects 和 Agents Panel 结合，并在 SDK 中提供
Token、费用、时长和会话预算事件。
[GitHub Copilot Agent 会话](https://docs.github.com/en/copilot/how-tos/copilot-on-github/use-copilot-agents/manage-and-track-agents)。

Cursor 提供计划、后台 Agent、Headless JSON、工具进度以及管理侧用量和成本视图。
[Cursor 规划](https://docs.cursor.com/en/agent/planning)；
[Cursor Headless CLI](https://docs.cursor.com/en/cli/headless)。

Factory 采用：

- 任务入口与项目工作项关联；
- 运行、Token、成本和预算集中展示；
- 后台运行可暂停、检查和下钻；
- 管理界面与 CLI 消费同一查询接口。

Factory 不采用：

- 把 Issue、PR 或后台会话当权威工作流；
- 以活跃度、请求数和生成代码行数衡量交付质量；
- 在没有需求覆盖证据时宣称工作完成。

## 7. TRAE 与 ZCode

TRAE 展示了“计划、任务、代码、预览、Diff 和中途干预”在一个工作台内的体验，也支持自定义
Agent、Skill、Rule、Hook 和 MCP。官方变更记录同时表明产品行为和命令会持续变化，所以
Factory 只能借鉴模式，不能依赖其界面流程。
[TRAE Changelog](https://www.trae.ai/changelog)。

ZCode 明确区分：

- Plan Mode：先形成计划，批准后实施；
- Goal Mode：为长任务设置可验证目标、预算、暂停和恢复；
- Usage Stats：查看 Token、会话、模型和工具使用；
- Task Management：按项目、分组和时间线查看任务。

[ZCode Agent](https://zcode.z.ai/en/docs/agents)；
[ZCode Goal Mode](https://zcode.z.ai/en/docs/goal)；
[ZCode Usage Stats](https://zcode.z.ai/en/docs/usage-stats)。

Factory 采用：

- Plan 和长任务目标是两个概念；
- 长运行有预算、暂停、恢复和逐轮验证；
- 工作项、文件变更、运行和用量集中展示。

Factory 不采用：

- 自动 Memory 覆盖项目事实；
- 会话达到 Goal 就自动通过产品门禁；
- 以不可导出的界面数据作为唯一证据。

本文中的 ZCode 指 `zcode.z.ai`。同名的 `zcodeapp.com` 是另一产品，不在本方案范围内。

## 8. Factory 的规划双轨

Factory 不增加第二套 Spec 生命周期。规划有两种执行策略，但最终都只发布一个 `plan.md`：

### 8.1 快速计划

适用于范围清晰、风险较低但仍需拆分的目标：

- 一次读取和提问；
- 一次形成工作项拆分；
- 一次计划批准；
- 批准后创建 WorkItem。

### 8.2 受控计划

适用于跨模块、高风险、资料冲突或架构不确定：

- 先确认目标、边界和冲突；
- 再确认关键设计决定和回退方向；
- 最后形成工作项依赖、验收轮廓和执行顺序；
- Operator 可以多轮反馈，最终按内容 hash 批准。

这些中间检查点不各自产生一套正式长文。只有最终批准的 `plan.md` 和其中引用的独立架构决定
成为项目事实。

## 9. 四类数据

| 类别 | 示例 | 是否进入 Git | 是否参与门禁 |
|---|---|---|---|
| 项目事实 | `project.md`、批准计划、架构决定、领域规则 | 是 | 作为正式输入 |
| 工作项交付产物 | Requirement Version、审核、测试报告、交付摘要 | 是 | 是 |
| 运行遥测 | 会话、工具、Token、耗时、错误、重试 | 默认否 | 默认否 |
| 临时运行数据 | 未批准计划、截断原文、调试截图、恢复缓存 | 否 | 否 |

自动 Memory、会话摘要和工具日志不能提升为项目事实。需要长期保留的结论必须进入正常提案、
审核和版本流程。

## 10. 借鉴后的最小产品面

Factory 1.1 只需要五个深模块：

| 模块 | 小接口 | 隐藏的复杂行为 |
|---|---|---|
| Core | 状态查询与结构化动作 | 状态机、不变量、失效、审批和发布 |
| Planning | 开始、提交、批准计划 | 提问、版本、拆分、依赖和计划发布 |
| Observation | 运行、导入、对账 | 宿主事件、父子会话、时间和用量归一化 |
| Analysis | 构建、审查、比较 | 指标、模型分析、符合性和基线 |
| Project Query | 查询项目、工作项、运行和报告 | 投影、下钻、分页、权限和脱敏 |

CLI、Agent 工具、MCP 和控制台都是这些接口的 Adapter，不增加业务逻辑。

## 11. 明确拒绝

- 不把 Factory 做成源码编辑器；
- 不托管模型私有思维链；
- 不维护通用向量知识库或自动 Memory；
- 不默认保存完整会话；
- 不用固定工具次数限制正常工作；
- 不默认启动全部专业 Agent；
- 不让 Hook 执行重型分析；
- 不把厂商 session/event 结构写进 Core；
- 不让分析 Agent 自证并发布改进；
- 不用单次运行或单一模型决定架构；
- 不把项目控制台做成第二个 Workflow Index；
- 不以 Token 越少作为唯一优化目标。

## 12. 采用优先级

### P0：合同

- DeliveryPlan、计划候选和批准；
- 四类数据边界；
- 当前插件问题对应的不变量；
- CLI、控制台和分析提供方共用应用接口。

### P1：观测 CLI

- OpenCode Adapter；
- 标准事件和运行模型；
- `observe/analyze/report/export`；
- 阶段、Token、成本、工具和错误报告。

### P2：产物检查

- 需求覆盖；
- 必测四态；
- UI、协议和安全检查；
- 证据新鲜度。

### P3：项目控制台

- 项目地图和工作项看板；
- 计划和审批；
- 运行时间线与成本；
- 产物符合性和证据下钻。

### P4：Codex 改进闭环

- 脱敏分析输入；
- Codex Adapter；
- 改进候选；
- Factory 维护 WorkItem；
- 固定基线前后对比。
