# SDLC Factory

状态：正式方案，用户已确认

日期：2026-08-07
首选运行时：OpenCode

SDLC Factory 是一个本地优先的 AI 软件研发工作台。它以真实项目和持续多轮对话为基础，通过显式 `/sdlc-*` 命令完成需求分析、总体设计、能力单元规划、编码、测试和系统验收；AI 负责分析与生成候选，用户负责正式审核，系统负责保存可追溯、不可伪造的项目事实。

本文是项目主题入口和总体需求的唯一权威来源。本文及其 MVP0/MVP1 子文档已经用户明确确认，具有规范效力；研究、旧版归档和 brainstorming 产物不能自行升级为需求。

## 0. 文档权威与正式化规则

### 0.1 当前已经明确的决策

以下内容来自用户当前明确指令，不依赖 brainstorming HTML：

1. 最终采用 OpenCode；Pi 因需要 Factory 自行处理沙箱而延期，后续再评估集成；
2. MVP0 以 OpenCode Plugin 方式快速验证从需求、总体设计、能力单元拆分到编码、测试和系统验收的完整流程；
3. MVP1 在 MVP0 Plugin 基础上集成桌面端，建设会话管理、遥测、Factory 自有 Harness、项目管理和项目工厂；
4. Claude Code Game Studios 只参考“引导而不是强制冻结”的流程方式，并且该方式必须进入 MVP0；
5. 根 README 描述整体需求、MVP0/MVP1 流程和边界；子文档分别描述 MVP0 与 MVP1 实现细节；
6. brainstorming HTML 没有形成正式文档或正式约定，不能作为当前需求依据。

本文其他细节是根据上述决策和历史正式 Markdown 整理并经用户确认的正式方案。

### 0.2 权威顺序

发生冲突时按以下顺序解释：

1. 用户当前和后续的明确指令；
2. 经用户明确审阅确认的本 README；
3. 经用户明确审阅确认的 MVP0/MVP1 实现设计子文档；
4. 官方源码审计和技术研究，仅提供事实证据；
5. `docs/design-records/**/visuals/*.html` 等 brainstorming 产物，仅记录探索过程，不是需求、方案或正式约定。

正式化必须经过“Markdown 成稿 → 用户审阅 → 用户明确确认 → 标记正式状态”四步。展示过、生成过或进入 Git 都不能单独代表用户已确认。

## 1. 整体需求

### 1.1 项目与对话

1. 用户可以创建、导入和持续维护本地项目。
2. 一个项目可以有长期、多轮、可恢复的对话；一次模型回复结束不代表工作完成。
3. 等待用户、部分完成、中断、停止和失败都必须保留真实状态，后续可以继续。
4. 对话不绑定生命周期阶段，消息不携带可切换的流程上下文。
5. 原始需求、附件、项目文件、候选文档、审核决定和 Baseline 必须可追溯。

### 1.2 显式命令与柔性引导

正式研发工作由用户显式执行 `/sdlc-*` 命令触发，普通对话不能自动推进流程。

系统参考 Claude Code Game Studios 的轻量引导方式：

1. Skill 开始时读取真实项目文件、已有产物、候选、审核和 Baseline；
2. AI 说明当前建议工作位置、明显缺口和一个主要推荐命令；
3. 系统不自动执行推荐命令；
4. 用户可以先执行建议命令，也可以接受风险并继续当前命令；
5. 执行后续命令不会自动宣布前序工作完成，也不会自动改变建议工作位置。

“建议工作位置”用于定位和提醒，不是中央生命周期状态机，也不是命令执行锁。只有以下情况可以停止当前命令：

- 命令目标不存在或参数无效；
- 缺少当前命令不可替代的直接输入，继续执行会失去确定语义；
- 文件范围、权限、安全、数据完整性或正式审核事务不成立。

“上一项工作尚未全部结束”本身不能成为拒绝原因。

### 1.3 研发正式产物

MVP0 保留四份用户可读的正式工作文档：

1. `docs/requirements/software-requirements-specification.md`：需求规格说明书；
2. `docs/design/software-design-description.md`：总体设计说明书，内含 Capability Map、正式能力单元边界和验证覆盖；
3. `docs/development/implementation-plan.md`：版本化 ExecutionPlan 的用户可读投影；
4. `docs/verification/verification-report.md`：逐 CU 测试和系统验收的用户可读汇总。

原始输入和 AI 生成内容必须分离：AI 不能覆盖原始材料，也不能把未确认假设写成既定事实。需求、设计、开发和测试允许跨多轮持续工作，不要求一次完成。

### 1.4 候选、审核与 Baseline

- 工作文档可以持续修改；
- `/sdlc-review` 固定某一时刻的实际文件、内容 Hash、来源和开放问题，形成不可变候选；
- 用户可以通过、退回修订或暂缓；
- 只有显式人工通过才能生成 ReviewRecord 和 Baseline；
- AI 回复“已通过”、工具成功、Session 空闲或文件存在，都不能代替人工审核；
- 冻结的是被审核的精确版本，不是项目阶段。用户始终可以继续工作并提交新版本。

MVP0 的正式 Baseline 包括 RequirementBaseline、DesignBaseline、逐 CU CodeBaseline、逐 CU TestBaseline 和最终 SystemAcceptanceBaseline。ExecutionPlan 本身版本化但不是 Baseline；系统验收绑定其精确版本和所有参与 CU 的当前有效 Baseline。

### 1.5 最终桌面体验

最终产品采用 Electron + React 三栏桌面工作台：

- 左侧：项目、对话、历史和常用命令；
- 中间：持续多轮对话，按轮展示工具、变更、测试、预览、错误和审核卡；
- 右侧：聚合文件、变更、产物、证据、审核和 Baseline；
- 输入框：模型、推理强度、文本、多附件、拖放、粘贴、停止和排队输入。

Renderer 只负责显示和交互，不直接访问文件系统、OpenCode SDK、SQLite 或模型凭据。

### 1.6 运行时与安全

最终采用 OpenCode 作为 Agent Runtime。OpenCode 负责模型调用、Agent Loop、原生 Session、工具调用和权限请求；Factory 不重新实现一套 Agent Loop。

OpenCode 的 `allow / ask / deny` 和工作区权限可以减少 Factory 自建权限层的范围，但不能自动视为 OS 级强隔离沙箱。Factory Plugin 和桌面 Harness 仍必须限制真实路径、外部目录、危险命令、凭据和状态写入。

Pi 暂不集成。只有未来具备经过验证的沙箱、文件/进程/网络/凭据权限和审计方案时，才作为实验性 Runtime Adapter 重新评估。

## 2. 分阶段交付策略

```mermaid
flowchart LR
    INPUT["真实项目资料"]
    MVP0["MVP0\nOpenCode Plugin\n需求 · 设计 · CU · 编码 · 测试"]
    GATE["MVP0 验收\n全流程 · 质量 · 审核 · 恢复 · 权限"]
    MVP1["MVP1\nElectron + OpenCode SDK\n会话 · 遥测 · 项目工厂"]
    PRODUCT["桌面研发项目工厂"]

    INPUT --> MVP0 --> GATE --> MVP1 --> PRODUCT
```

MVP0 先验证最核心、风险最高的智能体工作流程。MVP0 未通过时，不用桌面 UI、会话平台或遥测掩盖问题；应继续修正 Plugin、Skill 和文档合同。

## 3. MVP0：OpenCode Plugin 快速验证

### 3.1 目标

在现有 OpenCode TUI/CLI 中安装项目级 Plugin，用真实项目资料验证：

> 项目初始化 → 多轮需求分析 → RequirementBaseline → 总体设计与 CU 拆分 → DesignBaseline → ExecutionPlan → 按 CU 编码与 CodeBaseline → 按 CU 测试与 TestBaseline → 系统集成测试与 SystemAcceptanceBaseline。

这是一条推荐工作路径，不是强制阶段锁。系统只显示一个主要建议、一个 OpenCode Todo 和一条完整命令；用户必须再次输入命令才会执行。用户可以显式选择非推荐 CU，AI 必须说明依赖缺口和风险，但不能仅因阶段顺序拒绝执行。

### 3.2 MVP0 命令

- `/sdlc-init`：初始化项目规则、来源登记和本地状态；
- `/sdlc-spec`：开展需求分析并维护需求规格说明书；
- `/sdlc-design`：开展总体设计、正式 CU 拆分，并结合 OpenCode Todo 形成 ExecutionPlan；
- `/sdlc-code <CU名称>`：显式执行指定 CU 的编码工作；
- `/sdlc-test <CU名称>`：显式执行指定 CU 的测试工作；`/sdlc-test system` 显式执行系统集成测试；
- `/sdlc-review [CU名称]`：固定当前候选并请求人工决定；CU 名称用于定位 Code/Test Candidate；
- `/sdlc-status`：显示建议工作位置、已确认产物、主要缺口和推荐命令。

命令之间只通过文件事实、状态查询、推荐文本和用户再次输入衔接，不自动串行运行。

### 3.3 MVP0 边界

MVP0 包含：

- OpenCode 项目级 Plugin、Commands 和原生 Skills；
- 项目资料登记与确定性状态查询；
- 需求分析、总体设计、正式 CU、ExecutionPlan 和四份用户可读文档；
- 按 CU 编码、测试、返工和失效传播；
- 系统集成测试与系统验收；
- Requirement、Design、CU Code、CU Test 和 System Acceptance 的候选、Hash、人工 ReviewRecord 和 Baseline；
- 柔性缺口提示、失败保真和重启恢复；
- 真实目标项目端到端验证。

MVP0 不包含：

- Factory 自身的 Electron、React 和桌面工作台；目标项目可以采用 Electron 或其他技术栈；
- `@opencode-ai/sdk` 驱动和 Factory 自有 Harness；
- Factory 自有会话管理、SQLite 和遥测；
- 多项目目录、模板市场和远程项目；
- StageTask、Coding/Testing Child Session、容量队列和通用工作流引擎；
- 发布、部署和制品分发工厂；
- Pi 或多运行时适配；
- OS 级沙箱已经完成的结论。

详细设计见[《MVP0 OpenCode Plugin 实现设计》](docs/architecture/mvp0-opencode-plugin-design.md)。

## 4. MVP1：桌面 Harness 与项目工厂

### 4.1 目标

在 MVP0 已验证的 Plugin、全流程合同和项目事实格式上建设桌面产品：

> 创建或导入项目 → 安装并校验 Plugin → 通过 OpenCode SDK 创建或恢复 Session → 在三栏工作台持续对话 → 聚合事件与遥测 → 审核候选 → 形成并展示 Baseline。

### 4.2 MVP1 边界

MVP1 包含：

- Electron + React 三栏工作台；
- TypeScript Harness 与 `OpenCodeRuntimeHost`；
- OpenCode Server 启停、SDK Client、Session 绑定、恢复、停止和事件订阅；
- 项目创建、导入、打开、Plugin 安装、版本和健康检查；
- 对话账本、附件、事件索引、错误恢复和本地 SQLite；
- 本地遥测：耗时、Token、工具、权限、停止、错误和恢复结果；
- 桌面审核、Diff、ReviewRecord 和 Baseline 投影；
- MVP0 需求、设计、CU、ExecutionPlan、编码、测试和系统验收的完整桌面投影。

MVP1 不包含：

- Pi、多 Runtime 注册表或通用 Runtime 市场；
- 云端控制面、多用户协作和远程执行；
- 可配置生命周期和自动阶段推进；
- 把聊天轮次包装成 Factory 领域任务；
- 发布、部署和制品分发工厂。

详细设计见[《MVP1 桌面 Harness 实现设计》](docs/architecture/mvp1-desktop-harness-design.md)。

## 5. 跨阶段权威边界

| 主体 | 权威职责 | 不负责 |
| --- | --- | --- |
| 用户 | 原始意图、风险接受、正式审核决定 | 伪造执行证据 |
| OpenCode | 模型、Agent Loop、原生 Session、工具和权限交互 | Factory 项目、审核和 Baseline 真相 |
| Factory Plugin | 项目事实查询、CU、ExecutionPlan、执行记录、候选、Hash、ReviewRecord、Baseline 和路径边界 | 桌面会话目录与跨项目管理 |
| Factory Harness | 项目目录、OpenCode 进程、Session 绑定、事件、遥测和桌面投影 | 改写 Plugin 已固定的文档事实 |
| 项目工作区 | 原始资料、工作文档、候选快照和 Baseline 的可移植事实 | 会话运行状态 |
| SQLite | MVP1 的项目、对话和遥测索引 | 成为第二套文档权威源 |

## 6. MVP0 到 MVP1 的晋级条件

只有同时满足以下条件才进入 MVP1：

1. 在真实目标项目中完成实际 OpenCode Plugin 流程；
2. SRS 和总体设计经过人工审阅，内容质量达到可继续研发的水平；
3. DesignBaseline 包含可独立编码、独立测试且有稳定名称的正式 CU；
4. ExecutionPlan、一个主要建议和一个 Todo 的边界得到验证，任何推荐命令都不会自动执行；
5. 每个验收范围内的 CU 具有当前有效 CodeBaseline 和 TestBaseline；
6. 跨 CU 系统场景完成真实验证并形成 SystemAcceptanceBaseline；
7. 未知信息、假设和缺失证据没有被伪装成事实或通过；
8. 错误 Hash、过期候选、重复审核和 AI 自行批准会被拒绝；
9. OpenCode 重启后可以从项目事实恢复 ExecutionPlan、当前 CU、候选和审核状态；
10. 柔性引导得到验证：提示缺口但不因阶段顺序强制冻结命令；
11. Plugin 的路径和权限边界通过负向验证。

## 7. 文档与研究证据

当前实现依据：

- [MVP0 OpenCode Plugin 实现设计](docs/architecture/mvp0-opencode-plugin-design.md)
- [MVP1 桌面 Harness 实现设计](docs/architecture/mvp1-desktop-harness-design.md)

研究与历史参考：

- [2026-08-06 至 2026-08-07 brainstorming 记录](docs/design-records/2026-08-06-to-07-reconstruction/README.md)——仅记录探索过程，不具有规范效力。
- [Claude Code Game Studios 流程引导机制审计](docs/research/claude-code-game-studios-workflow-guidance-audit-2026-08-06.md)
- [Open Design 官方源码审计](docs/research/open-design-official-source-audit-2026-08-06.md)
- [Agent 运行时选型与 Pi SDK 研究记录](docs/research/agent-runtime-selection-pi-sdk-2026-08-07.md)——研究事实保留，Pi 首版结论已被本方案替代。

## 8. 当前状态

已经明确的方向是：采用 OpenCode；MVP0 以 Plugin 验证需求、设计、正式 CU、ExecutionPlan、编码、测试和系统验收完整闭环；MVP1 集成桌面端、会话管理、遥测、Harness 项目管理和项目工厂；流程引导不能演变成强制阶段冻结。

本文及 MVP0/MVP1 子文档构成当前正式约定。MVP0 Plugin 已具备 Commands、Skills、来源快照、文档写入、候选审核、Baseline、ExecutionPlan 和 CU Run 等基础实现及自动化测试；最终版 `/sdlc-spec` 的 S0–S9 需求论证流程、真实目标项目全流程验收和 MVP1 仍未完成。任何历史 HTML 或已删除原型都不能被描述为当前方案已经实现。
