# Open Design 官方源码审计与 Factory 迁移启示

> 日期：2026-08-06
>
> 审计对象：`nexu-io/open-design` 官方仓库
>
> 当前 `main` 固定提交：[`370479e4a7f8b5391e905e4bba4f8fcab5cbe380`](https://github.com/nexu-io/open-design/commit/370479e4a7f8b5391e905e4bba4f8fcab5cbe380)
>
> 原调研固定提交：[`9ce7b3aeec5eb77300f7661562afda3e5935bd60`](https://github.com/nexu-io/open-design/commit/9ce7b3aeec5eb77300f7661562afda3e5935bd60)
> 被核验材料：`C:\Users\gandaofu\Desktop\opendesign.md`

## 1. 结论摘要

`opendesign.md` 对 Open Design 的总体定位基本正确：它不是另造一个 Agent，而是由本地 daemon 统一管理 Project、Conversation、资源包和 CLI Adapter，再调用用户已有的 Agent CLI。对 Factory 最有价值的是 Runtime Registry、适配器隔离、native session 捕获/恢复、Session 失效后冷重播、`SKILL.md` 兼容格式、安全解包以及 Plugin 的 apply-time 记录思路。

但源码审计发现六项需要在方案重构前纠正的关键事实：

1. **stable prompt 变化不会使 native session 失效。** 当前恢复失效原因只有 Model、CWD、Conversation cursor 和缺失 cursor；stable prompt 变化时仍恢复同一个 native session，只是重新发送稳定指令块。
2. **`AppliedPluginSnapshot` 不是完整的内容快照。** Digest 只覆盖 manifest、inputs 和已解析引用标识；Plugin-local `SKILL.md` 在运行时从当前安装目录读取，资源正文也没有全部固化。因此“Plugin 升级后历史 Prompt/资源仍可完整重建”在当前实现中不成立。
3. **Atom Pipeline 不是执行权威。** 它与 Agent run 并行，错误被吞掉，大多数 Atom 没有独立观测器，缺失信号会得到 permissive success 默认值；它适合提示、时间线和 UX，不适合 Gate、Evidence 或生命周期推进。
4. **Memory 是 daemon 级 Markdown 注入层，不是受治理事实库。** 默认注入开启、自动提取关闭；存储是 last-writer-wins。虽然仓库存在 deterministic verify 函数和结果列表 API，但全仓静态检索未找到生产运行链路对 `enforceVerify` / `recordVerify` 的调用，因此当前没有证据证明它真正阻断或标记一次失败运行。
5. **Plugin capability 与 Agent 运行权限不是同一安全边界。** OpenCode、Claude 和 ACP 路径存在 permission bypass/auto-approve；Windows 上 Codex 适配器使用 `danger-full-access`。`OD_SANDBOX_MODE` 主要隔离 HOME/配置/临时目录与导入根，不是 OS 级执行沙箱。
6. **安装安全不等于供应链可信。** Plugin 安装器有 50 MiB、SSRF、路径穿越、链接和 SHA-256 检查，但预期 hash 是可选项；没有预期值时只是计算并记录下载摘要，不构成来源认证。Skill 远程安装器甚至不计算内容 hash，只提供安全解包与原子安装。官方规范也明确 v1 不建设签名/PKI。

因此，Open Design 最适合作为 **Host/Adapter、资源包和交互工作台的参考实现**，不应被当成 Factory 的生命周期、证据、基线和权限权威。

## 2. 审计方法、版本漂移与边界

### 2.1 方法

- 通过官方 Git 仓库读取 `main` HEAD，记录固定 SHA 和提交时间。
- 对 `9ce7b3a..370479e4` 做提交、文件和目标模块差异检查。
- 直接阅读数据库 DDL、HTTP routes、Runtime Registry/Adapter、session resume、Skill、Plugin、Atom、Memory、权限、安装器、License 等实现。
- 所有官方源码链接固定到 `370479e4a7f8b5391e905e4bba4f8fcab5cbe380`，避免 `main` 漂移。
- “未接线”结论来自对当前提交全仓 TypeScript 的静态检索，不等价于动态运行时测试。

### 2.2 `9ce7b3a` 与当前 `main` 的实际差异

两个提交只相隔约 20 分钟：

| 提交 | 时间（Asia/Shanghai） | 说明 |
|---|---:|---|
| `9ce7b3a` | 2026-08-06 18:45:56 | 原调研使用的提交 |
| `370479e4` | 2026-08-06 19:06:21 | 本审计锁定的 `main` |

期间共 8 个提交，Git diff 为 100 个文件、3978 行新增、3490 行删除。主要架构性变化是 `design-systems` structured runtime/schema 被回滚；而本审计涉及的以下路径均未变化：

- `apps/daemon/src/db.ts`
- `apps/daemon/src/routes/project/conversations.ts`
- `apps/daemon/src/agent-session-resume.ts`
- `apps/daemon/src/server.ts`
- `apps/daemon/src/runtimes/`
- `apps/daemon/src/skills.ts`
- `apps/daemon/src/plugins/`
- `apps/daemon/src/memory.ts`
- `apps/daemon/src/memory-verify.ts`
- `packages/plugin-runtime/`

这意味着本报告对 stable prompt、Plugin snapshot、Atom 和 Memory 的纠正不是短时版本漂移造成，而是对原材料中源码语义的再校准。另一方面，Design System runtime 正在快速变化，不应从这两个提交推断其稳定合同。

### 2.3 版本与安装包口径

官方仓库在审计时存在 `open-design-v0.18.0` tag；官方 Changelog 提供 0.18.0 的 macOS/Windows 安装包链接，[固定证据](https://github.com/nexu-io/open-design/blob/370479e4a7f8b5391e905e4bba4f8fcab5cbe380/docs/CHANGELOG/v0.18.0/zh-CN.md#L32-L38)。该 tag 位于 release 分支而不是当前 `main` 的祖先；当前 `main` 根 `package.json` 仍写 `0.16.2` 且 `private: true`，[固定证据](https://github.com/nexu-io/open-design/blob/370479e4a7f8b5391e905e4bba4f8fcab5cbe380/package.json#L1-L10)。因此：

- `0.18.0` 是当前公开安装包版本，可以作为产品版本口径；
- 根 `package.json` 的 `0.16.2` 不能用来否定 release 版本，也不能用作产品更新判断；
- `main` 与 stable release 分支并非线性关系，复制源码时必须固定目标分支和 SHA。

## 3. 官方实现事实

## 3.1 总体架构：daemon 是产品权威，CLI 是被调度执行器

官方拓扑是 Browser/Electron → Next.js Web → Express daemon → SQLite/项目文件/资源注册表 → CLI 或 ACP 进程；Web UI 与 `od` CLI 调用同一组 daemon HTTP API，不各自实现业务逻辑，[固定证据](https://github.com/nexu-io/open-design/blob/370479e4a7f8b5391e905e4bba4f8fcab5cbe380/docs/architecture.md#L55-L77)。

daemon 对 Open Design 产品自身是 `/api/*` 权威，负责 Project/Conversation 持久化、文件、Agent 探测与启动、run 记录、Prompt 组装、Plugin/MCP/Memory 等服务，[固定证据](https://github.com/nexu-io/open-design/blob/370479e4a7f8b5391e905e4bba4f8fcab5cbe380/docs/architecture.md#L96-L110)。生成时 daemon 解析 Project、Design System、Skill、Runtime 和执行元数据，以 Project workspace 为 CWD 启动 CLI，并通过 SSE 归一化事件，[固定证据](https://github.com/nexu-io/open-design/blob/370479e4a7f8b5391e905e4bba4f8fcab5cbe380/docs/architecture.md#L175-L199)。

**已验证事实**

- Open Design 不把 `codex`、`opencode`、`claude` 等 CLI 本身当产品控制面；daemon 才是产品层协调者。
- `run` 是一次 Agent 调用/流式执行，而不是独立的 SDLC 生命周期权威。
- 资源层由 daemon 统一发现并组装，不是所有语义都委托给某个 CLI 原生机制。

**迁移启示（非最终 Factory 架构）**

- 可以借用“产品控制边界与 CLI 进程边界分离”的思想。
- 不应把 Open Design daemon 的产品权威性直接等价为 Factory 的需求、设计、测试或验收权威；两者管理的问题不同。
- 若 Factory 复用 Host 代码，必须显式定义谁拥有 lifecycle、evidence、baseline、permission 的最终写权限。

## 3.2 Project、Conversation、Message 与 Agent Session

### 数据合同

数据库中：

- `conversations.project_id` 是普通外键并带列表索引，没有 `UNIQUE(project_id)`；一个 Project 可有多个 Conversation。
- `messages.conversation_id` 归属 Conversation。
- `agent_sessions` 的主键是 `(conversation_id, agent_id)`，保存当前 `session_id`、stable prompt hash、model、cwd、last message cursor，[固定证据](https://github.com/nexu-io/open-design/blob/370479e4a7f8b5391e905e4bba4f8fcab5cbe380/apps/daemon/src/db.ts#L163-L227)。
- Agent Session 合同明确把 Project identity 通过 `conversations.project_id` 间接关联，并把上游 handle 标记为默认不应公开的敏感值，[固定证据](https://github.com/nexu-io/open-design/blob/370479e4a7f8b5391e905e4bba4f8fcab5cbe380/packages/contracts/src/api/agent-sessions.ts#L56-L93)。
- upsert 会覆盖同一 `(conversation, agent)` 的当前 session 绑定；它不是 native session 历史账本，[固定证据](https://github.com/nexu-io/open-design/blob/370479e4a7f8b5391e905e4bba4f8fcab5cbe380/apps/daemon/src/db.ts#L2369-L2405)。

### Conversation fork 的真实语义

创建 Conversation 支持 `seedFromConversationId` 和 `forkAfterMessageId`。实现会复制截断后的消息、为每条复制消息生成新 ID，并删除原 Conversation 的 run pointers，[固定证据](https://github.com/nexu-io/open-design/blob/370479e4a7f8b5391e905e4bba4f8fcab5cbe380/apps/daemon/src/routes/project/conversations.ts#L81-L174)。表中没有 `parent_conversation_id`、fork point 或分支 DAG 字段。

**已验证事实**

- `opendesign.md` 关于“一个 Project 可有多个 Conversation、每个 `(conversation_id, agent_id)` 保存一个 native session”的判断正确。
- “本地 6 个 Project 每个只有一个 Conversation”只是样本现象，不是官方数据库 invariant。
- Fork 是消息快照复制，不是持久化分支关系，也不是 rollback。
- Agent Session 表保存“当前可恢复绑定”，不能独立证明历史上每次调用实际使用了什么 session、版本或权限。

**迁移启示**

- 如果 Factory 需要唯一活动主会话、显式分支谱系或审计型 session history，必须自己建模并加约束，不能从 Open Design 的 UI 行为推导。
- native session handle 应是 Invocation/Binding 的运行时属性；历史审计还需逐次记录 runtime version、模型、CWD、权限和失效原因。

## 3.3 Runtime Registry、探测与 Adapter

当前 `Runtime Registry` 有 26 个基础 `RuntimeAgentDef`，其中包含 `byok-opencode`；官方 README 的产品口径是“25 CLIs + BYOK”，两者并不矛盾，[注册表固定证据](https://github.com/nexu-io/open-design/blob/370479e4a7f8b5391e905e4bba4f8fcab5cbe380/apps/daemon/src/runtimes/registry.ts#L1-L68)、[README 固定证据](https://github.com/nexu-io/open-design/blob/370479e4a7f8b5391e905e4bba4f8fcab5cbe380/README.md#L273-L279)。

探测逻辑先解析实际会被启动的 executable path，成功执行 version probe 后才判为 available；随后并发执行 capability、model、声明过的 auth 与 companion probes，[固定证据](https://github.com/nexu-io/open-design/blob/370479e4a7f8b5391e905e4bba4f8fcab5cbe380/apps/daemon/src/runtimes/detection.ts#L238-L317)。所有 Adapter 并发探测，并用 `safeProbe` 隔离单个 Adapter 的异常，避免一个失败清空整个 Agent picker，[固定证据](https://github.com/nexu-io/open-design/blob/370479e4a7f8b5391e905e4bba4f8fcab5cbe380/apps/daemon/src/runtimes/detection.ts#L351-L399)。

这里应修正原材料中“对每个 CLI 并发探测 executable、版本、认证、模型、能力”的绝对表述：version 是必需 availability gate；其他 probe 取决于 Adapter 是否声明，model 也可能来自 fallback，不一定都是实时查询。

OpenCode Adapter 使用 stdin 传 Prompt，首轮为 `opencode run --format json`，捕获 `sessionID`；后续增加 `-s <sessionID>`，[固定证据](https://github.com/nexu-io/open-design/blob/370479e4a7f8b5391e905e4bba4f8fcab5cbe380/apps/daemon/src/runtimes/defs/opencode.ts#L41-L79)。Codex Adapter 首轮使用 `codex exec`，从 `thread.started.thread_id` 捕获 handle，后续使用 `codex exec resume <thread_id>`，[固定证据](https://github.com/nexu-io/open-design/blob/370479e4a7f8b5391e905e4bba4f8fcab5cbe380/apps/daemon/src/runtimes/defs/codex.ts#L194-L230)。

**可直接提炼的模式**

- `RuntimeAgentDef` 作为声明式适配器接口。
- “探测的 executable 必须等于真正启动的 executable”。
- Adapter fault isolation、并发探测、结构化 diagnostic。
- `buildArgs`、stdin Prompt、stream parser、native handle capture/resume 的分离。

**不能直接照搬的部分**

- 每个 Adapter 的参数、权限、模型和 auth 语义均不相同，不能抽象成一个无差别的通用命令模板。
- 当前 Registry、探测和 UI 元数据与 Open Design monorepo 类型耦合，工程复用更适合提炼合同和测试向量，而不是整目录复制。

## 3.4 Native session resume：正确边界与关键纠错

### 当前真实失效条件

官方合同列出的失效原因只有：

- `model_changed`
- `cwd_changed`
- `conversation_advanced`
- `missing_cursor`

[固定证据](https://github.com/nexu-io/open-design/blob/370479e4a7f8b5391e905e4bba4f8fcab5cbe380/packages/contracts/src/api/agent-sessions.ts#L46-L54)

纯函数 `evaluateResumeInvalidation` 也只检查 Model、CWD、上次 Assistant Message cursor 及 Conversation 是否推进，[固定证据](https://github.com/nexu-io/open-design/blob/370479e4a7f8b5391e905e4bba4f8fcab5cbe380/apps/daemon/src/agent-session-resume.ts#L45-L76)。满足时恢复保存的 session；不满足时生成新 session ID，并让调用方冷启动，[固定证据](https://github.com/nexu-io/open-design/blob/370479e4a7f8b5391e905e4bba4f8fcab5cbe380/apps/daemon/src/agent-session-resume.ts#L78-L128)。

### stable prompt 的正确行为

`stable_prompt_hash` 不是 session invalidation guard。`computeIncludeStable` 的语义是：

- 新 session：发送稳定指令块；
- 恢复 session 且 hash 相同：跳过稳定指令块；
- 恢复 session 但 hash 变化：**仍恢复原 session，只重新发送稳定指令块**。

[固定证据](https://github.com/nexu-io/open-design/blob/370479e4a7f8b5391e905e4bba4f8fcab5cbe380/apps/daemon/src/agent-session-resume.ts#L226-L243)

server 中也先独立决定 `isResuming`，再用 stable hash 决定本轮是否包含 daemon/tool/system Prompt，[固定证据](https://github.com/nexu-io/open-design/blob/370479e4a7f8b5391e905e4bba4f8fcab5cbe380/apps/daemon/src/server.ts#L9603-L9687)。因此 `opendesign.md:440-448` 将“稳定 Prompt 变化”列为新建 native session 条件是不准确的。

### 重播与故障恢复

- 恢复 session 时只发送最新用户请求；新 session 发送完整 Conversation Transcript，[固定证据](https://github.com/nexu-io/open-design/blob/370479e4a7f8b5391e905e4bba4f8fcab5cbe380/apps/daemon/src/server.ts#L1761-L1789)。
- 如果上游 session 已过期/丢失，daemon 清除旧 handle，同一轮透明重试一次，并用数据库中的完整 Transcript 冷重播；有防循环保护，[固定证据](https://github.com/nexu-io/open-design/blob/370479e4a7f8b5391e905e4bba4f8fcab5cbe380/apps/daemon/src/server.ts#L12535-L12590)。

**迁移启示**

- “恢复能力”应由 Adapter capability 声明，不应假设所有 CLI 都支持同一种 handle。
- Resume guard 应至少增加 host/adapter version、workspace revision、permission profile 和 effective tool/config digest；但这些是 Factory 增强项，不是 Open Design 当前事实。
- stable prompt 变化是“继续旧上下文并注入新规则”还是“强制新 session”属于产品语义决策。Open Design 选择前者，Factory 不能无条件照搬。
- 冷重播是良好的容错模式，但应产生可见审计事件，不能只作为用户无感优化。

## 3.5 Skill：格式可移植，Studio 运行时仍由 daemon 全量注入

官方 Skill 最小包是包含 `SKILL.md` 的目录，可附带 `assets/` 和 `references/`；正文是自由 Markdown，OD 按原文读取，[固定证据](https://github.com/nexu-io/open-design/blob/370479e4a7f8b5391e905e4bba4f8fcab5cbe380/docs/skills-protocol.md#L7-L51)。用户根优先于 bundled 根，同 ID 的用户 Skill 覆盖内置项，每次 listing 重新扫描，[固定证据](https://github.com/nexu-io/open-design/blob/370479e4a7f8b5391e905e4bba4f8fcab5cbe380/docs/skills-protocol.md#L123-L138)。实现会读取完整 `SKILL.md` 正文并执行 first-root-wins，[固定证据](https://github.com/nexu-io/open-design/blob/370479e4a7f8b5391e905e4bba4f8fcab5cbe380/apps/daemon/src/skills.ts#L227-L321)。

对于 side files，daemon 在每轮运行前把 active Skill 复制到 Project 的 `.od-skills/`，刻意不用 symlink，避免 Agent 从 Project CWD 反向修改共享源文件，[固定证据](https://github.com/nexu-io/open-design/blob/370479e4a7f8b5391e905e4bba4f8fcab5cbe380/apps/daemon/src/cwd-aliases.ts#L1-L29)。staging 是 non-throwing，失败时回退绝对路径，[固定证据](https://github.com/nexu-io/open-design/blob/370479e4a7f8b5391e905e4bba4f8fcab5cbe380/apps/daemon/src/cwd-aliases.ts#L97-L120)。

Open Design Studio 的真实执行链不是“把 Skill 安装进所选 CLI，再由 CLI 原生 Skill tool 按需发现”：

1. daemon 查找主 Skill 和 ad-hoc Skills；
2. 拼接多个完整 Skill body；
3. Plugin-local `SKILL.md` 可覆盖 global Skill；
4. Prompt composer 把完整正文放进 `## Active skill`；
5. 再附加 Plugin block 与 Atom stage blocks。

[Skill 选择与拼接固定证据](https://github.com/nexu-io/open-design/blob/370479e4a7f8b5391e905e4bba4f8fcab5cbe380/apps/daemon/src/server.ts#L8150-L8325)、[Prompt 注入固定证据](https://github.com/nexu-io/open-design/blob/370479e4a7f8b5391e905e4bba4f8fcab5cbe380/apps/daemon/src/prompts/system.ts#L1170-L1207)

需要区分两个表面：Open Design 可以通过 `od mcp install`/插件形式进入外部 Agent；但在自身 Studio/daemon 运行链里，Skill 是 daemon 解析和全量 Prompt 注入，不是所选 Agent 的原生 discovery。

### Skill 安装安全

远程 Skill 安装支持 `github:owner/repo` 与 HTTPS tarball，使用 SSRF-safe fetch，拒绝绝对路径、Windows 路径穿越、symlink/hardlink 和特殊文件，默认 50 MiB，最后通过 rename 原子安装且不覆盖同名 Skill，[固定证据](https://github.com/nexu-io/open-design/blob/370479e4a7f8b5391e905e4bba4f8fcab5cbe380/apps/daemon/src/services/skill-installation.ts#L270-L409)。

但该安装器不计算或持久化 Skill 内容 SHA-256，也没有 SemVer/source/content-hash 权威登记。`opendesign.md` 提议的 Skill ID、版本、Hash、来源登记是合理的 Factory 增强建议，不是 Open Design 已提供的机制。

**迁移判断**

- `SKILL.md` 包格式、路径安全检查、copy-not-symlink、原子安装可以借鉴。
- 全量 Skill Prompt 注入是否采用，应由 Factory 的上下文预算、CLI 原生能力和可审计性决定；不能把“格式兼容”误认为“运行方式相同”。
- 若需可重放，必须保存生效正文或内容地址化 blob，不能只保存 Skill ID。

## 3.6 Plugin：不是 UI 扩展，但也不是纯数据

官方规范把 Plugin 定义为围绕一个或多个 Skill 的可分发包：`SKILL.md` 是最低公共分母，`open-design.json` 是 OD sidecar；只有 `open-design.json` 的目录是 metadata-only，不是可运行 Plugin，[固定证据](https://github.com/nexu-io/open-design/blob/370479e4a7f8b5391e905e4bba4f8fcab5cbe380/docs/plugins-spec.md#L180-L218)。Apply 默认是纯解析：读取 manifest、模板化 query、返回 context/assets/MCP/capability 等；写 Project CWD、启动 MCP/进程等副作用延迟到 Project create/run start 且应通过 capability gate，[固定证据](https://github.com/nexu-io/open-design/blob/370479e4a7f8b5391e905e4bba4f8fcab5cbe380/docs/plugins-spec.md#L484-L488)。

不过“Plugin 不是传统 Electron UI 插件”不等于“Plugin 不会引入可执行能力”。Manifest 可以声明 MCP、Claude-plugin hooks、`subprocess`、`bash` 和 `network`；规范明确 `subprocess/bash` 能绕过细粒度 `fs:*`/`network` 限制，属于 elevated capabilities，[固定证据](https://github.com/nexu-io/open-design/blob/370479e4a7f8b5391e905e4bba4f8fcab5cbe380/docs/plugins-spec.md#L395-L409)。准确描述应是：

- 没有传统 Electron panel lifecycle 或以任意 UI 代码为主合同的插件运行时；
- Apply 本身不启动隐藏进程；
- Run start 后仍可能根据授权启动 MCP command、hook 或 subprocess；Plugin 绝非天然“只读声明数据”。

### Context resolver 与 digest

`resolveContext` 是纯函数，只基于 daemon 提供的 Registry View 把引用解析成 ID/chip，并产出 `{kind, ref}` 列表；它不读取资源正文，[固定证据](https://github.com/nexu-io/open-design/blob/370479e4a7f8b5391e905e4bba4f8fcab5cbe380/packages/plugin-runtime/src/resolve.ts#L8-L30)、[固定证据](https://github.com/nexu-io/open-design/blob/370479e4a7f8b5391e905e4bba4f8fcab5cbe380/packages/plugin-runtime/src/resolve.ts#L61-L172)。`manifestSourceDigest` 的 SHA-256 输入严格是：

```text
{ manifest, inputs, resolvedContextRefs }
```

[固定证据](https://github.com/nexu-io/open-design/blob/370479e4a7f8b5391e905e4bba4f8fcab5cbe380/packages/plugin-runtime/src/digest.ts#L4-L36)

因此这个 digest 不覆盖：

- Plugin-local `SKILL.md` 的实际字节；
- 被引用 Skill/Design System/Craft 的正文；
- Asset 文件字节；
- MCP command 对应的实际包版本/二进制；
- 运行时所选 Agent CLI 版本。

### `AppliedPluginSnapshot` 的真实不变性边界

Snapshot 合同保存 plugin/version/source/digest/inputs/context/capabilities/assets/connectors/MCP/pipeline 等 apply-time 字段，[固定证据](https://github.com/nexu-io/open-design/blob/370479e4a7f8b5391e905e4bba4f8fcab5cbe380/packages/contracts/src/plugins/apply.ts#L38-L77)。`snapshots.ts` 不会重写 `resolved_context_json`，这是合理的 payload 不漂移约束，[固定证据](https://github.com/nexu-io/open-design/blob/370479e4a7f8b5391e905e4bba4f8fcab5cbe380/apps/daemon/src/plugins/snapshots.ts#L1-L13)。

但数据库行本身并非严格 append-only：它会更新 run/project/conversation 绑定、expiry 和 `status='stale'`，未引用/过期行还会被 GC 删除，[绑定/状态固定证据](https://github.com/nexu-io/open-design/blob/370479e4a7f8b5391e905e4bba4f8fcab5cbe380/apps/daemon/src/plugins/snapshots.ts#L150-L168)、[GC 固定证据](https://github.com/nexu-io/open-design/blob/370479e4a7f8b5391e905e4bba4f8fcab5cbe380/apps/daemon/src/plugins/snapshots.ts#L238-L245)、[删除固定证据](https://github.com/nexu-io/open-design/blob/370479e4a7f8b5391e905e4bba4f8fcab5cbe380/apps/daemon/src/plugins/snapshots.ts#L278-L326)。

更关键的是，Plugin-local `SKILL.md` 被刻意排除在 apply 阶段，Prompt 组装时才从当前 installed plugin folder 读取，[固定证据](https://github.com/nexu-io/open-design/blob/370479e4a7f8b5391e905e4bba4f8fcab5cbe380/apps/daemon/src/plugins/local-skill.ts#L1-L11)、[固定证据](https://github.com/nexu-io/open-design/blob/370479e4a7f8b5391e905e4bba4f8fcab5cbe380/apps/daemon/src/plugins/local-skill.ts#L33-L59)。Plugin 安装器又默认允许替换同 ID 安装，[固定证据](https://github.com/nexu-io/open-design/blob/370479e4a7f8b5391e905e4bba4f8fcab5cbe380/apps/daemon/src/plugins/installer.ts#L69-L101)、[固定证据](https://github.com/nexu-io/open-design/blob/370479e4a7f8b5391e905e4bba4f8fcab5cbe380/apps/daemon/src/plugins/installer.ts#L737-L748)。

所以 `opendesign.md:617-623` 中“Plugin 升级后历史执行仍可重建”“Skill/Asset/MCP/Atom 绑定可审计”只能部分成立：标识、配置和授权可回看，但历史有效字节和真实执行环境不能由当前 Snapshot 完整重建。

**迁移启示**

- 借鉴 Snapshot envelope、capability grant 和 provenance 字段。
- Factory 若要求强重放，应固化每个生效资源的 content digest、不可变 blob/仓库 SHA、解析器版本、Adapter/CLI 版本、effective argv/env/permission profile，而不是只存引用 ID。
- “不可变”应拆成 payload append-only、关联 append-only、保留策略和可删除条件四个明确合同。

## 3.7 Atom Pipeline：可观测外壳，不是 lifecycle scheduler

`pipeline-runner.ts` 明确说明真实 Stage execution 仍由 Agent loop 拥有；runner 只发 stage timeline、记录 iteration、处理 GenUI，调用方提供 `runStage`，[固定证据](https://github.com/nexu-io/open-design/blob/370479e4a7f8b5391e905e4bba4f8fcab5cbe380/apps/daemon/src/plugins/pipeline-runner.ts#L1-L19)。

当前 server 行为更直接：

- Pipeline 错误被 `.catch` 并发出事件，但不会阻塞 Agent run；
- stub runner 直接给 `critique.score=4`、`preview.ok=true`、`user.confirmed=true`；
- Pipeline 与 Agent run 并行，`Promise.all` 只用于结束后的 token reconciliation，不把 pipeline outcome 作为 Agent run Gate。

[固定证据](https://github.com/nexu-io/open-design/blob/370479e4a7f8b5391e905e4bba4f8fcab5cbe380/apps/daemon/src/server.ts#L8728-L8811)

Registry 默认信号也是 permissive success；未注册 Atom 被忽略，Worker 异常只形成 note，不让 Stage 失败，[固定证据](https://github.com/nexu-io/open-design/blob/370479e4a7f8b5391e905e4bba4f8fcab5cbe380/apps/daemon/src/plugins/atoms/registry.ts#L83-L141)。内置 Atom 中只有 `critique-theater` 尝试读取 daemon 可观测分数，其余 Atom 都返回空 signals，依赖默认值收敛，[固定证据](https://github.com/nexu-io/open-design/blob/370479e4a7f8b5391e905e4bba4f8fcab5cbe380/apps/daemon/src/plugins/atoms/built-ins.ts#L1-L68)。

纯 scheduler 自身有 iteration cap，并会返回 non-converged outcome；但注释明确由调用方决定是否继续/失败，[固定证据](https://github.com/nexu-io/open-design/blob/370479e4a7f8b5391e905e4bba4f8fcab5cbe380/apps/daemon/src/plugins/pipeline.ts#L87-L174)。当前 server 调用方没有用该 outcome 阻断 Agent run。

**已验证结论**

- `opendesign.md` 关于“Atom 默认信号不能作为 Factory Evidence”的判断完全正确。
- 还应进一步明确：当前 Pipeline 不是弱化版 lifecycle scheduler，而是与 Agent loop 并行的 Prompt/UX/观测层。
- 任何 `UNKNOWN / NOT_PROVIDED` 被映射成通过的行为都不适合 Factory Gate。

## 3.8 Memory：轻量全局 Prompt 记忆，不是受治理知识层

Memory 是 `<dataDir>/memory/` 下的 Markdown 文件和 `MEMORY.md` 索引，采用 per-file last-writer-wins，代码假设同一时刻只有一个 chat run 写入，[固定证据](https://github.com/nexu-io/open-design/blob/370479e4a7f8b5391e905e4bba4f8fcab5cbe380/apps/daemon/src/memory.ts#L1-L21)。类型为 `profile/user/feedback/project/reference/rule`；`project` 只是分类字段，并未形成 Project ID namespace，[固定证据](https://github.com/nexu-io/open-design/blob/370479e4a7f8b5391e905e4bba4f8fcab5cbe380/packages/contracts/src/api/memory.ts#L14-L41)。

默认配置是：

- Memory injection：开启；
- Chat auto-extraction：关闭；
- profile/rewrite/verify Prompt hooks：开启。

[固定证据](https://github.com/nexu-io/open-design/blob/370479e4a7f8b5391e905e4bba4f8fcab5cbe380/apps/daemon/src/memory.ts#L198-L229)、[默认测试固定证据](https://github.com/nexu-io/open-design/blob/370479e4a7f8b5391e905e4bba4f8fcab5cbe380/apps/daemon/tests/memory-extraction-default-off.test.ts#L23-L40)

`composeMemoryBody(dataDir)` 从 daemon-wide index 选 active entries 并组成 Prompt，没有 projectId/conversationId 过滤参数，[固定证据](https://github.com/nexu-io/open-design/blob/370479e4a7f8b5391e905e4bba4f8fcab5cbe380/apps/daemon/src/memory.ts#L607-L697)。这意味着同一个 daemon namespace 内的 active Memory 默认跨 Project 注入。

### Verify 机制的实现与接线差距

仓库确实实现了纯函数 `enforceVerify`：当存在 active rules 且有 artifact 时，它解析模型输出中的 scorecard，检查 rule coverage 和 fail rows；另有 20 条内存 ring buffer 的 `recordVerify`，[固定证据](https://github.com/nexu-io/open-design/blob/370479e4a7f8b5391e905e4bba4f8fcab5cbe380/apps/daemon/src/memory-verify.ts#L80-L137)、[固定证据](https://github.com/nexu-io/open-design/blob/370479e4a7f8b5391e905e4bba4f8fcab5cbe380/apps/daemon/src/memory-verify.ts#L139-L180)。HTTP route 只提供 recent verifications 的 list/delete，[固定证据](https://github.com/nexu-io/open-design/blob/370479e4a7f8b5391e905e4bba4f8fcab5cbe380/apps/daemon/src/routes/memory.ts#L345-L375)。

但是在当前 SHA 上，全仓静态检索 `enforceVerify` / `recordVerify` 只命中定义文件与单元测试，没有生产 run completion 调用点。server 只把 `verifyEnabled` 送进 Prompt composer，[固定证据](https://github.com/nexu-io/open-design/blob/370479e4a7f8b5391e905e4bba4f8fcab5cbe380/apps/daemon/src/server.ts#L8337-L8361)。所以当前可以确认的是“有 verifier 实现和 UI/API 外壳”，不能确认“每次 Artifact run 都被程序化 enforcement”。

**迁移启示**

- 可借鉴 Markdown 人工可编辑体验、active index 和默认关闭自动提取的谨慎策略。
- 不应复制其 daemon-global、last-writer-wins 存储作为 Project truth。
- `PROPOSED/ACTIVE/SUPERSEDED`、来源、content hash、`verified_at`、expiry、作用域和对 Baseline 的不可覆盖规则，都是 Factory 需要补建的治理合同，不是 Open Design 现成功能。

## 3.9 权限与安全边界

### Daemon 网络边界

daemon 默认绑定 `127.0.0.1`，[固定证据](https://github.com/nexu-io/open-design/blob/370479e4a7f8b5391e905e4bba4f8fcab5cbe380/apps/daemon/src/daemon-startup.ts#L31-L50)。绑定非 loopback 时若没有 `OD_API_TOKEN` 会拒绝启动，除非显式设置 `OD_DISABLE_API_AUTH=1`；配置 token 后，非 loopback `/api/*` 请求需要 Bearer token，健康探针和已签发 preview scope 有例外，[固定证据](https://github.com/nexu-io/open-design/blob/370479e4a7f8b5391e905e4bba4f8fcab5cbe380/apps/daemon/src/server.ts#L2388-L2474)。

这是合理的本地 daemon 最低安全线，但单一 bearer token 不是多租户 RBAC、Project ACL 或操作级授权模型。

### Agent 执行权限

- OpenCode Adapter 在 CLI 支持时添加 `--dangerously-skip-permissions`，[固定证据](https://github.com/nexu-io/open-design/blob/370479e4a7f8b5391e905e4bba4f8fcab5cbe380/apps/daemon/src/runtimes/opencode-permissions.ts#L1-L16)。
- Claude Adapter固定添加 `--permission-mode bypassPermissions`，[固定证据](https://github.com/nexu-io/open-design/blob/370479e4a7f8b5391e905e4bba4f8fcab5cbe380/apps/daemon/src/runtimes/defs/claude.ts#L77-L88)。
- ACP permission request 会优先选择 `approve_for_session`，其次 `allow_always`、`allow_once`，并自动返回，[固定证据](https://github.com/nexu-io/open-design/blob/370479e4a7f8b5391e905e4bba4f8fcab5cbe380/apps/daemon/src/agent-protocol/acp/rpc.ts#L233-L249)、[固定证据](https://github.com/nexu-io/open-design/blob/370479e4a7f8b5391e905e4bba4f8fcab5cbe380/apps/daemon/src/agent-protocol/acp/session.ts#L624-L645)。
- Windows/WSL 下 Codex Adapter 因工作区沙箱限制改用 `danger-full-access`；macOS/Linux 仍允许 workspace-write 下网络访问，[固定证据](https://github.com/nexu-io/open-design/blob/370479e4a7f8b5391e905e4bba4f8fcab5cbe380/apps/daemon/src/runtimes/defs/codex.ts#L187-L227)。

这些选择适合追求本地设计工作流连续性，却不满足 Factory 的显式审批、最小权限和证据保留要求。

### `OD_SANDBOX_MODE` 的真实边界

该模式默认关闭；开启时要求 `OD_DATA_DIR`，限制 imported Project root，并把 HOME、XDG、Codex/Claude/OpenCode 配置、cache、temp 等重定向到 daemon data root，[固定证据](https://github.com/nexu-io/open-design/blob/370479e4a7f8b5391e905e4bba4f8fcab5cbe380/apps/daemon/src/sandbox-mode.ts#L37-L49)、[固定证据](https://github.com/nexu-io/open-design/blob/370479e4a7f8b5391e905e4bba4f8fcab5cbe380/apps/daemon/src/sandbox-mode.ts#L130-L194)。这提供配置/状态隔离和路径收敛，但源码没有显示它为所有子进程提供 OS 级 syscall、filesystem 或 network sandbox。

### Plugin trust 与 runtime 权限不可混为一谈

本地 Plugin 默认 `trusted`，trusted 默认带 `mcp:*`、`connector:*`、`genui:*`、`pipeline:*` 等能力；restricted 默认只有 `prompt:inject`，[固定证据](https://github.com/nexu-io/open-design/blob/370479e4a7f8b5391e905e4bba4f8fcab5cbe380/apps/daemon/src/plugins/trust.ts#L1-L32)。即便 Plugin capability gate 正确，它也没有把 Agent CLI 进程约束在同等能力集合里。Factory 若采用能力模型，必须把：

1. Plugin 声明能力；
2. 用户/策略批准；
3. Agent CLI 有效权限；
4. OS/容器实际约束；
5. 运行中真实 tool/process/network 事件

分别建模并核对，不能仅凭 Snapshot 中 `capabilitiesGranted` 判定一次执行受控。

### Telemetry 数据边界

README 明确普通 analytics/session replay 受 consent gate，但 scrubbed safety/reliability telemetry 始终开启，[固定证据](https://github.com/nexu-io/open-design/blob/370479e4a7f8b5391e905e4bba4f8fcab5cbe380/README.md#L264-L269)。代码在没有 telemetry 配置时默认 `metrics=true, content=true`，[固定证据](https://github.com/nexu-io/open-design/blob/370479e4a7f8b5391e905e4bba4f8fcab5cbe380/apps/daemon/src/app-config.ts#L684-L701)；普通 capture 会重新检查 metrics consent，而 `captureSafety` 明确不检查 consent，[固定证据](https://github.com/nexu-io/open-design/blob/370479e4a7f8b5391e905e4bba4f8fcab5cbe380/apps/daemon/src/analytics.ts#L297-L362)。实际外发仍需要构建/环境提供 PostHog 配置；本报告未动态检查安装包中的实际 endpoint。

迁移时不能复制 Open Design 的默认遥测策略，应按 Factory 数据分类、企业部署和审计要求重新定义 opt-in、脱敏、保留与出口控制。

## 3.10 安装安全、供应链与许可证

### Plugin 安装器

Plugin 支持 local、GitHub 和 HTTPS archive，默认 50 MiB，[固定证据](https://github.com/nexu-io/open-design/blob/370479e4a7f8b5391e905e4bba4f8fcab5cbe380/apps/daemon/src/plugins/installer.ts#L1-L15)。远程路径：

- 通过安全 fetch 获取 archive；
- 下载时计算 SHA-256 并限制大小；
- 如果调用方传入 `archiveIntegrity`，则做 expected-vs-computed 校验；
- 拒绝 symlink/hardlink 和 path traversal；
- 解压后再次检查总大小；
- 把计算出的摘要记录到安装 provenance。

[固定证据](https://github.com/nexu-io/open-design/blob/370479e4a7f8b5391e905e4bba4f8fcab5cbe380/apps/daemon/src/plugins/installer.ts#L470-L596)、[SHA-256 固定证据](https://github.com/nexu-io/open-design/blob/370479e4a7f8b5391e905e4bba4f8fcab5cbe380/apps/daemon/src/plugins/installer.ts#L612-L642)

本地复制也拒绝 symlink、unsafe path、socket/fifo/device，并限制树大小，[固定证据](https://github.com/nexu-io/open-design/blob/370479e4a7f8b5391e905e4bba4f8fcab5cbe380/apps/daemon/src/plugins/installer.ts#L880-L913)。

**关键限定**

- `archiveIntegrity` 是可选项；没有预先可信的 expected hash 时，计算 SHA-256 只提供内容标识和事后审计，不证明发布者身份或下载未被可信源替换。
- 规范明确 v1 不建设签名/PKI，[固定证据](https://github.com/nexu-io/open-design/blob/370479e4a7f8b5391e905e4bba4f8fcab5cbe380/docs/plugins-spec.md#L158-L174)。
- 本地 Plugin 自动 trusted 不适合高治理环境。
- 同 ID Plugin 默认可被替换，历史重放必须依靠真正不可变的内容存储，而不是当前安装目录。

### License

根仓库为 Apache License 2.0，[固定证据](https://github.com/nexu-io/open-design/blob/370479e4a7f8b5391e905e4bba4f8fcab5cbe380/LICENSE#L1-L10)。再分发 Work/Derivative Works 时，Apache-2.0 要求向接收者提供 License、修改文件有显著变更说明、保留适用版权/专利/商标/归属声明，并在上游存在 NOTICE 时传递其中适用内容，[固定证据](https://github.com/nexu-io/open-design/blob/370479e4a7f8b5391e905e4bba4f8fcab5cbe380/LICENSE#L89-L121)。

根 README 明确 bundled Skills/Templates 可能保留各自独立 License，例如 MIT，[固定证据](https://github.com/nexu-io/open-design/blob/370479e4a7f8b5391e905e4bba4f8fcab5cbe380/README.md#L770-L772)。因此：

- 可以在履行 Apache-2.0 条件后修改/商业使用根代码；
- 不能把根 License 自动套到所有 `skills/`、`plugins/`、`design-templates/`、素材、品牌和 vendor 内容；
- 复制代码前应建立 source file inventory、原始 License、变更标记、attribution 与第三方资源审计；
- 以上是工程合规提醒，不是法律意见。

官方 Windows 文档还说明当前 Windows 安装包未使用被 SmartScreen 识别的代码签名，会显示 Unknown publisher，[固定证据](https://github.com/nexu-io/open-design/blob/370479e4a7f8b5391e905e4bba4f8fcab5cbe380/docs/windows-troubleshooting.md#L24-L41)。这进一步说明“GitHub Release 可下载”不等于“具备企业供应链签名链”。

## 4. 对 `opendesign.md` 的逐项校准

| 原材料判断 | 审计状态 | 校准结果 |
|---|---|---|
| 一个 Project 可有多个 Conversation | 已验证 | DB 没有一项目一会话唯一约束。 |
| 每个 `(conversation_id, agent_id)` 对应 native session | 基本正确 | 只保存当前绑定并覆盖更新，不是历史账本。 |
| Conversation fork 是分支 | 部分正确 | 复制消息形成新 Conversation，但没有 parent/fork lineage。 |
| 25 种本地 CLI 执行器 | 口径需区分 | README 是 25 CLIs + BYOK；Registry 有 26 个 base definitions，包含 `byok-opencode`。 |
| 并发探测 executable/version/auth/model/capability | 部分正确 | Version 是必需 gate；其他 probe 由 Adapter 可选声明，model 可能来自 fallback。 |
| OpenCode 使用 `run --format json` 与 `-s` 续接 | 已验证 | Prompt 走 stdin，sessionID 从 stream 捕获。 |
| stable prompt 变化导致新 native session | **不正确** | 仍恢复同一 session，只重新发送稳定指令块。 |
| 恢复失败后完整 Transcript 冷重播 | 已验证 | 还会清除 stale handle 并同一轮透明重试一次。 |
| Open Design Studio 不是 CLI 原生 Skill discovery | 已验证 | daemon 读取完整正文、拼 Prompt，并复制 side files。 |
| Skill 安装/版本/Hash/来源机制可直接复用 | 部分不正确 | 安全安装可借鉴；当前 Skill installer 没有 content hash/版本权威登记。 |
| Plugin 不是传统 Electron/OpenCode Plugin | 基本正确 | 没有传统 UI lifecycle；但授权后可启动 MCP/hooks/subprocess，不能称为纯数据。 |
| Manifest SHA-256 固定 Plugin 内容 | **过度表述** | 只 hash manifest、inputs、resolved reference IDs，不覆盖全部正文/资源/二进制。 |
| AppliedPluginSnapshot 可保证升级后历史完整重建 | **当前实现不成立** | Snapshot 固化元数据，但 local Skill/资源可从 live install 读取；行也可更新状态/关联并被 GC。 |
| Atom Pipeline 不可作为 Factory Gate/Evidence | 已验证且应加强 | 它与 Agent run 并行、错误吞并、缺失观测默认成功。 |
| Plugin installer 有 50 MiB、SHA-256、link/traversal guard | 已验证但有限定 | Expected hash 可选；无签名/PKI；摘要不等于来源认证。 |
| 本地 Plugin 默认 trusted | 已验证 | Factory 不应照搬。 |
| 根仓库 Apache-2.0，可修改和商业使用 | 已验证 | 需履行再分发条件并逐包审计独立 License/素材。 |

## 5. 复用分级

### 5.1 可直接提炼为独立实现/测试向量

这里的“直接”指机制和小型纯函数可以原义迁移，不表示把整个 Open Design 模块复制进 Factory：

- executable resolution 与“探测路径等于实际启动路径”约束；
- Adapter `buildArgs`、stdin、stream parser、handle capture/resume 的接口分离；
- 单 Adapter `safeProbe` fault isolation；
- Model/CWD/Conversation cursor resume guard 纯函数；
- native session 丢失后 clear + cold reseed + 单次防循环重试；
- archive path traversal、symlink/hardlink、特殊文件、大小上限检查；
- Skill staging 的 copy-not-symlink 原则；
- Plugin manifest canonicalization/digest 算法作为一种 manifest identity 算法，但不能称完整内容 digest。

### 5.2 适合借鉴后重建合同

- Project/Conversation/Message/native binding 的分层；
- Conversation fork 的 UX，但需补 branch lineage；
- `SKILL.md` 兼容格式、用户覆盖内置、side-file staging；
- Plugin Manifest、apply purity、provenance、capability grant；
- `AppliedPluginSnapshot` envelope，但需扩展成内容地址化事实；
- GenUI/Plugin Pipeline 作为交互和提示层；
- Markdown Memory 的人工可编辑体验；
- loopback daemon 与非 loopback token floor。

### 5.3 不适合直接采用

- 一项目一主 Conversation 的隐含 UI 假设；
- Agent Session 表覆盖更新作为审计记录；
- stable prompt 变化仍无条件继续旧 native session；
- daemon 全量 Skill/Design/Craft/Memory/Plugin Prompt 堆叠作为唯一上下文策略；
- Plugin local source 自动 trusted；
- Plugin capability grant 被当成 CLI/OS 实际权限证明；
- OpenCode/Claude permission bypass、ACP auto-approve、Windows Codex danger-full-access；
- permissive Atom defaults、Worker error swallowing、Pipeline failure 不阻断 Agent run；
- daemon-global、last-writer-wins Memory 作为 Project truth；
- 可选 expected hash、无签名/PKI的安装机制作为企业供应链终态；
- 当前 Snapshot 作为完整历史重放依据。

## 6. 对 Factory 重构的迁移约束（不构成最终方案）

这部分只给出由官方源码证据推导出的重构约束，不替代 Factory 的最终领域建模与技术方案。

1. **明确两种“Run”。** Open Design chat run 应最多映射为 Agent Invocation/Attempt；是否存在更高层 Execution Run、Stage 和 Gate，必须由 Factory 领域合同决定。
2. **对话连续性不能成为事实权威。** Conversation/Memory 负责上下文体验；正式 Requirement、Design、Evidence、Baseline 必须有独立状态、来源和审核链。
3. **native session 是可丢失缓存。** 任何 CLI session 都可过期、被清理或因 Adapter/模型/CWD/Revision 变化失效；Factory 的正确性不能依赖其永久存在。
4. **每次 Invocation 固化 effective execution record。** 至少包括 runtime/adapter/CLI version、model、CWD/workspace revision、native handle 的安全引用、effective args/config、Prompt/Skill/Plugin content digests、permission profile 与实际 tool/process/network events。
5. **Snapshot 必须覆盖字节而非只覆盖 ID。** 如果要求历史重放，所有生效 Skill/Plugin/Rule/Template/Asset/Validator/MCP definition 均需要不可变 content digest 和可取回内容。
6. **Capability 声明、批准和执行约束分层。** Manifest 要什么、策略批了什么、CLI 实际拿到什么、OS 真正阻止了什么、运行时做了什么必须分别留证。
7. **缺失证据不得成功。** Pipeline/Validator/Gate 的 `UNKNOWN`、异常、timeout、未运行都不能借用 Open Design permissive defaults 转成 `PASSED`。
8. **Skill 运行模式要显式选择。** CLI 原生按需 Skill、daemon 全量注入、文件 staging 可以并存，但每种模式的 Prompt hash、加载证据和可重放语义必须明确。
9. **Memory 必须有作用域与治理状态。** User、Project、Session Working Memory 需隔离；自动提取先形成 Proposal，经确认后才能影响权威上下文，并且不能覆盖 Baseline。
10. **供应链终态需要超越 Open Design。** 固定仓库 SHA/版本、expected digest、签名/发布者、SBOM/License、审批与隔离安装应由 Factory 自己定义。

## 7. 最终审计判断

`opendesign.md` 最值得保留的是“Host 层与 Factory 领域权威分离”的方向，以及对 Atom permissive default、本地 Plugin 自动 trusted、全量 Prompt 注入风险的警惕。需要删除或改写的是：

- stable prompt 被当作 native session invalidation 条件；
- `AppliedPluginSnapshot` 被描述为完整不可变、可保证历史资源重建；
- Skill 已具备版本/content-hash 权威登记的暗示；
- Plugin 被理解为不会引入可执行能力；
- SHA-256 被理解为发布者认证或完整供应链保证；
- Memory verify 已在运行链中可靠 enforcement 的假设。

综合结论：

> **可以借 Open Design 的 Adapter、native session、资源包、安全解包和 apply-time provenance；不能借它的 permissive pipeline、运行权限默认值、全局 Memory 和不完整 Snapshot 来承担 Factory 的生命周期与证据权威。**
