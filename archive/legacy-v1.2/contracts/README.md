# AI 软件工厂 v1.2 机器合同

本目录与 [v1.2 架构基线](../docs/v1.2/README.md) 共同构成唯一设计来源。Markdown 解释领域意图，Schema 与 DDL 固定机器边界；这里不保留评审采纳表或旧字段兼容层。

## 内容

```text
contracts/
├─ json-schema/             # Draft 2020-12 合同
├─ examples/
│  ├─ valid/                # 每个合同一个正例
│  └─ invalid/              # 每个合同一个反例
├─ ddl/                     # V1 起顺序执行的唯一 Flyway 迁移源
├─ tck/
│  ├─ fakes/                # 确定性 Fake Host 与 Fake Runner
│  ├─ opencode/             # 不调用模型的真实 CLI/SDK 兼容性 Smoke
│  └─ run-adapter-tck.mjs   # Adapter 行为、Schema 与幂等重放测试
└─ scripts/
   ├─ validate-contracts.ps1
   ├─ validate-adapter-tck.ps1
   ├─ validate-opencode-compatibility.ps1
   └─ validate-ddl.ps1
```

Schema 集合：

P0 跨模块边界合同：

- `factory-session.schema.json`
- `stage-submission.schema.json`
- `run-request.schema.json`
- `agent-invocation.schema.json`
- `context-manifest.schema.json`
- `handoff.schema.json`
- `evidence.schema.json`
- `gate-command.schema.json`
- `gate-result.schema.json`
- `host-run-event.schema.json`
- `host-run-result.schema.json`
- `execution-result.schema.json`
- `runtime-lease.schema.json`
- `error-envelope.schema.json`

已冻结领域与生产资料合同：

- `skill-definition.schema.json`
- `interface-definition.schema.json`
- `agent-definition.schema.json`
- `prompt-template.schema.json`
- `rule-set.schema.json`
- `template-registration.schema.json`
- `template-binding.schema.json`
- `system-acceptance.schema.json`
- `system-acceptance-baseline.schema.json`
- `environment-requirement.schema.json`
- `factory-run-budget.schema.json`
- `factory-trajectory-event.schema.json`
- `review-record.schema.json`
- `baseline.schema.json`
- `validation-contract.schema.json`
- `validation-finding.schema.json`
- `capability-index.schema.json`
- `context-expansion-request.schema.json`

## 已冻结的裁决

- PostgreSQL 16+ 是唯一权威关系数据库；不提供 H2 运行模式，也不维护双数据库兼容合同。
- `ddl/` 是唯一 Flyway 迁移源；验证必须从 V1 开始顺序回放全部迁移，不得只验证初始文件或复制第二份初始化脚本。
- Project Main Session 稳定绑定 OpenCode Session；Requirement/Design 共用持续主会话，CU Coding/Testing 使用 Child Session，Todo 权威固定为 `OPENCODE_NATIVE`。
- Requirement/Design 通过 `StageSubmission` 固定候选产物、来源 Session/Message、Agent、Skill 与 Model 后进入 Gate；普通消息不能自动创建 Gate。
- `RunRequest` 只接受 Initialization、Coding、Testing 和 System Acceptance 的受控执行；Requirement/Design 对话不创建 Run。
- SystemAcceptance 绑定 `project_id + execution_plan_version`，不引入 `DeliveryPlan`。
- v1.2 保持单活动 Run；`FactoryRunBudget.max_concurrent_runs` 和 `per_project_quota` 都固定为 `1`，其他 Run 进入 `QUEUED_FOR_CAPACITY`。
- Agent、Skill、Prompt、Rule 与 Template 使用稳定 ID、版本和内容 Hash；持久化合同不接受 `latest`。
- Skill 安装在项目 `.opencode/skills/<skill-id>/SKILL.md`，由 OpenCode 原生按需加载；Factory 记录绑定和健康状态，不把 Skill 正文注入固定 Prompt。
- `PromptTemplate` 是独立生产资料，不能只作为 AgentDefinition 内的松散路径和版本号。
- ReviewRecord 完整表达职责分离；本机单用户只能使用带理由的 `SINGLE_OPERATOR_EXCEPTION`。
- FactoryTrajectoryEvent 是 append-only（只追加）事实。DDL 使用触发器拒绝更新和删除；该表不引用 ReviewRecord 或 Baseline，也不能推进业务状态。
- ValidationContract 在正式拆分 CU 前形成行为断言，完成 CU 覆盖分配后作为 Project DesignBaseline 的组成产物冻结；它不新增生命周期或 Gate。
- CapabilityIndex + ContextExpansionRequest 延迟加载权威资料和注册执行能力，不包含 Skill。Context Assembler 负责权威资料的版本解析、预算、脱敏和 ContextManifest 更新；已授权工作区内容由 OpenCode 原生工具访问。
- MVP-B 的 Scrutiny/User-testing Validator 必须使用全新会话，只能产生 ValidationFinding；合同固定 `code_mutation_allowed=false` 和 `gate_authority=false`。
- 系统验收工具保持技术中立；Playwright 只是可能的首个实现，不进入机器合同。
- 首个真实 Host Adapter 使用 Node.js/TypeScript 和固定版本的 `@opencode-ai/sdk`；Spring Boot Core 只依赖本目录的 P0 合同，不接触 OpenCode SDK 类型。
- OpenCode Host/SDK 版本必须在启动握手和 AgentInvocation 中固定。Host 返回的结构化对象必须再次通过本地 Schema 校验；只有 `finish=tool-calls`、但缺失有效结构化对象时返回 `STRUCTURED_OUTPUT_INVALID`，不得报告成功。

## 验证

```powershell
powershell -ExecutionPolicy Bypass -File contracts/scripts/validate-contracts.ps1
powershell -ExecutionPolicy Bypass -File contracts/scripts/validate-adapter-tck.ps1
powershell -ExecutionPolicy Bypass -File contracts/scripts/validate-opencode-compatibility.ps1
powershell -ExecutionPolicy Bypass -File contracts/scripts/validate-ddl.ps1
```

第一个脚本在系统临时目录一次性安装固定版本 AJV，按 Draft 2020-12 编译每个 Schema，并分别断言同名正例通过、反例失败。第二个脚本让 Fake Host 与 Fake Runner 执行成功、结构化输出失败、启动和超时场景，校验输出合同与幂等重放。第三个脚本安装与本机 CLI 完全相同版本的 OpenCode SDK，在临时目录验证 Server、健康版本、会话、SSE、取消和清理，默认不调用模型。第四个脚本在系统临时目录安装固定版本 PGlite，从空数据库顺序执行全部 Flyway 迁移，再验证持续 Session、原生 Skill、StageSubmission、串行预算、Trajectory/Host Event append-only 和成功 HostResult 必须绑定 Handoff；临时依赖在结束时删除。仅检查 JSON 可解析、括号和分号数量不算完成验证。

当前样例只覆盖每个合同的一组代表性正反路径。缺字段、版本兼容、幂等重放和数据库迁移回放仍应在 M0 TCK 中继续扩展。
