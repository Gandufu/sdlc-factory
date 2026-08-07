# 标准 SRS 与 SDD 生成规范调研

> 日期：2026-08-07
>
> 状态：研究结论，已转化为 [DESIGN-02《MVP0 `/sdlc-spec` 最终设计》](../design/02-mvp0-sdlc-spec-design.md)
>
> 范围：需求分析、软件需求规格说明书（SRS）、软件设计说明（SDD/SwDD）、CapabilityUnit（CU）、ExecutionPlan 与 OpenCode Todo 的关系

## 1. 结论摘要

MVP0 不应直接照搬一套军用文档目录，也不应只依赖一段“大模型提示词”。推荐采用以下组合：

1. 用 CSCI/DID 的思想保证 SRS、SDD 对一个受控软件项的覆盖完整性；
2. 用 ISO/IEC/IEEE 29148 的需求工程思想约束需求质量、信息项和生命周期；
3. 用 ISO/IEC/IEEE 42010 的架构描述思想组织设计关注点、视角、模型和设计理由；
4. 用 NASA Software Engineering Handbook 的公开清单形成可落地的 SRS、SDD 最小内容和追溯质量门；
5. 用敏捷方法管理增量和变更，但不使用 Product Backlog、User Story 或 Todo 取代正式 SRS、SDD；
6. 借鉴 Claude Game Studio 的引导体验：识别当前阶段、每轮只追问一个关键问题、给出一个建议动作和一个 Todo，但绝不自动执行下一阶段。

最终应形成一条可审计链路：

```text
原始来源
  -> 证据台账与范围澄清
  -> SRS 草案
  -> RequirementCandidate
  -> 人工批准后的 RequirementBaseline
  -> SDD 草案与正式 CU
  -> DesignCandidate
  -> 人工批准后的 DesignBaseline
  -> ExecutionPlan
  -> OpenCode Todo 会话投影
  -> 编码、测试和验收证据
```

核心判断是：**CSCI 不等于 CU，Feature 也不等于 CU。** 标准能够规范文档覆盖、需求质量、设计内容和追溯，但不能替项目自动决定 CU 粒度。Factory 必须给出自己的层级语义、拆分规则和机器校验器。

## 2. 权威来源与适用方式

| 来源 | 当前状态与主要作用 | 本项目采用方式 |
| --- | --- | --- |
| [MIL-STD-498](https://quicksearch.dla.mil/qsDocDetails.aspx?ident_number=114847) | 已于 1998 年取消，由 IEEE/EIA 12207 系列替代 | 只作为 CSCI、生命周期数据项和完整文档集的历史来源，不作为当前合规声明 |
| [DI-IPSC-81433 Software Requirements Specification](https://quicksearch.dla.mil/qsDocDetails.aspx?ident_number=205912) | DLA ASSIST 当前列为 Active；SRS 说明 CSCI 的需求以及确认每项需求已满足的方法，外部接口可在 SRS 中描述或引用 IRS | 用作 SRS 覆盖范围和“每项需求都必须有鉴定方法”的直接参考 |
| [DI-IPSC-81435 Software Design Description](https://quicksearch.dla.mil/qsDocDetails.aspx?ident_number=205915) | DLA ASSIST 当前列为 Active；SDD 覆盖 CSCI 级设计决策、架构设计和足以实现的软件详细设计，并可引用 IDD/DBDD | 用作 SDD 的主骨架和双向追溯要求 |
| [ISO/IEC/IEEE 29148:2018](https://www.iso.org/standard/72089.html) | 2024 年确认仍有效，2026 年进入修订流程；规定需求工程过程、信息项、内容和格式指导，且与具体方法论无关 | 用作需求获取、分析、表达、验证、确认、基线和变更管理的质量框架；不复制受版权保护的标准正文 |
| [ISO/IEC/IEEE 12207:2026](https://www.iso.org/standard/90219.html) | 当前软件生命周期过程标准；覆盖构想、开发、运行、支持和退役，可迭代、递归、增量应用，也适用于 Agile | 用作端到端生命周期框架，不把它误当成 SRS 模板 |
| [ISO/IEC/IEEE 42010:2022](https://www.iso.org/standard/74393.html) | 当前架构描述标准；区分架构本身和表达架构的 Architecture Description，并围绕关注点、视角和模型组织描述 | 用作 SDD 的架构描述方法，避免只有一张组件图或只有技术选型 |
| [NASA SRS 最小内容指南](https://swehb.nasa.gov/display/SWEHBVD/5.09%2B-%2BSRS%2B-%2BSoftware%2BRequirements%2BSpecification) | 公开工程指南；覆盖功能、状态/模式、接口、数据、安全、性能、环境、资源、质量、约束、鉴定方法、双向追溯和分阶段交付 | 用作 SRS 模板与检查表的可公开实施依据 |
| [NASA Software Requirements](https://swehb.nasa.gov/spaces/SWEHBVD/pages/102695421/SWE-050%2B-%2BSoftware%2BRequirements) | 强调需求应分解、唯一标识、原子、清晰、可度量、可验证，并追溯到父需求 | 用作 RequirementItem 质量门 |
| [NASA Software Design Description](https://swehb.nasa.gov/spaces/SWEHBVD/pages/102695674/5.13%2B-%2BSwDD%2B-%2BSoftware%2BDesign%2BDescription) | 公开 SDD 指南；覆盖 CSCI 级权衡、架构、组件分解、数据/控制/时序、接口、硬件资源和需求—设计—代码追溯 | 用作 SDD 内容和“设计必须足以编码测试”的检查表 |
| [Scrum Guide 2020](https://scrumguides.org/scrum-guide.html) | 当前官方 Scrum Guide；规定 Product Goal、Product Backlog、Increment 和 Definition of Done，但不规定 SRS、CSCI、CU 或 User Story 格式 | 只用于增量规划、排序、反馈和演化，不替代工程规格 |

### 2.1 对 CSCI 理念的正确使用

CSCI 是被指定进行配置管理的软件项，是交付、版本、变更和验证的受控边界。一个系统可以包含一个或多个 CSCI；是否拆成多个 CSCI 是配置管理和系统工程决策。

Factory 的 CU 是项目内部为总体设计、编码、测试、审查和计划建立的能力级生命周期单元。它不是标准术语，也不能直接声明为 CSCI。

MVP0 可采用以下默认策略，但必须记录为项目决策：

- 一个目标项目默认管理一个软件项/CSCI；
- 一个 CSCI 包含多个能力候选，设计批准后形成多个 CU；
- 只有当软件存在独立配置控制、独立版本/交付、独立合格性验证等真实边界时，才讨论拆成多个 CSCI；
- 不因存在 Electron Renderer、Main Process、HTTPS Client 或测试工程就创建多个 CSCI 或 CU。

## 3. Factory 的统一概念模型

### 3.1 固定层级

```text
System / Product
└── Software Item / CSCI
    ├── CapabilityCandidate（需求阶段）
    │   ├── Feature
    │   │   ├── RequirementItem
    │   │   └── RequirementItem
    │   └── Feature
    └── CapabilityCandidate

RequirementBaseline + 总体设计
    -> CapabilityCandidate 被确认、拆分或合并为 CapabilityUnit

CapabilityUnit
    -> 由一个或多个 Software Unit / Component 实现
    -> 在 ExecutionPlan 中按依赖排序
    -> 在当前 OpenCode 会话中投影为 Todo
```

### 3.2 术语定义

| 概念 | 定义 | 不是什么 |
| --- | --- | --- |
| System / Product | 用户提出的完整产品目标、运行环境和业务边界 | 不是本轮要先完成的一个页面 |
| Software Item / CSCI | 受配置管理的软件交付项 | 不是任意模块或技术进程 |
| CapabilityCandidate | SRS 中按稳定业务能力组织的候选边界，等待设计验证 | 不是已批准 CU，也不是实现任务 |
| Feature | 一个 CapabilityCandidate 内用户可辨识的最小子功能 | 不是默认可独立排期的 CU |
| RequirementItem | 一条原子、规范、可验证、有稳定 ID 的需求 | 不是主题、章节、故事标题或 Todo |
| CapabilityUnit | 设计阶段确认的能力级生命周期单元，可独立设计、编码、测试、审查和形成证据 | 不是纯技术层、单个页面、测试用例或任意可拆任务 |
| Software Unit / Component | 实现 CU 的进程、模块、服务、类库或其他设计单元 | 不是天然的 CU |
| ExecutionPlan | DesignBaseline 之后形成的 CU 顺序、依赖、验证义务和状态的项目事实 | 不是聊天 Todo 文本 |
| OpenCode Todo | 当前会话对下一建议动作或当前计划项的可见投影 | 不是项目基线，不可自动改变 ExecutionPlan |

### 3.3 层级基数与归属规则

1. 每个 Feature 必须且只能有一个主 CapabilityCandidate；
2. 每条功能 RequirementItem 必须且只能有一个主 Feature；
3. 一条 RequirementItem 可以追溯到其他能力或全局约束，但附加追溯不得改变其主归属；
4. 非功能需求可以作用于整个 CSCI、一个 CU 候选或指定 RequirementItem，作用域必须显式；
5. 一个 CapabilityCandidate 只有在 DesignBaseline 中才能成为 CU；设计可以保留、拆分或合并候选，但必须记录理由并保持需求追溯；
6. Software Unit 与 CU 不是一一对应：一个 CU 可跨多个组件，一个组件也可能支持多个 CU；
7. ExecutionPlan 只排列正式 CU，不排列 Feature、RequirementItem、组件或临时开发任务。

## 4. 如何判断 CU 与 Feature

“可以独立编码、测试”只能证明一个对象可拆成任务，不能单独证明它是 CU。否则任何按钮、接口或测试用例都可能被错误拆成 CU。

### 4.1 同层级判定

候选 CU 应同时从以下方面进行判断：

- 具有独立且稳定的业务/用户能力目标；
- 对外有可描述的输入、输出、状态、错误语义和验收结果；
- 有相对内聚的业务规则、数据责任或外部契约；
- 可以在其他同级能力旁被单独设计、批准、实现、测试和维护；
- 拆分后仍是有意义的交付能力，而不只是页面、技术层或实现步骤；
- 与其他 CU 处于相近的语义粒度。

若只是同一能力中的一个页面、一个配置分区或一组字段，默认归为 Feature。若是否拆分会显著影响边界、数据、接口或交付，Skill 必须展示两个候选层级并询问用户，不能静默采用模型偏好。

### 4.2 已确认语义的示例

```text
软件项/CSCI：会议终端客户端（完整产品，不能缩成当前垂直切片）
├── 能力候选：系统设置
│   ├── Feature：系统信息
│   ├── Feature：网络设置
│   ├── Feature：声音设置
│   └── Feature：其他设置子功能
├── 能力候选：授权
└── 能力候选：设备认证
```

这里“系统信息”是“系统设置”中的 Feature，不应仅因它有独立页面和测试就提升为同级 CU；“授权”和“设备认证”具有独立的安全目标、状态和失败语义，因此应作为与“系统设置”同级的候选能力。设计阶段仍需依据批准的需求和实际接口完成正式化。

## 5. 标准 SRS 结构

推荐文件：`docs/requirements/software-requirements-specification.md`。

### 5.1 文档目录

1. **文档控制**
   - 文档 ID、版本、状态、适用软件项、Candidate/Baseline 信息；
   - 修订历史、批准记录；
   - 来源清单和读取状态。
2. **引言**
   - 目的、范围、读者；
   - 术语、缩略语、引用文件。
3. **系统与软件项概述**
   - 完整产品目标与价值；
   - System of Interest、软件项/CSCI 边界；
   - 角色、利益相关者、运行环境；
   - 假设、依赖、约束和明确排除项。
4. **运行概念**
   - 正常、异常和降级场景；
   - 状态、模式和关键状态转换；
   - 跨能力端到端流程。
5. **能力与功能分解**
   - Capability Map；
   - CapabilityCandidate 目录；
   - 每个候选的目标、边界、包含的 Feature、同级依赖；
   - 跨候选场景，不把跨能力流程伪装成新 CU。
6. **详细功能需求**
   - 按 CapabilityCandidate → Feature → RequirementItem 组织；
   - 正常行为、边界条件、失败和恢复；
   - 状态/模式适用性；
   - 每项需求的鉴定方法。
7. **外部接口需求**
   - 用户、硬件、软件、通信接口；
   - 协议、数据、顺序、超时和错误语义；
   - 详细接口需求可引用独立 IRS。
8. **数据需求**
   - 业务对象、数据字段、约束、生命周期、保留和一致性；
   - 数据字典或其引用。
9. **非功能与质量需求**
   - 性能与时序；
   - 可用性、可靠性、恢复；
   - 安全、隐私与凭据；
   - 易用性、可访问性；
   - 可维护性、可测试性、兼容性和可移植性；
   - 每项均须有明确作用域和可测阈值，未知阈值不得伪造。
10. **环境、资源与约束**
    - 硬件、软件、通信和部署环境；
    - 技术、法规、安装适配、人员或运维约束。
11. **鉴定与验收**
    - `INSPECTION | ANALYSIS | DEMONSTRATION | TEST`；
    - 验收环境、前置条件和证据类型；
    - 分阶段交付/MVP 只作为完整产品范围的交付分区，不能替代完整范围。
12. **双向追溯矩阵**
    - 来源 → RequirementItem；
    - RequirementItem → CapabilityCandidate/Feature；
    - RequirementItem → 鉴定方法与验收断言；
    - 设计形成后再追加 RequirementItem → CU/Software Unit，不在需求阶段伪造设计事实。
13. **假设、未知、未决项与风险**
    - 与已确认需求分表记录；
    - 明确负责人、影响和解除条件。
14. **附录**
    - 术语表、数据字典、来源索引、接口引用。

### 5.2 RequirementItem 固定结构

```yaml
id: REQ-<能力缩写>-<序号>
parentCapability: CAP-...
parentFeature: FEAT-...
statement: 系统必须……
sourceRefs: [SRC-...]
rationale: 为什么需要该行为
priorityOrCriticality: 必要时记录，未知则明确 UNKNOWN
applicableStateOrMode: 适用状态/模式
preconditions: 可观察前置条件
inputs: 输入及有效范围
requiredBehavior: 单一规范行为
outputsOrPostconditions: 可观察结果
failureAndRecovery: 失败、提示、恢复和降级
qualificationMethod: INSPECTION | ANALYSIS | DEMONSTRATION | TEST
acceptanceRefs: [VAL-...]
status: CONFIRMED | ASSUMPTION | OPEN | UNKNOWN
```

规范句必须表达“系统必须做什么”，而不是提前规定“使用哪个类、框架或函数实现”。确有外部约束的技术选型可以作为设计约束需求，并附来源和理由。

### 5.3 SRS 质量门

SRS Candidate 创建前至少通过以下检查：

- 完整产品目标与本轮 MVP/垂直切片明确分离；
- System/CSCI 边界明确；
- Capability Map 先于详细 RequirementItem；
- 同级 CapabilityCandidate 粒度一致；
- 无孤儿 Feature、孤儿 RequirementItem 和重复 ID；
- 每条确认需求有来源或直接用户决策；
- 每条 RequirementItem 原子、清晰、必要、一致、可实现、可验证；
- 每条需求有明确作用域、鉴定方法和可观察结果；
- 正常、边界、异常、恢复、状态/模式均有覆盖；
- 未知、假设和开放问题未混入已确认需求；
- 来源到需求、需求到验证的双向追溯完整；
- 文档没有包含未经证据支持的实现设计。

## 6. 标准 SDD 结构

推荐文件：`docs/design/software-design-description.md`。`overall-design.md` 可作为兼容别名，但项目只保留一个权威设计源。

### 6.1 硬入口

SDD 只能以已批准且哈希匹配的 RequirementBaseline 为输入。RequirementCandidate、聊天结论、Todo 或用户要求“直接做”都不能替代基线。设计必须保留 SRS 中的未知，不能静默补齐。

### 6.2 文档目录

1. **文档控制与适用范围**
   - 文档 ID、版本、状态、软件项/CSCI、RequirementBaseline 引用；
   - 术语、引用和设计资料来源。
2. **架构驱动因素**
   - 利益相关者及其关注点；
   - 关键功能、质量属性、约束、风险和运行场景；
   - 设计需要回答的问题。
3. **CSCI 级设计决策与权衡**
   - 候选方案、选定方案、理由和被放弃方案；
   - 假设、限制、风险、触发重新评估的条件；
   - ADR 引用。
4. **系统上下文与外部边界**
   - 外部参与者、设备、系统、协议和信任边界；
   - 输入、输出、错误、超时和责任边界。
5. **架构描述视角**
   - 逻辑/模块视角；
   - 运行时、进程、并发和控制流视角；
   - 数据、状态和持久化视角；
   - 部署、环境和资源视角；
   - 安全、凭据和信任视角；
   - 验证与架构符合性视角。
6. **CapabilityUnit 设计目录**
   - 正式 CU 的 ID、名称、目标、边界和依赖；
   - 承接的 CapabilityCandidate、Feature 和 RequirementItem；
   - 输入/输出、状态、错误、数据责任、接口、验证义务；
   - 目标产品路径和测试路径；
   - 候选被保留、拆分或合并的设计理由。
7. **软件单元/组件设计**
   - 组件职责、提供/依赖接口；
   - 静态关系和运行时协作；
   - 软件单元与 CU、RequirementItem 的多对多映射。
8. **详细设计**
   - 算法、数据结构、状态机、控制流、数据流、时序；
   - 边界、错误处理、重试、幂等、恢复和降级；
   - 详细程度达到可以编码、编译和测试，但不粘贴未来实现代码。
9. **接口设计**
   - API、IPC、协议消息、数据结构、顺序、超时、版本和错误码；
   - 复杂接口可引用独立 IDD。
10. **数据与存储设计**
    - 模型、所有权、一致性、迁移、保留、缓存和敏感数据处理；
    - 复杂数据库可引用独立 DBDD/数据字典。
11. **质量属性实现**
    - 性能、可用性、可靠性、安全、隐私、可维护性、可测试性；
    - 每项关联 SRS 需求和验证方法。
12. **构建、部署、资源与适配**
    - 运行拓扑、外部依赖、硬件/软件资源和环境适配；
    - 不把本地开发便利条件写成真实验收事实。
13. **验证架构与符合性**
    - 单元、集成、端到端、真实环境验证边界；
    - 如何检查实现符合架构决策；
    - 证据位置和失败处理。
14. **双向追溯矩阵**
    - RequirementItem ↔ CU；
    - RequirementItem ↔ Software Unit；
    - RequirementItem/CU ↔ 验证义务；
    - 所有需求必须被覆盖或明确标记 `BLOCKED`，不可静默遗漏。
15. **风险、未知和开放设计决策**
    - 影响、所有者、解除条件和下一审查点。
16. **ExecutionPlan 就绪性**
    - 仅说明 CU 是否具备排期条件；
    - 不把草案 Todo 或未批准顺序写成 ExecutionPlan。

### 6.3 每个 CU 的固定设计记录

```yaml
cuId: cu-...
cuName: 用户可读且唯一的能力名称
objective: 独立业务/用户能力目标
inScope: 包含的能力和行为
outOfScope: 与同级 CU 的边界
candidateRefs: [CAP-...]
featureRefs: [FEAT-...]
requirementRefs: [REQ-...]
dependenciesById: [cu-...]
inputsAndOutputs: 可观察输入输出
stateAndFailureSemantics: 状态、失败、恢复、降级
dataOwnership: 所有权和共享规则
interfaces: 提供和依赖接口
softwareUnits: 计划实现该 CU 的设计单元
productPaths: 目标实现路径
testPaths: 目标测试路径
verificationObligations: [VAL-...]
blockingUnknowns: []
acceptanceEvidence: 期望证据类型和位置
```

用户执行命令使用 `cuName`；内部 ID 只用于持久化关系、依赖和追溯。

### 6.4 SDD 质量门

- 输入 RequirementBaseline 存在且哈希匹配；
- 所有设计决策可追溯到需求、约束或明确理由；
- 所有 RequirementItem 被 CU/Software Unit 覆盖或显式 `BLOCKED`；
- CapabilityCandidate 到 CU 的保留、拆分、合并均有理由；
- CU 同层级且不是页面列表、技术层列表或任务列表；
- 组件职责、接口、数据所有权、信任边界和失败语义无冲突；
- 架构包含静态、运行时、数据、部署、安全和验证所需视角；
- 关键方案有权衡、风险和放弃理由；
- 详细设计足以编码和测试；
- 需求—设计—验证双向追溯闭合；
- 未决设计问题没有伪装成确定事实；
- 只有人工审查动作可以创建 DesignBaseline。

## 7. 面向 OpenCode 的生成流程

单一长提示词无法稳定完成证据提取、层级分类、规范写作、设计分解和质量检查。推荐把 `/sdlc-spec` 与 `/sdlc-design` 设计成受 Plugin 约束的多步 Skill。

### 7.1 `/sdlc-spec`：SRS 生成顺序

1. 调用 `sdlc_status`，读取登记来源和现有文档；
2. 建立证据台账，将陈述分类为 `SOURCED_FACT | USER_DECISION | ASSUMPTION | OPEN | UNKNOWN`；
3. 先确认完整产品目标、System of Interest、CSCI 边界和明确排除项；
4. 生成 Capability Map 草案，不写详细实现；
5. 对每个候选进行同层级检查，展示父子树；
6. 在层级稳定后生成 Feature 和原子 RequirementItem；
7. 补齐状态、异常、接口、数据、非功能和鉴定方法；
8. 运行确定性 SRS Lint；
9. 若存在会改变范围、公共行为、数据、错误语义或验收的未知，每轮只问一个最关键问题并停止；
10. 质量门通过后创建 RequirementCandidate，等待人工审查。

### 7.2 `/sdlc-design`：SDD 生成顺序

1. 调用 `sdlc_status` 并验证 RequirementBaseline 和哈希；
2. 读取批准的 SRS、目标脚手架事实和已登记技术来源；
3. 提取架构驱动因素、关注点、约束和验证义务；
4. 形成上下文、运行时、数据、部署、安全和验证视角；
5. 将 CapabilityCandidate 正式化为 CU，必要时提出拆分/合并候选并询问用户；
6. 定义组件、接口、数据所有权、状态和失败语义；
7. 建立 RequirementItem ↔ CU ↔ Software Unit ↔ 验证追溯；
8. 运行确定性 SDD Lint；
9. 质量门通过后创建 DesignCandidate，等待人工审查；
10. 仅在 DesignBaseline 已存在时，保存 ExecutionPlan。

### 7.3 Claude Game Studio 式引导外壳

每轮交互固定显示：

- `Confirmed`：有来源或用户决策支持的事实；
- `Unknown`：不得猜测的缺失证据；
- `Current question`：最多一个会改变结果的关键问题；
- `Draft hierarchy`：当问题涉及功能边界时显示当前父子树；
- `RecommendedAction`：一个建议动作；
- `Todo`：一个可见但不自动执行的 Todo；
- `Command`：一条完整 `/sdlc-*` 命令。

Todo 必须是建议和会话投影，不能触发命令，不能作为批准事实，也不能被解析为 ExecutionPlan。

## 8. 提示词必须包含的约束

下面内容应进入 Skill 的强约束，而不是依赖模型自行领会：

```text
你正在生成完整软件项的正式工程文档，不得把当前示例、页面或 MVP 切片缩写为产品总需求。

先完成 System/CSCI -> CapabilityCandidate -> Feature 的功能分解，再编写 RequirementItem。
每个 Feature 必须有且只有一个主 CapabilityCandidate；每条功能 RequirementItem 必须有且只有一个主 Feature。

CU 是设计阶段的能力级生命周期单元。可独立编码或测试不是拆成 CU 的充分条件。
页面、菜单、技术进程、类库、接口客户端、测试工程和实施任务默认不是 CU。

当两个候选粒度不一致，或拆分/合并会改变业务边界、数据所有权、接口、失败语义或交付时：
1. 展示两个候选树；
2. 给出推荐及理由；
3. 只询问这一项；
4. 未获确认前记录为 OPEN，不得替用户决定。

RequirementItem 必须原子、规范、可观察、可验证，包含稳定 ID、来源、父级、鉴定方法和验收引用。
未知事实必须记录为 UNKNOWN 或 OPEN，不得采用“行业默认”补齐。

设计只能从哈希匹配的 RequirementBaseline 开始。
所有 RequirementItem 必须映射到 CU、设计单元和验证义务，或明确 BLOCKED。

推荐动作、Todo 和命令只用于引导。不得自动执行下一阶段；Todo 不得创建、修改或完成 ExecutionPlan。
```

## 9. 确定性校验器，而非只靠提示词

Plugin 至少应增加两类结构化校验：

### 9.1 SRS Lint

- 必需章节和文档元数据；
- 唯一 ID 与合法引用；
- CapabilityCandidate/Feature/RequirementItem 父子基数；
- 无孤儿和循环依赖；
- 规范句、来源、作用域、鉴定方法和验收引用；
- `CONFIRMED` 需求不得引用未知来源；
- MVP/阶段范围不得覆盖或替换产品总范围；
- 追溯矩阵覆盖率；
- 同级候选粒度审查结果。

### 9.2 SDD Lint

- RequirementBaseline 与输入哈希；
- 必需架构视角和设计决策记录；
- Candidate → CU 的正式化理由；
- RequirementItem → CU → Software Unit → 验证覆盖；
- CU 名称唯一、依赖合法、无循环；
- 数据所有权、接口责任和信任边界冲突；
- `BLOCKED` 项具有阻塞原因；
- DesignBaseline 前禁止保存 ExecutionPlan。

大模型负责分析和起草；Plugin 负责不变量、哈希、状态机、引用完整性和审查门。两者缺一不可。

## 10. ExecutionPlan 与 Todo 的无歧义定义

| 对象 | 形成时间 | 内容 | 权威性 | 是否自动执行 |
| --- | --- | --- | --- | --- |
| DesignCandidate 中的 CU 顺序建议 | 设计草案阶段 | 候选顺序和依赖 | 非基线 | 否 |
| ExecutionPlan | DesignBaseline 后 | 正式 CU 名称、内部 ID、依赖、顺序、验证义务和状态 | 项目事实 | 否，由命令驱动推进 |
| OpenCode Todo | 当前会话 | 建议的一个下一动作或当前 CU 的会话步骤 | 会话投影 | 否 |

`/sdlc-code` 默认读取 ExecutionPlan 的下一个可执行 CU；用户可选传入 **CU 名称** 进行显式选择，但不能传内部 `cuId`。无参数不代表自动连续执行全部 CU；完成一个候选后必须停在审查/验证边界。

## 11. 对当前 MVP0 实现的直接影响

研究显示当前实现至少需要以下修正，才能稳定生成用户期望的文档：

1. Requirement Skill 不能从“系统边界”直接跳到 RequirementItem；必须强制生成并校验 Capability Map；
2. SRS 模板必须包含 CapabilityCandidate → Feature → RequirementItem，而不是只列需求表；
3. Design Skill 中“只要能更小地独立编码测试就继续拆 CU”的规则必须删除；它会系统性地把 Feature 拆成 CU；
4. CU 拆分应采用能力目标、业务内聚、契约/数据边界、生命周期和同级粒度的综合判断；
5. SDD 必须成为独立权威文档，不能只在 ExecutionPlan 中保存 CU 列表；
6. ExecutionPlan 只能在 DesignBaseline 后由结构化设计候选生成，不能解析 OpenCode Todo 文本；
7. 需要加入 SRS/SDD 模板、Schema/Lint 和错误样例压力测试；
8. Claude Game Studio 只影响阶段识别、提问、建议和 Todo 展示，不冻结文档分类和 CU 规则。

## 12. 未采用的方案

### 12.1 原样复制 MIL-STD-498/DID

优点是覆盖完整、追溯严格；缺点是文档负担较重，包含面向合同数据项的格式要求，且 MIL-STD-498 本身已取消。项目应借用内容完整性和 CSCI 思想，不宣称完整军标合规。

### 12.2 只采用 ISO/IEC/IEEE 29148

它提供强需求工程框架，但不能自动定义 Factory 的 CU、ExecutionPlan 和交互行为，也不能单独解决具体项目层级误拆问题。

### 12.3 只采用 User Story/Product Backlog

适合排序和增量反馈，但不足以表达接口、状态、异常、安全、性能、数据、验证方法和双向追溯，无法作为 MVP0 从需求到设计、编码、测试的唯一基线。

### 12.4 只优化提示词

可以改善平均输出，但不能保证 ID 唯一、父子基数、哈希、阶段门、追溯覆盖和 Plan 状态。正式方案必须是“Skill 引导 + 模板 + 结构化候选 + 确定性校验 + 人工批准”。

## 13. 推荐实施顺序

1. 先确认本文件中的统一术语和 SRS/SDD 目录；
2. 更新 MVP0 权威设计文档，删除与新 CU 规则冲突的描述；
3. 新增 SRS、SDD 模板及结构化 Schema；
4. 重写 `/sdlc-spec` 和 `/sdlc-design` Skill；
5. 新增正确层级、过度拆分、粒度不一致、未知信息和追溯缺失的压力测试；
6. 在隔离目标项目中用 OpenCode CLI 生成完整 SRS 和 SDD；
7. 人工审查文档后再验证 ExecutionPlan、编码和测试流程。

在此之前，不应继续用当前错误层级的需求文档驱动编码；否则后续 CU、Plan、Todo、代码和测试都会继承同一分类错误。
