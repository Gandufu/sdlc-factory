# Agent 运行时选型与 Pi SDK 研究记录

> 决策状态：**历史研究，Pi 首版选型结论已被替代**
>
> 2026-08-07 后续明确决定：MVP0 使用纯 OpenCode 项目级 Plugin 验证需求、设计和文档闭环；MVP1 使用 OpenCode SDK 集成 Electron、会话管理、遥测和项目工厂。Pi 因仍需 Factory 自行解决沙箱及文件、进程、网络和凭据权限，暂不集成。当前方案见[根 README](../../README.md)。
>
> 研究日期：2026-08-07
>
> 研究范围：Open Design、Multica、Pi 官方仓库、官方文档、许可证及公开 Issue
>
> 用途：保留当时对 Pi、Open Design 和 Multica 的技术研究事实，不再作为当前运行时实现依据

## 1. 原研究结论（已替代）

当时的研究结论是：SDLC Factory 首版采用 **Pi SDK 进程内集成**，不采用 Open Design 式多 CLI 运行层，也不采用 Multica 作为底层运行时。该结论现已被文首所述后续决策替代。

组合关系固定为：

```text
Open Design：只参考桌面对话和项目工作区交互
Pi SDK：负责模型调用、Agent Loop、流式事件和上下文管理
Factory Core：负责项目、权限、工具、/sdlc-*、审核、基线和产品持久化
```

这项决策的核心原因不是“Pi 能让模型本身变快”，而是它允许 Factory 在 TypeScript Core 内直接维护 `AgentSession`，从架构上移除多 CLI 探测、每轮进程启动、不同 JSON 协议解析和 CLI 会话标识适配。模型首令牌、生成和工具执行仍可能占据主要耗时，最终性能必须以同模型、同提示词、同项目的实测为准。

## 2. Open Design：保留交互参考，放弃运行时架构

### 2.1 大型聊天组件不等于运行时全部写在界面里

Open Design 的产品链路由 Electron/Web、daemon、SQLite、项目文件和外部 Agent CLI 共同组成。CLI 参数、事件解析和会话恢复主要位于 daemon；大型聊天组件还同时承担流式状态、工具过程、附件、产物、问题表单、错误、重试和文件刷新等产品状态。

因此，Factory 没有必要复制其大型聊天文件。应只复用交互规则和流式状态机思想，并按项目导航、消息时间线、输入区、审核卡、右侧项目面板拆成独立组件。架构事实见 [Open Design 官方架构](https://github.com/nexu-io/open-design/blob/main/docs/architecture.md)及仓库内的[官方源码审计](open-design-official-source-audit-2026-08-06.md)。

### 2.2 “慢”由多段成本组成

Open Design 官方正在分别观测排队、进程准备、进程启动、首令牌、生成、工具和收尾耗时，而不是把延迟统一归因于 CLI。[Issue #3547](https://github.com/nexu-io/open-design/issues/3547)

已经确认的延迟来源包括：

- 旧版本多轮对话每轮建立新会话并重发完整历史，降低缓存复用；
- 稳定提示词、Skills、Memory、附件和历史消息放大有效输入；
- 长会话全量消息加载和 Renderer 渲染；
- 大项目文件树重复扫描；
- Windows CLI 冷启动、认证和模型首次响应。

Open Design 已合并 Codex、OpenCode、Pi 等运行时的原生会话恢复；合并说明给出的 Codex 实测为恢复路径复用 96% 前缀，而扁平重发为 39%。这说明会话恢复可以显著改善后续轮次，但仍然保留 CLI 进程和跨协议适配复杂度。[PR #4629](https://github.com/nexu-io/open-design/pull/4629)

长会话和大项目的应用层性能问题仍在跟踪，例如完整消息与项目数据加载的 [Issue #6296](https://github.com/nexu-io/open-design/issues/6296)，以及重复项目文件扫描的 [Issue #6179](https://github.com/nexu-io/open-design/issues/6179)。

### 2.3 对 Factory 的影响

Factory 不复制以下 Open Design 运行代码：

- CLI 注册、探测和模型列表读取；
- Codex、OpenCode、Claude Code 等参数构造；
- CLI stdout/JSON 解析；
- 外部进程式原生会话恢复；
- daemon 的多运行时调度。

Factory 仍参考：

- 左侧项目导航、中间多轮对话和可收起右栏；
- 流式消息、工具过程、文件变更和错误的时间线表达；
- 模型、推理强度、附件和停止操作；
- 会话内事件卡与右侧聚合视图的配合。

## 3. Multica：不采用

### 3.1 它是任务调度层，不是模型运行时

Multica 官方说明的执行路径是：服务端记录和协调工作，本地 daemon 领取任务、调用本机 AI 编码 CLI，再把进度和结果写回 Issue。[How Multica works](https://multica.ai/docs/how-multica-works)

这意味着 Multica 仍然依赖 Codex、Claude Code、Pi 等下游工具，并额外引入：

- 服务端和本地 daemon；
- Issue、任务队列、领取和心跳；
- 独立任务工作区；
- 重试、超时、执行日志和团队协作状态。

它适合团队任务分派和多智能体协作，不适合 Factory 当前的单机持续多轮对话。它不会消除底层模型或 CLI 延迟。Multica 目前也存在简单直接对话等待八分钟以上的开放报告：[Issue #1978](https://github.com/multica-ai/multica/issues/1978)。

### 3.2 许可证不适合直接嵌入产品

Multica 使用带附加条件的 `Multica License`。未经商业许可，不得把其源码作为组件嵌入对外销售、许可或商业分发的产品，也不得向第三方提供托管服务；其 UI 还存在品牌保留要求，非 UI 使用也需要声明产品基于 Multica。[官方 LICENSE](https://github.com/multica-ai/multica/blob/main/LICENSE)

因此，Multica 既不进入 Factory 核心架构，也不作为复制代码来源。未来如果产生远程团队任务协作需求，只能作为独立外部集成重新评估。

## 4. Pi SDK：采用依据

### 4.1 当前官方项目

原 `badlogic/pi-mono` 已重定向到 [earendil-works/pi](https://github.com/earendil-works/pi)。当前包使用 `@earendil-works/*` 命名，仓库采用 MIT License。[官方 LICENSE](https://github.com/earendil-works/pi/blob/main/LICENSE)

Pi 不是单一 CLI 包装器，它把模型 Provider、Agent Loop 和可嵌入编码 Agent 分成独立 TypeScript 包。Factory 直接使用 `@earendil-works/pi-coding-agent` SDK，不启动 `pi` CLI。

### 4.2 进程内 AgentSession

官方 SDK 提供 `createAgentSession()`。`AgentSession` 管理消息历史、模型状态、上下文压缩和事件流，并提供 `prompt`、`steer`、`followUp`、事件订阅、停止和会话切换等能力。[Pi SDK 文档](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/sdk.md)

Factory 可将一个活跃产品对话绑定到一个内存中的 `AgentSession`：

```text
Factory Core
  → PiRuntimeHost
  → AgentSession
  → pi-agent-core / pi-ai
  → 模型服务
```

相比每轮启动 CLI，这条路径可以移除：

- CLI 可执行文件探测；
- 每轮子进程创建和 stdout 管道；
- 不同 CLI JSON 协议解析；
- 多套原生会话 ID 捕获与恢复逻辑；
- 运行时之间的功能最小公分母。

这是结构性减负，不是模型推理加速承诺。

### 4.3 自定义工具与事件

SDK 支持自定义工具和事件订阅，并允许禁用或筛选内置工具。Factory 可以只向 Pi 注册经过自身权限控制的文件、搜索、编辑、PowerShell、测试、`sdlc_status` 和 `request_user_input` 工具。[SDK Tools](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/sdk.md#tools)

Pi 会产生文本、思考、工具开始、工具更新、工具结束和 turn 生命周期事件。Factory 应在 `PiRuntimeHost` 内转换为自己的纯增量事件，不让 Pi 类型进入 Renderer、审核和基线接口。

### 4.4 会话与上下文压缩

Pi Session 使用树形条目保存历史并支持继续、分叉和切换；SDK 提供内存与持久化 SessionManager。[SDK Session Management](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/sdk.md#session-management)

Pi 还提供自动上下文压缩：接近上下文窗口时总结较早历史并保留最近内容，原始会话条目仍可保存。[Compaction 文档](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/compaction.md)

Factory 必须保持边界：Pi 压缩摘要只用于模型上下文，不能覆盖完整产品消息，也不能成为审核证据或基线正文。

## 5. Pi 的已知风险与规避

### 5.1 JSON 模式累计序列化

[Pi Issue #7395](https://github.com/earendil-works/pi/issues/7395) 仍处于开放状态。报告指出 CLI JSON 模式在每个增量中序列化累计 assistant 状态，可能形成近似二次方输出并导致长时间 stdout 排空。

Factory 的规避方式是：

- 不启动 `pi --mode json`；
- 直接订阅进程内 SDK 事件；
- 只把新增 delta 转发给 Renderer；
- 实施事件背压和批量 UI 刷新；
- 用测试断言传输数据量随真实输出线性增长。

不能把开放 Issue 或未合并 PR 写成已经修复。

### 5.2 模型连接和超时

[Pi Issue #4945](https://github.com/earendil-works/pi/issues/4945) 报告 OpenAI Codex WebSocket 在首事件前可能长期等待。Factory 必须自己实现：

- 首事件超时；
- 流空闲超时；
- 总运行上限；
- 用户取消；
- 一次有界重试；
- 已执行副作用工具后的禁止自动重放。

### 5.3 Windows 工具兼容性

Pi CLI 的默认 Bash 工具在 Windows 上涉及 Git Bash、WSL 和 PowerShell 差异，官方使用 [Windows 汇总 Issue #7547](https://github.com/earendil-works/pi/issues/7547) 跟踪问题。

Factory 不继承 Pi CLI 的 Bash 约定。首版由 Core 提供原生 PowerShell `shell` 工具，并自行处理命令编码、工作目录、输出流和进程树终止。

### 5.4 权限与隔离

Pi 本身不是安全沙箱。官方容器化文档把强隔离交给 Gondolin、Docker 或 OpenShell 等外部环境。[Containerization 文档](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/containerization.md)

Factory 因此必须：

- 禁用 Pi 默认的宽权限工具组合；
- 只注册 Factory 自定义工具；
- 在执行前实施允许／询问／拒绝；
- 把文件路径限制在当前授权工作区；
- 对危险 Shell 和工作区外访问请求用户确认；
- 不把模型凭据写入 SQLite、项目文件和日志。

### 5.5 接口变化

Pi 仍处于快速迭代期。Factory 必须锁定经过验证的精确版本和 lockfile，并通过单一 `PiRuntimeHost` 隔离 SDK 变化。升级必须重跑会话、事件、工具、取消、恢复和权限兼容性测试。

## 6. Factory 与 Pi 的职责边界

| 能力 | Factory Core | Pi SDK |
|---|---|---|
| 项目与工作目录 | 权威 | 只接收当前 CWD |
| 产品对话与完整消息 | 权威持久化 | 维护模型上下文副本 |
| 模型调用与 Agent Loop | 配置、监控 | 执行 |
| 上下文压缩 | 保存完整历史、限定输入 | 生成运行时摘要 |
| 文件与 Shell 工具 | 定义、授权、审计、执行 | 发起工具调用 |
| `/sdlc-*` 命令 | 定义项目事实与工具 | 承载 Skill 工作 |
| 阶段提示 | Core 返回事实，AI给出建议 | 不拥有阶段状态 |
| 审核决定 | 用户和 Core 权威 | 无权决定 |
| 基线 | Core 原子写入 | 无权生成 |
| 凭据 | 操作系统安全存储 | 运行时使用，不持久化明文 |

## 7. 性能纵切要求

在完整功能开发前，用同一台 Windows 机器、同一模型、同一项目和同一提示词，对 Pi SDK 与直接 CLI 做首轮和后续轮次对照。每组应多次运行，并分别记录中位数和高分位数。

需要记录：

- Core 排队时间；
- 上下文准备时间与估算 Token；
- 模型首事件时间；
- 模型生成时间；
- 工具执行时间；
- SQLite 持久化时间；
- Renderer 消费与渲染时间；
- 总耗时、取消耗时、进程数和内存；
- 会话恢复是否成功、失败原因及是否重建；
- 增量事件总字节数是否随输出线性增长。

纵切至少证明：

1. Pi SDK 后续轮次不会新建 CLI 进程；
2. 同一 `AgentSession` 可以连续多轮、停止并恢复；
3. JSON 累计序列化问题不会进入 Factory 事件协议；
4. PowerShell 工具能够终止完整 Windows 进程树；
5. 文件越界、危险命令和凭据访问会询问或拒绝；
6. Pi 会话或模型失败不会污染审核和基线；
7. 性能数据能够区分框架开销与模型本身耗时。

如果纵切失败，应修正 Pi 集成边界或暂停实现，不回退为首版多 CLI 产品设计。

## 8. 原最终选型（已替代）

- **采用：** Pi SDK 进程内 `AgentSession`，由 `PiRuntimeHost` 隔离。
- **不采用：** Multica 核心或源码嵌入。
- **不采用：** Open Design 多 CLI daemon 和运行时适配层。
- **保留参考：** Open Design 桌面对话交互；Claude Code Game Studios 的显式命令和非强制阶段提醒。
- **延期：** Codex、OpenCode、Claude Code CLI 兼容运行时；只有未来出现明确用户需求和测量收益时才重新立项。

## 9. 后续正式方向

- **MVP0：** 纯 OpenCode 项目级 Plugin，在 OpenCode TUI/CLI 中验证需求分析、总体设计、柔性流程引导、候选、人工审核和 Baseline；
- **MVP1：** Electron + TypeScript Harness，通过 OpenCode SDK 管理项目、Conversation、原生 Session、事件和本地遥测；
- **Pi：** 暂不集成。只有具备经验证的沙箱、权限、审计和 Windows 生命周期方案后，才作为实验性 Runtime Adapter 重新评估；
- **本文其余章节：** 只保留研究过程和技术事实，不得用其中“采用 Pi”的表述覆盖根 README。
