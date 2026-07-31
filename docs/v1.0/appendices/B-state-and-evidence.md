# 附录 B：状态与证据

本附录定义事实、状态索引、运行结果和最小恢复语义。

## B.1 四类数据

| 数据 | 形式 | 所有者 | 用途 |
|---|---|---|---|
| Project Facts | Markdown | Agent 提案，Operator 发布或审核 | 需求、架构、测试计划等可读内容 |
| Project Profile | YAML | 项目维护者 | 模块和 Project Action 路由 |
| Workflow Index | JSON | Core | 当前状态、版本、哈希和引用 |
| Evidence | 文件及 JSON 引用 | Runner / Core | 日志、报告、诊断和产物 |

JSON 不保存需求正文、会话记录或完整日志。Markdown 不重复保存可变流程状态。

## B.2 Workflow Index

1.0 使用一个 Project 级 Workflow Index：

```text
.sdlc/index/workflow.json
```

它至少包含：

```text
project_id
version
work_items[]
test_batches[]
operations[]
```

每个 Markdown 引用同时保存内容哈希。Core 执行状态转换前重新读取文件并验证哈希；内容与索引不一致时拒绝转换。

索引由 Core 独占写入。Adapter、Framework Pack、Runner、Skill 和 Agent 不得直接修改 `.sdlc/index/**`。

## B.3 最小写入语义

1.0 只承诺单写者和原子替换：

1. 读取当前 `version`；
2. 验证请求的 `expectedVersion`；
3. 在内存中完成领域 Guard 和新状态计算；
4. 将完整新索引写入同目录临时文件并完成 flush；
5. 原子替换 `workflow.json`；
6. 成功后返回新 `version`。

1.0 不实现事件日志、WAL、快照回放、跨文件事务或自动崩溃修复。启动时如果索引无法解析或引用丢失，Core 必须停止写入并输出诊断，不得猜测状态。

索引备份属于部署策略，不进入领域接口。实现可保留最近一个已验证副本，但恢复必须由 Operator 明确确认。

## B.4 Source Revision

Source Revision 是 Core 生成或接受的稳定不透明字符串，用来表示确定源码内容。实现可以使用：

- Git commit；
- Git HEAD 加工作区内容摘要；
- 受控工作区 snapshot ID。

1.0 不规定具体算法，但同一内容必须能稳定比较，不同内容不得复用同一 revision。分支名、修改时间和 Agent 声明不能作为 Source Revision。

绑定关系：

```text
Implementation Completed
  → requirement_version + source_revision

Review Approved
  → requirement_version + source_revision + review_version

Verification Subject
  → work_item_id + requirement_hash
    + requirement_version + source_revision + review_version
```

## B.5 Evidence

Evidence 文件写入：

```text
.sdlc/evidence/<operation-id>/
```

Workflow Index 只保存：

```text
evidence_id
kind
relative_path
sha256
created_at
producer
```

Evidence 内容写入后不可原地修改。需要脱敏或重新解析时产生新的 Evidence，并保留对原始受限制品的引用。

最小类型：

- `stdout` / `stderr`；
- `test_report`；
- `build_artifact`；
- `diagnostic`；
- `review_decision`。

## B.6 Operation 与进程恢复

Runner 在启动命令前写入 `queued` Operation，开始后改为 `running`，结束时写入终态和 Capability Result。

Core 重启时：

- 已有终态不修改；
- 可以确认仍被当前 Runner 管理的进程，继续查询；
- 无法确认归属的 `running` Operation 标为 `interrupted`；
- 尽力清理已记录 Runtime Handle；
- 不自动重放命令。

这保证状态诚实，但不承诺长操作跨 Core 崩溃继续运行。

## B.7 上下文和 memory

Core 根据请求即时选择：

```text
Project Profile
相关 WorkItem Markdown
Workflow Index 中的当前状态
相关 TestBatch 与 Evidence 引用
```

1.0 不维护会话记忆、向量索引、llmwiki 或 Mem0。Skill/Agent 可以使用自己的临时上下文，但该上下文不能发布需求、批准 Review 或覆盖 Workflow Index。
