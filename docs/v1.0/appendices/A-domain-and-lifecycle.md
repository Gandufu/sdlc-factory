# 附录 A：领域与生命周期

本附录定义 1.0 的状态、Guard 和失效规则。领域名称以根目录 [CONTEXT.md](../../../CONTEXT.md) 为准。

## A.1 聚合

1.0 只有三个需要独立维护的一等聚合：

| 聚合 | 作用 |
|---|---|
| WorkItem | 保存一项增量的当前需求、实现和人工审核状态 |
| TestBatch | 聚合一个或多个精确 Verification Subject，并保存测试状态 |
| Operation | 保存一次项目动作的运行状态、结果和 Evidence 引用 |

Project 是它们共同所属的范围。1.0 不引入 Task、Execution Slice、Gate、Release 或 Delivery 聚合。

## A.2 WorkItem 状态

### Requirement

```text
draft → published
  └──────────────→ withdrawn
```

| 转换 | Actor | Guard |
|---|---|---|
| 创建或更新 `draft` | Agent / Operator | 内容引用存在且哈希匹配 |
| `draft → published` | Operator | 标题、正文和验收条件完整 |
| `draft/published → withdrawn` | Operator | 提供原因 |

已发布版本不可原地修改。修改已发布需求时，WorkItem 增加 Requirement Version 并回到 `draft`；历史版本继续通过 Git 和 Evidence 保留。新版本发布后，Implementation 重置为 `not_started`，Review 重置为 `not_requested`，引用旧版本的 TestBatch 变为 `stale`。

### Implementation

```text
not_started → in_progress → completed
                    ↑           │
                    └───────────┘  源码继续变化
```

| 转换 | Actor | Guard |
|---|---|---|
| `not_started → in_progress` | Agent / Operator | 当前 Requirement Version 为 `published` |
| `in_progress → completed` | Agent | 提供与当前 Requirement Version 对应的 Source Revision |
| `completed → in_progress` | Core / Agent | 源码继续修改或审核要求修改 |

Implementation 完成只表示 Agent 已提交确定源码，不表示人工审核或测试通过。

### Review

```text
not_requested → pending → approved
                     └──→ changes_requested → pending
```

| 转换 | Actor | Guard |
|---|---|---|
| `not_requested/changes_requested → pending` | Agent | Implementation 为 `completed` |
| `pending → approved` | Operator | 决定绑定当前 Requirement Version 和 Source Revision |
| `pending → changes_requested` | Operator | 决定绑定当前 Requirement Version 和 Source Revision，并提供意见 |

Requirement Version 或 Source Revision 变化时：

- 当前 `approved` 不再满足测试准入；
- Review 当前状态重置为 `not_requested`；
- 原 Review Decision 作为历史 Evidence 保留。

Agent Interface 不包含 `review.approve` 或 `review.request_changes`。

## A.3 TestBatch 状态

```text
planned → running → passed
   │          ├──→ failed
   └──────────┴──→ cancelled

planned / running / passed / failed
  └─ Verification Subject 不再匹配 → stale
```

创建 TestBatch 时，每个 Verification Subject 必须固定：

```text
work_item_id
requirement_version
requirement_hash
source_revision
review_version
```

准入 Guard：

1. WorkItem 当前 Requirement 为 `published`；
2. Implementation 为 `completed`，且绑定同一 Requirement Version；
3. Review 为 `approved`，且绑定同一 Requirement Version 和 Source Revision；
4. TestBatch 中不存在重复 WorkItem；
5. 所有 WorkItem 属于同一 Project。

开始测试前 Core 再检查一次 Guard。测试运行期间或完成后，任一 Subject 不再匹配时，TestBatch 变为 `stale`。旧 Evidence 不删除，但不能证明当前源码已通过。

WorkItem 的测试摘要由 Core 推导：

| 匹配当前版本的 TestBatch | 查询结果 |
|---|---|
| 不存在，只有历史批次 | `stale` |
| 不存在且从未测试 | `not_tested` |
| `planned` | `planned` |
| `running` | `running` |
| 最新为 `passed` | `passed` |
| 最新为 `failed` | `failed` |

不得把该摘要作为第二份可写状态保存。

## A.4 Operation 状态

```text
queued → running → succeeded / failed / cancelled / interrupted
```

- `Operation` 表示一次 `project.*` 动作，不表示 WorkItem 阶段；
- `app.start` 成功时可以产生 Runtime Handle，供 `app.ready` 和 `app.stop` 使用；
- 进程异常退出或 Core 无法继续跟踪时记为 `interrupted`，不得伪造成功；
- 1.0 不保证 Host 或 Core 进程断开后 Operation 继续运行；
- Operation 失败不会直接改写 Requirement、Implementation 或 Review 状态。

## A.5 失败分类

Capability Result 必须保留以下分类：

| Category | 含义 | 默认处理 |
|---|---|---|
| `product` | 业务代码或行为不满足预期 | 回到 Implementation |
| `specification` | 需求或验收条件存在问题 | 更新并重新发布 Requirement Version |
| `test_contract` | 测试脚本、readiness probe 或 parser 有误 | 修 Framework Pack 或测试契约 |
| `infrastructure` | Runner、磁盘、临时网络或进程异常 | 有限重试或人工处理环境 |
| `environment` | 工具链、配置或依赖环境不满足 | Operator 修复环境后重试 |

`test_contract` 不能路由为修改业务代码；`infrastructure` 重试不改变 WorkItem 状态。

## A.6 并发和版本

- 一个 Project 可同时存在多个活动 WorkItem；
- Core 是 Workflow Index 的唯一写者；
- 每次变更携带 `expectedVersion`，不匹配时拒绝并要求重新读取；
- 1.0 不自动隔离或合并多个 Agent 的源码修改；
- Review 和 TestBatch 使用一个稳定的 Source Revision，不引入多维 Revision Vector。
