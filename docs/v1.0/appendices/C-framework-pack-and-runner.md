# 附录 C：Framework Pack 与 Runner

本附录定义 Framework Pack、Project Profile、Project Action 和 Runner 的最小接口。

## C.1 两级能力

大模型调用 Project Action，Core 调用 Framework Capability：

```text
Agent: project.start
  → Core 读取 Project Profile
  → api.app.start
  → api.app.ready
  → web.app.start
  → web.app.ready
```

框架名称、argv、cwd、工具输出和 parser 都不会进入 Agent Tool Interface。

## C.2 Framework Pack Interface

每个 Pack Adapter 实现：

```text
describe()                         → CapabilityDescriptor[]
plan(capability, module, inputs)   → ExecutionPlan
interpret(raw_execution)           → CapabilityResult
```

职责：

- `describe` 声明实际支持的 Capability；
- `plan` 把标准 Capability 编译为声明式 Execution Plan；
- `interpret` 把 exit code、stdout、报告和 Runtime Handle 转为结构化结果；
- Pack 不执行状态转换，不产生人工决定，不写 Workflow Index。

Pack 目录可包含模板资产，但模板生成项目和运行 Capability 是两件事；Core 只依赖 Pack Interface。

## C.3 标准 Capability

| Capability | 含义 | 典型输出 |
|---|---|---|
| `project.inspect` | 识别模块是否满足 Pack 前置条件 | metadata / diagnostics |
| `dependencies.restore` | 恢复或安装依赖 | lockfile diagnostics |
| `code.check` | lint、typecheck 或等价静态检查 | report |
| `build.compile` | 编译可运行内容 | artifact refs |
| `package.build` | 生成可分发包 | package refs |
| `app.start` | 启动模块 | Runtime Handle |
| `app.ready` | 验证模块可以提供功能 | readiness Evidence |
| `app.stop` | 停止 Runtime Handle | cleanup Evidence |
| `test.run` | 按 `unit/integration/functional` 运行测试 | test report |

不是所有 Pack 都必须实现全部 Capability。Project Profile 引用不存在的能力时，`project.inspect` 必须失败。

`dependencies.restore` 和 `app.ready` 通常由 Core 作为其他 Project Action 的前置步骤调用，不需要直接暴露给 Agent。

## C.4 Project Action

Core 对外提供：

```text
project.inspect
project.check
project.build
project.start
project.stop
project.test
project.package
```

Project Profile 用有序 `steps` 把 Project Action 路由到模块 Capability。规则：

- `moduleId` 必须存在；
- Pack 必须声明对应 Capability；
- `app.stop` 使用 `app.start` 返回的 Runtime Handle；
- 启动失败时，Core 逆序停止已经启动的模块；
- 测试完成后，Core 必须执行 Profile 中声明的停止步骤；
- Project Action 的结果聚合所有步骤，不以最后一步掩盖前序失败。

前端单模块只需要一组步骤。前后端项目明确声明启动和停止顺序；Core 不推断技术栈依赖。

Project Profile Schema 见 [project-profile.schema.json](../contracts/project-profile.schema.json)。

## C.5 Execution Plan

Execution Plan 只包含 Runner 必须知道的内容：

```text
plan_id
operation_id
module_id
capability
argv[]
cwd
environment
timeout_seconds
expected_outputs[]
```

1.0 规则：

- `argv` 以数组传递，不拼接 shell 字符串；
- `cwd` 必须位于 Project root 内；
- 环境变量值由 Core 组装，Secret 在日志中脱敏；
- 超时后 Runner 停止整个已知进程树；
- `app.start` 成功时 Capability Result 返回 Runtime Handle；
- Parser 错误使用 `test_contract`，不得伪装为测试失败。

1.0 不规定网络、CPU、内存或容器隔离策略。

## C.6 Capability Result

Capability Result 包含：

```text
operation_id
module_id
capability
status
exit_code
runtime_handle?
diagnostics[]
evidence_refs[]
```

`status` 只表示本次能力执行结果。Core 再根据领域 Guard 决定 TestBatch 或 Operation 状态。

诊断分类必须保留 `product`、`specification`、`test_contract`、`infrastructure` 和 `environment`，定义见[附录 A](A-domain-and-lifecycle.md#a5-失败分类)。

## C.7 Runner 最小保证

Runner 必须：

- 不通过隐式 shell 解释 `argv`；
- 实施 timeout 和显式 cancel；
- 跟踪自己创建的进程；
- `app.stop` 后检查已知进程和临时端口；
- 将大日志写入 Evidence，而不是内嵌到 JSON 状态；
- 返回结构化 Capability Result。

Runner 不被视为 hostile-code sandbox。同一 OS 用户下恶意代码隔离不属于 1.0 保证。

## C.8 Pack TCK

每个 Pack 至少通过：

1. Descriptor 和 Schema 可解析；
2. `describe` 与实际可规划能力一致；
3. Execution Plan 不越出 Project root；
4. timeout 返回结构化失败；
5. `app.start → app.ready → app.stop` 无已知 orphan；
6. test report 可以解析为 Capability Result；
7. parser 故障分类为 `test_contract`；
8. 不直接修改 `.sdlc/index/**`。

组合能力使用 fake frontend Pack 和 fake backend Pack 验证；首个真实 Pack 由第一个目标项目的技术栈决定，不在架构阶段强制绑定 Electron。
