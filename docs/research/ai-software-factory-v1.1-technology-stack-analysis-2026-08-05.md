# AI 软件工厂 v1.1 技术栈与 Harness 深度分析

> 日期：2026-08-05
>
> 状态：技术研究结论，不修改 v1.1 架构基线
>
> 资料范围：官方文档、官方规范和官方源码

## 1. 结论摘要

此前把 Spring AI、LangGraph/LangChain 和 LangFlow 简单排除在 v1.1 之外，结论过早。真正需要避免的不是某种语言或框架，而是让第二套 Agent Runtime 或工作流状态成为 Factory 的业务事实源。

针对当前约束——项目级需求与总体设计、设计基线确定 CU、CU 串行编码测试、单活动 Run、结构化 Handoff、确定性 Runner、人工 Gate——推荐采用分层组合，而不是在 Java、TypeScript、Python 中三选一：

```text
Spring Boot Factory Core（业务事实源）
├─ Baseline / CU / ExecutionPlan / Gate / Policy / Audit
├─ Harness Registry / Dataset / Evaluation / Experiment
├─ Runner Control / Evidence / Handoff Validation
└─ OTLP + Factory Event Outbox
             │
             ├─ Node.js OpenCode Host Adapter
             │    └─ @opencode-ai/sdk → OpenCode Server → Coding Agent
             │
             ├─ 可选 Spring AI Direct Model Adapter
             │    └─ 分类、评审建议、评估器等受限任务
             │
             └─ 可选 Python Evaluation Lab
                  └─ LangGraph/LangChain 或独立评估脚本

OpenTelemetry Collector
└─ Phoenix（首选原型）或 Langfuse（候选产品化后端）
```

核心判断如下：

1. **Spring Boot 继续承担 Factory Core。** 当前难点是可审计的领域状态、事务、Gate、基线与证据，不是通用 Agent 图编排。
2. **OpenCode 继续作为首个 Coding Agent Harness。** 官方 SDK 已提供 Session、事件流、结构化输出、取消、消息 Part、工具调用、Diff、成本和 Token 等可采集信号，明显比从零重造代码 Agent 更合适。[OpenCode SDK](https://opencode.ai/docs/sdk/)、[OpenCode SDK 官方类型](https://github.com/anomalyco/opencode/blob/dev/packages/sdk/js/src/gen/types.gen.ts)
3. **Spring AI 不应包在 OpenCode 外面形成双重 Agent Loop，但应保留为可选 Direct Model Adapter。** 它适合 Java 内的模型调用、工具抽象、结构化评估和 Micrometer 可观测性；不应接管 Coding Agent 主循环。[Spring AI Tool Calling](https://docs.spring.io/spring-ai/reference/api/tools.html)、[Spring AI Observability](https://docs.spring.io/spring-ai/reference/observability/index.html)
4. **LangGraph/LangChain 的价值从“主流程编排”调整为“实验与特定 Agent 实现”。** 其耐久执行、检查点、人工中断和回放能力真实存在，但若直接承载 Factory 生命周期，会与 Core 的 Gate、Run 和恢复协议形成双重状态。[LangGraph 概览](https://docs.langchain.com/oss/python/langgraph/overview)、[LangGraph Persistence](https://docs.langchain.com/oss/python/langgraph/persistence)
5. **LangFlow 适合可视化原型和连接验证，不适合成为 v1.1 生产控制平面。** 它确实支持 Agent、工具、MCP、人工审批和多种观测后端，但可视化 Flow 不能替代版本化领域合同和确定性 Runner。[LangFlow Agents](https://docs.langflow.org/components-agents)、[LangFlow LangSmith 集成](https://docs.langflow.org/integrations-langsmith)
6. **MCP 要保留，但定位为边界协议，不是内核总线。** M0 不需要为了单一 OpenCode Host 强制引入 MCP；当需要第二个 Host、外部工具生态或稳定的跨语言能力面时，再把 Factory 的受限资源与工具暴露成 MCP。
7. **遥测不能等同于 Harness 经验库。** OpenTelemetry 负责跨进程因果链和运行观测；Factory 自己保存可审计事实、版本绑定、证据和人工裁决。OTel Trace 可以丢、采样和过期，不能成为 Gate 或 Baseline 的权威来源。
8. **不能把“分析模型原始私有思维链”设为产品依赖。** 应采集模型公开返回的 reasoning summary（推理摘要，如果有）、工具轨迹、计划/自评、问题与答案、Diff、Runner 证据、重试、返工和人工裁决；这些才是可跨模型、可审计、可评估的替代信号。

## 2. 评估目标与边界

后续 v1.2 设计继续保持这些边界：ExecutionPlan 是从 Project DesignBaseline 派生的可重建调度投影；任一时刻只有一个活动业务 Run；Runner 提供权威执行证据；Handoff 使用版本化结构，而 Gate 由操作人员或明确定义的策略裁决。详见 [v1.2 架构基线](../v1.2/ai-software-factory-design-v1.2-final.md)。

新增目标是把每次工厂运行沉淀为可持续迭代的 Harness：

- 保留用户原始输入、澄清问题与答案；
- 记录装配后的上下文及来源，不仅保存最终 Prompt；
- 记录模型、Prompt、策略、工具模式和环境版本；
- 记录工具调用、代码修改、Runner 证据、失败、重试与返工；
- 保存 Gate 输入、人工裁决、修改意见和最终结果；
- 从生产轨迹构造版本化评估集；
- 通过离线回放和实验比较 Prompt、模型、策略及工具；
- 以风险和证据为条件，逐步把人工 Gate 转成自动 Gate。

因此技术栈必须同时支持四种不同的真相：

| 层次 | 权威内容 | 不应由谁替代 |
|---|---|---|
| Factory Domain | Baseline、CU、Gate、Run、Handoff、人工裁决 | LangGraph checkpoint、OpenCode Session、Trace 后端 |
| Execution Evidence | 命令、退出码、测试报告、Diff、Git revision、环境绑定 | 模型总结或 LLM-as-a-judge |
| Agent Trajectory | 输入、上下文、消息、工具调用、重试、公开推理摘要 | 仅靠聊天全文或原始私有 CoT |
| Telemetry | Span、指标、日志、Token、成本、延迟 | 审计账本或业务状态表 |

## 3. 候选技术栈分析

### 3.1 Spring Boot + Spring AI

#### 适合承担的职责

Spring Boot 适合承载 Factory Core：领域状态、关系数据库事务、Outbox、权限、人工审核 API、Runner 控制和审计。Spring AI 提供 Java 风格的 `ChatClient`、模型抽象、Tool Callback、MCP Client/Server 以及基于 Spring/Micrometer 的观测能力。[Spring AI API](https://docs.spring.io/spring-ai/reference/api/)、[Spring AI MCP](https://docs.spring.io/spring-ai/reference/api/mcp/mcp-overview.html)

Spring AI 的 Tool Calling 可以由框架、Advisor 或用户代码控制。官方文档明确说明 `ChatClient` 默认注册 `ToolCallingAdvisor` 并管理完整工具循环，也允许关闭后由用户控制。[Spring AI Tool Calling](https://docs.spring.io/spring-ai/reference/api/tools.html) 这意味着它可以实现一个 Agent Runtime，但也正因此不应再包裹 OpenCode 的 Agent Loop。

Spring AI 的观测基于 Spring 生态，覆盖 ChatClient、ChatModel 和工具调用；工具参数和结果因敏感性默认不导出，需显式开启。[Spring AI Observability](https://docs.spring.io/spring-ai/reference/observability/index.html) 该默认值符合 Factory 的“先脱敏后导出”要求。

#### 推荐定位

- **必须使用：** Spring Boot Core、Micrometer/OTel、数据库和安全能力。
- **可选使用：** Spring AI Direct Model Adapter，用于需求分类、审核摘要、风险标签、评估器或不需要代码仓库自主操作的受限任务。
- **不推荐：** `Spring AI Agent → OpenCode Agent` 的嵌套循环。
- **不要假设：** 使用 Spring AI 就能直接调用 `@opencode-ai/sdk`；官方 OpenCode SDK 是 JS/TS 客户端，Java 侧仍需 HTTP/OpenAPI 客户端或 Node Adapter。

### 3.2 TypeScript + OpenCode SDK

OpenCode 官方将 SDK 定义为 OpenCode Server 的类型安全 JS/TS 客户端；类型由 Server OpenAPI 规范生成。SDK 可以启动 Server，也可以连接已有 Server，并提供 Session、消息、文件、结构化输出、取消和 SSE 事件订阅。[OpenCode SDK](https://opencode.ai/docs/sdk/)、[OpenCode Server](https://opencode.ai/docs/server/)

官方生成类型还展示了 Harness 所需的细粒度信号：

- `ToolPart` 含 `callID`、工具名、输入、输出、错误和起止时间；
- `StepFinishPart` 含成本、输入/输出/推理/缓存 Token；
- `PatchPart`、`SnapshotPart`、`RetryPart` 和 Session Diff；
- `ReasoningPart` 和消息 Part 更新事件；
- Permission、Session 状态、文件编辑和错误事件。

这些字段见 [OpenCode SDK 官方类型源码](https://github.com/anomalyco/opencode/blob/dev/packages/sdk/js/src/gen/types.gen.ts)。它们非常适合由 Host Adapter 归一化为 Factory Trajectory Event 和 OTel Span。

#### 推荐定位

- Node.js/TypeScript 只作为 **OpenCode Host Adapter 进程**，不成为第二套业务后端。
- Adapter 负责协议、Session 生命周期、事件流、取消、Host 版本探测和事件归一化。
- Factory Core 继续决定 Run 是否可开始、Gate 是否满足、Handoff 是否有效和 Runner 是否通过。
- OpenCode 的 `ReasoningPart` 只能按“供应商公开返回的推理内容/摘要”处理，不能假定是完整、真实或跨模型等价的原始思维链。

### 3.3 Python LangGraph / LangChain

LangChain 官方将 LangChain 定位为 Agent Framework，将 LangGraph 定位为支持耐久执行、Streaming、人工介入和持久化的编排 Runtime。[LangGraph 概览](https://docs.langchain.com/oss/python/langgraph/overview) LangGraph Checkpointer 支持人工暂停、故障恢复和时间旅行；失败后可从检查点恢复。[LangGraph Persistence](https://docs.langchain.com/oss/python/langgraph/persistence) LangChain 的 Human-in-the-loop Middleware 会在工具执行前中断并保存图状态。[LangChain Human-in-the-loop](https://docs.langchain.com/oss/python/langchain/human-in-the-loop)

这些能力不是缺点，而且对 Harness 实验非常有价值：

- 快速构造替代 Agent 或 evaluator pipeline；
- 对固定数据集执行 Prompt/模型/策略实验；
- 在研究环境中检查中间节点和重放路径；
- 利用 Python 的评估、统计和数据分析生态。

但不建议让 LangGraph 成为当前生产生命周期的权威编排器，因为会出现两套语义：

```text
Factory Run / Gate / Outbox / Recovery
                ↕ 对账
LangGraph Thread / Checkpoint / Interrupt / Resume
```

如果未来某个 Stage Agent 由 LangGraph 实现，它应位于 Host Adapter 后面，输入和输出仍遵守 Factory 的 `AgentInvocation` 与 `Handoff` 合同。LangGraph checkpoint 只能是该 Agent 的内部状态，不是 Project/CU/Gate 事实源。

### 3.4 LangFlow

LangFlow 的 Agent 组件把 LLM、工具、其他 Agent 和 MCP Server 组合成可视化 Flow，并支持对工具调用增加人工审批；其官方文档也列出 LangSmith、Langfuse、Arize 等观测集成。[LangFlow Agents](https://docs.langflow.org/components-agents)、[LangFlow LangSmith 集成](https://docs.langflow.org/integrations-langsmith)

它适合：

- 非核心 Stage Agent 的可视化原型；
- Prompt、模型、工具和 MCP 连通性验证；
- 产品/领域人员参与的早期流程试验；
- 把成功原型导出为明确合同后再工程化。

它不适合直接承载：Project DesignBaseline、ExecutionPlan、唯一活动 Run、权威 Runner、累计 Diff、Gate 审计及基线失效规则。其可视化 Flow 版本也必须作为 Experiment Variant 记录，不能在生产中无版本热改。

### 3.5 可选耐久工作流引擎

Temporal 的 Workflow 通过 Event History 重放恢复状态；官方文档强调 Workflow 必须确定性，外部调用、文件 I/O、数据库和 LLM 应放入 Activity。Temporal 提供 Java SDK。[Temporal Workflow](https://docs.temporal.io/workflows)、[Temporal Java SDK](https://docs.temporal.io/develop/java)

这与长期运行、等待人工审批和崩溃恢复高度匹配，但当前 v1.1 已限定单活动 Run、串行执行，并已有数据库状态、Outbox 和 Reconciler。立即引入 Temporal 会增加第二份 Event History、部署和版本迁移成本。

推荐设置引入触发条件，而不是永久排除：

- Run 经常跨天等待并且进程重启恢复成为主要故障源；
- 多个外部系统回调、超长定时器和补偿逻辑显著增加；
- 自研 Outbox/Reconciler 的恢复复杂度或事故率超过团队可接受范围；
- 需要跨多个 Worker/机器调度，而不再是单实例串行；
- 能明确保证 Factory Domain 仍是业务事实源，Temporal 仅承载执行协调，或决定一次性迁移而不是双写。

在这些条件出现前，保留 `WorkflowRuntime` seam 和稳定命令合同即可，不在 M0/M1 部署 Temporal。

## 4. 推荐组合与适配度

评分：5 为非常适合，1 为明显不适合。评分针对本项目目标，而不是框架通用能力。

| 候选 | Factory 领域核心 | Coding Agent | Harness 轨迹 | 离线评估/实验 | 人工 Gate | 当前运维成本 | 推荐角色 |
|---|---:|---:|---:|---:|---:|---:|---|
| Spring Boot | 5 | 1 | 4 | 3 | 5 | 4 | 权威 Core |
| Spring AI | 3 | 2 | 4 | 3 | 3 | 4 | 受限 Direct Model Adapter / Java evaluator |
| OpenCode SDK | 1 | 5 | 4 | 3 | 2 | 4 | 首个 Coding Host Adapter |
| LangGraph/LangChain | 2 | 3 | 5 | 5 | 4 | 2 | Evaluation Lab / 可选 Stage Agent |
| LangFlow | 1 | 2 | 3 | 3 | 3 | 2 | 原型和连接验证 |
| Temporal | 3 | 1 | 3 | 2 | 5 | 1 | 达到触发条件后的耐久协调器 |

最终推荐不是“Spring AI 或 OpenCode 或 LangGraph”，而是：

> **Spring Boot Core + TypeScript OpenCode Adapter + OTel/OTLP + 独立 Harness 数据模型；Phoenix 先做本地原型，Langfuse 作为产品化候选；Spring AI 和 Python/LangGraph 作为可插拔实验与受限 Agent 能力。**

## 5. Harness 学习闭环

### 5.1 闭环结构

```text
真实 Factory Run
→ 领域事件 + 执行证据 + Agent 轨迹 + 遥测
→ 脱敏、归一化、质量标注
→ 失败簇 / 高价值案例 / 人工纠正
→ 版本化 Dataset
→ Prompt / Model / Policy / Tool Schema 实验
→ 确定性检查 + 人工/LLM 评估
→ 候选策略 Shadow / Canary
→ 风险分层 Gate 自动化
→ 新运行继续产生证据
```

LangSmith 官方描述了从生产 Trace 生成数据集、离线实验、在线评估再把失败样本回灌数据集的闭环。[LangSmith Evaluation](https://docs.langchain.com/langsmith/evaluation) Langfuse 也支持在线 Trace、数据集、Prompt/模型/代码实验、人工或自动评分以及 CI/CD 回归拦截。[Langfuse Evaluation](https://langfuse.com/docs/evaluation/overview) Phoenix 支持 OTLP Trace、人工标注、数据集、实验、Prompt 版本和 Span Replay。[Phoenix 概览](https://arize.com/docs/phoenix)

这些产品可加速闭环，但 Factory 必须拥有自己的最小 Harness 合同，避免后端迁移时丢失语义。

### 5.2 经验与轨迹数据模型

建议新增逻辑对象 `FactoryTrajectory`，以 append-only Event Envelope 保存，关系库只保存索引和关键事实，大对象进入受控 Object Store：

| 分类 | 必须记录的字段 |
|---|---|
| Identity | project_id、cu_id、slice_id、run_id、attempt_id、trace_id、host_session_id |
| Authority Binding | Requirement/Design/Code/Test Baseline ID 与 Hash、ExecutionPlan 版本、Git base revision |
| Variant Binding | agent、prompt、policy、model、provider、tool schema、context assembler、host adapter、runner、environment 的版本与 Hash |
| User Evidence | 原始输入、澄清问题、用户答案、后续纠正；分级加密并记录同意与保留策略 |
| Context | ContextManifest、来源 URI/版本/Hash、选取原因、缺失与截断，不盲目复制所有正文 |
| Agent Events | 公开消息、公开 reasoning summary、工具请求/结果、权限请求、重试、压缩、取消、结构化 Handoff |
| Code Evidence | 起始 revision、Patch/Diff、修改文件、快照引用、最终 revision |
| Runner Evidence | 命令模板版本、实际参数、环境、退出码、stdout/stderr 引用、测试报告、时长、清理结果 |
| Review | Gate 输入、Reviewer、决定、理由、修改意见、Override、时间、关联 Evidence |
| Outcome | 成功/失败/挂起、失败分类、返工次数、通过的验收、成本、Token、延迟 |
| Governance | sensitivity、redaction_version、retention_class、tenant、export_policy、lineage |

关键约束：

- `FactoryTrajectory` 不是 Baseline，也不能反向修改业务事实；
- Trace ID 与领域 ID 双向关联，但 OTel 后端不是唯一存储；
- Prompt、策略和工具定义必须按内容 Hash 固定，不能只存“latest”；
- 公开推理摘要只能作为弱诊断信号，不能作为 Gate 的唯一证据；
- 人工反馈应记录“看到了什么证据后做出什么裁决”，不能只保存 `approved=true`。

### 5.3 三种回放

1. **协议回放：** 用已保存的 OpenCode/Codex 事件验证 Adapter 归一化、脱敏、幂等和错误处理，不重新调用模型。
2. **确定性回放：** 在固定 revision 和环境镜像上重跑 Runner，验证证据是否可复现。任何外部依赖都必须固定或声明不可复现。
3. **反事实 Agent 回放：** 在隔离副本中用同一输入和上下文，对不同 Prompt/模型/策略重新执行。它是新实验，不是假装重现原随机轨迹；副作用工具使用 Stub、Sandbox 或只读模式。

LangGraph 的 checkpoint/time travel 可用于特定 Python Agent 的内部回放，[LangGraph Persistence](https://docs.langchain.com/oss/python/langgraph/persistence)；Phoenix Span Replay 可用于模型调用级调试，[Phoenix 概览](https://arize.com/docs/phoenix)；两者都不能替代 Factory 的 revision、环境和 Runner 证据回放。

### 5.4 实验单位与评估

每个 `ExperimentVariant` 至少固定：

```text
dataset_version
+ baseline/context snapshot
+ agent/prompt/policy version
+ model/provider/parameters
+ tool schema and permission policy
+ host adapter/runner/environment version
= reproducible experiment manifest
```

评估顺序应是：

1. Schema、权限、允许文件、命令退出码等确定性断言；
2. Compile/build/lint/test 和安全扫描；
3. 与 RequirementItem/TestObligation 的覆盖映射；
4. 人工盲评或成对比较；
5. LLM-as-a-judge 作为补充，并保存 evaluator Prompt、模型和解释；
6. 成本、延迟、Token、重试和返工等效率指标。

不要只优化“最终测试通过率”。还需防止删测试、放宽断言、绕过 Gate、过度修改和把风险转移给人工等 reward hacking。任何自动评分都应保留反作弊规则和独立 Runner 证据。

## 6. 人工 Gate 的逐级自动化

人工审批不能按“模型更强了”直接取消，应按风险类别和历史证据逐 Gate 演进：

| 等级 | 行为 | 进入条件 |
|---|---|---|
| G0 人工决定 | 系统仅整理证据 | 初始状态或高风险变更 |
| G1 建议模式 | 自动给出通过/拒绝建议，人必须裁决 | 评估集已建立，建议可解释且无自动副作用 |
| G2 Shadow | 系统生成自动裁决但不生效，与人工结果持续比对 | 分层样本量足够，严重漏检为零或满足预设上限 |
| G3 低风险自动通过 | 满足策略的低风险案例自动通过，异常转人工 | 确定性 Gate 全过、覆盖充分、变更范围受限、回滚/停止有效、持续漂移监控 |
| G4 常态零审批 | 已覆盖的工厂流程全部由策略自动裁决；高风险、低置信、策略冲突、漂移或分布外案例停止运行并进入异常处置，不把人工审批保留为正常流水线步骤 | 多版本长期稳定，独立审计通过，事故与 Override 率低于策略阈值，异常停止和恢复机制验证有效 |

每次升级必须固定：风险分类、最低证据、评估窗口、置信区间/误差上限、关键失败零容忍项、回退开关、Shadow 周期和责任人。阈值不应现在写死；应在真实轨迹形成后由 PolicyBaseline 冻结。

G4 的产品目标是取消常态人工审批，而不是让系统在证据不足时冒险放行。需求/设计基线的重大业务变化、凭据与生产权限扩大、不可逆数据迁移、安全边界变化、合规例外以及自动评估覆盖之外的新型变更，应被策略判定为“当前 Harness 不具备自治授权”，安全停止并形成结构化异常包。人员处理的是扩大授权边界、补充规则或修复系统，而不是充当每次运行都必须经过的 Gate。随着这些异常类型被纳入数据集、评估和策略覆盖面，人工介入范围继续收缩，最终使目标场景达到端到端无人审批。

## 7. 遥测技术方案

### 7.1 采用 OpenTelemetry 作为传输与关联基础

OpenTelemetry Semantic Conventions 提供统一 Span、Metric 和 Event 命名；GenAI 约定涵盖模型调用、Agent、工具、Token、成本相关字段与评估事件，但当前仍有 development 状态内容，必须固定语义约定版本并通过 Collector 做兼容转换。[OTel Semantic Conventions](https://opentelemetry.io/docs/specs/semconv/)、[OTel GenAI Spans 官方源码](https://github.com/open-telemetry/semantic-conventions/blob/main/model/gen-ai/spans.yaml)、[OTel GenAI Metrics](https://github.com/open-telemetry/semantic-conventions/blob/main/docs/gen-ai/gen-ai-metrics.md)

建议：

- Java Core、Node Adapter、Python Lab 统一传播 W3C Trace Context；
- 标准属性使用 `gen_ai.*`，领域属性使用受控的 `factory.*`；
- 每个 Run 根 Span 下挂 context assembly、agent invocation、model call、tool、runner、handoff、gate 和 evaluator Span；
- Prompt、输出、工具参数和结果默认不导出，只在经过 sensitivity policy、脱敏和采样后写入受控后端；
- 审计事件同步写 Factory Outbox，OTLP 异步导出；
- 固定 `semconv_version` 和自定义 schema version，禁止无迁移直接跟随最新字段。

### 7.2 OTel GenAI 与 OpenInference

OpenInference 是构建在 OpenTelemetry 之上的 AI 语义约定，定义 LLM、Agent、Tool、Retriever、Evaluator 和 Prompt 等 Span 类型，并包含内容屏蔽配置。[OpenInference Specification](https://arize-ai.github.io/openinference/spec/)

两者不需要在业务代码里重复埋点。建议：

- Factory Canonical Event → OTel `gen_ai.* + factory.*`；
- 若选 Phoenix 或某个 Instrumentor 只原生理解 OpenInference，在 Collector/Exporter 层映射；
- 对自动 Instrumentation 产生的 OpenInference Span 关联同一 Trace，并去重，不再手工创建同义 Span。

### 7.3 后端选择

| 后端 | 优点 | 注意点 | 当前建议 |
|---|---|---|---|
| Phoenix | 开源、自托管、OTLP/OpenInference、Python/TS/Java、Trace/人工标注/数据集/实验/Prompt/Span Replay 一体 | 产品化权限、多租户和长期运维需验证 | **M0/M1 首选原型** |
| Langfuse | 开源可自托管，Trace、成本、Prompt、Dataset、Experiment、在线/离线 Eval 和 CI 能力完整 | 生产自托管需要 Postgres、ClickHouse、Redis/Valkey、对象存储 | **产品化候选** |
| LangSmith | 与 LangGraph/LangChain 深度集成，数据集版本、线上/离线评估和实验成熟，也能脱离 Agent 部署使用 | 自托管是 Enterprise add-on，完整部署组件较重 | 仅在 LangGraph 成为重要实现或接受服务条件时选 |
| 通用 APM | 已有运维体系、基础设施指标和跨服务 Trace | 缺少 Agent 数据集、Prompt、Eval 和人工标注工作流 | 与上述 AI 后端并存，不单独承担 Harness |

Phoenix 的官方文档明确其接收 OTLP，并支持 Trace、人工标签、数据集、实验和 Prompt 版本。[Phoenix 概览](https://arize.com/docs/phoenix) Langfuse 的官方文档支持 Trace、数据集、在线/离线评估和实验，并可自托管；其生产架构包含 Postgres、ClickHouse、Redis/Valkey 和对象存储。[Langfuse Observability](https://langfuse.com/docs/observability/overview)、[Langfuse Self-hosting](https://langfuse.com/self-hosting) LangSmith 的自托管观测与评估是 Enterprise add-on，官方架构同样需要 ClickHouse、Postgres、Redis 和可选 Blob Storage。[LangSmith Self-hosted](https://docs.langchain.com/langsmith/self-hosted)

不要同时部署 Phoenix、Langfuse 和 LangSmith。先用同一份 OTLP 和 Factory Dataset Export 做短期 bake-off，再选一个后端。

## 8. 能否分析模型思维链

### 8.1 不能依赖原始私有思维链

产品设计不能假定能取得模型的原始 Chain-of-thought（CoT）：

- OpenAI API 官方文档明确说明 raw reasoning token 不会暴露，支持的模型可在显式请求后返回 reasoning summary；[OpenAI Reasoning Models](https://developers.openai.com/api/docs/guides/reasoning)
- OpenAI 对 reasoning model 的公开说明同样表示不向用户展示原始 CoT，而提供模型生成的摘要；[OpenAI：Learning to reason with LLMs](https://openai.com/index/learning-to-reason-with-llms/)
- OpenAI 研究还表明，对 CoT 施加强优化压力可能使模型隐藏意图，因此即使能看见也不能当作稳定、忠实的审计证据；[OpenAI：Detecting misbehavior in frontier reasoning models](https://openai.com/index/chain-of-thought-monitoring/)
- Gemini 官方区分 raw thoughts 与 thought summaries，并把 thought signature 定义为加密的内部推理状态表示；[Gemini Thinking](https://ai.google.dev/gemini-api/docs/thinking)、[Gemini Thought Signatures](https://ai.google.dev/gemini-api/docs/generate-content/thought-signatures)
- OTel 新约定能记录 reasoning token 数量或供应商公开的 reasoning content，但协议有字段不等于供应商会提供完整私有 CoT。[OTel GenAI 官方约定](https://github.com/open-telemetry/semantic-conventions/blob/main/model/gen-ai/spans.yaml)

因此答案是：**可以分析供应商公开返回的推理摘要和外显轨迹，不能把原始私有思维链当成必得、忠实或可比较的数据。**

### 8.2 应采集的可审计替代信号

优先级从强到弱：

1. 用户原始要求、澄清问题和用户答案；
2. 实际装配上下文的来源、版本、Hash、缺失和截断；
3. 模型实际输出、结构化计划、Handoff、自评和显式不确定性；
4. 工具名、参数、结果、错误、权限请求、耗时和顺序；
5. 文件 Diff、Git revision、命令、退出码、测试报告和环境；
6. 重试、策略分支、返工原因及前后结果差异；
7. Gate 展示的证据、人工决定、理由和 Override；
8. Provider 提供的 reasoning token 和公开 reasoning summary；
9. 独立 evaluator 的结构化评分与解释。

可以要求 Agent 在关键决策点调用 `factory_record_decision`，提交 `decision`、`evidence_refs`、`alternatives`、`uncertainty` 和 `expected_check`。这是受约束的可审计说明，不是要求泄露私有 CoT，也不能取代行为证据。

## 9. MCP 是否需要

### 9.1 MCP 的正确职责

MCP 是 Host 与 Server 之间的标准协议。官方架构包含生命周期和能力协商，Server 可提供 Resources、Prompts 和 Tools；规范把 Resources 定位为应用控制的上下文，把 Tools 定位为模型可发现和调用的动作。[MCP Architecture](https://modelcontextprotocol.io/docs/learn/architecture)、[MCP Server Primitives](https://modelcontextprotocol.io/specification/2025-06-18/server/index)

对本项目，MCP 适合：

- 向多个 Agent Host 暴露同一组只读 Baseline、ContextManifest 和 Evidence Resource；
- 暴露 `request_context`、`submit_handoff`、`report_blocked`、`record_decision` 等狭窄工具；
- 连接 GitHub、Issue Tracker、知识库等外部工具生态；
- 利用协议版本、能力协商和 Tool Schema 降低 Host 专属耦合。

OpenCode 原生支持本地与远程 MCP Server，[OpenCode MCP](https://opencode.ai/docs/mcp-servers/)；Spring AI 也提供 MCP Java Client/Server、Stdio 和 Streamable HTTP 等实现。[Spring AI MCP](https://docs.spring.io/spring-ai/reference/api/mcp/mcp-overview.html)

### 9.2 MCP 不应承担的职责

- 不作为 Factory 内部模块间的总线；同进程 Application Interface 直接调用更清晰。
- 不保存 Baseline、ExecutionPlan、Run 或 Gate 状态。
- 不编排 CU 生命周期，也不负责单活动 Run 的互斥。
- 不向模型暴露 `approve_gate`、`change_baseline`、`force_transition` 等越权工具。
- 不把工具调用成功等价为业务提交成功；所有写工具必须带 Run/attempt、幂等键、授权上下文并经过 Application Service。
- 不用 MCP Prompt 取代 Factory 版本化 Prompt/Policy Registry；MCP Prompt 更适合用户选择的交互模板。

### 9.3 当前引入时机

推荐分两步：

1. **M0：先冻结协议无关的 Factory Tool Contract。** OpenCode Adapter 可用原生 Custom Tool/Plugin 或直接 HTTP 调用，快速验证 `submit_handoff`、`request_context`、`report_blocked` 和事件归一化。
2. **M1：当第二个 Host 接入，或确认需要通用工具生态时，增加 Factory MCP Server Adapter。** MCP 与 REST/内部调用共享同一 Application Service、JSON Schema、权限和 TCK。

如果一开始就明确 v1.1 验收必须同时支持 OpenCode 与 Codex/Claude Code，则 MCP 应提前到 M0；否则不应为了“协议先进”延误首个纵向闭环。

## 10. 建议的最小验证路线

### M0：合同与轨迹骨架

- 冻结 `AgentInvocation`、`FactoryTrajectoryEvent`、`Handoff`、`RunnerEvidence`、`GateDecision` 和 `ExperimentManifest` Schema；
- Spring Boot 生成 Run 根 Trace 和 `factory.*` 属性；
- Node OpenCode Adapter 连接 Server、订阅 SSE，把 Tool/Step/Patch/Retry/Permission 事件归一化；
- 内容默认不出本机，建立 secret/PII 脱敏与 retention policy；
- Fake Host 和固定 JSONL 完成协议回放。

### M1：一个 CU 的真实闭环

- 在唯一工作目录串行完成一个 CU 编码、Runner 验证、Handoff 和人工 Gate；
- 同步保留 Factory 审计事实，异步发 OTLP；
- Phoenix 本地验证 Trace、工具层级、Token/成本、人工标签和 Dataset；
- 对同一输入执行两个 Prompt 或模型 Variant，形成第一份 Experiment Report。

### M2：学习闭环和 Gate Shadow

- 从人工拒绝、返工和高成本轨迹自动候选采样，人工确认后进入版本化 Dataset；
- 加入确定性 evaluator、人工成对评审和 LLM evaluator；
- 运行 Gate Shadow，只比较自动建议与人工裁决，不改变状态；
- 根据真实数据决定 Phoenix、Langfuse 或 LangSmith，决定是否引入 MCP Server。

### 暂不做

- 不用 LangGraph/Temporal 替换 Factory 生命周期；
- 不把 LangFlow Flow 当生产架构定义；
- 不部署多个 AI Observability 后端；
- 不采集或承诺分析原始私有 CoT；
- 不在没有 Dataset、风险分层和 Shadow 证据前取消人工 Gate。

## 11. 最终技术决策建议

可冻结以下方向，但不要冻结所有实现细节：

1. **业务内核：** Spring Boot + 关系数据库 + Outbox/Reconciler。
2. **首个代码宿主：** Node.js/TypeScript `OpenCodeHostAdapter` + `@opencode-ai/sdk`。
3. **确定性验证：** 自研 Project Runner，证据进入 Factory 审计模型。
4. **Agent 扩展：** Spring AI 用于 Java 内受限模型任务；LangGraph/LangChain 可用于 Python Evaluation Lab 或特定 Stage Agent，均在 Adapter 后。
5. **遥测：** OTel/OTLP 为基础，固定 GenAI SemConv 版本，增加 `factory.*`；OpenInference 在 Exporter/后端边界映射。
6. **观测与评估：** Phoenix 做最小原型，Langfuse 做产品化候选，LangSmith 仅在 LangGraph 生态或商业条件匹配时采用。
7. **MCP：** 冻结协议无关 Tool Contract；第二 Host/外部生态出现时启用 MCP Adapter，MCP 永不成为 Core 状态机。
8. **耐久工作流：** 保留 seam；达到长等待、分布式 Worker 和复杂恢复触发条件后再评估 Temporal。
9. **Harness：** Factory 自有 Trajectory/Dataset/Experiment/Gate Policy 合同，任何第三方观测平台都只是可替换后端。
10. **思维链：** 不依赖原始私有 CoT；只分析公开摘要和可验证的外显决策、工具、代码、Runner、Gate 与人工反馈证据。

这个组合既没有把 Python/LangGraph/LangFlow 永久排除，也没有让它们侵入当前最重要的业务真相边界；同时为后续基于真实轨迹优化 Harness、逐级取消人工审批留下了可验证路径。
