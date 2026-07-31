# 附录 E：实施与验收

本附录把 1.0 拆成四个可独立验收的实施切片，不给出未经实现验证的工期承诺。

## E.1 Slice 0：合同

交付：

- 六份 JSON Schema；
- Project Profile 示例；
- fake frontend / backend Pack descriptor；
- Schema 解析测试。

退出条件：

- Schema 通过 Draft 2020-12 校验；
- 示例能够表达前端单模块和前后端组合；
- Agent Tool Schema 不包含需求发布和人工审核动作。

## E.2 Slice 1：Workflow Core

交付：

- WorkItem、TestBatch、Operation 状态和 Guard；
- JSON Workflow Index；
- `expectedVersion` 并发控制和原子文件替换；
- `sdlc_status`、`sdlc_transition`；
- 独立 Operator 发布和审核入口。

退出条件：

- Agent 不能发布 Requirement 或批准 Review；
- Requirement、Implementation、Review 可以独立查询；
- 多个 WorkItem 可以处于不同阶段；
- Requirement 或 Source Revision 变化会使 Review 和 TestBatch 失效。

## E.3 Slice 2：Framework 与 Runner

交付：

- Framework Pack Interface；
- Project Action Orchestrator；
- Runner timeout、cancel、Runtime Handle 和 Evidence；
- fake Pack TCK；
- `sdlc_execute`、`sdlc_operation_get`。

退出条件：

- 前端单模块完成 inspect/check/build/start/ready/stop；
- fake 前后端组合按 Profile 顺序启动并逆序停止；
- Skill/Agent 看不到框架命令；
- parser 故障分类为 `test_contract`；
- 已知进程树得到清理。

## E.4 Slice 3：真实项目闭环

交付：

- 一个由目标项目决定的真实 Framework Pack；
- 一个前端单模块项目；
- 一个前后端组合项目，后端可先使用 fake Pack；
- 包含多个 WorkItem 的真实 TestBatch。

退出条件：

- 两类 Project Profile 使用相同 Core Tool；
- TestBatch 固定所有 Verification Subject；
- 测试产生可定位 Evidence；
- 源码变化后旧 Passed 批次显示为 `stale`；
- 失败可以区分 product、specification、test_contract、infrastructure 和 environment。

## E.5 最小黑盒场景

| ID | 场景 | 预期 |
|---|---|---|
| V1-01 | 前端单模块执行 `project.start` | Core 调用 start、ready；返回 Runtime Handle |
| V1-02 | 前后端执行 `project.start/stop` | 按 Profile 启动并逆序停止 |
| V1-03 | Agent 请求发布需求 | Core 拒绝，状态不变 |
| V1-04 | 未发布需求开始实现 | Core 拒绝 |
| V1-05 | 完成实现但未提供 Source Revision | Core 拒绝 |
| V1-06 | Agent 请求批准 Review | Agent Tool Schema 无此动作 |
| V1-07 | TestBatch 包含未批准 WorkItem | Core 拒绝 |
| V1-08 | TestBatch 包含多个已批准 WorkItem | 创建成功并固定版本 |
| V1-09 | Passed 后源码变化 | 原 TestBatch 变为 `stale` |
| V1-10 | 测试断言失败 | `product`，Evidence 指向失败报告 |
| V1-11 | 测试 parser 失败 | `test_contract`，不要求修改业务代码 |
| V1-12 | Runner 超时 | Operation 失败，执行清理并保留 Evidence |
| V1-13 | Workflow Index version 冲突 | 后提交者被拒绝并重新读取 |
| V1-14 | Core 重启发现未知 running Operation | 标记 `interrupted`，不伪造完成 |

## E.6 停止条件

出现以下任一情况时停止扩展范围，先处理设计或实现问题：

- Pack 需要把框架专用字段暴露到 Agent Tool 才能工作；
- Review 或 TestBatch 无法绑定稳定 Source Revision；
- 前后端组合必须修改 Core 源码，而不能只调整 Project Profile 或 Pack；
- Framework Pack 或 Runner 可以绕过 Core 修改状态；
- 状态损坏后实现尝试猜测成功状态；
- 为通过场景开始引入 Supervisor、WAL、分布式锁或知识库。
