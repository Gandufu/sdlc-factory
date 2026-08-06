# 领域与生命周期

## 1. 交付作用域

Project（项目）是 Requirement 和 Design 的作用域；CapabilityUnit（能力单元，CU）是 Coding、Testing 和独立交付的作用域。CSCI 管理配置、版本、部署和验证对象，不能替代 CU。

```text
PROJECT + REQUIREMENT
PROJECT + DESIGN
CAPABILITY_UNIT + CODING
CAPABILITY_UNIT + TESTING
PROJECT + SYSTEM_ACCEPTANCE
```

需求阶段识别 CapabilityCandidate，设计阶段根据业务内聚、数据归属、接口、事务、依赖和独立验证能力确认正式 CU。页面、按钮、单接口、单表和 CRUD 动作不能单独成为 CU。

## 2. 生命周期主线

```text
Initialization Draft
→ Initialization Approved / InitializationBaseline
→ Requirement Active
→ Requirement AwaitingReview / StageSubmission
→ Requirement Approved / RequirementBaseline
→ Design Active
→ Design AwaitingReview / StageSubmission
→ Design Approved / DesignBaseline
→ Planning / ExecutionPlan
→ CU Coding / CodeBaseline
→ CU Testing / TestBaseline
→ CU Delivered
→ System Integration
→ SystemAcceptanceBaseline
```

每个阶段只允许以下领域结果：

- `ACTIVE`：当前阶段可继续工作；
- `WAITING_FOR_HUMAN`：候选已提交，等待正式命令；
- `ON_HOLD`：外部条件不足，保留上下文；
- `NEEDS_INTERVENTION`：自动恢复停止，需要操作人员选择；
- `APPROVED`：Gate 已批准并形成 Baseline。

聊天文本、模型自评、前端本地状态和 SSE 事件都不是状态迁移命令。

## 3. StageSubmission、Gate 与 Baseline

Requirement/Design 完成候选后先创建 StageSubmission。Submission 固定：

- 产物引用与内容 Hash；
- 来源 Factory/OpenCode Session 与消息位置；
- Agent、Skill 和 Model 版本；
- 被替代的旧 Submission；
- `READY_FOR_REVIEW | APPROVED | CHANGES_REQUESTED | SUPERSEDED` 状态。

Gate 只能审核明确的 Submission 或 CU 执行候选。批准生成 ReviewRecord 和 Baseline；退回保留旧 Submission，并在原 Session 中继续修订。Baseline 不可原地修改，上游变化通过新版本和影响分析处理。

## 4. ExecutionPlan、ExecutionRun 与 Operation

ExecutionPlan 从 DesignBaseline 派生，是 CU 依赖、优先级、就绪和调度的可重建投影。一个 CU 是一个顶层任务；Agent 可在自己的 Child Session 中使用原生 Todo 继续拆解内部步骤。

ExecutionRun 仅表示以下对象的一次实际执行：

- Coding/Testing 的内部 ExecutionSlice；
- System Integration；
- compile、build、test、start、readiness、stop 等确定性 Operation。

ExecutionRun 负责固定输入 Baseline、Git revision、Agent/Skill/Model、权限、预算、Diff、Evidence 和错误。它不表示一条消息、一次 Grilling 问答、完整 Session 或阶段完成。

## 5. 权威边界

| 事实 | 权威拥有者 |
|---|---|
| 消息、Todo、Child Session、Skill 加载 | OpenCode |
| Project、CU、LifecycleStage | Spring Boot Control Plane |
| StageSubmission、Gate、ReviewRecord、Baseline | Spring Boot Control Plane |
| 命令、进程、退出码、测试结果 | Project Runner |
| Agent 运行事件 | Host Adapter 采集，控制平面持久化 |
| UI 状态 | 只读 Projection，不是第二事实源 |
