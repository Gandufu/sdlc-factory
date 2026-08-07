# MVP0 OpenCode Plugin 实施与验证计划

状态：用户已确认，执行中

日期：2026-08-07

## 目标

在 `D:\workspace\sdlc-factory` 实现可安装的 OpenCode 项目级 Plugin，并在
`D:\workspace\sdlc-test\sdlc-factory-mvp0-helicopter` 中，通过真实 OpenCode CLI 完成：

> 需求分析 → RequirementBaseline → 总体设计与 CU → DesignBaseline → ExecutionPlan → 逐 CU 编码与测试 → SystemAcceptanceBaseline

## 固定约束

- OpenCode、`@opencode-ai/plugin`、`@opencode-ai/sdk` 固定为 `1.18.14`。
- 使用 Node 22 和 `corepack pnpm@10.34.5`，不调用全局 pnpm。
- Factory Plugin 使用 TypeScript、ESM、Vitest 和 esbuild 单文件打包。
- OpenCode 负责目标项目业务代码；Codex 只开发 Plugin、调用 CLI、核验证据。
- 不使用 `sleep`、`--auto`、自动串联 Slash Command 或无边界重试。
- Plugin 只推荐一个动作、一个 Todo、一条完整命令；执行必须由用户再次显式输入。
- CU 使用用户可读名称作为命令参数，内部 `cu_id` 只用于持久化和追溯。
- MVP0 不实现 Electron Harness、Factory 会话管理、SQLite、遥测或多项目管理。

## 实施顺序

1. 建立独立 Plugin package、真实 OpenCode 兼容性门禁和可重复安装资源。
2. 以 TDD 实现路径、Hash、原子写入、Journal、来源快照、Candidate、ReviewRecord 和 Baseline。
3. 以 TDD 实现 CU、ExecutionPlan、RecommendedAction、Run、Evidence 和局部 `STALE` 传播。
4. 实现七个 `/sdlc-*` Commands、四个 Skills、一个打包后的项目级 Plugin 和安装/校验 CLI。
5. 从固定脚手架提交创建隔离目标，以 `C:\Users\gandaofu\Desktop\TEMP` 的受控资料完成需求与设计 Baseline。
6. 按批准后的 CU 名称逐一调用 OpenCode CLI 完成编码、测试、返工和系统验收。
7. 真实设备只使用 `SDLC_TEST_DEVICE_IP` 和 `SDLC_TEST_DEVICE_PASSWORD`；缺失凭据、连接或证书信任时明确标记未验证，不创建 SystemAcceptanceBaseline。
8. 全量验证后只提交本次相关 Factory 文件并推送当前 `main`；隔离目标项目不推送脚手架远端。

## 完成标准

- 确定性内核、安装器和 OpenCode 1.18.14 兼容性测试全部通过。
- 真实 CLI 流程包含候选退回、修订、批准、失败返工、局部失效和重启恢复。
- 目标项目全部 CU 具有当前有效 CodeBaseline 和 TestBaseline。
- Mock HTTPS 测试与真实设备证据分开记录；localhost 不计入真实设备验收。
- 密码和 Token 不进入源码、日志、Evidence、截图或 Git。
- 只有真实设备验收和人工审核都通过时才形成 SystemAcceptanceBaseline。
