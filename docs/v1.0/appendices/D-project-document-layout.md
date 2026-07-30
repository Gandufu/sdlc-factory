# 附录 D：项目文档与目录规范

本附录只定义文档和目录编排，不承载 1.0 主流程。主方案见 [docs/v1.0/README.md](../README.md)。

## D.1 本设计仓库

```text
README.md                                 # 当前目标、1.0 主流程、导航
docs/
  v1.0/
    README.md                             # 1.0 主方案
    appendices/
      A-domain-and-lifecycle.md
      B-state-evidence-and-recovery.md
      C-framework-pack-and-runner.md
      D-project-document-layout.md
      E-delivery-and-acceptance.md
      F-review-disposition.md
    adr/
      ADR-001-Core-Cutover.md
    diagrams/
      SDLC-Pipeline-1.0-Architecture.drawio
      SDLC-Pipeline-1.0-Transition-Harness.svg
      SDLC-Pipeline-1.0-Task-State.svg
      SDLC-Pipeline-1.0-Harness-Loop.svg
  v2.0/
    README.md                             # 只保留演进路线
    SDLC-Pipeline-2.0-Project-Software-Factory.svg
  research/
    agent-harness-landscape-2026-07-30.md
```

阅读顺序：

1. 根 [README](../../../README.md)；
2. [1.0 主方案](../README.md)；
3. 只读取当前问题涉及的附录；
4. 架构决定读取 ADR；
5. 需要了解后续方向时才读取 [2.0 路线](../../v2.0/README.md)；
6. 需要外部事实依据时再读取 research。

不再维护一篇同时包含主流程、协议调研、Schema、Runner、安全、路线和评审记录的总文档。

## D.2 文档职责

| 文档 | 必须回答 | 不应包含 |
|---|---|---|
| 根 README | 当前做什么、主流程、从哪里继续读 | 完整 Schema、评审原文、2.0 平台细节 |
| 1.0 README | 范围、架构、接口、交付条件 | 大型 Manifest、26 个场景全文、研究综述 |
| 附录 | 某一主题的完整契约 | 重复主流程和路线宣传 |
| ADR | 单一架构决定、替代方案和后果 | 整套方案说明 |
| 2.0 README | 从 1.0 到软件工厂的演进阶段 | 1.0 具体实现和 M0 契约 |
| research | 外部事实、来源、推断 | 当前已批准的领域真相 |

## D.3 目标项目 ProjectFacts

安装 1.0 后，目标项目使用：

```text
docs/sdlc/
  project.md                            # 产品目标、Feature 地图、依赖和索引
  requirements.md                       # 当前有效 Requirement / AC
  architecture.md                       # 模块、接口、数据流和 ADR 引用
  verification.md                       # Requirement/AC → Gate/Test 追溯
  interfaces/
    catalog.yaml                        # 内部/外部接口与 contractRef
  environments/
    SIT-001.yaml                        # 非秘密环境绑定和 Secret Ref
  tasks/
    active/
      TASK-0001/
        proposal.md                     # 待批准增量
        plan.md                         # Execution Slice 和 handoff
        fact-change-set.json            # 确定性补丁索引
    completed/
      TASK-0000/
        delivery.md                     # 完成摘要和 Evidence 引用
```

ProjectFacts 只表示已完成 Task 形成的当前有效事实。已批准但未 Delivery 的增量仍保存在 active Task 中。

## D.4 目标项目运行态

```text
.sdlc/
  project.json                          # project_id、Pack binding、facts_revision
  tasks/
    TASK-0001/
      state.json                        # 紧凑 snapshot
      events.jsonl                      # 只追加领域事件
      attempts/
        ATTEMPT-0001.json
  operations/
    OP-0001.json
  transactions/
    TXN-0001.json
  leases/
    WORKSPACE-0001.json
  evidence/
    TASK-0001/
      GATE-0001/
        result.json
        stdout.log
        stderr.log
  logs/
    core.jsonl
```

`.sdlc/**` 是 Core 运行态，不是项目事实，也不是 Agent 工作区。

## D.5 路径所有权

| 路径 | 写入者 | 规则 |
|---|---|---|
| `.sdlc/**` | Core/StateStore Adapter | Agent、Pack、Harness 均不可写 |
| `docs/sdlc/tasks/active/**` | Agent 在 Workspace Policy 允许下编辑；Core 校验和冻结 | 仅当前 Task |
| `docs/sdlc/project.md` 等权威事实 | Core Fact Publisher | 只能应用批准的 FactChangeSet |
| `docs/sdlc/interfaces/**` | Core Fact Publisher | 作为 ProjectFacts |
| `docs/sdlc/environments/**` | Core Environment Publisher | 只接受 Operator 批准的绑定 |
| `src/**`、`tests/**`、批准的迁移目录 | Agent | 受 Task scope 和 Pack policy 约束 |
| `coverage/**`、`test-results/**`、临时运行目录 | Harness Runtime | 受配额和 cleanup 约束 |

不能用一个 `docs/sdlc/**` protected glob 同时禁止合法 proposal 编辑。Pack 必须显式区分 authoring、authority 和 runtime 路径。

## D.6 内容格式

### Markdown

用于：

- 用户目标和需求正文；
- 架构解释和 ADR；
- Execution Slice 计划和 handoff；
- Delivery 摘要；
- 人工可读诊断说明。

### JSON/JSONL

只用于：

- ID、状态和版本；
- 哈希和 digest；
- Artifact/Evidence 指针；
- 紧凑诊断；
- 领域事件；
- 幂等、租约和恢复索引。

禁止把 transcript、完整需求、长日志或大段模型输出塞入 JSON。

### YAML

用于：

- Framework Pack Manifest；
- Interface Catalog；
- Environment Binding；
- Policy/Project Profile。

### SVG/Draw.io

- SVG 是可直接阅读和渲染的交付图；
- Draw.io 是唯一可编辑源；
- SVG 页脚必须指回 Draw.io 文件和页码；
- 修改图示时同时更新 SVG 和 Draw.io；
- 提交前解析 XML，并用浏览器实际渲染 SVG。

## D.7 命名与链接

- 版本目录使用 `docs/v1.0`、`docs/v2.0`；
- 主入口统一为该版本的 `README.md`；
- 附录使用稳定字母前缀；
- ADR 使用 `ADR-<number>-<slug>.md`；
- 文档之间使用相对链接；
- research 可以带日期，契约文档不在文件名中追加日期；
- 删除被替代的总文档，不保留“final-v2-new”之类兼容副本；
- 当前决定只保留一个权威落点，评审记录只说明为何选择。

## D.8 变更检查

文档提交前至少检查：

```text
Markdown 相对链接
代码围栏平衡
JSON/YAML 示例可解析
Draw.io 根节点 = mxfile
SVG 根节点 = svg
Draw.io ID 无重复
SVG 浏览器渲染
git diff --check
```

只提交当前任务相关文件；不要把临时渲染 PNG、外部评审原文或无关工作区变化加入仓库。
