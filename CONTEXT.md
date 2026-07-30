# SDLC Factory

SDLC Factory 描述一个由 Core 裁决、由 Agent 生成内容、由 Operator 作可信决定的可恢复软件交付上下文。本词汇表只定义领域语言；实现和协议合同位于 `docs/v1.0`。

## Language

**Project**:
一个受同一 Project Profile、ProjectFacts 和本地 Core Supervisor 管理的软件交付边界。
_Avoid_: repository, workspace

**ProjectFacts**:
已完成 Task 形成的当前有效需求、架构、接口和验证事实。
_Avoid_: Baseline snapshot, project memory

**Task**:
一次具有独立批准与交付结果的业务增量。M0 不承诺自动撤销普通工作区修改。
_Avoid_: Change, session, prompt

**Execution Slice**:
Task 内按 Requirement/AC 划分、可以独立恢复和交接的纵向结果。
_Avoid_: phase, frontend slice, backend slice

**Attempt**:
某个 Execution Slice 在一个执行阶段内、受预算约束的一次尝试。
_Avoid_: retry loop, session

**Operation**:
可跨 Host 连接持续存在，并具有租约、心跳、取消和恢复语义的长运行工作。
_Avoid_: request, tool call

**GateRun**:
某个 Gate 在精确输入版本下的一次确定性验证记录。
_Avoid_: test claim, completion statement

**Evidence**:
支撑 Gate、审批或 Delivery 结论的不可变制品及其完整性引用。
_Avoid_: log text in JSON, Agent claim

**Suspension**:
覆盖当前业务阶段的阻塞记录，包含恢复阶段、所需决定和支撑证据。
_Avoid_: Blocked stage, pause flag

**FactChangeSet**:
Proposal 对 ProjectFacts 提出的有限、确定性文件操作集合。
_Avoid_: arbitrary patch, transcript

**Revision Vector**:
Approval、Gate 和 Delivery 所依赖的全部版本身份集合。
_Avoid_: Git commit only, timestamp

**Operator Receipt**:
Operator 控制动作对 subject、revision 和本地身份元数据的不可变绑定记录。
_Avoid_: Agent confirmation, chat approval

**ContextBundle**:
Core 针对当前动作和 Revision Vector 编译的最小临时上下文视图。
_Avoid_: transcript, new source of truth

**DeliveryManifest**:
Finalized 时对源码状态、事实变更、Gate 和审批证据的不可变索引。
_Avoid_: release, deployment record

**Delivery**:
将已批准 Task 的源码状态与事实变更固化为 DeliveryManifest 和 source bundle；不等同于部署、发布或 Git push。
_Avoid_: release, deployment, automatic push

**Framework Pack**:
将项目技术栈能力编译为声明式 ExecutionPlan 的版本化能力包。
_Avoid_: lifecycle plugin, command template

**Session**:
Agent 或 Operator 与 Adapter 的一次临时连接；Session 终止不改变 Task、Operation 或 Evidence 的所有权。
_Avoid_: attempt, durable workflow
