# SDLC Factory

SDLC Factory 是一个面向本地真实研发流程的 AI 软件生产控制平台。它使用持续 Agent 会话完成需求和总体设计，再以 CapabilityUnit（能力单元，CU）为交付任务组织编码、测试和系统验收。

当前仓库仍处于分阶段实施期；本文描述目标生产流程，不代表所有环节已经完成。

Spring Boot 控制平面拥有生命周期、人工 Gate（门禁）、Baseline（基线）、Evidence（证据）和恢复事实；OpenCode 保持原生 Session、Skills、Todo、工具和 Child Session 能力；Electron 提供统一操作界面。

## 生产流程

```text
项目初始化
→ 初始化人工审核 → InitializationBaseline

→ 项目持续主会话
  → 上传原始需求或通过对话描述需求
  → Requirement Grilling / Brainstorming
  → 生成需求规格说明书.md
  → 人工审核 → RequirementBaseline

  → Design Grilling / Brainstorming
  → 生成总体设计文档、ValidationContract 与正式 CU
  → 人工审核 → DesignBaseline

→ ExecutionPlan：一个 CU 对应一个顶层任务
→ 每个 CU 创建 Coding Child Session
→ 代码审核 → CodeBaseline
→ 每个 CU 创建独立 Testing Child Session
→ 测试审核 → TestBaseline
→ 系统集成与人工系统验收 → SystemAcceptanceBaseline
```

Requirement、Design、Coding、Testing 和 System Acceptance 不能越级。Agent 可以提出问题、生成候选产物和提交结构化结果，但不能自行批准 Gate 或推进生命周期。

## 核心概念

| 概念 | 含义 |
|---|---|
| Project | 软件工厂管理的项目，也是持续主会话的作用域 |
| Session | OpenCode 原生持续上下文；消息失败或阶段切换不会自动销毁 Session |
| Child Session | 每个 CU 的编码、测试或独立验证会话 |
| Skill | 安装在项目 `.opencode/skills/` 下、由 OpenCode 原生按需加载的行为能力 |
| Todo | OpenCode 会话内部的工作进度，不是 Factory 生命周期事实 |
| LifecycleStage | Factory 权威的 Requirement、Design、Coding、Testing、System Acceptance 阶段 |
| StageSubmission | Requirement/Design 候选产物的正式提交，连接持续会话与人工 Gate |
| CapabilityUnit | 用户可理解、可独立编码、测试和交付的业务能力；ExecutionPlan 中一个 CU 对应一个顶层任务 |
| ExecutionRun | 受控执行切片或确定性 Operation 的一次实际执行；不代表聊天轮次或阶段完成 |
| Gate | 操作人员对候选产物和证据作出的正式批准或退回决定 |
| Baseline | Gate 批准后形成的不可原地修改事实源 |

## 设计理念

### 会话连续，阶段受控

项目主 Session 跨 Requirement 和 Design 保持连续；CU 编码和测试使用 Child Session。会话负责上下文，Lifecycle 负责阶段，二者通过稳定标识关联但互不替代。

### 原生能力优先

Skills、Todo、消息历史、Child Session 和工具调用优先使用 OpenCode 原生机制。Factory 不在 Java、Node 或 Python 中复制 Grilling、Brainstorming、Coding、Testing 等技能正文，也不把全部技能规则拼入固定系统提示。

### 治理事实与 Agent 判断分离

Factory 严格管理 Baseline、Gate、Evidence、版本、Hash、权限和恢复；Agent 在授权工作区内保留正常的代码探索与专业判断能力。模型输出永远是候选，不是批准事实。

### 错误不等于上下文丢失

认证、网络、模型或进程错误只结束当前调用；原 Session、Todo、草稿和阶段保持可恢复。编码工作使用可识别的 Git checkpoint 或隔离工作区，禁止静默破坏性回滚。

### 一个事实只定义一次

长篇正式正文使用 Markdown；机器索引和跨模块接口使用版本化 JSON Schema 与 PostgreSQL 约束。Skill、Prompt、Rule、Agent 和 Template 均使用稳定版本与内容 Hash，其他位置引用而不重复改写规则。

## 实现思路

```text
Electron Console
    ↓ REST / SSE
Spring Boot Control Plane
    ├─ Project & Lifecycle
    ├─ Gate / Baseline / Evidence
    ├─ Planning / Orchestration / Recovery
    └─ Adapter Interfaces
          ├─ OpenCode Host Adapter
          ├─ Stage Agent Adapter
          ├─ Scaffold Template Adapter
          └─ Project Runtime Adapter
```

控制平面只通过 Factory 自有合同调用 Adapter，不依赖 OpenCode SDK 类型。OpenCode SDK 仅存在于 Node/TypeScript Host Adapter；Renderer 不直接调用 SDK，也不拥有业务状态。

## 设计与合同

- [架构文档索引](docs/v1.2/README.md)
- [机器合同说明](contracts/README.md)
- [JSON Schema](contracts/json-schema)
- [PostgreSQL 迁移](contracts/ddl)

README 只描述流程、概念和实现理念；具体状态、接口、恢复与阶段规则以架构子文档和机器合同为准。
