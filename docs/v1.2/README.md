# SDLC Factory v1.2 架构基线

状态：实施合同修订版
日期：2026-08-06

本目录与 `contracts/` 共同构成唯一权威设计源：Markdown 解释领域意图和模块职责，JSON Schema 与 PostgreSQL DDL 固定机器边界。历史评审稿、原型和运行截图不能覆盖这里的定义。

## 当前实施状态

持续 Session、原生 Skill 和 StageSubmission 已冻结机器合同，但现有桌面工作区仍包含早期 Host Acceptance 纵向验收实现。该实现中的“每条消息创建 Run”、固定 `CODER`、固定 `SYSTEM_ACCEPTANCE` Gate 和临时 OpenCode Session 都不是本架构的生产行为，后续必须按本目录重新实现。

## 文档结构

1. [领域与生命周期](01-domain-and-lifecycle.md)：项目、阶段、Gate、Baseline、CU 与 ExecutionRun。
2. [持续会话与原生 Skills](02-continuous-sessions-and-native-skills.md)：Factory/OpenCode Session、Todo、Child Session、Skill 安装和上下文职责。
3. [需求与总体设计](03-requirement-and-design.md)：原始需求、Grilling、SRS、总体设计、正式 CU、StageSubmission 和人工审核。
4. [CU 规划、编码与测试](04-cu-planning-coding-and-testing.md)：一个 CU 一个任务、ExecutionPlan、Coding/Testing Child Agent 和系统验收。
5. [恢复、治理与机器合同](05-recovery-governance-and-contracts.md)：错误分类、工作区恢复、不可变事实、观测层级和合同映射。

## 阅读顺序

实现 Requirement/Design 工作区时依次阅读 1、2、3、5；实现 CU 执行时依次阅读 1、2、4、5。任何实现不得只根据 UI 原型或单个 Schema 推断完整生命周期。

## 最高优先级不变量

- 初始化批准后才能进入 Requirement。
- Requirement 和 Design 使用项目持续主 Session；消息不是 ExecutionRun，也不自动创建 Gate。
- RequirementBaseline 批准后才能进入 Design；DesignBaseline 批准后才能生成 ExecutionPlan。
- 一个 CU 对应 ExecutionPlan 中一个顶层任务；Coding 与 Testing 使用不同 Child Session。
- OpenCode 原生管理 Session、Skills、Todo 和工具；Factory 管理 Lifecycle、StageSubmission、Gate、Baseline、Evidence 和恢复。
- Requirement/Design 候选通过 StageSubmission 进入人工审核，不能借用 Handoff 或 SYSTEM_ACCEPTANCE Gate。
- ExecutionRun 只表示受控执行切片或确定性 Operation，不表示聊天轮次或阶段完成。
- Agent、Hook、Observer、Plugin 和 SSE 都不能自行推进生命周期。
