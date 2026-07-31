# 附录 E：中文词汇与英文编码名

## 1. 文档语言规则

- 面向用户和架构评审的正文以中文为主；
- 第一次出现重要概念时可以写“中文名（英文编码名）”；
- 代码、Schema、工具名、字段名和目录名使用固定英文编码名；
- 不用英文标题堆叠中文解释；
- 已有通用技术名词如 Agent、Skill、Hook、Token、API、UI、JSON、Git 可以保留；
- 同一概念不得在不同文档中随意切换英文名。

## 2. 核心领域

| 中文名 | 英文专业名 | 推荐编码名 |
|---|---|---|
| 项目 | Project | `Project` |
| 项目配置 | Project Profile | `ProjectProfile` |
| 项目模块 | Project Module | `ProjectModule` |
| 工作项 | Work Item | `WorkItem` |
| 需求版本 | Requirement Version | `RequirementVersion` |
| 源码修订 | Source Revision | `SourceRevision` |
| 审核决定 | Review Decision | `ReviewDecision` |
| 测试批次 | Test Batch | `TestBatch` |
| 验证对象 | Verification Subject | `VerificationSubject` |
| 运行操作 | Operation | `Operation` |
| 证据 | Evidence | `Evidence` |
| 交付预览 | Delivery Preview | `DeliveryPreview` |
| 交付清单 | Delivery Manifest | `DeliveryManifest` |
| 操作者 | Operator | `Operator` |

## 3. 专业协作

| 中文名 | 英文专业名 | 推荐编码名 |
|---|---|---|
| 专业编排包 | Orchestration Pack | `OrchestrationPack` |
| Agent 定义 | Agent Definition | `AgentDefinition` |
| Skill 定义 | Skill Definition | `SkillDefinition` |
| Hook 定义 | Hook Definition | `HookDefinition` |
| 领域规则包 | Domain Rule Pack | `DomainRulePack` |
| 交付负责人 | Delivery Lead | `DeliveryLead` |
| 需求负责人 | Requirements Lead | `RequirementsLead` |
| 实现负责人 | Implementation Lead | `ImplementationLead` |
| 测试负责人 | Testing Lead | `TestingLead` |
| 专业专家 | Specialist Agent | `SpecialistAgent` |
| 结构化交接 | Structured Handoff | `StructuredHandoff` |
| 检查范围 | Inspection Scope | `inspection_scope` |
| 交付目标 | Delivery Targets | `delivery_targets` |
| 实际变更 | Observed Diff | `observed_diff` |
| 受保护路径 | Protected Paths | `protected_paths` |

## 4. 宿主与运行观察

| 中文名 | 英文专业名 | 推荐编码名 |
|---|---|---|
| 宿主适配器 | Host Adapter | `HostAdapter` |
| 宿主观察适配器 | Host Observation Adapter | `HostObservationAdapter` |
| 运行记录 | Run Record | `RunRecord` |
| 运行轨迹 | Run Trace | `RunTrace` |
| 运行遥测 | Runtime Telemetry | `RuntimeTelemetry` |
| 可观测推理指标 | Reasoning Telemetry | `ReasoningTelemetry` |
| 阶段指标 | Stage Metrics | `StageMetrics` |
| 工具调用记录 | Tool Call Record | `ToolCallRecord` |
| 工具错误 | Tool Error | `ToolError` |
| 失败指纹 | Failure Fingerprint | `FailureFingerprint` |
| 成本账本 | Cost Ledger | `CostLedger` |
| 实际总量 | Actual Total | `actual_total` |
| 成功路径 | Successful Path | `successful_path` |
| 返工开销 | Rework Overhead | `rework_overhead` |
| 人工等待 | Operator Wait | `operator_wait` |
| OpenCode 估算成本 | OpenCode Estimated Cost | `opencode_estimated_cost` |
| 提供方结算成本 | Provider Billed Cost | `provider_billed_cost` |
| 实际结算未知 | Billing Unknown | `billing_status=unknown` |

“思维链分析”在对外文档中统一改为“可观测推理行为分析”。代码使用
`ReasoningTelemetry`，不使用 `ChainOfThought`、`CoTLog` 或暗示能够读取私有推理的命名。

## 5. 执行与框架

| 中文名 | 英文专业名 | 推荐编码名 |
|---|---|---|
| 框架适配包 | Framework Pack | `FrameworkPack` |
| 项目动作 | Project Action | `ProjectAction` |
| 能力描述 | Capability Descriptor | `CapabilityDescriptor` |
| 执行计划 | Execution Plan | `ExecutionPlan` |
| 执行器 | Runner | `Runner` |
| 运行结果 | Capability Result | `CapabilityResult` |
| 就绪检查 | Readiness Check | `ReadinessCheck` |
| 清理策略 | Cleanup Policy | `CleanupPolicy` |
| 脱敏策略 | Redaction Policy | `RedactionPolicy` |

## 6. 产物检查

| 中文名 | 英文专业名 | 推荐编码名 |
|---|---|---|
| 产物检查 | Artifact Inspection | `ArtifactInspection` |
| 产物检查器 | Artifact Inspector | `ArtifactInspector` |
| 需求覆盖矩阵 | Requirement Coverage Matrix | `RequirementCoverageMatrix` |
| 符合性报告 | Conformance Report | `ConformanceReport` |
| 观察结论 | Observation | `Observation` |
| 故障诊断 | Failure Diagnostic | `FailureDiagnostic` |
| 满足 | Satisfied | `satisfied` |
| 不满足 | Unsatisfied | `unsatisfied` |
| 不确定 | Uncertain | `uncertain` |
| 不适用 | Not Applicable | `not_applicable` |
| 必测 | Mandatory Test | `mandatory` |
| 通过 | Passed | `passed` |
| 失败 | Failed | `failed` |
| 跳过 | Skipped | `skipped` |
| 阻塞 | Blocked | `blocked` |

## 7. 工具命名

对 Agent 公开的工具保留统一前缀：

| 中文用途 | 工具名 |
|---|---|
| 查询当前状态 | `sdlc_status` |
| 请求状态动作 | `sdlc_transition` |
| 请求项目执行 | `sdlc_execute` |
| 查询运行操作 | `sdlc_operation_get` |
| 提交结构化交接 | `sdlc_handoff_submit` |
| 查询运行或产物分析 | `sdlc_analysis_get` |

内部端口使用清晰动词，不暴露成通用 Agent 工具：

```text
run_observation_ingest
run_analysis_build
artifact_inspection_build
delivery_preview_build
```

## 8. 避免使用的模糊词

| 避免 | 原因 | 推荐替代 |
|---|---|---|
| 中间状态 | 无法区分生命周期状态和临时数据 | 工作流状态、运行记录或候选产物 |
| 上下文 | 范围过大 | 会话上下文、工作项输入或检查范围 |
| 验证通过 | 无法判断谁验证、验证什么 | 测试通过、人工审核通过或门禁通过 |
| 思维链爆炸 | 容易误解为读取私有推理 | 推理 Token 异常、生成耗时异常 |
| 工具爆炸 | 没有基线和进展定义 | 工具调用放大、无进展重复调用 |
| Agent 权限 | 容易混淆职责和文件 ACL | Agent 职责能力、全局保护策略 |
| source | 容易混淆需求资料和源码 | 外部参考资料、原始需求或源码修订 |
