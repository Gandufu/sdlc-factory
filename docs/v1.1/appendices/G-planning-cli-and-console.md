# 附录 G：规划模式、观测 CLI 与项目控制台

## 1. 目标

本附录补齐四项能力：

1. 大需求在进入正式需求前先规划、提问和拆分；
2. 观测器提供可脚本化 CLI，不依赖 Codex 人工读取日志；
3. Codex 或其他分析 Agent 可以通过稳定接口分析运行，而不直接修改工作流；
4. 本地项目控制台展示项目、计划、工作项、运行、成本和产物符合性。

CLI、控制台和 Agent 工具必须调用同一个应用接口。它们只是不同入口，不能各自实现一套状态
判断。

## 2. 项目管理模型

1.1 在 1.0 的 `Project → WorkItem → TestBatch → Operation` 基础上，只新增一个一等规划对象：

```text
Project
├─ Project Profile
├─ Project Facts
├─ Delivery Plan
│  └─ linked WorkItems[]
├─ WorkItems[]
├─ TestBatches[]
├─ Operations[]
├─ RunRecords[]
└─ Reports[]
```

### 2.1 交付计划

交付计划（`DeliveryPlan`）用于把一个过大的目标拆成多个可独立审核和验证的工作项。

最小索引：

```text
delivery_plan_id
project_id
status
input_ref
input_hash
plan_ref
plan_hash
version
linked_work_item_ids[]
created_at
approved_at?
approved_by?
supersedes?
```

状态：

```text
draft → awaiting_approval → approved
   └───────────────→ cancelled
approved → superseded
```

只有 Operator 可以批准计划。计划批准不等于需求发布、代码审核或交付批准。

### 2.2 项目地图

项目地图不是新的可写状态聚合。它由以下事实实时投影：

- `project.md` 中的产品目标、模块和外部系统；
- `project-profile.yaml` 中的框架与能力路由；
- 已批准交付计划；
- 当前和历史工作项；
- 工作项之间的依赖、关联和后续关系；
- 测试批次、运行操作和正式报告。

控制台显示实时项目地图。需要归档时可以导出 `project-map.md`，但导出文件只是快照，不能反向
覆盖 Core 状态。

### 2.3 工作项关系

工作项增加轻量关系：

```text
depends_on
related_to
follow_up_of
supersedes
```

最终交付后发现问题时创建 `follow_up_of` 工作项，不重开已完成历史。一次会话不是一个工作项；
一个工作项可以关联多个主会话、子代理和重试运行。

## 3. 规划模式

### 3.1 何时使用

规划模式由用户主动选择，或由交付负责人提出建议。出现以下任一情况时建议先规划：

- 一个目标包含多个可独立验收的用户结果；
- 跨越多个模块、仓库、设备或外部系统；
- 存在需求、协议、原型或安全策略冲突；
- 需要多次人工决定；
- 预计不能在一个聚焦实现运行中完成；
- 失败回退会影响多个已有能力；
- 用户给出的目标仍然模糊，需要先访谈。

这些是建议条件，不是 Token、文件数或工具调用次数门禁。小而清晰的需求可以直接创建
WorkItem。

### 3.2 快速计划和受控计划

规划模式有两种执行策略：

| 策略 | 适用范围 | 过程 | 正式产物 |
|---|---|---|---|
| 快速计划 | 清晰、低风险、主要是拆分 | 一次检查、一次拆分、一次批准 | 一个 `plan.md` |
| 受控计划 | 跨模块、高风险、资料冲突或架构不确定 | 边界确认、关键决定确认、最终拆分批准 | 一个 `plan.md` 加被引用的独立决定 |

受控计划可以多轮反馈，但不为每轮自动生成一篇长期文档。只有最终批准的正文和确有长期价值的
架构决定进入项目事实。

### 3.3 规划模式能做什么

规划模式允许：

- 读取项目和正式参考资料；
- 检查现有模块、能力、约束和历史工作项；
- 向用户提问；
- 识别冲突、未知项和高风险决定；
- 提出工作项拆分、依赖和验证顺序；
- 估算所需角色、环境和测试类型；
- 生成或修订 `plan.md`。

规划模式不允许：

- 修改产品源码；
- 执行发布、部署或破坏性命令；
- 发布需求版本；
- 自动创建并启动全部工作项；
- 因为计划写得完整就宣称需求或实现完成。

宿主可以用只读沙箱实现“规划时不改源码”。这是规划动作的显式执行策略，不是按 Agent 角色
设置隐式目录 ACL。Core 在提交计划时独立确认源码修订没有变化。

### 3.4 规划流程

```mermaid
flowchart LR
    I["原始目标"] --> P["规划模式"]
    P --> Q["提问与项目检查"]
    Q --> D["交付计划草案"]
    D --> A["等待计划批准"]
    A -->|修改| P
    A -->|批准| W["创建关联 WorkItem"]
    W --> S["各 WorkItem 进入需求阶段"]
```

### 3.5 正式规划产物

批准后的计划只保存一份正文：

```text
docs/sdlc/plans/<delivery-plan-id>/plan.md
```

内容固定为：

1. 目标和不在范围内的内容；
2. 已确认事实和仍待确认事项；
3. 项目影响范围；
4. 工作项拆分；
5. 工作项依赖图；
6. 风险和回退方向；
7. 验收轮廓；
8. 角色、环境和验证要求；
9. 批准信息和内容哈希。

不额外生成与 WorkItem 重复的 `requirements.md`、`design.md` 和 `tasks.md`。每个 WorkItem
仍按自己的 Requirement Version 保存正式需求；技术设计只有在确实需要时作为 Project Fact
或 WorkItem 产物保存。

未批准草案使用短生命周期待批准文件。批准后原子发布为正式 `plan.md`；取消或被替代后按
保留策略删除草案，不进入项目文档。

### 3.6 计划变更

- 未批准计划可以继续修订；
- 已批准计划不可原地修改；
- 大方向改变时创建新版本并标记 `supersedes`；
- 已开始的 WorkItem 不自动删除；
- 受影响工作项回到各自 Requirement Version 流程；
- 已有实现、审核和测试证据按版本绑定规则失效；
- 计划回退不能直接回滚 Git，源码回退仍由正常工作项处理。

## 4. 观测器 CLI

推荐提供单一命令 `sdlc-factory`，而不是再维护一套只服务 OpenCode 的脚本。

### 4.1 项目与计划

```powershell
sdlc-factory project list
sdlc-factory project show --project PRJ-001
sdlc-factory project map --project PRJ-001 --format text

sdlc-factory plan start --project PRJ-001 --input .\goal.md
sdlc-factory plan show --plan DP-001
sdlc-factory plan submit --plan DP-001
sdlc-factory plan approve --plan DP-001 --hash <sha256> --confirmed
```

`plan approve` 必须走独立 Operator 入口。Agent 入口不暴露该命令。

### 4.2 运行观察

```powershell
sdlc-factory observe run `
  --host opencode `
  --project PRJ-001 `
  --work-item WI-001 `
  --stage implementation `
  -- opencode run --format json "<prompt>"

sdlc-factory observe watch --run RUN-001
sdlc-factory observe status --run RUN-001 --format json
sdlc-factory observe import --host codex --run RUN-002 --jsonl .\codex-events.jsonl
sdlc-factory observe reconcile --run RUN-001
```

`observe run`：

1. 创建 `run_id`；
2. 前台启动宿主进程；
3. 同时读取 stdout、stderr 和事件；
4. 等待进程或宿主会话终态；
5. 运行宿主专属补全和子会话对账；
6. 关闭运行记录并返回确定退出码。

禁止固定 `sleep`。长时间无输出使用“静默时间”指标观察，不代表进程已经失败。

### 4.3 分析与报告

```powershell
sdlc-factory analyze build --run RUN-001
sdlc-factory analyze review --provider codex --run RUN-001
sdlc-factory analyze compare --baseline RUN-BASE --candidate RUN-001

sdlc-factory inspect build --work-item WI-001 --test-batch TB-001
sdlc-factory report show --report RPT-001
sdlc-factory report export --report RPT-001 --format markdown
sdlc-factory doctor --host opencode
```

CLI 输出约定：

- 人类模式默认中文摘要；
- `--format json` 输出单个最终对象；
- `--format jsonl` 输出运行事件；
- 大正文通过文件引用返回；
- stdout 只放协议输出，诊断写 stderr；
- 进程退出码区分成功、工作流拒绝、宿主失败、遥测不完整、符合性不通过和适配器错误；
- Secret 在进入 stdout、stderr 和事件存储前脱敏。

## 5. 分析提供方接口

Codex、OpenCode 或其他模型通过分析提供方接口（`AnalysisProvider`）接入：

```text
analyze(request) → AnalysisResult
```

请求只包含：

```text
analysis_job_id
analysis_kind
project_id
work_item_ids[]
run_ids[]
report_refs[]
requirement_refs[]
source_revision_id?
schema_version
redaction_policy
```

结果：

```text
status
summary
findings[]
evidence_refs[]
limitations[]
recommended_actions[]
provider_run_ref
```

分析提供方不能直接读取或修改 Workflow Index，也不能批准计划、需求、审核或交付。

### 5.1 Codex 适配器

第一版可以使用 Codex 非交互模式：

```powershell
codex exec --json `
  --output-schema .\schemas\analysis-result.schema.json `
  "分析指定 Factory 运行报告，只输出符合 Schema 的结论"
```

`codex exec --json` 提供线程、轮次、工具、文件变更和 Token 等 JSONL 事件；
`--output-schema` 约束最终结果。需要在 Factory 控制台中呈现实时线程、计划、审批和工具进度时，
再增加 Codex App Server Adapter。

官方参考：

- [Codex 非交互模式](https://learn.chatgpt.com/docs/non-interactive-mode)
- [Codex App Server](https://learn.chatgpt.com/docs/app-server)
- [Codex 规划与长期工作](https://learn.chatgpt.com/docs/prompting)

禁止直接依赖 Codex 私有 rollout 文件结构。CLI JSONL 和 App Server 是正式适配缝；若协议版本
变化，只修改 Codex Adapter。

### 5.2 分析独立性

- 分析运行使用只读项目权限；
- 分析 Agent 与被分析的实现或测试运行使用不同 `run_id`；
- 确定性指标先生成，模型只能解释和归类；
- 模型结论与原始指标并列展示；
- 没有证据引用的结论标为 `uncertain`；
- 分析失败不改变产品工作流状态；
- 同一个模型可以承担不同角色，但身份、输入和证据必须隔离；
- 分析报告不能自动触发修改、提交、推送或发布。

## 6. 项目控制台

推荐实现本地 Web 控制台：

```powershell
sdlc-factory console serve --listen 127.0.0.1:7331
```

默认只监听本机。技术栈在实现阶段决定；1.1 先冻结查询与命令接口，不把某个前端框架写进 Core。

### 6.1 页面

| 页面 | 主要内容 |
|---|---|
| 项目总览 | 项目健康、活动计划、工作项、测试批次、阻塞和最近报告 |
| 项目地图 | 模块、外部系统、工作项关系、依赖和当前源码基线 |
| 交付计划 | 计划正文、版本、工作项拆分、依赖图和批准状态 |
| 工作项看板 | 需求、实现、审核、测试摘要和后续工作项 |
| 运行时间线 | 主会话、子代理、模型步骤、工具、门禁和人工等待 |
| Token 与成本 | 实际总量、成功路径、返工开销、阶段和角色对比 |
| 工具与错误 | 调用量、失败指纹、重复读取、输出体积和责任分类 |
| 产物符合性 | 需求覆盖、必测项、UI、协议、安全和证据状态 |
| 报告对比 | 基线运行与候选运行的耗时、Token、错误和质量差异 |
| 插件健康 | 适配器版本、事件缺口、Schema 兼容和脱敏状态 |

### 6.2 界面边界

- 控制台读取查询投影，不直接解析工作区文件；
- 所有写动作调用与 CLI 相同的应用接口；
- 批准动作要求内容哈希和 `confirmed=true`；
- 长报告按需加载，不在首页注入；
- 原始会话和推理正文默认不展示；
- Secret 永不通过浏览器接口返回；
- UI 缓存损坏不能改变 Core 状态；
- 控制台关闭不影响已由 Runner 管理的运行；
- 每个图表都能下钻到指标来源和数据完整度。

## 7. 使用 Codex 迭代 Factory

后续升级使用一个受控闭环：

```mermaid
flowchart LR
    R["真实流程运行"] --> O["确定性观测报告"]
    O --> A["Codex 独立分析"]
    A --> C["改进候选"]
    C --> H["人工确认"]
    H --> W["Factory 维护 WorkItem"]
    W --> V["回归与基线对比"]
    V -->|改善| B["更新基线"]
    V -->|退化| W
```

### 7.1 改进候选

Codex 分析只能产生改进候选：

```text
candidate_id
problem_statement
affected_runs[]
evidence_refs[]
suspected_owner
proposed_change
expected_benefit
risk
acceptance_metrics
analysis_provider_ref
```

Operator 确认后，在 SDLC Factory 项目中创建正常 WorkItem。修改 Factory、运行回归、提交和发布
仍走正常流程，不能由观测器自我修改。

### 7.2 防止错误优化

- 不用单次运行决定架构；
- 至少保存一个固定回放数据集和一个真实项目基线；
- 性能改善不能以需求符合性下降为代价；
- Token 下降但失败率上升视为退化；
- 删除必要读取不能伪装成效率提升；
- 分析器版本、模型、提示词和 Schema 都必须记录；
- 候选与基线使用相同输入、宿主版本和环境条件；
- 失败、取消和人工等待必须单独比较；
- 只有 Operator 可以接受新基线。

## 8. 必须吸取的插件教训

| 历史问题 | 1.1 防复发合同 |
|---|---|
| 把外部资料复制成 `sources/SRC-*` | 项目资料由宿主正常读取；Core 只保存正式需求和产物引用 |
| 图片等原文件被转换为 Markdown | Factory 不做通用内容摄取和格式转换 |
| 目录文件数门禁导致流程卡死 | 不按固定文件数或读取次数阻止正常规划和实现 |
| 角色目录 ACL 互相矛盾 | 角色是职责；权限由显式执行模式和全局保护策略管理 |
| Context Pack 导致重复注入 | 按工作项引用和按需规则加载，不复制完整会话或资料 |
| 子代理无法访问主线所需资料 | 隔离上下文，不隔离正常项目读取能力 |
| 聊天尾部 JSON 解析失败 | 使用结构化交接工具或输出 Schema |
| 新反馈到达后仍复验旧错误 | 新事实使旧执行计划失效，先分类再调度 |
| `skip + exit 0` 假通过 | 测试原生四态，必测项只有 `passed` 才通过 |
| 原始需求被模型改写 | 模型前按原始字节保存并计算哈希 |
| 固定 `sleep` 轮询长进程 | 等待进程、事件或会话终态，静默只作为指标 |
| 把所有运行时间算成一个阶段 | 使用 Factory 阶段事件，父子时间不重复相加 |
| `cost=0` 被理解为免费 | 分离 OpenCode 估算和提供方实际结算 |
| Codex 手工拼接日志才能分析 | 观测 CLI、分析提供方和控制台独立生成报告 |
| 一次会话割裂一个项目 | Project、DeliveryPlan、WorkItem 和 RunRecord 分层关联 |

这些合同的完整问题背景、实际运行数据和当前残留风险见
[SDLC Pipeline 插件模式问题复盘](../../research/sdlc-pipeline-plugin-mode-lessons-2026-08-03.md)。

## 9. 验收

至少验证：

1. 小需求可跳过规划直接创建 WorkItem；
2. 大需求可形成一个批准计划和多个关联 WorkItem；
3. 计划期间源码变化会被拒绝提交；
4. 计划更新不会静默删除已开始工作项；
5. OpenCode 运行可以被 CLI 前台观察且不使用固定 `sleep`；
6. Codex JSONL 可以通过 Adapter 导入并生成结构化分析；
7. Codex 分析失败不会修改工作流；
8. 控制台与 CLI 查询同一状态得到一致结果；
9. 控制台能显示阶段时间、Token、错误、产物符合性和数据缺口；
10. 基线对比能区分成功路径与返工开销；
11. 改进候选必须经 Operator 确认后才能成为维护 WorkItem；
12. 任一报告都不泄漏密码、Token、认证头或私有推理正文。
