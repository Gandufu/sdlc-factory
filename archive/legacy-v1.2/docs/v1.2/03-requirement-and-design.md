# 需求与总体设计

## 1. Requirement 输入

初始化基线批准后，项目进入 Requirement。用户可以：

- 上传原始需求文档、图片、协议或参考资料；
- 在项目主会话中直接描述完整需求；
- 在后续对话中补充范围、约束和验收期望。

Factory 保存原始输入引用、媒体类型、内容 Hash 和提交时间。AI 生成内容不能覆盖原始输入，也不能在未说明的情况下把假设写成已确认事实。

## 2. Requirement Grilling

Requirement Agent 使用 `factory-requirement-grilling`，必要时组合 Brainstorming 方法：

1. 先从现有输入提取事实，不重复询问已知信息；
2. 建立需求地图：目标、边界、角色、业务对象、规则、场景、非功能约束和外部依赖；
3. 只询问会改变范围、可观察验收、公共接口、数据或错误语义的阻塞决策；
4. 每轮优先提出一个关键问题并给出推荐答案；
5. 大需求先形成 Feature Map，再识别 CapabilityCandidate；
6. 信息不足时继续同一 Session，不创建 ExecutionRun 或 Gate；
7. 共享理解稳定后生成候选 SRS，不自动批准。

Todo 由 OpenCode 原生维护，用于展示分析、澄清和文档生成进度。

## 3. 需求规格说明书

默认正式路径：

```text
docs/requirements/software-requirements-specification.md
```

固定结构：

1. 项目目标与系统边界；
2. 利益相关者、角色与权限；
3. 功能组成与跨功能业务场景；
4. 业务对象、业务规则与数据需求；
5. 稳定 RequirementItem 与验收条件；
6. CapabilityCandidate 及初步关系；
7. 内部、跨系统与外部接口需求；
8. 性能、可靠性、安全和其他非功能要求；
9. 运行、测试环境与验证方法；
10. 需求追溯、假设和开放问题。

每个 RequirementItem 和验收条件使用稳定 ID；验证方法只能是 `INSPECTION | ANALYSIS | DEMONSTRATION | TEST`。

## 4. Requirement 审核

候选 SRS 完成后创建 `StageSubmission(REQUIREMENT)`。界面在会话中展示候选、来源、Skill/Model 绑定和开放问题，并提供正式命令：

- 批准需求：生成 ReviewRecord 和 RequirementBaseline；
- 退回修订：Submission 进入 `CHANGES_REQUESTED`，原 Session 继续 Grilling；
- 暂不处理：保持 `WAITING_FOR_HUMAN`。

Agent 可以调用提问工具确认用户意图，但聊天回复“通过”本身不能生成 Baseline。

## 5. Design Grilling

RequirementBaseline 批准后，在同一个项目主 Session 中切换到 Design Agent 和 `factory-design-grilling`。Design 只能把已批准 RequirementBaseline 作为需求权威源。

设计澄清至少覆盖：

- 系统和技术架构；
- 全局数据模型与数据归属；
- 外部接口、CU 间接口与兼容策略；
- 跨 CU 流程、事务、并发和错误处理；
- 安全、权限、部署与环境约束；
- ValidationContract 的行为断言、验证方法和 Evidence；
- 正式 CU、依赖、独立编码和独立测试边界。

信息不足时在同一 Session 继续澄清，不创建新的项目主 Session。

## 6. 设计产物与审核

默认总体设计路径：

```text
docs/design/software-design-description.md
```

Design Submission 至少包含：

- 总体设计文档；
- Capability Map；
- ValidationContract；
- 每个 CU 的 DesignSliceManifest；
- 接口、环境与依赖引用。

人工审核同时覆盖总体设计、正式 CU、依赖和验证覆盖。批准后形成 DesignBaseline 并冻结 ValidationContract；随后才能生成 ExecutionPlan。退回后在原主 Session 中继续修订，并生成新的 StageSubmission。
