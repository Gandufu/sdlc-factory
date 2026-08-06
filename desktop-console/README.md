# SDLC Factory Desktop Console

Electron Forge + React + Vite + TypeScript 的 M0 生产骨架。Renderer 通过 REST/SSE 读取 Spring Boot 控制平面；Electron Main 只负责安全窗口、最小 IPC 和 readiness 检查。

## 数据边界

- `/actuator/health`、`/api/capacity/board`、`/api/runs/events` 使用真实控制平面。
- Projects、Attention、Workspace 暂无后端查询合同，当前由 `src/renderer/data/fixtures.ts` 提供明确标注的 M0 演示快照。
- fixture 不会写入控制平面，也不能提交 Gate。接口冻结后应替换数据适配器，不应在页面组件中继续堆叠样例数据。

## 开发与验证

```powershell
pnpm install
pnpm start
pnpm verify
```

控制平面默认监听 `127.0.0.1:8420`。未启动时控制台会显示可恢复的未连接状态。
