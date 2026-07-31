# SDLC Factory 1.0 合同索引

状态：Draft

本目录只保留 1.0 实现必须共同遵守的六份 JSON Schema。领域 Guard 以[附录 A](../appendices/A-domain-and-lifecycle.md)为准，Schema 负责数据形状，不重复实现状态机。

| 合同 | 作用 |
|---|---|
| [project-profile.schema.json](project-profile.schema.json) | Project 模块与项目动作路由 |
| [framework-pack.schema.json](framework-pack.schema.json) | Framework Pack 身份和 Capability 声明 |
| [execution-plan.schema.json](execution-plan.schema.json) | Pack 交给 Runner 的最小执行计划 |
| [capability-result.schema.json](capability-result.schema.json) | Runner/Pack 返回的结构化结果和 Evidence 引用 |
| [workflow-state.schema.json](workflow-state.schema.json) | WorkItem、TestBatch 和 Operation 当前状态索引 |
| [core-tool-request.schema.json](core-tool-request.schema.json) | Skill/Agent 可调用的四类 Core Tool |

## 接口层次

```text
Skill / Agent
  → core-tool-request
  → Core Project Action Orchestrator
  → Project Profile routes
  → Framework Pack
  → execution-plan
  → Runner
  → capability-result
  → workflow-state
```

Operator 发布需求和作出人工审核决定走独立入口，不属于 Agent Tool Schema。实现可以复用 Application Command，但不能让 Agent 请求携带或伪造 Operator 身份。

## 版本约定

- `$schema` 使用 JSON Schema Draft 2020-12；
- `apiVersion` 固定为 `sdlc.factory/v1`；
- 未知字段默认拒绝；
- 破坏字段语义时升级合同版本，不增加旧版 fallback；
- ID、路径和 Source Revision 的业务约束由 Core Guard 二次校验；
- 大段文本、日志和二进制内容只通过引用关联。

## 尚未完成

Schema 当前只是设计输入，尚未通过 meta-schema、示例、TCK 或真实项目验证。实现前必须为六份 Schema 增加有效和无效样例。
