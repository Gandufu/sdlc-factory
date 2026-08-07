# SDLC Factory UI 竞品分析与最佳设计方向

> 调研日期：2026-08-05
>
> 调研范围：AI 软件开发工作台、Agent 编排器、开发者门户与人工裁决界面
> 证据规则：只引用项目官方 GitHub 仓库、GitHub API 与项目官方文档；Stars 和代码活跃度是调研当日快照，会随时间变化。

## 1. 结论先行

SDLC Factory 不应继续做成“小字号三栏 IDE”，也不应照搬通用 Kanban、节点编排画布或企业门户卡片墙。

有证据支持的最佳组合是：

1. 用 **Backstage 的 Catalog（目录）→ Entity Detail（对象详情）** 组织项目、能力单元和正式产物；
2. 用 **Cline Kanban 的多 Agent 总览 → 单任务审查** 表达执行队列、工作区隔离、Diff 与交付动作，但只吸收“总览—聚焦”关系，不把 Task 卡片变成 Factory 领域事实；
3. 用 **OpenHands 的单会话主线 + Changes / Terminal / App 按需切换** 承载当前唯一活动 Run；
4. 用 **Dify / Flowise 的原生 Human-in-the-Loop（人机协同）暂停点** 设计 Gate，而不是用普通确认弹窗；
5. 用 **Cline 的 Plan / Act、Diff、Approve / Reject、Checkpoint（检查点）** 形成“先看清影响，再批准执行”的操作闭环；
6. 视觉上采用 **Apple 式冷静分层**：大字号、低饱和中性色、弱边框、少量半透明浮层、单一蓝色强调，不复制 Apple 产品外观，也不做霓虹赛博风。

最终建议的产品方向命名为 **Factory Mission Control（工厂任务控制台）**：首页负责找项目和看全局健康度，项目页只突出“当前阶段、当前 Run、下一次人工裁决”，Artifact、Evidence、日志和运行预览按需展开。

---

## 2. 候选筛选与活跃度快照

Stars 与 `pushed_at` 来自对应仓库的 GitHub API，代码活跃度以 `pushed_at` 为准，而不是可能受收藏、Issue 等影响的 `updated_at`。

| 项目 | GitHub | Stars 快照 | 最近代码推送 | 是否纳入 UI 对照 |
|---|---|---:|---|---|
| OpenHands | [OpenHands/OpenHands](https://github.com/OpenHands/OpenHands) · [API](https://api.github.com/repos/OpenHands/OpenHands) | 83,141 | 2026-08-05 | 纳入：有完整 Web 工作区与人工确认证据 |
| Backstage | [backstage/backstage](https://github.com/backstage/backstage) · [API](https://api.github.com/repos/backstage/backstage) | 34,018 | 2026-08-05 | 纳入：Catalog、对象详情、模板任务与正式设计系统证据完整 |
| Dify | [langgenius/dify](https://github.com/langgenius/dify) · [API](https://api.github.com/repos/langgenius/dify) | 151,375 | 2026-08-05 | 纳入：Workflow Canvas、运行调试与 Human Input 证据完整 |
| Flowise | [FlowiseAI/Flowise](https://github.com/FlowiseAI/Flowise) · [API](https://api.github.com/repos/FlowiseAI/Flowise) | 55,162 | 2026-08-03 | 纳入：Agentflow 可视编排、执行路径与 Human Input 证据完整 |
| Cline | [cline/cline](https://github.com/cline/cline) · [API](https://api.github.com/repos/cline/cline) | 65,657 | 2026-08-05 | 纳入：Plan / Act、行内审批、Diff、Checkpoint 证据完整 |
| Cline Kanban | [cline/kanban](https://github.com/cline/kanban) · [API](https://api.github.com/repos/cline/kanban) | 1,229 | 2026-07-30 | 纳入：多 Agent 总览、独立 worktree、审查和交付闭环高度相关；但仍是 Research Preview |
| MetaGPT | [FoundationAgents/MetaGPT](https://github.com/FoundationAgents/MetaGPT) · [API](https://api.github.com/repos/FoundationAgents/MetaGPT) | 69,666 | 2026-01-21 | 剔除 UI 对照：官方 README 主要是架构、CLI 与演示视频，缺乏稳定的 Factory Portal 界面证据 |
| GPT Pilot | [Pythagora-io/gpt-pilot](https://github.com/Pythagora-io/gpt-pilot) · [API](https://api.github.com/repos/Pythagora-io/gpt-pilot) | 33,713 | 2026-06-18 | 剔除 UI 对照：官方 README 明确声明仓库不再维护，界面证据以旧视频/扩展入口为主 |

MetaGPT 仍可作为“角色化软件公司”架构对照，但不应作为视觉依据。GPT Pilot 的核心理念——开发者监督 AI 完成大部分实现——仍有启发，但应由活跃且有明确 UI 证据的 Cline 取代其界面参考地位。

---

## 3. 竞品逐项分析

### 3.1 OpenHands：单任务会话与按需工作面

**官方证据**

- [官方仓库](https://github.com/OpenHands/OpenHands)
- [Key Features](https://docs.openhands.dev/openhands/usage/key-features)：工作区包含 Chat、Changes、VS Code、Terminal、App、Browser 等工作面；App 可交互运行应用，Browser 是 Agent 浏览记录。
- [Security & Action Confirmation](https://docs.openhands.dev/sdk/guides/security)：确认策略包含 `AlwaysConfirm`、`NeverConfirm`、`ConfirmRisky`，执行状态包含 `WAITING_FOR_CONFIRMATION`，拒绝时可反馈原因并继续寻找替代方案。
- [Terminal](https://docs.openhands.dev/openhands/usage/cli/terminal)：支持暂停正在运行的 Agent，并在恢复前追加指令。

**核心界面模式**

- Chat 是时间主线；代码、终端、变更和预览是围绕当前任务的工作面。
- 次级工具不必永久同时出现，而是通过 Tab 或工作区切换进入。
- 人工确认是 Conversation / Run 的正式状态，而不是执行完成后的附加弹窗。

**适合借鉴**

- 项目详情中只保持一个主焦点：当前活动 Run 的事件流。
- `Artifact`、`Changes`、`Evidence`、`Logs`、`Preview` 做成按需工作面。
- Gate 显示拟执行动作、风险等级、影响范围与拒绝反馈输入。
- 暂停、继续、批准、拒绝形成同一条运行状态链。

**不应照搬**

- 不复制 IDE 式多面板常驻，也不默认展示终端原始输出。
- OpenHands 的对象中心是“会话”，Factory 的事实中心必须仍是 Project、CU、Stage、Run、Artifact、Baseline 与 Gate。
- 不采用开发工具常见的 12–13px 小字号密度。

**对本项目的启示**

OpenHands 最适合定义“单活动 Run 详情页”，但不适合定义 Factory 的全局信息架构。它回答的是“当前智能体在做什么”，Backstage 才回答“我在哪个项目、哪个 CU、哪个正式阶段”。

### 3.2 Backstage：Catalog、对象详情与分层表面

**官方证据**

- [官方仓库](https://github.com/backstage/backstage)
- [Software Catalog](https://backstage.io/docs/features/software-catalog/)：以实体、Owner、Metadata、Search、Filter、Star 和 Entity Detail 聚合分散的开发工具；Git 中的 YAML 仍是来源。
- [Software Templates](https://backstage.io/docs/features/software-templates/)：从模板选择、分步输入、Review、执行进度、成功/失败日志到 Task List 构成完整流程。
- [Backstage UI](https://ui.backstage.io/)：React + TypeScript 设计系统；布局表面自动递增背景深度；Neutral 0–4 提供分层，以及 hover、pressed、disabled 状态。
- 官方截图：[Catalog 首页](https://github.com/backstage/backstage/blob/master/docs/assets/software-catalog/software-catalog-home.png)、[基础首页](https://github.com/backstage/backstage/blob/master/docs/assets/getting-started/simple-homepage.png)。

**核心界面模式**

- 目录页负责发现对象；详情页围绕单个实体聚合文档、关系与工具。
- 全局搜索、Owner、状态与标签解决规模化查找，不依赖首页堆叠所有信息。
- 视觉层级更多来自表面深度，而不是每个区域都加粗边框或投影。

**适合借鉴**

- 首页采用 Project Catalog；进入项目后再显示 Capability Map、CU 和阶段。
- 为 Project、CU、Artifact、Baseline 设计稳定的对象 Header 与详情 Tab。
- 使用 Neutral Surface（中性表面）层级，而非大量有色卡片。
- 初始化可借鉴 Software Templates 的“参数 → Review → Run → Result”流程。

**不应照搬**

- 不做传统企业门户式“左侧大导航 + 卡片墙 + 大表格”。
- Plugin 不是 Factory 的首要用户心智，不能让工具目录压过生命周期与裁决。
- Catalog 只负责发现对象，不承担 Run 的实时工作台。

**对本项目的启示**

Backstage 的价值是对象组织与视觉底层，而不是直接复制页面。Factory 应采用“目录页轻、对象页深”的结构，把实时执行留给单项目工作台。

### 3.3 Dify：Canvas 调试与原生 Human Input

**官方证据**

- [官方仓库](https://github.com/langgenius/dify)
- [30-Minute Quick Start](https://docs.dify.ai/en/guides/application-orchestrate/creating-an-application)：用户进入 Workflow Canvas，选择节点后打开配置面板，可 Test Run、单步运行、查看缓存变量与对应节点的 Last Run 日志。
- [Human Input](https://docs.dify.ai/en/cloud/use-dify/nodes/human-input)：工作流在关键点暂停；表单可展示 Markdown 与动态变量、收集输入，并通过预定义按钮路由到不同执行分支；还包含交付渠道和超时策略。
- [Human Input API Integration Flow](https://docs.dify.ai/en/api-reference/guides/human-input-flow)：运行产生 `human_input_required`，提交批准或反馈后沿对应分支恢复；重复提交被禁止，超时有独立事件。

**核心界面模式**

- 设计态以节点画布为中心，节点属性进入侧面板。
- 调试态把运行结果绑定回具体节点，而不是只输出一条全局日志。
- Human Input 是可配置的暂停节点：展示上下文、收集修改、选择分支、设置超时。

**适合借鉴**

- Gate 不是“是/否”弹窗，而是带 Artifact 摘要、Evidence、输入字段、决策分支和超时的正式表单。
- Evidence 必须能回指产生它的阶段、Run 或 Operation。
- 支持“批准”“要求修改”“挂起澄清”等不同领域动作，不把它们压成一个 Confirm。
- 运行详情可从阶段定位到对应日志和变量快照。

**不应照搬**

- 不把节点画布设为日常首页。复杂图在大规模项目中会产生连线噪声。
- Factory 的项目/CU 生命周期、不可变 Baseline 和 Gate 不能交给通用节点图定义。
- 不允许用户通过拖线任意绕过生命周期前置条件。

**对本项目的启示**

Dify 最值得借鉴的是 Human Input 的信息完整度与恢复语义，而不是 Canvas 本身。Factory 的 Gate Sheet 应当比普通审批卡更接近“受合同约束的审查表单”。

### 3.4 Flowise：显式路径、Checkpoint 与人机分支

**官方证据**

- [官方仓库](https://github.com/FlowiseAI/Flowise)，README 提供 Agentflow 官方动图。
- [官方文档首页](https://docs.flowiseai.com/)：产品包含 Visual Builder、Tracing & Analytics、Evaluations、Human in the Loop、Teams & Workspaces。
- [Agentflow V2](https://docs.flowiseai.com/using-flowise/agentflowv2)：节点连接显式定义控制路径；支持分支、循环、共享 Flow State、人机交互；Human Input 暂停执行并保存 Checkpoint，恢复后沿用户选择的路径继续。

**核心界面模式**

- 画布适合展示复杂分支、循环、Supervisor / Worker 和共享状态。
- Checkpoint 让长运行在人工等待或应用重启后继续。
- Human Input 节点同时承担说明、决策和反馈收集。

**适合借鉴**

- 在“设计视图”中可提供只读生命周期/依赖图，帮助理解 CU 依赖与受影响范围。
- Gate 必须与持久化状态和恢复点绑定。
- 多 Agent 内部执行可在详情中可视化 Supervisor / Worker，但不提升为顶层生命周期。

**不应照搬**

- 不将 Factory 表达成任意 Agent 节点的连线编辑器。
- 不在主界面同时显示全部节点属性、日志和运行状态。
- Flow State 不能替代正式 Artifact、Baseline 或领域数据库事实。

**对本项目的启示**

Flowise 适合提供“必要时打开的 Blueprint（蓝图）”，不适合做 Project 首页。Factory 默认应显示确定性的阶段轨道，只在总体设计、ExecutionPlan 或影响分析时打开依赖图。

### 3.5 Cline 与 Cline Kanban：计划/执行分离、总览/聚焦与可恢复审查

**官方证据**

- [Cline 官方仓库](https://github.com/cline/cline)
- [Plan & Act](https://docs.cline.bot/core-workflows/plan-and-act)：Plan 模式只理解和规划，不修改文件或执行命令；Act 继承计划上下文后执行。
- [IDE Usage](https://docs.cline.bot/usage/ide)：文件修改以 Diff 展示，用户可 Approve / Reject；每次文件创建、编辑和命令均可要求明确批准。
- [Checkpoints](https://docs.cline.bot/core-workflows/checkpoints)：每次工具使用后保存快照，可 Compare 或 Restore；Checkpoint 降低 Auto-Approve 的回滚成本。
- [Cline Kanban 官方仓库](https://github.com/cline/kanban)：每张卡有独立 terminal 与 worktree；卡片显示 Agent 最新消息/工具调用；进入卡片可查看 TUI、累计 Diff、行级评论；最终 Commit 或 Open PR。官方明确标注其为 Research Preview。

**核心界面模式**

- Plan 与 Act 是明确、可见、可理解的权限边界。
- Kanban 是多 Agent 运行的雷达；点击单卡后进入深度审查。
- Diff、评论、Checkpoint、Commit / PR 构成从执行到交付的完整闭环。

**适合借鉴**

- “总览 → 聚焦”两层：全局只看状态与下一动作，详情才看事件、Diff、Evidence。
- Coding Gate 默认展示 CU 累计 Diff，而不是 Agent 聊天摘要。
- 拒绝或要求修改时允许对 Artifact/Diff 精确批注，并把批注结构化回传。
- 每个关键动作提供 Compare / Restore / Re-run 的可恢复路径。

**不应照搬**

- Factory v1.2 明确 `Task` 不是领域实体，因此不能把 Kanban 卡片作为生命周期真相。
- 默认单实例 `max_concurrent_runs = 1`，不应为了“酷炫”制造大量并行动画和 Agent 卡片。
- worktree、auto-commit、auto-PR 是执行机制，不等于 CodeBaseline、TestBaseline 或系统验收。
- Research Preview 的权限绕过与自动化假设不适合直接进入受控 Factory。

**对本项目的启示**

Cline Kanban 最适合作为“ExecutionPlan / Queue 的视觉投影”，OpenHands/Cline 单任务页最适合作为当前 Run 的执行与审查面。投影可以重建，不能拥有 Gate 或 Baseline 事实。

---

## 4. 横向模式比较

| 设计问题 | OpenHands | Backstage | Dify / Flowise | Cline / Kanban | Factory 应采用 |
|---|---|---|---|---|---|
| 全局对象发现 | 弱，会话优先 | 强，Catalog / Search / Owner | 中，App / Flow 列表 | 中，任务板 | Backstage 式 Project Catalog |
| 当前执行聚焦 | 强，单会话 + 工具面 | 弱，门户为主 | 强，节点运行与调试 | 强，单卡 TUI / Diff | 单活动 Run 工作台 |
| 多 Agent 总览 | 中 | 弱 | 图形化 | 强，Kanban 雷达 | 只作为 ExecutionPlan 投影 |
| 人工裁决 | 风险确认、批准/拒绝 | Review / Create 流程 | 原生暂停表单、分支、超时 | 行内批准、反馈、恢复 | Gate Sheet + 结构化反馈 + 恢复 |
| 正式产物审查 | Changes 为主 | 文档/实体聚合 | 变量/节点输出 | Diff/Checkpoint | Artifact 主体 + Diff + Hash + 追溯 |
| 证据定位 | 会话事件与工具面 | 实体关联工具 | 节点 Last Run / Trace | 工具步骤 / Checkpoint | Evidence 与 Operation 精确关联 |
| 视觉风险 | IDE 小字、多面板 | 企业卡片墙、表格感 | 节点画布拥挤 | Kanban 卡片泛滥 | 大字号、单焦点、按需展开 |

---

## 5. 对齐 SDLC Factory v1.2 的最佳设计

本建议以 [v1.2 历史设计索引](../../archive/legacy-v1.2/docs/v1.2/README.md) 为当时的研究边界。竞品只能提供界面模式，不能改写以下领域约束：

- Project Requirement / Design 是项目级阶段；Coding / Testing 是 CU 级阶段；
- 每阶段形成正式 Artifact、确定性 Evidence 与人工审核记录；
- Baseline 经批准后不可原地修改，上游变化导致下游 `STALE` 或 `IMPACT_REVIEW_REQUIRED`；
- Evidence 与日志必须分离：Evidence 是 Gate 依据，日志是诊断材料；
- 项目级 Gate 与 CU 级 Gate 的审查对象不同；
- 发布范围内全部 CU 具有有效 TestBaseline 后，仍须完成 System Integration Run 与 `SystemAcceptanceBaseline`；
- 单实例默认只有一个活动 Run，其他请求进入 `QUEUED_FOR_CAPACITY`；
- `Task` 不作为领域实体，ExecutionPlan 是可重建投影。

### 5.1 产品结构：Catalog → Mission Control → Focus Workspace

```text
Factory Catalog
└── Project Mission Control
    ├── Overview：当前阶段、Baseline 健康度、下一裁决
    ├── Capability Units：CU 状态与依赖的紧凑投影
    ├── Artifacts：正式产物、版本、Hash、Diff、追溯
    ├── Runs：唯一活动 Run + 容量队列 + 历史 Run
    └── System Acceptance：参与 CU 基线、集成场景、系统验收
        └── Focus Workspace
            ├── Activity：当前 Run 的事件主线
            ├── Review：当前 Gate 的审查材料
            ├── Evidence：不可变证据清单与预览
            ├── Logs：诊断输出
            └── Preview：应用、测试或运行结果
```

这套结构分别吸收 Backstage 的“目录—对象”、Cline Kanban 的“总览—聚焦”和 OpenHands 的“单任务—按需工作面”。

### 5.2 首页：Project Catalog，而不是仪表盘卡片墙

首页只保留：

- 32px 页面标题与全局搜索；
- 最近项目列表；
- 每个项目仅显示 Lifecycle 状态、Baseline 健康度、是否等待裁决、最近活动时间；
- 一个显著的“需要我裁决”过滤入口；
- 新建项目动作。

首页不展示终端、Agent 对话、Evidence 数量矩阵、Token 图表或完整 CU 看板。用户先选项目，再进入深层工作。

### 5.3 项目页：以“下一次裁决”为视觉中心

项目页顶部使用一条简洁的 Lifecycle Rail（生命周期轨道）：

```text
Initialize ─ Requirement Gate ─ Design Gate ─ CU Coding / Testing ─ System Acceptance
```

主体只保留一个大焦点：

- 运行中：显示当前 Run、阶段、已用时间、当前 Operation 与 Pause；
- 等待审核：显示 Gate Sheet；
- 无活动 Run：显示下一可执行动作与容量队列；
- 基线失效：显示 Stale Impact Sheet（失效影响面），优先于普通运行信息。

CU 状态使用紧凑列表或小型矩阵，不使用大尺寸 Kanban 卡片。由于同一时间只有一个活动 Run，运行中项目应只有一个明显的动态指示。

### 5.4 Gate Sheet：必须让用户“看得懂再裁决”

Gate Sheet 是整套产品唯一允许高视觉权重的浮层/流内面板，结构固定为：

1. **Decision Header**：作用域、阶段、风险/完整度、等待时长；
2. **What changed**：Artifact 版本、Diff 摘要、Git revision；
3. **Why it is ready**：必需 Evidence、检查结果、追溯覆盖；
4. **What this unlocks**：批准后将形成的 Baseline 与下游阶段；
5. **Open issues**：告警、未解决项、豁免；
6. **Decision**：Approve、Request changes、On hold；危险或不可逆动作不提供默认批准；
7. **Feedback**：结构化原因、精确批注和附件。

不同 Gate 使用同一视觉骨架，但材料不同：

- Project Requirement / Design Gate：正式 Markdown、候选/最终 CU、接口和影响范围；
- CU Code Gate：CU 累计 Diff、权威构建/测试结果、Git revision；
- CU Test Gate：Test Obligation、场景、环境快照、Evidence 与追溯矩阵；
- System Acceptance Gate：参与 CU 的 Code/Test Baseline、接口版本、跨 CU 场景、集成 Evidence 与未解决问题。

### 5.5 Artifact、Evidence 与 Logs 必须视觉分离

- **Artifact**：可读正文优先，支持目录、版本、Hash、Diff 和追溯；像文档审阅器，不像 JSON Viewer。
- **Evidence**：以来源 Operation、时间、环境、Hash、结果分类；默认显示 Gate 所需证据是否齐备。
- **Logs**：单独 Tab，默认折叠原始输出，提供搜索和错误定位；不能用“日志很多”暗示 Evidence 充分。
- **Baseline**：显示为不可变快照，批准后不出现 Edit；发生变化时新建版本，并明确显示旧版、当前版与 `STALE` 传播关系。

### 5.6 视觉语言：Apple 式冷静，不做 Apple 仿制品

推荐视觉方向：**Light-first Graphite + Electric Blue（浅色优先的石墨灰 + 电蓝）**。

| Token | 建议值 | 用途 |
|---|---|---|
| App background | `#F5F5F7` | 全局背景 |
| Primary surface | `rgba(255,255,255,0.86)` | 主工作面与 Gate Sheet |
| Primary text | `#111318` | 标题、正文 |
| Secondary text | `#6E737B` | 元信息 |
| Accent | `#0A7AFF` | 唯一主动作、当前节点 |
| Success | `#30A46C` | 已批准/通过 |
| Warning | `#E58A00` | 等待裁决/需复核 |
| Danger | `#D92D20` | 失败、拒绝、高风险 |
| Hairline | `rgba(17,19,24,0.10)` | 极弱分隔线 |

字体采用系统字体栈：

```css
font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display",
  "Segoe UI Variable", "Segoe UI", sans-serif;
```

字号下限：

- 页面标题：32–36px / 1.15；
- 对象标题：26–30px；
- 区域标题：20–22px；
- 正文：16–17px / 1.55；
- 元信息：14px，禁止低于 13px；
- 代码与 Hash：14.5–15px monospace。

空间和形态：

- 8px 基础网格，页面横向留白 28–40px；
- 主面板圆角 20–24px，按钮 10–12px；
- 同屏最多一个强阴影浮层；其他层级用 Neutral Surface 和间距表达；
- 不使用渐变大标题、霓虹描边、玻璃卡片墙或遍布全屏的状态色；
- Motion 只用于运行状态、Gate 出现和 Tab 转换，时长 160–240ms，并支持 reduced motion。

### 5.7 下一版可视原型应验证什么

下一版不应继续修旧稿，而应一次性实现一个可点击的完整裁决闭环，至少包含四个可切换状态：

1. **Project Catalog**：找到一个等待裁决的项目；
2. **Mission Control / Running**：看到唯一活动 Run，打开 Artifact、Evidence、Logs、Preview；
3. **Mission Control / Awaiting Gate**：打开大字号 Gate Sheet，查看材料并选择 Approve / Request changes / On hold；
4. **After Decision**：形成新 Baseline，生命周期前进；或要求修改后创建新的受控返工路径。

同时提供 Project Gate 与 CU Gate 两种真实内容，证明同一视觉骨架能承载不同审查材料。只有用户确认这版交互原型的视觉、字号和裁决路径后，再继续扩展 Capability Map、依赖图和 System Acceptance 页面。

---

## 6. 最终建议

最佳设计不是“选一个 GitHub 项目照抄”，而是明确分工：

- **Backstage** 决定全局信息架构和中性表面层级；
- **Cline Kanban** 决定多 Agent/队列的总览—聚焦关系；
- **OpenHands** 决定当前 Run 的单主线工作方式；
- **Cline** 决定 Diff、批准、反馈与恢复闭环；
- **Dify / Flowise** 决定 Human Gate 的暂停、表单、分支和恢复语义；
- **SDLC Factory v1.2** 最终约束所有页面的领域事实：Project/CU 两级生命周期、正式 Artifact、不可变 Baseline、Evidence/Logs 分离、单活动 Run 和 SystemAcceptanceBaseline。

因此，下一版原型应采用 **Factory Mission Control**，而不是继续装饰旧三栏界面：大字号、单焦点、层级分明、裁决优先，既有 Apple 式简约与质感，也保留软件工厂必须具备的证据与审计深度。
