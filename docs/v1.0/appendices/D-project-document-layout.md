# 附录 D：项目目录规范

本附录规定使用 SDLC Factory 1.0 的目标项目目录，不规定本设计仓库的内部布局。

## D.1 推荐目录

```text
project/
├─ sdlc/
│  └─ project-profile.yaml
├─ docs/
│  └─ sdlc/
│     ├─ project.md
│     ├─ requirements/
│     │  ├─ WI-001.md
│     │  └─ WI-002.md
│     └─ test-batches/
│        └─ TB-001.md
└─ .sdlc/
   ├─ index/
   │  └─ workflow.json
   └─ evidence/
      └─ OP-001/
```

## D.2 路径职责

| 路径 | 是否进入 Git | 写入者 | 内容 |
|---|---:|---|---|
| `sdlc/project-profile.yaml` | 是 | 项目维护者 | 模块、Pack 和 Project Action 路由 |
| `docs/sdlc/project.md` | 是 | Agent / Operator | 项目目标和约束 |
| `docs/sdlc/requirements/*.md` | 是 | Agent 提案，Operator 发布 | WorkItem 需求正文 |
| `docs/sdlc/test-batches/*.md` | 是 | Agent / Operator | 测试范围和人工说明 |
| `.sdlc/index/workflow.json` | 否 | Core | 当前流程状态索引 |
| `.sdlc/evidence/**` | 否 | Runner / Core | 日志、报告、诊断和产物 |

是否归档 Evidence 到制品库由项目决定；不要把大日志直接提交到 Project Facts。

## D.3 Markdown

每份 WorkItem Markdown 至少包含：

```markdown
---
work_item_id: WI-001
requirement_version: 1
---

# 标题

## 目标

## 验收条件
```

Workflow Index 保存文件相对路径和内容 SHA-256。发布后的版本不可直接改写；修改时增加 `requirement_version`，状态回到 `draft`。

TestBatch Markdown 描述测试目标、范围和人工观察，不保存运行状态。运行状态和 Verification Subject 位于 Workflow Index。

## D.4 JSON

JSON 只保存：

- 稳定 ID；
- 当前状态；
- 乐观并发版本；
- Requirement Version、哈希和 Source Revision；
- Review Decision 与 Evidence 引用；
- TestBatch Subject；
- Operation 摘要。

JSON 不保存：

- 完整需求正文；
- Agent 对话；
- stdout/stderr 全文；
- 二进制产物；
- 自动生成的百科或长期记忆。

## D.5 YAML

Project Profile 使用 YAML，必须：

- 禁止自定义 tag 和可执行表达式；
- 路径使用 Project root 相对路径；
- 不保存 Secret 明文；
- Pack 引用包含稳定 ID 和版本；
- Project Action 步骤顺序具有语义。

## D.6 所有权

```text
Agent / Operator → Markdown facts
Project Maintainer → Project Profile
Core → Workflow Index
Framework Pack → Execution Plan / parsed result
Runner → raw Evidence
```

任何越权写入都应由 Core 拒绝或在下一次读取时报告不一致。
