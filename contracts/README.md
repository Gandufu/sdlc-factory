# AI 软件工厂 v1.2 机器合同

本目录以 [v1.2 架构基线](../docs/v1.2/ai-software-factory-design-v1.2-final.md) 为唯一设计来源，替代 `files.zip` 中基于早期增补稿生成的合同。这里不保留评审采纳表或旧字段兼容层。

## 内容

```text
contracts/
├─ json-schema/             # 29 个 Draft 2020-12 合同
├─ examples/
│  ├─ valid/                # 每个合同一个正例
│  └─ invalid/              # 每个合同一个反例
├─ ddl/
│  └─ V1__v1_2_contract_baseline.sql # Flyway 初始迁移，也是唯一 DDL 基线
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
- `ddl/V1__v1_2_contract_baseline.sql` 同时是 Flyway V1 初始迁移和独立 DDL 校验输入；不得复制成第二份初始化脚本。
- SystemAcceptance 绑定 `project_id + execution_plan_version`，不引入 `DeliveryPlan`。
- v1.2 保持单活动 Run；`FactoryRunBudget.max_concurrent_runs` 和 `per_project_quota` 都固定为 `1`，其他 Run 进入 `QUEUED_FOR_CAPACITY`。
- Agent、Prompt、Rule 与 Template 使用稳定 ID、版本和内容 Hash；持久化合同不接受 `latest`。
- `PromptTemplate` 是独立生产资料，不能只作为 AgentDefinition 内的松散路径和版本号。
- ReviewRecord 完整表达职责分离；本机单用户只能使用带理由的 `SINGLE_OPERATOR_EXCEPTION`。
- FactoryTrajectoryEvent 是 append-only（只追加）事实。DDL 使用触发器拒绝更新和删除；该表不引用 ReviewRecord 或 Baseline，也不能推进业务状态。
- ValidationContract 在正式拆分 CU 前形成行为断言，完成 CU 覆盖分配后作为 Project DesignBaseline 的组成产物冻结；它不新增生命周期或 Gate。
- MVP-A 使用 CapabilityIndex + ContextExpansionRequest 延迟加载完整工具、技能和资料；Agent 只能请求，Context Assembler 负责授权、版本解析、预算、脱敏和 ContextManifest 更新。
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

第一个脚本在系统临时目录一次性安装固定版本 AJV，按 Draft 2020-12 编译每个 Schema，并分别断言同名正例通过、反例失败。第二个脚本让 Fake Host 与 Fake Runner 执行成功、结构化输出失败、启动和超时场景，校验输出合同与幂等重放。第三个脚本安装与本机 CLI 完全相同版本的 OpenCode SDK，在临时目录验证 Server、健康版本、会话、SSE、取消和清理，默认不调用模型。第四个脚本在系统临时目录安装固定版本 PGlite，从空数据库执行 Flyway V1，再验证串行预算、Trajectory/Host Event append-only 和成功 HostResult 必须绑定 Handoff；临时依赖在结束时删除。仅检查 JSON 可解析、括号和分号数量不算完成验证。

当前样例只覆盖每个合同的一组代表性正反路径。缺字段、版本兼容、幂等重放和数据库迁移回放仍应在 M0 TCK 中继续扩展。
