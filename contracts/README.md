# AI 软件工厂 v1.2 机器合同

本目录以 [v1.2 架构基线](../docs/v1.2/ai-software-factory-design-v1.2-final.md) 为唯一设计来源，替代 `files.zip` 中基于早期增补稿生成的合同。这里不保留评审采纳表或旧字段兼容层。

## 内容

```text
contracts/
├─ json-schema/             # 13 个 Draft 2020-12 合同
├─ examples/
│  ├─ valid/                # 每个合同一个正例
│  └─ invalid/              # 每个合同一个反例
├─ ddl/
│  └─ v1.2-schema.sql       # 可从空 PostgreSQL 数据库执行的自包含关系模型基线
└─ scripts/
   └─ validate-contracts.ps1
```

Schema 集合：

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

## 已冻结的裁决

- SystemAcceptance 绑定 `project_id + execution_plan_version`，不引入 `DeliveryPlan`。
- v1.2 保持单活动 Run；`FactoryRunBudget.max_concurrent_runs` 和 `per_project_quota` 都固定为 `1`，其他 Run 进入 `QUEUED_FOR_CAPACITY`。
- Agent、Prompt、Rule 与 Template 使用稳定 ID、版本和内容 Hash；持久化合同不接受 `latest`。
- `PromptTemplate` 是独立生产资料，不能只作为 AgentDefinition 内的松散路径和版本号。
- ReviewRecord 完整表达职责分离；本机单用户只能使用带理由的 `SINGLE_OPERATOR_EXCEPTION`。
- FactoryTrajectoryEvent 是 append-only（只追加）事实。DDL 使用触发器拒绝更新和删除；该表不引用 ReviewRecord 或 Baseline，也不能推进业务状态。
- 系统验收工具保持技术中立；Playwright 只是可能的首个实现，不进入机器合同。

## 验证

```powershell
powershell -ExecutionPolicy Bypass -File contracts/scripts/validate-contracts.ps1
powershell -ExecutionPolicy Bypass -File contracts/scripts/validate-ddl.ps1
```

第一个脚本使用 AJV 按 Draft 2020-12 编译每个 Schema，并分别断言同名正例通过、反例失败。第二个脚本在系统临时目录安装固定版本 PGlite，从空数据库执行 DDL，再验证串行预算约束和 Trajectory append-only 触发器；临时依赖在结束时删除。仅检查 JSON 可解析、括号和分号数量不算完成验证。

当前样例只覆盖每个合同的一组代表性正反路径。缺字段、版本兼容、幂等重放和数据库迁移回放仍应在 M0 TCK 中继续扩展。
