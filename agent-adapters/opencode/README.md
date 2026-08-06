# OpenCode Host Adapter

独立 Node.js/TypeScript 进程模块。它是 Factory 合同与 `@opencode-ai/sdk` 之间的 Adapter；Spring Boot Java Core 不依赖 OpenCode SDK 类型。

首个切片提供一个深接口：`OpenCodeHostAdapter.invoke`。接口接收固定 `provider/model#variant` 的模型引用，模块内部负责启动本地 OpenCode Server、版本握手、Session、模型调用和清理。

当前固定版本与模型：

- OpenCode CLI/SDK：`1.18.14`；
- `model_ref`：`openai/gpt-5.6-luna#max`；
- Smoke 禁止工具调用，只验证本机凭据下的真实模型响应。

```powershell
pnpm install
pnpm test
pnpm smoke:model
```

此切片只返回 Adapter 内部的 `OpenCodeInvocationResult`，尚未接入 Spring Boot 的 Run 编排和持久化，也不冒充 Factory 正式 `HostRunResult`。下一步由控制平面通过 Factory 自有 `AgentInvocation` 合同启动该进程；只有结构化 Handoff 经本地 Schema 二次校验并持久化后，才能形成成功的 `HostRunResult`。
