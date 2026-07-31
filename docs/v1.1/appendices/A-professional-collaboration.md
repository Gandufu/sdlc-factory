# 附录 A：专业协作与职责

## 1. 目标

专业编排包负责把“一个通用模型完成所有工作”改造成“稳定负责人按需调用专业能力”。
它提供角色、方法、事件触发和领域约定，但不成为第二套状态机。

四类扩展的边界如下：

| 扩展 | 回答的问题 | 保存的内容 | 不保存的内容 |
|---|---|---|---|
| Agent | 谁负责判断和交付 | 角色、输入、输出、委派条件 | 工作流真相、审批结果 |
| Skill | 这类专业工作怎么做 | 方法、步骤、检查表、参考资料 | 当前工作项状态 |
| Hook | 某个宿主事件发生后做什么 | 轻量事件映射和触发规则 | 长 Prompt、复杂业务逻辑 |
| 领域规则 | 项目中必须遵守什么 | 编码、架构、UI、协议、测试规则 | 会话内容、重试历史 |

## 2. Agent 组织

### 2.1 稳定负责人

| 角色 | 编码名 | 主要职责 | 可请求的专家 |
|---|---|---|---|
| 交付负责人 | `sdlc-main` | 维护项目主线、组织规划和工作项、提交 Core 动作 | 全部专家 |
| 需求负责人 | `sdlc-requirements` | 整理原始需求、冲突、验收条件和待确认事项 | 需求分析、方案架构 |
| 实现负责人 | `sdlc-implementation` | 实现、聚焦验证和变更说明 | 前端、后端、Electron、设备集成 |
| 测试负责人 | `sdlc-testing` | 测试设计、测试实现、失败分类和结果交接 | UI、设备、安全专家 |
| 运行审计员 | `sdlc-run-auditor` | 分析工具、耗时、Token、成本和重试 | 不再委派 |
| 产物验收员 | `sdlc-artifact-inspector` | 组织最终产物语义检查 | UI、协议、架构、安全专家 |

交付负责人拥有主会话和完整项目视图。需求、实现和测试负责人使用隔离上下文，避免把全部
历史对话复制到每个角色。隔离的是上下文和职责，不是项目目录读写能力。

### 2.2 Agent 定义合同

每个 Agent 定义至少包含：

```yaml
id: sdlc-implementation
responsibility: 实现当前已批准需求
required_inputs:
  - work_item_id
  - requirement_version_id
  - inspection_scope
allowed_actions:
  - read_project
  - edit_project
  - run_focused_checks
handoff_tool: sdlc_handoff_submit
delegation:
  max_depth: 1
  specialists: [frontend, backend, electron, device-integration]
stop_conditions:
  - requirement_conflict
  - missing_runtime_credential
  - repeated_same_failure
```

`allowed_actions` 表示职责能力，不表示文件系统 ACL。全局受保护路径、Secret 策略和危险命令
策略由项目统一执行，不能按角色制造互相矛盾的隐式限制。

### 2.3 按需委派

只有满足下列至少一项时才委派专家：

- 工作项明确跨越独立专业领域；
- 当前负责人缺少框架或协议专长；
- 失败分类指向一个明确专业问题；
- 最终验收需要独立视角；
- 规则要求高风险变更必须专业审查。

以下情况不委派：

- 仅为了重复阅读相同资料；
- 仅为了让另一个 Agent 重新总结；
- 小范围、单领域、负责人可直接完成；
- 上一次专家结果仍然有效且输入没有变化。

默认最大委派深度为两层：交付负责人到阶段负责人，阶段负责人到专业专家。专家不能再继续
向下派发，除非项目配置显式提高上限。

## 3. Skill 组织

Skill 应按专业能力组织，不按每个命令复制一份：

```text
skills/
├─ requirement-analysis/
├─ acceptance-criteria/
├─ electron-architecture/
├─ protocol-integration/
├─ ui-fidelity-review/
├─ test-design/
├─ device-validation/
├─ security-review/
└─ failure-diagnosis/
```

Skill 输入使用工作项引用、正式产物引用和检查范围。Skill 不应要求把完整会话、完整仓库结构或
全部外部资料注入 Prompt。大文件由宿主正常读取；是否分段由工具能力和内容大小决定，不由
Core 设置固定读取次数门禁。

Skill 输出是分析或建议。需要改变生命周期时，Agent 必须调用 Core 工具提交动作。

## 4. Hook 组织

Hook 保持轻量：

| 事件 | Hook 行为 |
|---|---|
| 用户提交 `/sdlc-plan` | 在模型处理前保存原始目标，建立规划运行关联 |
| 用户提交 `/sdlc-spec` | 在模型处理前保存原始输入字节和哈希 |
| 会话或子代理启动 | 建立运行、阶段、角色和父子会话关联 |
| 工具调用前后 | 记录标准化名称、输入指纹、状态、耗时和错误类型 |
| 模型生成完成 | 记录公开的 Token、成本和耗时字段 |
| 结构化交接提交 | 校验身份和必填字段后转交 Core |
| 会话取消或退出 | 关闭运行记录，保留未完成状态 |

Hook 不应：

- 生成 Spec、Code 或 Test 正文；
- 从聊天尾部猜测 JSON；
- 在事件回调内执行完整回归；
- 根据工具次数直接禁止读取；
- 修改 Core 状态文件；
- 把完整提示词、Secret 或模型私有推理写入日志。

## 5. 领域规则

领域规则分为两类：

### 5.1 可执行规则

可以由 Core、执行器或产物检查器确定性验证：

- 原始需求必须有内容哈希；
- 必测项必须是 `passed`；
- 测试证据必须绑定当前源码修订；
- Secret 不得进入源码、日志或交付报告；
- 受保护路径变更必须显式声明；
- 发布必须绑定 Operator 的明确批准。

### 5.2 指导规则

需要 Agent 判断并提供证据：

- UI 应与高保真原型一致；
- 协议实现不得猜测字段；
- 复杂模块应使用清晰边界；
- 错误反馈应对用户可见；
- 测试应覆盖业务语义而非只覆盖代码行。

指导规则不能伪装成目录权限或固定工具次数。专业 Agent 违反指导规则时，产物验收报告应指出
不符合项和证据，由 Operator 或权威门禁决定后续动作。

### 5.3 规则优先级

从高到低：

1. 最新已批准需求；
2. 项目级安全和发布策略；
3. 正式设计与协议；
4. 框架适配包规则；
5. Agent 和 Skill 的通用建议。

冲突不能由 Agent 静默合并。影响实现或验收的冲突必须形成结构化待确认事项。

## 6. 三种范围

为避免“只读文件”和“允许提交文件”混在同一个 `changed_files` 中，统一使用三种范围：

| 中文名 | 编码名 | 含义 |
|---|---|---|
| 检查范围 | `inspection_scope` | Agent 为完成任务可以读取和分析的范围 |
| 交付目标 | `delivery_targets` | 预计需要修改或新增的路径和产物 |
| 实际变更 | `observed_diff` | Core 从源码修订独立计算的真实变更 |

另有全局 `protected_paths`，仅表示项目统一保护策略。交接中的声明不能覆盖真实 diff，也不能把
未声明变更自动当成文件权限违规。范围差异首先是审计事实；是否阻止发布由明确规则决定。

## 7. 结构化交接

Agent 必须通过 `sdlc_handoff_submit` 提交，不再要求聊天最后一行输出裸 JSON。

建议请求：

```json
{
  "work_item_id": "WI-0001",
  "role": "sdlc-testing",
  "run_id": "RUN-0008",
  "summary": "完成设备接口功能测试",
  "observations": [
    {
      "kind": "test_issue",
      "severity": "high",
      "message": "必测场景被脚本标记为 skipped"
    }
  ],
  "declared_changed_paths": [
    "tests/functional/device-e2e.ts"
  ],
  "open_issues": [],
  "requested_follow_up": "implementation"
}
```

Core 校验身份和引用，随后独立计算源码修订、测试状态和门禁结果。聊天中的说明可以面向人类，
但不再承担机器协议。

## 8. 已知问题的责任归属

| 已知问题 | 直接责任模块 | 处理方式 |
|---|---|---|
| 明确修复反馈后仍先复验旧错误 | 专业编排包 + Core 动作前置条件 | 新反馈形成新事实，失效旧复验计划 |
| Tester 说明文字导致 JSON 解析失败 | 结构化交接工具 | 不解析聊天包装 |
| Tester 读写范围契约互相矛盾 | Agent 合同 + 范围模型 | 分离检查范围、交付目标和真实 diff |
| 必测项用 `skip + exit 0` 通过 | 执行器结果模型 + Core 门禁 | 原生四态，`skipped` 不满足必测项 |
| 原始需求被模型改写 | 宿主输入 Hook + Core | 模型前按原字节保存和计算哈希 |
| Spec 读取慢后增加固定次数门禁 | 运行分析器 | 做观测、基线和诊断，不限制正常读取 |

## 9. 设计检查

专业编排包必须满足：

- 替换 OpenCode 时，Core 的工作流合同不变；
- 替换模型时，结构化交接合同不变；
- 删除某个专家时，负责人仍能完成小任务；
- 禁用运行遥测时，交付门禁仍然正确；
- Agent 不能通过修改 JSON 状态伪造完成；
- Hook 失败会产生可诊断错误，但不会悄悄推进状态；
- 相同输入没有变化时，不重复启动昂贵专家检查。
