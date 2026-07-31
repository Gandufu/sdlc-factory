# SDLC Factory

SDLC Factory 是一个由 Core 统一编排项目能力并记录软件交付状态的本地 SDLC 上下文。Framework Pack 隐藏技术栈差异，Agent 生成内容，Operator 作出需求发布和人工审核决定。

## Language

**Project**:
由同一 Project Profile 描述、由同一 Core 管理的交付范围。
_Avoid_: repository, workspace

**Project Profile**:
Project 的模块组成，以及项目级动作到模块能力的路由约定。
_Avoid_: framework config, command list

**Project Module**:
Project 内可独立绑定 Framework Pack 的运行或构建部分，例如前端、后端或桌面端。
_Avoid_: service, component

**Framework Pack**:
实现标准 Capability、把框架细节转换为 Execution Plan 的适配包。
_Avoid_: template command, lifecycle plugin

**Capability**:
Core 可调用的、与具体框架无关的标准能力。
_Avoid_: shell command, framework action

**Project Action**:
Core 面向 Agent、Skill 或 Operator 提供的项目级意图，由一个或多个 Capability 组合完成。
_Avoid_: raw capability, script

**WorkItem**:
一项具有独立需求、实现和人工审核状态的交付增量。
_Avoid_: Task, Change, prompt

**Requirement Version**:
WorkItem 当前需求内容的版本；发布后的版本不可原地修改。
_Avoid_: draft text, conversation

**Source Revision**:
Core 为一组确定源码内容生成的稳定身份，用于绑定实现、审核和测试。
_Avoid_: timestamp, branch name

**Review Decision**:
Operator 对某个 Requirement Version 和 Source Revision 作出的人工决定。
_Avoid_: reviewed flag, Agent confirmation

**Verification Subject**:
TestBatch 中被冻结的 WorkItem、Requirement Version、Source Revision 和 Review Decision 组合。
_Avoid_: requirement ID only, latest code

**TestBatch**:
对一个或多个 Verification Subject 进行统一验证的批次。
_Avoid_: WorkItem test stage, release

**Operation**:
Core 对一次项目动作的可查询运行记录。
_Avoid_: session, workflow stage

**Evidence**:
支撑执行、测试或人工决定结论的不可变制品引用。
_Avoid_: Agent claim, conversation history

**Operator**:
通过独立入口发布需求或作出人工审核决定的人。
_Avoid_: Agent, model
