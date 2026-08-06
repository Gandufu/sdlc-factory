# CU 规划、编码与测试

## 1. ExecutionPlan

ExecutionPlan 只从批准的 DesignBaseline 派生。一个正式 CU 对应一个顶层任务，计划记录：

- `cu_id`、名称和业务目标；
- DesignSliceManifest 与 Validation Assertion 引用；
- CU 依赖和同层优先级；
- `READY | RUNNING | WAITING_FOR_HUMAN | BLOCKED | COMPLETED` 投影；
- Coding/Testing Child Session 与当前执行引用。

CU 边界、数据归属和接口不由 Plan 重新决定。OpenCode Todo 只分解当前 CU 内部工作，不成为另一套 ExecutionPlan。

## 2. Coding Child Session

调度一个就绪 CU 时，从项目主 Session 创建 `CODING_CHILD`：

- 固定 RequirementBaseline、DesignBaseline、DesignSliceManifest 和 Validation Assertion；
- 启用 Coding Agent 与 `factory-coding`；
- 在 CU 授权工作区内使用 OpenCode 原生工具；
- 使用原生 Todo 拆分内部实现步骤；
- 结构化提交 Handoff，声明改动路径、验证和开放问题。

Factory 独立计算 Diff，Runner 执行 compile/build/lint/unit test，并产生 Evidence。全部切片和权威检查完成后进入 Code Gate；批准形成 CodeBaseline。

## 3. Testing Child Session

CodeBaseline 批准后创建独立 `TESTING_CHILD`，不复用 Coder 的自我判断：

- 读取 RequirementBaseline、DesignBaseline、ValidationContract 和 CodeBaseline；
- 启用 Testing Agent 与 `factory-testing`；
- 设计或补充必要测试并执行真实验证；
- 对每条 Validation Assertion 记录 `PASSED | FAILED | SKIPPED | BLOCKED`；
- 生成测试报告、Finding、环境快照和 Evidence。

必测项只有 `PASSED` 可以通过。测试 Agent 不能批准 Gate，也不能把失败直接改写为成功。

测试失败时，Finding 返回原 Coding Child Session 处理；修复产生新的代码候选和 CodeBaseline。随后创建新的 Testing Child Session 复验，历史测试会话保持只读。

## 4. ExecutionRun

Coding/Testing 内部需要实际修改工作区、调用模型或执行 Runner 时创建 ExecutionRun。每个 Run 固定：

- `project_id / cu_id / stage / slice_id`；
- 基线、Git base revision 和隔离工作区；
- Agent、Skill、Prompt、Rule、Model 和工具目录 Hash；
- 预算、权限、环境绑定和幂等键；
- Handoff、Diff、Operation、Evidence 和错误。

Run 是执行详情，不是项目主会话节点，也不因发送普通消息自动创建。MVP 串行调度，容量不足进入 `QUEUED_FOR_CAPACITY`，不算失败。

## 5. 系统集成与验收

只有发布范围内全部 CU 具有当前有效 CodeBaseline 和 TestBaseline，才能启动 System Integration。系统验收绑定精确 CU 基线、接口版本、环境和跨 CU 场景，人工批准后形成 SystemAcceptanceBaseline。

系统验收失败只对有 Evidence 关联的 CU 创建返工；其他 CU 的有效基线保持不变，但受影响范围必须重新完成集成和系统验收。
