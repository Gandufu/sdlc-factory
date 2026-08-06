# 持续会话与原生 Skills

## 1. Session 模型

项目初始化批准后创建一个 `PROJECT_MAIN` Factory Session，并稳定绑定一个 OpenCode Session。Requirement 和 Design 共用这条主会话，不能在每次消息后删除或重建。

```text
Project
└─ Project Main Session
   ├─ Requirement conversation + Todo
   ├─ Design conversation + Todo
   ├─ Coding Child Session（每个 CU）
   ├─ Testing Child Session（每个 CU、与 Coding 隔离）
   └─ Validator Child Session（全新只读验证上下文）
```

Factory Session 持久化 `factory_session_id ↔ opencode_session_id`、项目、工作目录、类型、父会话、当前阶段、CU 和状态。OpenCode 保存消息与 Todo；Factory 可保存只读投影和关键关联，但不能维护另一套可写 Todo。

历史 Session 只读。归档不删除 OpenCode 历史；删除仅允许显式管理命令，并必须先通过引用检查。

## 2. Host 生命周期

OpenCode Host Adapter 应连接长生命周期、可恢复的本地 OpenCode Server，而不是每条消息启动临时 Server。Adapter 负责：

- 创建、读取、继续、终止和恢复 OpenCode Session；
- 映射消息、Todo、Child Session、工具事件和错误；
- 固定 SDK/Host/Model 版本并记录真实运行绑定；
- 保持 idempotency key，相同传输重试不得创建第二次业务动作；
- 只转换协议，不拥有 Lifecycle、Gate 或 Baseline。

认证、网络、限流或进程错误只结束当前调用。Session、Todo、草稿和当前 Stage 仍保留，界面提供“重试当前调用”或“继续剩余任务”。不能静默切换 Model、Host 或执行模式。

## 3. 原生 Skill 安装与发现

Factory 内置能力以标准 OpenCode Skill 包交付：

```text
.opencode/skills/<skill-id>/
├─ SKILL.md
├─ references/
├─ scripts/
└─ templates/
```

首批阶段 Skill：

- `factory-requirement-grilling`
- `factory-design-grilling`
- `factory-planning`
- `factory-coding`
- `factory-testing`

项目初始化安装固定版本；升级由显式项目配置命令完成。Skill 使用小写 kebab-case ID、SemVer、来源引用和内容 Hash。OpenCode 通过原生 `skill` tool 按需加载正文，Factory 不把 Skill 内容拼接进 Java/Node/Python 硬编码提示词。

Factory 只管理：

- 允许哪些阶段/Agent 发现某个 Skill；
- Skill 的版本、路径、来源、Hash 和健康状态；
- StageSubmission 或 ExecutionRun 实际使用的 Skill 绑定；
- 权限策略是否允许原生 Skill tool。

## 4. Prompt、Rule 与 Skill 的分工

- AgentDefinition：角色、默认 Model、权限与允许的 Skill 集；
- PromptTemplate：当前阶段目标和输出合同的最小入口提示；
- Skill：可演化的工作方法，例如 Grilling、Brainstorming、Coding 或 Testing；
- RuleSet：不可由 Agent 判断替代的治理规则；
- JSON Schema：结构化提交的机器边界；
- Deterministic Check：由程序执行的可重复验证。

同一规则只能有一个权威定义。Prompt 不复制 Skill 流程，Skill 不声明可以批准 Gate，RuleSet 不复述完整文档模板。

## 5. 上下文边界

上下文分为：

- `AuthoritativeMaterial`：已批准 Baseline、接口、验证合同、政策和跨 CU 事实，由 Context Assembler 固定版本、Hash、顺序和脱敏；
- `WorkspaceContent`：当前授权工作区内的源码、测试和配置，由 OpenCode 在权限范围内原生 read/grep/edit/bash；
- `ReferenceMaterial`：用户附件、原型和外部资料，保存来源与检测策略。

CapabilityIndex 与 ContextExpansionRequest 只管理权威资料和注册能力的延迟发现，不加载 Skill，也不审批 Agent 对已授权工作区的正常探索。
