# OpenCode Host Adapter

独立 Node.js/TypeScript 进程模块。它是 Factory 合同与 `@opencode-ai/sdk` 之间的 Adapter；Spring Boot Java Core 不依赖 OpenCode SDK 类型。

模块提供两个窄接口：`OpenCodeHostAdapter.invoke` 封装 SDK 与 Session 生命周期；`factory-bridge` 从标准输入接收正式 `AgentInvocation` JSON，输出经过本地 JSON Schema 校验的 Handoff 与宿主用量。Java Core 通过受控子进程调用 Bridge，再持久化正式 `HostRunResult`。

当前固定版本与模型：

- OpenCode CLI/SDK：`1.18.14`；
- `model_ref`：`openai/gpt-5.6-luna#max`；
- Smoke 禁止工具调用，只验证本机凭据下的真实模型响应。

```powershell
pnpm install
pnpm test
pnpm smoke:model
```

本地控制平面的验收入口是 `POST /api/projects/{projectId}/host-acceptance`。它创建独立验收 Run，不推进 CODING Gate；成功条件是 AgentInvocation、Handoff 与 HostRunResult 在同一 Run 上形成完整关联。Handoff 的标识、Run 关联、角色和提交时间由 Adapter 覆盖为 Factory 事实，模型不能决定这些字段；未授权的变更路径或证据引用会使 Run 失败。

`cost_usd` 当前保存 OpenCode SDK 返回值；它不是账单证据，返回 `0` 时不得解释为已确认免费。
